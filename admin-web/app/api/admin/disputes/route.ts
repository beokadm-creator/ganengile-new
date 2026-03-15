import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  const snap = await db
    .collection('disputes')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .get();

  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { disputeId, responsibility, compensation, note } = await req.json();
  if (!disputeId || !responsibility) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = getAdminDb();
  const ref = db.collection('disputes').doc(disputeId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await ref.update({
    status: 'resolved',
    resolution: { responsibility, compensation: compensation ?? 0, note: note ?? '' },
    resolvedAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
