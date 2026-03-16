import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requestId = params.requestId;
  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection('requests').doc(requestId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = snap.data();
  return NextResponse.json({
    id: snap.id,
    pickupStation: data?.pickupStation ?? null,
    deliveryStation: data?.deliveryStation ?? null,
    packageInfo: data?.packageInfo ?? null,
    urgency: data?.urgency ?? null,
    itemValue: data?.itemValue ?? null,
    initialNegotiationFee: data?.initialNegotiationFee ?? null,
    feeBreakdown: data?.feeBreakdown ?? null,
    createdAt: data?.createdAt ?? null,
  });
}
