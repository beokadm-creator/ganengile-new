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
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    } catch {
      return null;
    }
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

  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const thresholdMinutes = Number.parseInt(searchParams.get('thresholdMinutes') ?? '15', 10);
    const thresholdMs = (Number.isFinite(thresholdMinutes) ? thresholdMinutes : 15) * 60 * 1000;
    const thresholdDate = new Date(Date.now() - thresholdMs);

    let snap;

    try {
      snap = await db
        .collection('requests')
        .where('status', 'in', ['pending', 'matched'])
        .where('createdAt', '<=', thresholdDate)
        .orderBy('createdAt', 'asc')
        .limit(200)
        .get();
    } catch (queryError) {
      console.warn('[admin/delayed-requests] primary query failed, using fallback query', queryError);
      snap = await db
        .collection('requests')
        .orderBy('createdAt', 'asc')
        .limit(400)
        .get();
    }

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
      const pickupAddress =
        typeof raw.pickupAddress === 'object' && raw.pickupAddress !== null
          ? (raw.pickupAddress as UnknownRecord)
          : {};
      const deliveryAddress =
        typeof raw.deliveryAddress === 'object' && raw.deliveryAddress !== null
          ? (raw.deliveryAddress as UnknownRecord)
          : {};

      const pStation = asString(pickupStation.stationName);
      const pAddr = asString(pickupAddress.roadAddress) || asString(pickupAddress.address);
      const pickupStationName = pStation || pAddr || '출발지 미상';

      const dStation = asString(deliveryStation.stationName);
      const dAddr = asString(deliveryAddress.roadAddress) || asString(deliveryAddress.address);
      const deliveryStationName = dStation || dAddr || '도착지 미상';
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
        pickupStationName,
        deliveryStationName,
        createdAt: createdAt?.toISOString() ?? null,
        updatedAt: updatedAt?.toISOString() ?? null,
        ageMinutes: createdAt ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000)) : 0,
        feeTotal: asNumber(fee.totalFee, asNumber(raw.initialNegotiationFee)),
        opsPriority: asString(raw.opsPriority, 'normal'),
        opsMemo: asString(raw.opsMemo),
        opsLastReviewedAt: toDate(raw.opsLastReviewedAt)?.toISOString() ?? null,
      };
    })
      .filter((item) => {
        if (!['pending', 'matched'].includes(item.status)) {
          return false;
        }

        if (!item.createdAt) {
          return false;
        }

        return new Date(item.createdAt).getTime() <= thresholdDate.getTime();
      })
      .sort((a, b) => {
        const left = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
        const right = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
        return left - right;
      })
      .slice(0, 200);

    return NextResponse.json({ items, thresholdMinutes: Math.max(1, Math.floor(thresholdMs / 60000)) });
  } catch (error: unknown) {
    console.error('[admin/delayed-requests] GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch delayed requests', details: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as UnknownRecord;
    const action = asString(body.action);
    const requestId = asString(body.requestId).trim();

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    const db = getDb();

    if (action === 'cancel') {
      const reason = asString(body.reason) || '운영자 직권 취소 (지연)';
      
      await db.runTransaction(async (tx) => {
        const reqRef = db.collection('requests').doc(requestId);
        const doc = await tx.get(reqRef);
        if (!doc.exists) {
          throw new Error('요청을 찾을 수 없습니다.');
        }

        const data = doc.data() as UnknownRecord;
        if (data.status === 'completed' || data.status === 'cancelled') {
          throw new Error('이미 완료되거나 취소된 요청입니다.');
        }

        tx.update(reqRef, {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledBy: 'admin',
          updatedAt: new Date(),
        });

        // 진행중인 매칭이 있다면 모두 반려(rejected) 처리
        const matchesSnap = await tx.get(
          db.collection('matches').where('requestId', '==', requestId).where('status', '==', 'pending')
        );
        matchesSnap.forEach((matchDoc) => {
          tx.update(matchDoc.ref, {
            status: 'rejected',
            rejectionReason: '운영자 직권 취소',
            updatedAt: new Date(),
          });
        });
      });

      return NextResponse.json({ ok: true, message: '요청이 성공적으로 취소되었습니다.' });
    }

    // 기본 액션: 상태 업데이트 (opsPriority, opsMemo)
    const opsPriority = asString(body.opsPriority, 'normal').trim() || 'normal';
    const opsMemo = asString(body.opsMemo).trim();

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
  } catch (error: unknown) {
    console.error('[admin/delayed-requests] PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update delayed request', details: message },
      { status: 500 }
    );
  }
}
