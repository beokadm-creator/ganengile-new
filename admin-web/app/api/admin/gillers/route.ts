import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { readAccountLast4, readMaskedAccountNumber } from '../../../../../shared/bank-account';

const STATUS_ALIAS: Record<string, string[]> = {
  pending: ['pending', 'submitted', 'new'],
  in_review: ['in_review', 'reviewing', 'under_review'],
  approved: ['approved'],
  rejected: ['rejected', 'denied'],
};

function normalizeStatus(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (!value) return 'pending';
  if (STATUS_ALIAS.pending.includes(value)) return 'pending';
  if (STATUS_ALIAS.in_review.includes(value)) return 'in_review';
  if (STATUS_ALIAS.approved.includes(value)) return 'approved';
  if (STATUS_ALIAS.rejected.includes(value)) return 'rejected';
  return value;
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as { seconds?: number }).seconds === 'number') {
    return ((value as { seconds: number }).seconds) * 1000;
  }
  if (typeof value === 'object' && value !== null && '_seconds' in value && typeof (value as { _seconds?: number })._seconds === 'number') {
    return ((value as { _seconds: number })._seconds) * 1000;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getIntegrationFlags(data: Record<string, unknown>) {
  const integrationSnapshot =
    typeof data.integrationSnapshot === 'object' && data.integrationSnapshot !== null
      ? (data.integrationSnapshot as Record<string, unknown>)
      : {};
  const identity =
    typeof integrationSnapshot.identity === 'object' && integrationSnapshot.identity !== null
      ? (integrationSnapshot.identity as Record<string, unknown>)
      : {};
  const bank =
    typeof integrationSnapshot.bank === 'object' && integrationSnapshot.bank !== null
      ? (integrationSnapshot.bank as Record<string, unknown>)
      : {};
  const bankAccount =
    typeof data.bankAccount === 'object' && data.bankAccount !== null
      ? (data.bankAccount as Record<string, unknown>)
      : {};

  return {
    identityTestMode: Boolean(identity.testMode ?? false),
    identityLiveReady: Boolean(identity.liveReady ?? false),
    bankTestMode: Boolean(bank.testMode ?? false),
    bankLiveReady: Boolean(bank.liveReady ?? false),
    bankProvider: typeof bank.provider === 'string' ? bank.provider : null,
    bankVerificationMode:
      typeof bank.verificationMode === 'string' ? bank.verificationMode : null,
    bankVerificationStatus:
      typeof bankAccount.verificationStatus === 'string'
        ? bankAccount.verificationStatus
        : null,
    bankAccountMasked: readMaskedAccountNumber(bankAccount),
    bankAccountLast4: readAccountLast4(bankAccount),
  };
}

interface GillerApplicationItem {
  id: string;
  userId?: string;
  userName?: string;
  phone?: string;
  verificationStatus?: string;
  status: string;
  createdAt?: unknown;
  isSynthetic?: boolean;
  identityTestMode: boolean;
  identityLiveReady: boolean;
  bankTestMode: boolean;
  bankLiveReady: boolean;
  bankProvider: string | null;
  bankVerificationMode: string | null;
  bankVerificationStatus: string | null;
  bankAccountMasked: string;
  bankAccountLast4: string;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'pending';
    const aliases = STATUS_ALIAS[status] ?? [status];

    const snap = await db.collection('giller_applications').limit(500).get();

    const appItems: GillerApplicationItem[] = snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        ...data,
        ...getIntegrationFlags(data),
        status: normalizeStatus(data.status),
      };
    });

    const pendingUsersSnap = await db
      .collection('users')
      .where('gillerApplicationStatus', '==', 'pending')
      .limit(200)
      .get();

    const existingUserIds = new Set(
      appItems.map((item) => String(item.userId ?? item.id ?? ''))
    );

    const fallbackItems = pendingUsersSnap.docs
      .map((doc) => {
        const user = doc.data() as Record<string, unknown>;
        return {
          id: `user-${doc.id}`,
          userId: doc.id,
          userName: typeof user.name === 'string' ? user.name : '',
          phone: typeof user.phoneNumber === 'string' ? user.phoneNumber : '',
          verificationStatus: user.isVerified ? 'approved' : 'not_submitted',
          identityTestMode: false,
          identityLiveReady: false,
          bankTestMode: true,
          bankLiveReady: false,
          bankProvider: null,
          bankVerificationMode: null,
          bankVerificationStatus: null,
          status: 'pending',
          createdAt: user.updatedAt ?? user.createdAt ?? new Date(),
          isSynthetic: true,
        };
      })
      .filter((user) => !existingUserIds.has(String(user.userId)));

    const items = [...appItems, ...fallbackItems]
      .filter((item) => aliases.includes(String(item.status ?? 'pending')))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return NextResponse.json({ items });
  } catch (error: unknown) {
    console.error('[admin/gillers][GET] failed:', error);
    return NextResponse.json(
      {
        error: '길러 승급 요청 목록 조회 중 오류가 발생했습니다.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    applicationId?: string;
    action?: 'approve' | 'reject' | 'review';
    note?: string;
  };

  if (!body.applicationId || !body.action) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.collection('giller_applications').doc(body.applicationId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const newStatus =
    body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : 'in_review';

  const data = snap.data() as Record<string, unknown>;
  let verificationStatus =
    typeof data.verificationStatus === 'string' ? data.verificationStatus : undefined;
  if (!verificationStatus && typeof data.userId === 'string') {
    const verificationSnap = await db
      .collection('users')
      .doc(data.userId)
      .collection('verification')
      .doc(data.userId)
      .get();
    verificationStatus = verificationSnap.exists
      ? (verificationSnap.data()?.status as string | undefined)
      : undefined;
  }

  const isVerificationApproved =
    verificationStatus === 'approved' || verificationStatus === 'approved_test_bypass';

  if (body.action === 'approve' && !isVerificationApproved) {
    return NextResponse.json(
      { error: '본인확인 완료 상태가 아니어서 승인할 수 없습니다.' },
      { status: 400 }
    );
  }

  await ref.update({
    status: newStatus,
    adminNote: body.note ?? '',
    reviewedAt: new Date(),
  });

  if (body.action === 'approve' && typeof data.userId === 'string') {
    const userRef = db.collection('users').doc(data.userId);
    const userSnap = await userRef.get();
    const currentRole = userSnap.exists ? (userSnap.data()?.role as string | undefined) : undefined;
    const nextRole = currentRole === 'giller' ? 'giller' : 'both';
    const bankAccount =
      (data.bankAccount as Record<string, unknown> | undefined) ??
      ((typeof data.gillerInfo === 'object' && data.gillerInfo !== null
        ? (data.gillerInfo as Record<string, unknown>).bankAccount
        : null) as Record<string, unknown> | null) ??
      (data.bank_account as Record<string, unknown> | undefined) ??
      null;

    await userRef.update({
      role: nextRole,
      isGiller: true,
      gillerApplicationStatus: 'approved',
      gillerApprovedAt: new Date(),
      ...(bankAccount ? { 'gillerInfo.bankAccount': bankAccount } : {}),
      updatedAt: new Date(),
    });

    if (bankAccount) {
      await db
        .collection('users')
        .doc(data.userId)
        .collection('profile')
        .doc(data.userId)
        .set(
          {
            bankAccount,
            updatedAt: new Date(),
          },
          { merge: true }
        );
    }
  } else if (body.action === 'reject' && typeof data.userId === 'string') {
    await db.collection('users').doc(data.userId).update({
      gillerApplicationStatus: 'rejected',
      updatedAt: new Date(),
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
