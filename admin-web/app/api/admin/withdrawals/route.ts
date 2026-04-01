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

  const [withdrawalsSnap, bankConfigSnap] = await Promise.all([
    db.collection('withdraw_requests').where('status', '==', status).orderBy('createdAt', 'desc').get(),
    db.collection('config_integrations').doc('bank').get(),
  ]);

  const userIds = new Set<string>();
  withdrawalsSnap.docs.forEach((doc) => {
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
  const items = withdrawalsSnap.docs.map((doc) => {
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
          verification.identityVerificationStatus === 'approved' ||
          verification.identityVerificationStatus === 'approved_test_bypass',
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
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const current = (snap.data() as UnknownRecord) ?? {};
  const newStatus = action === 'approve' ? 'completed' : 'rejected';

  await ref.update({
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

  if (action === 'reject') {
    const userId = typeof current.userId === 'string' ? current.userId : '';
    const amount = typeof current.amount === 'number' ? current.amount : 0;
    if (userId && amount > 0) {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const currentBalance = Number(userSnap.data()?.pointBalance ?? 0);
        const currentSpent = Number(userSnap.data()?.totalSpentPoints ?? 0);
        await userRef.update({
          pointBalance: currentBalance + amount,
          totalSpentPoints: Math.max(0, currentSpent - amount),
        });
        await db.collection('point_transactions').add({
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
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
