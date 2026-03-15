import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const ACTIVE_STATUSES = ['matched', 'picked_up', 'in_locker', 'pending'];
const DONE_STATUSES = ['completed', 'cancelled', 'failed'];

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab') ?? 'active';

  const statuses = tab === 'active' ? ACTIVE_STATUSES : DONE_STATUSES;

  const snap = await db
    .collection('delivery_requests')
    .where('status', 'in', statuses)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const items = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      requesterId: d.requesterId ?? d.userId ?? '',
      gillerId: d.gillerId ?? '',
      status: d.status ?? '',
      totalAmount: d.totalAmount ?? d.finalAmount ?? 0,
      itemDescription: d.itemDescription ?? d.description ?? '',
      fromLocation: d.fromLocation ?? d.pickupLocation ?? '',
      toLocation: d.toLocation ?? d.deliveryLocation ?? '',
      createdAt: d.createdAt,
      completedAt: d.completedAt ?? null,
    };
  });

  return NextResponse.json({ items });
}
