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

  const disputeData = snap.data() as DisputeDoc;
  if (disputeData.status === 'resolved') {
    return NextResponse.json({ error: 'Already resolved' }, { status: 400 });
  }

  const compensationAmount = payload.compensation ?? 0;

  try {
    await db.runTransaction(async (transaction) => {
      const disputeDoc = await transaction.get(ref);
      if (!disputeDoc.exists) {
        throw new Error('Dispute not found in transaction');
      }

      if (disputeDoc.data()?.status === 'resolved') {
        throw new Error('Already resolved in transaction');
      }

      // 보상금이 설정된 경우, 요청자(또는 신고자)에게 포인트 지급 처리
      if (compensationAmount > 0 && disputeData.reporterId) {
        const userRef = db.collection('users').doc(disputeData.reporterId);
        const userSnap = await transaction.get(userRef);
        
        if (userSnap.exists) {
          const userData = userSnap.data() as { pointBalance?: number; totalEarnedPoints?: number };
          const current = userData?.pointBalance ?? 0;
          const currentEarned = userData?.totalEarnedPoints ?? 0;
          
          transaction.update(userRef, {
            pointBalance: current + compensationAmount,
            totalEarnedPoints: currentEarned + compensationAmount,
            updatedAt: new Date(),
          });

          const txRef = db.collection('point_transactions').doc();
          transaction.set(txRef, {
            userId: disputeData.reporterId,
            amount: compensationAmount,
            type: 'earn',
            category: 'dispute_compensation',
            description: `분쟁 조정에 따른 보상금 지급 (${compensationAmount.toLocaleString()}원)`,
            balanceBefore: current,
            balanceAfter: current + compensationAmount,
            status: 'completed',
            createdAt: new Date(),
            completedAt: new Date(),
          });
        }
      }

      transaction.update(ref, {
        status: 'resolved',
        resolution: {
          responsibility: payload.responsibility,
          compensation: compensationAmount,
          note: payload.note ?? '',
        },
        resolvedAt: new Date(),
        updatedAt: new Date(),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Transaction failed in dispute resolution:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
