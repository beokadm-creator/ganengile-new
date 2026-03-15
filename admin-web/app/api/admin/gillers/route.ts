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
  await ref.update({ status: newStatus, adminNote: note ?? '', reviewedAt: new Date() });

  // If approved, update user role in users collection
  if (action === 'approve') {
    const data = snap.data()!;
    if (data.userId) {
      await db.collection('users').doc(data.userId).update({ role: 'giller', isGiller: true, gillerApprovedAt: new Date() });
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
