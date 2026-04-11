import { NextRequest, NextResponse } from 'next/server';
import type {
  DocumentData,
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

type UserDoc = DocumentData & {
  name?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  isActive?: boolean;
  isVerified?: boolean;
  pointBalance?: number;
  gillerApplicationStatus?: string;
  createdAt?: unknown;
  gillerInfo?: {
    identityVerificationStatus?: string;
    bankAccount?: {
      bankCode?: string;
      accountNumberMasked?: string;
      accountNumber?: string;
      verificationStatus?: string;
    };
  };
};

function getIdentityStatus(data: UserDoc): string {
  if (typeof data.gillerInfo?.identityVerificationStatus === 'string') {
    return data.gillerInfo.identityVerificationStatus;
  }

  return data.isVerified ? 'approved' : 'not_submitted';
}

function getBankStatus(data: UserDoc): string {
  return typeof data.gillerInfo?.bankAccount?.verificationStatus === 'string'
    ? data.gillerInfo.bankAccount.verificationStatus
    : 'not_submitted';
}

function getOnboardingStage(data: UserDoc) {
  const applicationStatus =
    typeof data.gillerApplicationStatus === 'string' ? data.gillerApplicationStatus : 'none';
  const identityStatus = getIdentityStatus(data);
  const bankStatus = getBankStatus(data);
  const isIdentityApproved =
    identityStatus === 'approved' || identityStatus === 'approved_test_bypass';
  const isBankApproved =
    bankStatus === 'approved' || bankStatus === 'approved_test_bypass' || bankStatus === 'verified';

  if (applicationStatus === 'approved') return '길러 활성';
  if (applicationStatus === 'pending') return '길러 심사 대기';
  if (isIdentityApproved && isBankApproved) return '승급 준비 완료';
  if (isIdentityApproved) return '계좌 인증 대기';
  return '본인 확인 대기';
}

function toUserItem(doc: QueryDocumentSnapshot<UserDoc>) {
  const data = doc.data();
  const bankAccount = data.gillerInfo?.bankAccount;
  const identityStatus = getIdentityStatus(data);
  const bankStatus = getBankStatus(data);

  return {
    id: doc.id,
    name:
      typeof data.name === 'string'
        ? data.name
        : typeof data.displayName === 'string'
          ? data.displayName
          : '(이름 없음)',
    email: typeof data.email === 'string' ? data.email : '',
    phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : '',
    role: typeof data.role === 'string' ? data.role : '',
    isActive: Boolean(data.isActive ?? true),
    isVerified: Boolean(data.isVerified ?? false),
    pointBalance: typeof data.pointBalance === 'number' ? data.pointBalance : 0,
    gillerApplicationStatus:
      typeof data.gillerApplicationStatus === 'string' ? data.gillerApplicationStatus : null,
    identityVerificationStatus: identityStatus,
    bankVerificationStatus: bankStatus,
    bankCode: typeof bankAccount?.bankCode === 'string' ? bankAccount.bankCode : '',
    accountNumberMasked:
      typeof bankAccount?.accountNumberMasked === 'string'
        ? bankAccount.accountNumberMasked
        : typeof bankAccount?.accountNumber === 'string'
          ? bankAccount.accountNumber.replace(/.(?=.{4})/g, '*')
          : '',
    onboardingStage: getOnboardingStage(data),
    createdAt: data.createdAt ?? null,
  };
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db: Firestore = getAdminDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const role = searchParams.get('role') ?? '';

  let query: Query<UserDoc> = db
    .collection('users')
    .withConverter<UserDoc>({
      toFirestore: (data) => data,
      fromFirestore: (snapshot) => snapshot.data() as UserDoc,
    })
    .orderBy('createdAt', 'desc')
    .limit(100);

  if (role) {
    query = db
      .collection('users')
      .withConverter<UserDoc>({
        toFirestore: (data) => data,
        fromFirestore: (snapshot) => snapshot.data() as UserDoc,
      })
      .where('role', '==', role)
      .orderBy('createdAt', 'desc')
      .limit(100);
  }

  const snap = await query.get();
  let items = snap.docs.map(toUserItem);

  if (search) {
    const q = search.toLowerCase();
    items = items.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.phoneNumber.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  const userId =
    typeof body === 'object' && body !== null && typeof (body as { userId?: unknown }).userId === 'string'
      ? (body as { userId: string }).userId
      : null;
  const isActive =
    typeof body === 'object' && body !== null && typeof (body as { isActive?: unknown }).isActive === 'boolean'
      ? (body as { isActive: boolean }).isActive
      : null;

  if (!userId || isActive === null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db: Firestore = getAdminDb();
  await db.collection('users').doc(userId).update({
    isActive,
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  const userId =
    typeof body === 'object' && body !== null && typeof (body as { userId?: unknown }).userId === 'string'
      ? (body as { userId: string }).userId
      : null;

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const db: Firestore = getAdminDb();
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const userData = userSnap.data() as UserDoc;
  if (userData.isActive !== false) {
    return NextResponse.json({ error: 'Deactivate the user first' }, { status: 400 });
  }

  const profileRef = userRef.collection('profile').doc(userId);
  const [savedAddresses, recentAddresses, verifications] = await Promise.all([
    profileRef.collection('saved_addresses').get(),
    profileRef.collection('recent_addresses').get(),
    userRef.collection('verification').get(),
  ]);

  const deletions = [
    ...savedAddresses.docs.map((doc) => doc.ref.delete()),
    ...recentAddresses.docs.map((doc) => doc.ref.delete()),
    ...verifications.docs.map((doc) => doc.ref.delete()),
    profileRef.delete().catch(() => undefined),
    userRef.delete(),
  ];

  await Promise.all(deletions);

  return NextResponse.json({ ok: true });
}
