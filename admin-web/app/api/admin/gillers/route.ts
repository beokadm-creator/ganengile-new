import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  const snap = await db
    .collection('giller_applications')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .get();

  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
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
