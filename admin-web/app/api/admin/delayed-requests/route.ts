import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

type UnknownRecord = Record<string, unknown>;

function getDb(): Firestore {
  return getAdminDb() as unknown as Firestore;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const thresholdMinutes = Number.parseInt(searchParams.get('thresholdMinutes') ?? '15', 10);
  const thresholdMs = (Number.isFinite(thresholdMinutes) ? thresholdMinutes : 15) * 60 * 1000;
  const thresholdDate = new Date(Date.now() - thresholdMs);

  const snap = await db
    .collection('requests')
    .where('status', 'in', ['pending', 'matched'])
    .where('createdAt', '<=', thresholdDate)
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get();

  const items = snap.docs.map((snapshot) => {
    const raw = (snapshot.data() as UnknownRecord) ?? {};
    const createdAt = toDate(raw.createdAt);
    const updatedAt = toDate(raw.updatedAt);
    const pickupStation =
      typeof raw.pickupStation === 'object' && raw.pickupStation !== null
        ? (raw.pickupStation as UnknownRecord)
        : {};
    const deliveryStation =
      typeof raw.deliveryStation === 'object' && raw.deliveryStation !== null
        ? (raw.deliveryStation as UnknownRecord)
        : {};
    const fee =
      typeof raw.fee === 'object' && raw.fee !== null
        ? (raw.fee as UnknownRecord)
        : typeof raw.feeBreakdown === 'object' && raw.feeBreakdown !== null
          ? (raw.feeBreakdown as UnknownRecord)
          : {};

    return {
      id: snapshot.id,
      requesterId: asString(raw.requesterId),
      matchedGillerId: asString(raw.matchedGillerId),
      status: asString(raw.status, 'pending'),
      beta1RequestStatus: asString(raw.beta1RequestStatus),
      requestMode: asString(raw.requestMode, 'immediate'),
      pickupStationName: asString(pickupStation.stationName, '출발역'),
      deliveryStationName: asString(deliveryStation.stationName, '도착역'),
      createdAt: createdAt?.toISOString() ?? null,
      updatedAt: updatedAt?.toISOString() ?? null,
      ageMinutes: createdAt ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000)) : 0,
      feeTotal: asNumber(fee.totalFee, asNumber(raw.initialNegotiationFee)),
      opsPriority: asString(raw.opsPriority, 'normal'),
      opsMemo: asString(raw.opsMemo),
      opsLastReviewedAt: toDate(raw.opsLastReviewedAt)?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ items, thresholdMinutes: Math.max(1, Math.floor(thresholdMs / 60000)) });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as UnknownRecord;
  const requestId = asString(body.requestId).trim();
  const opsPriority = asString(body.opsPriority, 'normal').trim() || 'normal';
  const opsMemo = asString(body.opsMemo).trim();

  if (!requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
  }

  const db = getDb();
  await db.collection('requests').doc(requestId).set(
    {
      opsPriority,
      opsMemo,
      opsLastReviewedAt: new Date(),
      updatedAt: new Date(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true });
}
