import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { readAccountLast4, readMaskedAccountNumber } from '../../../../../shared/bank-account';

import { getWalletSummary } from '../../../../../src/utils/wallet-balance';

type UnknownRecord = Record<string, unknown>;

function readBankSnapshot(data: UnknownRecord) {
  const integrationSnapshot =
    typeof data.integrationSnapshot === 'object' && data.integrationSnapshot !== null
      ? (data.integrationSnapshot as UnknownRecord)
      : {};
  const bank =
    typeof integrationSnapshot.bank === 'object' && integrationSnapshot.bank !== null
      ? (integrationSnapshot.bank as UnknownRecord)
      : {};

  return {
    bankTestMode: Boolean(bank.testMode ?? false),
    bankLiveReady: Boolean(bank.liveReady ?? false),
    bankProvider: typeof bank.provider === 'string' ? bank.provider : null,
    bankVerificationMode: typeof bank.verificationMode === 'string' ? bank.verificationMode : null,
    requiresAccountHolderMatch: Boolean(bank.requiresAccountHolderMatch ?? false),
    manualReviewFallback: Boolean(bank.manualReviewFallback ?? true),
  };
}

function readUserVerification(user: UnknownRecord | null) {
  const gillerInfo =
    user && typeof user.gillerInfo === 'object' && user.gillerInfo !== null
      ? (user.gillerInfo as UnknownRecord)
      : {};
  const bankAccount =
    typeof gillerInfo.bankAccount === 'object' && gillerInfo.bankAccount !== null
      ? (gillerInfo.bankAccount as UnknownRecord)
      : {};

  const identityVerificationStatus =
    typeof gillerInfo.identityVerificationStatus === 'string'
      ? gillerInfo.identityVerificationStatus
      : user?.isVerified
        ? 'approved'
        : 'not_submitted';

  const bankVerificationStatus =
    typeof bankAccount.verificationStatus === 'string'
      ? bankAccount.verificationStatus
      : 'not_submitted';

  const gillerApplicationStatus =
    typeof user?.gillerApplicationStatus === 'string' ? user.gillerApplicationStatus : 'none';

  return {
    identityVerificationStatus,
    bankVerificationStatus,
    gillerApplicationStatus,
  };
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  try {
    let withdrawalsDocs: any[] = [];
    
    try {
      const snap = await db.collection('withdraw_requests')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .get();
      withdrawalsDocs = snap.docs;
    } catch (dbError: any) {
      const isIndexError = dbError.code === 9 || 
                          dbError.message?.includes('requires an index') || 
                          (dbError.message?.includes('FAILED_PRECONDITION') && dbError.message?.includes('index'));
                          
      if (isIndexError) {
        console.warn('Withdrawals API: Missing index for status + createdAt, falling back to client-side sort');
        const fallbackSnap = await db.collection('withdraw_requests')
          .where('status', '==', status)
          .get();
          
        withdrawalsDocs = fallbackSnap.docs.sort((a, b) => {
          const timeA = a.data().createdAt ? new Date(a.data().createdAt.toDate?.() || a.data().createdAt).getTime() : 0;
          const timeB = b.data().createdAt ? new Date(b.data().createdAt.toDate?.() || b.data().createdAt).getTime() : 0;
          return timeB - timeA;
        });
      } else {
        throw dbError;
      }
    }

    const bankConfigSnap = await db.collection('config_integrations').doc('bank').get();

    const userIds = new Set<string>();
    withdrawalsDocs.forEach((doc) => {
      const data = doc.data() as UnknownRecord;
      if (typeof data.userId === 'string' && data.userId) userIds.add(data.userId);
    });

    const userEntries = await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const userSnap = await db.collection('users').doc(userId).get();
        return [userId, userSnap.exists ? ((userSnap.data() as UnknownRecord) ?? {}) : null] as const;
      })
    );
    const userMap = new Map(userEntries);

    const bankConfig = bankConfigSnap.exists ? ((bankConfigSnap.data() as UnknownRecord) ?? {}) : {};
    const items = withdrawalsDocs.map((doc) => {
      const data = doc.data() as UnknownRecord;
      const user = typeof data.userId === 'string' ? userMap.get(data.userId) ?? null : null;
      const bankSnapshot = readBankSnapshot(data);
      const verification = readUserVerification(user);

      return {
        id: doc.id,
        ...data,
        accountNumberMasked:
          typeof data.accountNumberMasked === 'string'
            ? data.accountNumberMasked
            : readMaskedAccountNumber(data),
        accountLast4:
          typeof data.accountLast4 === 'string' ? data.accountLast4 : readAccountLast4(data),
        ...bankSnapshot,
        ...verification,
        reviewChecklist: {
          identityReady:
            verification.identityVerificationStatus === 'approved' || verification.identityVerificationStatus === 'approved_test_bypass',
          bankReady:
            verification.bankVerificationStatus === 'verified' ||
            verification.bankVerificationStatus === 'approved' ||
            verification.bankVerificationStatus === 'approved_test_bypass',
          gillerApproved: verification.gillerApplicationStatus === 'approved',
          liveTransferReady: Boolean(bankConfig.liveReady ?? false),
          manualReviewRequired:
            (bankSnapshot.manualReviewFallback ?? true) || !(bankConfig.liveReady ?? false),
        },
        bankConfigLiveReady: Boolean(bankConfig.liveReady ?? false),
        bankConfigTestMode: Boolean(bankConfig.testMode ?? true),
        bankConfigStatusMessage:
          typeof bankConfig.statusMessage === 'string'
            ? bankConfig.statusMessage
            : '계좌 인증 API 준비 전에는 운영 수동 검토를 함께 진행합니다.',
      };
    });

    return NextResponse.json({
      items,
      integration: {
        liveReady: Boolean(bankConfig.liveReady ?? false),
        testMode: Boolean(bankConfig.testMode ?? true),
        statusMessage:
          typeof bankConfig.statusMessage === 'string'
            ? bankConfig.statusMessage
            : '계좌 인증 API 준비 전에는 운영 수동 검토를 함께 진행합니다.',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch withdrawals:', error);
    
    return NextResponse.json(
      { error: '데이터를 불러오는데 실패했습니다.', details: error.message }, 
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    requestId,
    action,
    note,
    reviewChecklist,
  } = (await req.json()) as {
    requestId?: string;
    action?: 'approve' | 'reject';
    note?: string;
    reviewChecklist?: Record<string, unknown>;
  };

  if (!requestId || !action) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.collection('withdraw_requests').doc(requestId);
  
  try {
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        throw new Error('Not found');
      }

      const current = (snap.data() as UnknownRecord) ?? {};
      if (current.status !== 'pending') {
        throw new Error('Request is not in pending status');
      }

      const newStatus = action === 'approve' ? 'completed' : 'rejected';
      const userId = typeof current.userId === 'string' ? current.userId : '';
      const amount = typeof current.amount === 'number' ? current.amount : 0;
      
      // 승인/반려 시 Wallet Ledger 처리
      if (userId && amount > 0) {
        const userRef = db.collection('users').doc(userId);
        const ledgerRef = db.collection('wallet_ledgers').doc(userId);

        const [userSnap, ledgerSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(ledgerRef)
        ]);

        if (userSnap.exists) {
          const userData = (userSnap.data() as UnknownRecord) ?? {};
          const ledgerData = ledgerSnap.exists ? (ledgerSnap.data() as UnknownRecord) : null;

          const rawBalances = (ledgerData?.balances as Record<string, any>) ?? (userData.walletBalances as Record<string, any>) ?? {};
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
          const newBalances = { ...currentBalances };

          if (action === 'approve') {
            // 승인: 대기 중인 출금액을 완전히 차감
            newBalances.pendingWithdrawalBalance = Math.max(0, currentBalances.pendingWithdrawalBalance - amount);
          } else if (action === 'reject') {
            // 반려: 대기 중인 출금액을 다시 정산금으로 원복
            newBalances.pendingWithdrawalBalance = Math.max(0, currentBalances.pendingWithdrawalBalance - amount);
            newBalances.earnedBalance += amount;
          }

          const newSummary = getWalletSummary(newBalances as any);
          const now = new Date();

          // 1. 유저 업데이트 (Legacy fallback)
          transaction.update(userRef, {
            pointBalance: newSummary.totalUsableBalance,
            walletBalances: newBalances,
            totalSpentPoints: action === 'reject' ? Math.max(0, Number(userData.totalSpentPoints ?? 0) - amount) : userData.totalSpentPoints,
            updatedAt: now,
          });

          // 2. 렛저 업데이트
          transaction.set(ledgerRef, {
            userId,
            balances: newBalances,
            summary: newSummary,
            updatedAt: now,
          }, { merge: true });

          // 3. 로그 남기기
          const description = action === 'approve' ? '출금 완료 (대기 금액 차감)' : `출금 반려 환급 (${note ?? '사유 없음'})`;
          
          // Legacy Transaction
          if (action === 'reject') {
            const txRef = db.collection('point_transactions').doc();
            transaction.set(txRef, {
              userId,
              amount,
              type: 'earn',
              category: 'withdraw_rejected',
              description,
              balanceBefore: oldSummary.totalUsableBalance,
              balanceAfter: newSummary.totalUsableBalance,
              status: 'completed',
              relatedRequestId: requestId,
              createdAt: now,
              completedAt: now,
            });
          }

          // Wallet Entry
          const entryRef = db.collection('wallet_entries').doc();
          transaction.set(entryRef, {
            walletLedgerId: userId,
            userId,
            type: action === 'approve' ? 'withdraw_completed' : 'withdraw_rejected',
            fundingSource: 'earned',
            amount: action === 'approve' ? 0 : amount, // For approve, the usable balance doesn't change here, only pending shrinks.
            balanceBefore: oldSummary,
            balanceAfter: newSummary,
            description,
            metadata: { relatedRequestId: requestId },
            createdAt: now,
          });
        }
      }

      transaction.update(ref, {
        status: newStatus,
        adminNote: note ?? '',
        processedAt: new Date(),
        processedContext: {
          bankVerificationStatus:
            typeof current.bankVerificationStatus === 'string'
              ? current.bankVerificationStatus
              : 'manual_review',
          integrationSnapshot: current.integrationSnapshot ?? null,
          reviewChecklist: reviewChecklist ?? null,
        },
      });
    });

    const newStatus = action === 'approve' ? 'completed' : 'rejected';
    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error: any) {
    if (error.message === 'Not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (error.message === 'Request is not in pending status') {
      return NextResponse.json({ error: 'Request is not in pending status' }, { status: 400 });
    }
    console.error('Withdrawal patch transaction failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
