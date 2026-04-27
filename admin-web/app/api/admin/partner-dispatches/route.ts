import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

type UnknownRecord = Record<string, unknown>;

function getDb(): Firestore {
  return db as unknown as Firestore;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStatus(value: unknown): string {
  const status = asString(value, 'queued').trim();
  return status.length > 0 ? status : 'queued';
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const snap = await db.collection('partner_dispatches').orderBy('updatedAt', 'desc').limit(200).get();

  const partnerIds = new Set<string>();
  snap.docs.forEach((snapshot) => {
    const raw = (snapshot.data() as UnknownRecord) ?? {};
    if (typeof raw.partnerId === 'string' && raw.partnerId) {
      partnerIds.add(raw.partnerId);
    }
  });

  const partnerEntries = await Promise.all(
    Array.from(partnerIds).map(async (partnerId) => {
      const partnerSnap = await db.collection('delivery_partners').doc(partnerId).get();
      return [
        partnerId,
        partnerSnap.exists ? (((partnerSnap.data() as UnknownRecord) ?? {})) : null,
      ] as const;
    })
  );
  const partnerMap = new Map(partnerEntries);

  const items = snap.docs
    .map((snapshot) => {
      const raw = (snapshot.data() as UnknownRecord) ?? {};
      const partner = typeof raw.partnerId === 'string' ? partnerMap.get(raw.partnerId) ?? null : null;

      return {
        id: snapshot.id,
        partnerId: asString(raw.partnerId),
        partnerName: asString(partner?.partnerName, ''),
        missionId: asString(raw.missionId),
        requestId: asString(raw.requestId),
        deliveryId: asString(raw.deliveryId),
        deliveryLegId: asString(raw.deliveryLegId),
        partnerCapability: asString(raw.partnerCapability),
        dispatchMethod: asString(raw.dispatchMethod, 'manual_dashboard'),
        status: asStatus(raw.status),
        opsMemo: asString(raw.opsMemo),
        createdAt: raw.createdAt ?? null,
        updatedAt: raw.updatedAt ?? null,
        requestedAt: raw.requestedAt ?? null,
        acceptedAt: raw.acceptedAt ?? null,
        completedAt: raw.completedAt ?? null,
        rawResponse:
          typeof raw.rawResponse === 'object' && raw.rawResponse !== null
            ? raw.rawResponse
            : null,
      };
    })
    .filter((item) => (status ? item.status === status : true));

  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as UnknownRecord;
  const dispatchId = asString(body.dispatchId).trim();
  const status = asStatus(body.status);
  const opsMemo = asString(body.opsMemo).trim();

  if (!dispatchId) {
    return NextResponse.json({ error: 'dispatchId is required' }, { status: 400 });
  }

  const now = new Date();
  const payload: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  if (opsMemo) {
    payload.opsMemo = opsMemo;
  }
  if (status === 'accepted') {
    payload.acceptedAt = now;
  }
  if (status === 'completed') {
    payload.completedAt = now;
  }

  const db = getDb();
  await db.collection('partner_dispatches').doc(dispatchId).set(payload, { merge: true });

  return NextResponse.json({ ok: true });
}
