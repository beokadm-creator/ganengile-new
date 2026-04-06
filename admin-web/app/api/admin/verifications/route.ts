import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  const snap = await db
    .collectionGroup('verification')
    .where('status', '==', status)
    .orderBy('submittedAt', 'desc')
    .get();

  const items = snap.docs.map((doc) => {
    const data = doc.data();
    const userId = doc.ref.parent.parent?.id ?? doc.id;
    return { id: doc.id, userId, ...data };
  });

  const userIds = Array.from(new Set(items.map((item) => item.userId).filter(Boolean)));
  const userRefs = userIds.map((id) => db.collection('users').doc(id));
  const userSnaps = userRefs.length ? await db.getAll(...userRefs) : [];
  const userNameMap = new Map<string, string>();
  userSnaps.forEach((snap) => {
    if (snap.exists) {
      userNameMap.set(snap.id, snap.data()?.name ?? '');
    }
  });

  const enriched = items.map((item) => ({
    ...item,
    userName: item.userId ? userNameMap.get(item.userId) : '',
  }));

  return NextResponse.json({ items: enriched });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, action, reason } = await req.json();
  if (!userId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const status =
    action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'under_review';

  const db = getAdminDb();
  const ref = db.collection('users').doc(userId).collection('verification').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
    reviewedAt: new Date(),
    reviewedBy: 'admin',
  };
  if (status === 'rejected') {
    updateData.rejectionReason = reason ?? '';
  }

  await ref.update(updateData);
  await db.collection('users').doc(userId).update({
    isVerified: status === 'approved',
    updatedAt: new Date(),
  });

  const appSnap = await db
    .collection('giller_applications')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (!appSnap.empty) {
    await appSnap.docs[0].ref.update({ verificationStatus: status });
  }

  return NextResponse.json({ ok: true, status });
}
