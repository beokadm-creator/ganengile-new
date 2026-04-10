import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

type UnknownRecord = Record<string, unknown>;

const CONTRACTS_COLLECTION = 'business_contracts';
const DELIVERIES_COLLECTION = 'b2b_deliveries';

function getDb(): Firestore {
  return getAdminDb() as unknown as Firestore;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toMillis(value: unknown): number {
  if (!value) {
    return 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object') {
    const timestamp = value as { seconds?: number; _seconds?: number; toDate?: () => Date };
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().getTime();
    }
    if (typeof timestamp.seconds === 'number') {
      return timestamp.seconds * 1000;
    }
    if (typeof timestamp._seconds === 'number') {
      return timestamp._seconds * 1000;
    }
  }
  return 0;
}

function readNestedString(source: UnknownRecord, key: string, fallback = ''): string {
  const value = source[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    const nested = value as UnknownRecord;
    return asString(nested.station) || asString(nested.address) || fallback;
  }
  return fallback;
}

function mapContract(id: string, raw: UnknownRecord) {
  const duration = typeof raw.duration === 'object' && raw.duration !== null ? (raw.duration as UnknownRecord) : {};
  const billing = typeof raw.billing === 'object' && raw.billing !== null ? (raw.billing as UnknownRecord) : {};

  return {
    id,
    businessId: asString(raw.businessId),
    companyName: asString(raw.companyName, asString(raw.businessName, '이름 미등록')),
    registrationNumber: asString(raw.registrationNumber),
    ceoName: asString(raw.ceoName),
    contact: asString(raw.contact),
    email: asString(raw.email),
    address: asString(raw.address),
    tier: asString(raw.tier, 'basic'),
    status: asString(raw.status, 'pending'),
    billingMethod: asString(billing.method, 'invoice'),
    startAt: duration.start ?? raw.startDate ?? null,
    endAt: duration.end ?? raw.endDate ?? null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

function mapDelivery(id: string, raw: UnknownRecord) {
  const pricing = typeof raw.pricing === 'object' && raw.pricing !== null ? (raw.pricing as UnknownRecord) : {};

  return {
    id,
    contractId: asString(raw.contractId),
    businessId: asString(raw.businessId),
    gillerId: asString(raw.gillerId),
    status: asString(raw.status, 'pending'),
    type: asString(raw.type, 'on-demand'),
    pickupLabel: readNestedString(raw, 'pickupLocation', '-'),
    dropoffLabel: readNestedString(raw, 'dropoffLocation', '-'),
    scheduledTime: raw.scheduledTime ?? null,
    weight: asNumber(raw.weight),
    notes: asString(raw.notes),
    totalFee: asNumber(pricing.totalFee),
    gillerEarning: asNumber(pricing.gillerEarning),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    completedAt: raw.completedAt ?? null,
  };
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const [contractsSnap, deliveriesSnap] = await Promise.all([
    db.collection(CONTRACTS_COLLECTION).limit(200).get(),
    db.collection(DELIVERIES_COLLECTION).limit(200).get(),
  ]);

  const contracts = contractsSnap.docs
    .map((snapshot) => mapContract(snapshot.id, (snapshot.data() as UnknownRecord) ?? {}))
    .sort((a, b) => toMillis(b.updatedAt ?? b.createdAt).valueOf() - toMillis(a.updatedAt ?? a.createdAt).valueOf());

  const deliveries = deliveriesSnap.docs
    .map((snapshot) => mapDelivery(snapshot.id, (snapshot.data() as UnknownRecord) ?? {}))
    .sort((a, b) => toMillis(b.updatedAt ?? b.createdAt).valueOf() - toMillis(a.updatedAt ?? a.createdAt).valueOf());

  return NextResponse.json({
    contracts,
    deliveries,
    summary: {
      contractsTotal: contracts.length,
      contractsPending: contracts.filter((item) => item.status === 'pending').length,
      contractsActive: contracts.filter((item) => item.status === 'active').length,
      deliveriesTotal: deliveries.length,
      deliveriesActive: deliveries.filter((item) => ['pending', 'matched', 'picked_up', 'in_transit'].includes(item.status)).length,
    },
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as UnknownRecord;
  const targetType = asString(body.targetType).trim();
  const targetId = asString(body.targetId).trim();
  const status = asString(body.status).trim();

  if (!targetId || !status || (targetType !== 'contract' && targetType !== 'delivery')) {
    return NextResponse.json({ error: 'targetType, targetId and status are required' }, { status: 400 });
  }

  const collectionName = targetType === 'contract' ? CONTRACTS_COLLECTION : DELIVERIES_COLLECTION;
  await getDb().collection(collectionName).doc(targetId).set(
    {
      status,
      updatedAt: new Date(),
      adminLegacyNote: asString(body.adminLegacyNote).trim(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
