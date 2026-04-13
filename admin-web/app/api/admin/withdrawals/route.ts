import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { readAccountLast4, readMaskedAccountNumber } from '../../../../../shared/bank-account';

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
      
      // 승인인 경우 (자동 송금 연동은 별도의 Payout API 호출 필요, 여기서는 DB 상태만 안전하게 트랜잭션 처리)
      if (action === 'approve') {
        // TODO: executeTossPayout 연동 (현재는 Firebase Functions의 서비스이므로 직접 호출은 생략하고 상태만 업데이트)
        // 만약 여기서 fetch로 펌뱅킹 API를 호출한다면, 그 전에 반드시 상태를 processing으로 변경해야 함
      }

      // 반려인 경우 포인트 환불을 동일 트랜잭션 내에서 처리
      if (action === 'reject' && userId && amount > 0) {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        
        if (userSnap.exists) {
          const currentBalance = Number(userSnap.data()?.pointBalance ?? 0);
          const currentSpent = Number(userSnap.data()?.totalSpentPoints ?? 0);
          
          transaction.update(userRef, {
            pointBalance: currentBalance + amount,
            totalSpentPoints: Math.max(0, currentSpent - amount),
          });

          const txRef = db.collection('point_transactions').doc();
          transaction.set(txRef, {
            userId,
            amount,
            type: 'earn',
            category: 'withdraw_rejected',
            description: `출금 반려 환급 (${note ?? '사유 없음'})`,
            balanceBefore: currentBalance,
            balanceAfter: currentBalance + amount,
            status: 'completed',
            relatedRequestId: requestId,
            createdAt: new Date(),
            completedAt: new Date(),
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
