import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { getWalletSummary } from '../../../../../src/utils/wallet-balance';
import type { WalletBalances } from '../../../../../src/types/beta1-wallet';

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

     
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? '';

    let query = db.collection('users').orderBy('pointBalance', 'desc').limit(50);
    const snap = await query.get();

    const userIds = snap.docs.map((doc: any) => doc.id);
    
    // Fetch wallet ledgers for these users
    const ledgersSnap = userIds.length > 0 
      ? await db.collection('wallet_ledgers').where('userId', 'in', userIds).get()
      : { docs: [] };
      
    const ledgersMap = new Map(ledgersSnap.docs.map((d: any) => [d.data().userId, d.data()]));

    let items = snap.docs.map((doc: any) => {
      const userData = doc.data();
      const ledger: any = ledgersMap.get(doc.id);
      
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
      
      const summary = getWalletSummary(balances as unknown as WalletBalances);

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
        (u: any) => u.displayName.includes(search) || u.email.includes(search) || u.id.includes(search)
      );
    }

    return NextResponse.json({ items });
  } catch (error: unknown) {
    console.error('Points GET error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, type, amount, reason, fundingSource = 'promo' } = await req.json();
  if (!userId || !type || !amount || !reason) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

   
  
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

  const oldSummary = getWalletSummary(currentBalances as unknown as WalletBalances);
  const requestedDelta = type === 'earn' ? Number(amount) : -Number(amount);

  // 3. Apply changes to the specific funding source
  const newBalances = { ...currentBalances };
  let actualDelta = 0;

  if (fundingSource === 'charge') {
    newBalances.chargeBalance = Math.max(0, currentBalances.chargeBalance + requestedDelta);
    actualDelta = newBalances.chargeBalance - currentBalances.chargeBalance;
  } else if (fundingSource === 'earned') {
    newBalances.earnedBalance = Math.max(0, currentBalances.earnedBalance + requestedDelta);
    actualDelta = newBalances.earnedBalance - currentBalances.earnedBalance;
  } else {
    newBalances.promoBalance = Math.max(0, currentBalances.promoBalance + requestedDelta);
    actualDelta = newBalances.promoBalance - currentBalances.promoBalance;
  }

  const newSummary = getWalletSummary(newBalances as unknown as WalletBalances);
  const now = new Date();

  // 4. Batch write to both users and wallet_ledgers to maintain backward compatibility
  const batch = db.batch();

  const totalUpdate: Record<string, any> = { 
    pointBalance: newSummary.totalUsableBalance, // Keep legacy pointBalance synced
    walletBalances: newBalances,
    updatedAt: now 
  };
  
  if (type === 'earn') {
    totalUpdate.totalEarnedPoints = (userData.totalEarnedPoints ?? 0) + actualDelta;
  } else {
    totalUpdate.totalSpentPoints = (userData.totalSpentPoints ?? 0) + Math.abs(actualDelta);
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
    amount: actualDelta,
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
    amount: actualDelta,
    balanceBefore: oldSummary,
    balanceAfter: newSummary,
    description: `관리자 수동 조정: ${reason}`,
    createdAt: now,
  });

  await batch.commit();

  return NextResponse.json({ ok: true, newBalance: newSummary.totalUsableBalance });
  } catch (error: unknown) {
    console.error('Point adjustment failed:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
