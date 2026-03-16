import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const STATUS_ALIAS: Record<string, string[]> = {
  pending: ['pending', 'submitted', 'new'],
  in_review: ['in_review', 'reviewing', 'under_review'],
  approved: ['approved'],
  rejected: ['rejected', 'denied'],
};

function normalizeStatus(raw: unknown): string {
  const value = String(raw ?? '').toLowerCase();
  if (!value) return 'pending';
  if (STATUS_ALIAS.pending.includes(value)) return 'pending';
  if (STATUS_ALIAS.in_review.includes(value)) return 'in_review';
  if (STATUS_ALIAS.approved.includes(value)) return 'approved';
  if (STATUS_ALIAS.rejected.includes(value)) return 'rejected';
  return value;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'pending';
    const aliases = STATUS_ALIAS[status] ?? [status];

    // 인덱스/필드 누락 상황에서도 안전하게 읽기 위해 전체 조회 후 메모리 필터링
    const snap = await db.collection('giller_applications').limit(500).get();

    const appItems = snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data,
        status: normalizeStatus(data?.status),
      };
    });

    // fallback: 사용자 문서에는 pending인데 신청 컬렉션 문서가 누락된 케이스 보강
    const pendingUsersSnap = await db
      .collection('users')
      .where('gillerApplicationStatus', '==', 'pending')
      .limit(200)
      .get();

    const existingUserIds = new Set(appItems.map((item: any) => String(item.userId || '')));
    const fallbackItems = pendingUsersSnap.docs
      .map((doc) => doc.data() as any)
      .filter((user) => !existingUserIds.has(String(user.uid || '')))
      .map((user) => ({
        id: `user-${user.uid}`,
        userId: user.uid,
        userName: user.name || '',
        phone: user.phoneNumber || '',
        routeDescription: user?.gillerInfo?.activeRoute || '',
        verificationStatus: user.isVerified ? 'approved' : 'not_submitted',
        status: 'pending',
        createdAt: user.updatedAt || user.createdAt || new Date(),
        isSynthetic: true,
      }));

    const items = [...appItems, ...fallbackItems]
      .filter((item: any) => aliases.includes(String(item.status ?? 'pending')))
      .sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0).getTime();
        return bTime - aTime;
      });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('[admin/gillers][GET] failed:', error);
    return NextResponse.json(
      { error: '길러 신청 목록 조회 중 오류가 발생했습니다.', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { applicationId, action, note } = await req.json();
  if (!applicationId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = getAdminDb();
  const ref = db.collection('giller_applications').doc(applicationId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'in_review';

  const data = snap.data()!;
  let verificationStatus = data.verificationStatus as string | undefined;
  if (!verificationStatus && data.userId) {
    const verificationSnap = await db
      .collection('users')
      .doc(data.userId)
      .collection('verification')
      .doc(data.userId)
      .get();
    verificationStatus = verificationSnap.exists ? verificationSnap.data()?.status : undefined;
  }
  if (action === 'approve' && verificationStatus !== 'approved') {
    return NextResponse.json(
      { error: '신원 인증이 승인되지 않았습니다.' },
      { status: 400 }
    );
  }

  await ref.update({ status: newStatus, adminNote: note ?? '', reviewedAt: new Date() });

  // If approved, update user role in users collection
  if (action === 'approve') {
    if (data.userId) {
      const userRef = db.collection('users').doc(data.userId);
      const userSnap = await userRef.get();
      const currentRole = userSnap.exists ? userSnap.data()?.role : undefined;
      const nextRole = currentRole === 'giller' ? 'giller' : 'both';
      await userRef.update({
        role: nextRole,
        isGiller: true,
        gillerApplicationStatus: 'approved',
        gillerApprovedAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } else if (action === 'reject') {
    if (data.userId) {
      await db.collection('users').doc(data.userId).update({
        gillerApplicationStatus: 'rejected',
        updatedAt: new Date(),
      });
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
