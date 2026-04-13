import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { getWalletSummary } from '../../../../../src/utils/wallet-balance';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';

  let query = db.collection('users').orderBy('pointBalance', 'desc').limit(50);
  const snap = await query.get();

  const userIds = snap.docs.map((doc) => doc.id);
  
  // Fetch wallet ledgers for these users
  const ledgersSnap = userIds.length > 0 
    ? await db.collection('wallet_ledgers').where('userId', 'in', userIds).get()
    : { docs: [] };
    
  const ledgersMap = new Map(ledgersSnap.docs.map((d) => [d.data().userId, d.data()]));

  let items = snap.docs.map((doc) => {
    const userData = doc.data();
    const ledger = ledgersMap.get(doc.id);
    
    // Fallback logic similar to normalizeWalletBalances
    const rawBalances = ledger?.balances ?? userData.walletBalances ?? {};
    const balances = {
      chargeBalance: Number(rawBalances.chargeBalance ?? 0),
      earnedBalance: Number(rawBalances.earnedBalance ?? userData.pointBalance ?? 0),
      promoBalance: Number(rawBalances.promoBalance ?? 0),
      lockedChargeBalance: Number(rawBalances.lockedChargeBalance ?? 0),
      lockedEarnedBalance: Number(rawBalances.lockedEarnedBalance ?? 0),
      lockedPromoBalance: Number(rawBalances.lockedPromoBalance ?? 0),
      pendingWithdrawalBalance: Number(rawBalances.pendingWithdrawalBalance ?? 0),
    };
    
    const summary = getWalletSummary(balances as any);

    return {
      id: doc.id,
      displayName: userData.displayName ?? userData.name ?? '(이름없음)',
      email: userData.email ?? '',
      pointBalance: summary.totalUsableBalance, // Show total usable balance as main balance
      withdrawableBalance: summary.withdrawableBalance,
      balances: {
        charge: balances.chargeBalance,
        earned: balances.earnedBalance,
        promo: balances.promoBalance,
      },
      totalEarnedPoints: userData.totalEarnedPoints ?? 0,
      totalSpentPoints: userData.totalSpentPoints ?? 0,
      updatedAt: ledger?.updatedAt?.toDate() ?? userData.updatedAt?.toDate() ?? null,
    };
  });

  if (search) {
    items = items.filter(
      (u) => u.displayName.includes(search) || u.email.includes(search) || u.id.includes(search)
    );
  }

  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, type, amount, reason, fundingSource = 'promo' } = await req.json();
  if (!userId || !type || !amount || !reason) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = getAdminDb();
  
  // 1. User & Ledger Reference
  const userRef = db.collection('users').doc(userId);
  const ledgerRef = db.collection('wallet_ledgers').doc(userId);

  const [userSnap, ledgerSnap] = await Promise.all([userRef.get(), ledgerRef.get()]);
  if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const userData = userSnap.data() || {};
  const ledgerData = ledgerSnap.exists ? ledgerSnap.data() : null;

  // 2. Parse current balances (Fallback to user.pointBalance if no ledger)
  const rawBalances = ledgerData?.balances ?? userData.walletBalances ?? {};
  const currentBalances = {
    chargeBalance: Number(rawBalances.chargeBalance ?? 0),
    earnedBalance: Number(rawBalances.earnedBalance ?? userData.pointBalance ?? 0),
    promoBalance: Number(rawBalances.promoBalance ?? 0),
    lockedChargeBalance: Number(rawBalances.lockedChargeBalance ?? 0),
    lockedEarnedBalance: Number(rawBalances.lockedEarnedBalance ?? 0),
    lockedPromoBalance: Number(rawBalances.lockedPromoBalance ?? 0),
    pendingWithdrawalBalance: Number(rawBalances.pendingWithdrawalBalance ?? 0),
  };

  const oldSummary = getWalletSummary(currentBalances as any);
  const delta = type === 'earn' ? Number(amount) : -Number(amount);

  // 3. Apply changes to the specific funding source
  const newBalances = { ...currentBalances };
  if (fundingSource === 'charge') {
    newBalances.chargeBalance = Math.max(0, currentBalances.chargeBalance + delta);
  } else if (fundingSource === 'earned') {
    newBalances.earnedBalance = Math.max(0, currentBalances.earnedBalance + delta);
  } else {
    newBalances.promoBalance = Math.max(0, currentBalances.promoBalance + delta);
  }

  const newSummary = getWalletSummary(newBalances as any);
  const now = new Date();

  // 4. Batch write to both users and wallet_ledgers to maintain backward compatibility
  const batch = db.batch();

  const totalUpdate: Record<string, any> = { 
    pointBalance: newSummary.totalUsableBalance, // Keep legacy pointBalance synced
    walletBalances: newBalances,
    updatedAt: now 
  };
  
  if (type === 'earn') {
    totalUpdate.totalEarnedPoints = (userData.totalEarnedPoints ?? 0) + Number(amount);
  } else {
    totalUpdate.totalSpentPoints = (userData.totalSpentPoints ?? 0) + Number(amount);
  }
  
  batch.update(userRef, totalUpdate);

  const ledgerUpdate = {
    userId,
    balances: newBalances,
    summary: newSummary,
    updatedAt: now,
  };
  batch.set(ledgerRef, ledgerUpdate, { merge: true });

  // 5. Add Legacy Transaction Log
  batch.set(db.collection('point_transactions').doc(), {
    userId,
    amount: delta,
    type: type === 'earn' ? 'earn' : 'spend',
    category: 'admin_adjustment',
    description: `관리자 수동 조정 (${fundingSource}): ${reason}`,
    balanceBefore: oldSummary.totalUsableBalance,
    balanceAfter: newSummary.totalUsableBalance,
    status: 'completed',
    createdAt: now,
    completedAt: now,
  });

  // 6. Add New Wallet Entry Log
  batch.set(db.collection('wallet_entries').doc(), {
    walletLedgerId: userId,
    userId,
    type: 'adjustment',
    fundingSource: fundingSource,
    amount: delta,
    balanceBefore: oldSummary,
    balanceAfter: newSummary,
    description: `관리자 수동 조정: ${reason}`,
    createdAt: now,
  });

  await batch.commit();

  return NextResponse.json({ ok: true, newBalance: newSummary.totalUsableBalance });
}
