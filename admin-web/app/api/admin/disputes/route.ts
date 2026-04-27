import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { getWalletSummary } from '../../../../../src/utils/wallet-balance';
import type { WalletBalances } from '../../../../../src/types/beta1-wallet';

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
  return db as unknown as Firestore;
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

  try {
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
  } catch (error: unknown) {
    console.error('Failed to fetch disputes:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('FAILED_PRECONDITION') && errorMessage.includes('requires an index')) {
      const linkMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
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
      { error: '데이터를 불러오는데 실패했습니다.', details: errorMessage }, 
      { status: 500 }
    );
  }
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
        const ledgerRef = db.collection('wallet_ledgers').doc(disputeData.reporterId);

        const [userSnap, ledgerSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(ledgerRef)
        ]);
        
        if (userSnap.exists) {
          const userData = userSnap.data() as Record<string, any>;
          const ledgerData = ledgerSnap.exists ? ledgerSnap.data() as Record<string, any> : null;
          
          const rawBalances = ledgerData?.balances ?? userData.walletBalances ?? {};
          const currentBalances = {
            chargeBalance: Number(rawBalances.chargeBalance ?? 0),
            earnedBalance: Number(rawBalances.earnedBalance ?? userData.pointBalance ?? 0),
            promoBalance: Number(rawBalances.promoBalance ?? 0),
            lockedChargeBalance: Number(rawBalances.lockedChargeBalance ?? 0),
            lockedEarnedBalance: Number(rawBalances.lockedEarnedBalance ?? 0),
            lockedPromoBalance: Number(rawBalances.lockedPromoBalance ?? 0),
            pendingWithdrawalBalance: Number(rawBalances.pendingWithdrawalBalance ?? 0),
          };

          const oldSummary = getWalletSummary(currentBalances as unknown as WalletBalances);
          const newBalances = {
            ...currentBalances,
            promoBalance: currentBalances.promoBalance + compensationAmount, // 보상금은 프로모션 포인트로 지급
          };
          const newSummary = getWalletSummary(newBalances as unknown as WalletBalances);
          const now = new Date();
          
          transaction.update(userRef, {
            pointBalance: newSummary.totalUsableBalance,
            walletBalances: newBalances,
            totalEarnedPoints: (userData.totalEarnedPoints ?? 0) + compensationAmount,
            updatedAt: now,
          });

          transaction.set(ledgerRef, {
            userId: disputeData.reporterId,
            balances: newBalances,
            summary: newSummary,
            updatedAt: now,
          }, { merge: true });

          const txRef = db.collection('point_transactions').doc();
          transaction.set(txRef, {
            userId: disputeData.reporterId,
            amount: compensationAmount,
            type: 'earn',
            category: 'dispute_compensation',
            description: `분쟁 조정에 따른 보상금 지급 (${compensationAmount.toLocaleString()}원)`,
            balanceBefore: oldSummary.totalUsableBalance,
            balanceAfter: newSummary.totalUsableBalance,
            status: 'completed',
            createdAt: now,
            completedAt: now,
          });

          const entryRef = db.collection('wallet_entries').doc();
          transaction.set(entryRef, {
            walletLedgerId: disputeData.reporterId,
            userId: disputeData.reporterId,
            type: 'earn',
            fundingSource: 'promo',
            amount: compensationAmount,
            balanceBefore: oldSummary,
            balanceAfter: newSummary,
            description: `분쟁 조정에 따른 보상금 지급 (${compensationAmount.toLocaleString()}원)`,
            createdAt: now,
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
  } catch (error: unknown) {
    console.error('Transaction failed in dispute resolution:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
