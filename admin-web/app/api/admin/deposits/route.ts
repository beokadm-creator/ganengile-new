import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

interface DepositDoc {
  userId?: string;
  requestId?: string;
  depositAmount?: number;
  pointAmount?: number;
  tossAmount?: number;
  paymentMethod?: string;
  status?: string;
  createdAt?: unknown;
}

interface DeliveryRequestDoc {
  pickupStation?: { stationName?: string; lat?: number; lng?: number };
  deliveryStation?: { stationName?: string; lat?: number; lng?: number };
}

interface DepositActionPayload {
  depositId?: string;
  action?: 'refund' | 'deduct';
}

function getDb(): Firestore {
  return getAdminDb() as unknown as Firestore;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'paid';

  const snap = await db
    .collection('deposits')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const entries = snap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as DepositDoc,
  }));

  const requestIds = Array.from(
    new Set(
      entries
        .map((entry) => entry.data.requestId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );

  const requestEntries = await Promise.all(
    requestIds.map(async (requestId) => {
      const requestSnap = await db.collection('delivery_requests').doc(requestId).get();
      return [requestId, (requestSnap.data() as DeliveryRequestDoc | undefined) ?? undefined] as const;
    })
  );

  const requestMap = new Map(requestEntries);
  const items = entries.map((entry) => {
    const requestData = entry.data.requestId ? requestMap.get(entry.data.requestId) : undefined;

    return {
      id: entry.id,
      userId: entry.data.userId ?? '',
      requestId: entry.data.requestId ?? '',
      depositAmount: entry.data.depositAmount ?? 0,
      pointAmount: entry.data.pointAmount ?? 0,
      tossAmount: entry.data.tossAmount ?? 0,
      paymentMethod: entry.data.paymentMethod ?? 'unknown',
      status: entry.data.status ?? status,
      createdAt: entry.data.createdAt ?? new Date().toISOString(),
      geo:
        requestData?.pickupStation && requestData?.deliveryStation
          ? {
              pickup: requestData.pickupStation,
              dropoff: requestData.deliveryStation,
            }
          : null,
    };
  });

  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await req.json()) as DepositActionPayload;
  if (!payload.depositId ?? !payload.action) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = getDb();
  const ref = db.collection('deposits').doc(payload.depositId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = snap.data() as DepositDoc;
  if (data.status !== 'paid') {
    return NextResponse.json({ error: 'Deposit not in paid status' }, { status: 400 });
  }

  if (payload.action === 'refund') {
    await ref.update({ status: 'refunded', refundedAt: new Date(), updatedAt: new Date() });

    if ((data.pointAmount ?? 0) > 0 && data.userId) {
      const userRef = db.collection('users').doc(data.userId);
      const userSnap = await userRef.get();
      const userData = userSnap.data() as { pointBalance?: number; totalEarnedPoints?: number } | undefined;
      if (userSnap.exists) {
        const current = userData?.pointBalance ?? 0;
        const currentEarned = userData?.totalEarnedPoints ?? 0;
        await userRef.update({
          pointBalance: current + (data.pointAmount ?? 0),
          totalEarnedPoints: currentEarned + (data.pointAmount ?? 0),
        });
        await db.collection('point_transactions').add({
          userId: data.userId,
          amount: data.pointAmount ?? 0,
          type: 'earn',
          category: 'deposit_refund',
          description: `보증금 환급 (${(data.depositAmount ?? 0).toLocaleString()}원)`,
          balanceBefore: current,
          balanceAfter: current + (data.pointAmount ?? 0),
          status: 'completed',
          createdAt: new Date(),
          completedAt: new Date(),
        });
      }
    }
  } else if (payload.action === 'deduct') {
    await ref.update({ status: 'deducted', deductedAt: new Date(), updatedAt: new Date() });
  }

  return NextResponse.json({ ok: true });
}
