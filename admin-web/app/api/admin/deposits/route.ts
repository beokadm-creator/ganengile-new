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
  paymentId?: string;
  status?: string;
  createdAt?: unknown;
}

interface LocationData {
  address?: string;
  detail?: string;
  [key: string]: any;
}

interface RequestDoc {
  fromLocation?: LocationData;
  toLocation?: LocationData;
  requesterId?: string;
  gllerId?: string;
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

  try {
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
          const requestSnap = await db.collection('requests').doc(requestId).get();
          return [requestId, (requestSnap.data() as RequestDoc | undefined) ?? undefined] as const;
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
          requestData?.fromLocation && requestData?.toLocation
            ? {
                pickup: requestData.fromLocation,
                dropoff: requestData.toLocation,
              }
            : null,
      };
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('Failed to fetch deposits:', error);
    
    // Check if this is an index error from Firestore
    if (error.message?.includes('FAILED_PRECONDITION') && error.message?.includes('requires an index')) {
      // Extract the link from the error message if possible to show to the user
      const linkMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
      const indexLink = linkMatch ? linkMatch[0] : null;
      
      return NextResponse.json(
        { 
          error: '데이터베이스 색인(Index) 생성이 필요합니다.', 
          details: 'Firestore 복합 색인이 아직 생성되지 않았거나 빌드 중입니다. 백엔드 로그에 출력된 링크를 클릭하여 색인을 생성해주세요.',
          indexLink
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: '데이터를 불러오는데 실패했습니다.', details: error.message }, 
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await req.json()) as DepositActionPayload;
  if (!payload.depositId || !payload.action) {
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
    // 1. Toss Payments 환불 처리 (tossAmount가 있는 경우)
    if (data.tossAmount && data.tossAmount > 0 && data.paymentId) {
      const configDoc = await db.collection('config_integrations').doc('payment').get();
      const privateConfigDoc = await db.collection('config_private').doc('payment').get();
      
      const config = configDoc.data() || {};
      const privateConfig = privateConfigDoc.data() || {};
      
      if (!config.testMode && config.liveReady && !data.paymentId.startsWith('test_')) {
        const secretKey = privateConfig.secretKey;
        if (!secretKey) {
          return NextResponse.json({ error: 'Toss Payments 시크릿 키가 설정되지 않았습니다.' }, { status: 500 });
        }

        const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');
        const response = await fetch(`https://api.tosspayments.com/v1/payments/${data.paymentId}/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${encodedKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `cancel_admin_${data.paymentId}_${Date.now()}`
          },
          body: JSON.stringify({
            cancelReason: '관리자 직권 환불',
            cancelAmount: data.tossAmount,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return NextResponse.json({ error: `결제 취소 실패: ${errorData.message}` }, { status: 500 });
        }
      }
    }

    // 2. 상태 업데이트 및 포인트 환불 (트랜잭션 적용)
    try {
      await db.runTransaction(async (transaction) => {
        const depositDoc = await transaction.get(ref);
        if (!depositDoc.exists || depositDoc.data()?.status !== 'paid') {
          throw new Error('Deposit status changed during transaction');
        }

        transaction.update(ref, { status: 'refunded', refundedAt: new Date(), updatedAt: new Date() });

        if ((data.pointAmount ?? 0) > 0 && data.userId) {
          const userRef = db.collection('users').doc(data.userId);
          const userSnap = await transaction.get(userRef);
          
          if (userSnap.exists) {
            const userData = userSnap.data() as { pointBalance?: number; totalEarnedPoints?: number } | undefined;
            const current = userData?.pointBalance ?? 0;
            const currentEarned = userData?.totalEarnedPoints ?? 0;
            const pointAmount = data.pointAmount ?? 0;
            
            transaction.update(userRef, {
              pointBalance: current + pointAmount,
              totalEarnedPoints: currentEarned + pointAmount,
            });

            const txRef = db.collection('point_transactions').doc();
            transaction.set(txRef, {
              userId: data.userId,
              amount: pointAmount,
              type: 'earn',
              category: 'deposit_refund',
              description: `보증금 환급 (${(data.depositAmount ?? 0).toLocaleString()}원)`,
              balanceBefore: current,
              balanceAfter: current + pointAmount,
              status: 'completed',
              createdAt: new Date(),
              completedAt: new Date(),
            });
          }
        }
      });
    } catch (error: any) {
      console.error('Transaction failed during deposit refund:', error);
      return NextResponse.json({ error: `포인트 환급 트랜잭션 실패: ${error.message}` }, { status: 500 });
    }
  } else if (payload.action === 'deduct') {
    await ref.update({ status: 'deducted', deductedAt: new Date(), updatedAt: new Date() });
  }

  return NextResponse.json({ ok: true });
}
