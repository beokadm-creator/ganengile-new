import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

type Responsibility = 'giller' | 'requester' | 'system';

interface DisputeDoc {
  requestId?: string;
  reporterId?: string;
  reporterType?: 'requester' | 'giller';
  type?: 'damage' | 'loss' | 'quality' | 'delay' | 'other';
  description?: string;
  photoUrls?: string[];
  status?: string;
  createdAt?: unknown;
  resolution?: {
    responsibility?: Responsibility;
    compensation?: number;
    note?: string;
  };
}

interface RequestDoc {
  fromLocation?: { stationName?: string; lat?: number; lng?: number };
  toLocation?: { stationName?: string; lat?: number; lng?: number };
}

interface ResolvePayload {
  disputeId?: string;
  responsibility?: Responsibility;
  compensation?: number;
  note?: string;
}

function getDb(): Firestore {
  return getAdminDb() as unknown as Firestore;
}

function normalizeDisputeItem(id: string, data: DisputeDoc, requestData?: any) {
  return {
    id,
    reporterId: data.reporterId ?? '',
    reporterType: data.reporterType ?? 'requester',
    requestId: data.requestId ?? '',
    type: data.type ?? 'other',
    description: data.description ?? '',
    photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
    status: data.status ?? 'pending',
    createdAt: data.createdAt ?? new Date().toISOString(),
    resolution: data.resolution
      ? {
          responsibility: data.resolution.responsibility ?? 'system',
          compensation: data.resolution.compensation ?? 0,
          note: data.resolution.note ?? '',
        }
      : undefined,
    geo:
          requestData?.fromLocation && requestData?.toLocation
            ? {
                pickup: requestData.fromLocation,
                dropoff: requestData.toLocation,
              }
            : null,
  };
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  const snap = await db
    .collection('disputes')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .get();

  const disputeEntries = snap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as DisputeDoc,
  }));

  const requestIds = Array.from(
    new Set(
      disputeEntries
        .map((entry) => entry.data.requestId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );

  const requestEntries = await Promise.all(
    requestIds.map(async (requestId) => {
        const requestSnap = await db.collection('requests').doc(requestId).get();
        return [requestId, (requestSnap.data() as RequestDoc | undefined) ?? undefined] as const;
      })
  );

  const requestMap = new Map(requestEntries);
  const items = disputeEntries.map((entry) =>
    normalizeDisputeItem(entry.id, entry.data, entry.data.requestId ? requestMap.get(entry.data.requestId) : undefined)
  );

  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await req.json()) as ResolvePayload;
  if (!payload.disputeId || !payload.responsibility) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = getDb();
  const ref = db.collection('disputes').doc(payload.disputeId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await ref.update({
    status: 'resolved',
    resolution: {
      responsibility: payload.responsibility,
      compensation: payload.compensation ?? 0,
      note: payload.note ?? '',
    },
    resolvedAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
