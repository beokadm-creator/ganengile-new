import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

function toIso(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'object') {
    if ('toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if ('_seconds' in value && typeof (value as { _seconds: number })._seconds === 'number') {
      return new Date((value as { _seconds: number })._seconds * 1000).toISOString();
    }
    if ('seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
      return new Date((value as { seconds: number }).seconds * 1000).toISOString();
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  return null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { decisionId, action, fallbackPartnerId } = body;

    if (!decisionId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getAdminDb();
    const decisionRef = db.collection('actor_selection_decisions').doc(decisionId);

    await db.runTransaction(async (transaction) => {
      const decisionDoc = await transaction.get(decisionRef);
      if (!decisionDoc.exists) {
        throw new Error('Decision not found');
      }

      const data = decisionDoc.data();
      if (data?.status === 'executed' || data?.status === 'rejected') {
        throw new Error(`Already ${data.status}`);
      }

      if (action === 'approve') {
        transaction.update(decisionRef, {
          status: 'executed',
          manualReviewRequired: false,
          'actorSelection.selectedActorType': data?.actorSelection?.selectedActorType || 'external_partner',
          'actorSelection.selectedPartnerId': fallbackPartnerId || data?.actorSelection?.selectedPartnerId || null,
          updatedAt: new Date(),
        });
        
        // 실제 미션 라우팅 로직은 여기에 추가될 수 있습니다. (Cloud Function 트리거 또는 상태 변경)
        // 예: delivery 문서의 dispatch 상태 업데이트
        if (data?.deliveryId) {
           const deliveryRef = db.collection('deliveries').doc(data.deliveryId);
           transaction.update(deliveryRef, {
             dispatchMethod: 'api',
             assignedPartnerId: fallbackPartnerId || data?.actorSelection?.selectedPartnerId || null,
             updatedAt: new Date(),
           });
        }
      } else if (action === 'reject') {
        transaction.update(decisionRef, {
          status: 'rejected',
          updatedAt: new Date(),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to execute AI review decision:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitCount = Number(searchParams.get('limit')) || 50;

  const db = getAdminDb();
  const [
    analysesSnap,
    draftsSnap,
    quotesSnap,
    decisionsSnap,
    missionsSnap,
    analysisCountSnap,
    lowConfidenceCountSnap,
    selectedQuoteCountSnap,
    manualReviewCountSnap,
    reservationDraftCountSnap,
    immediateDraftCountSnap
  ] = await Promise.all([
    db.collection('ai_analyses').orderBy('createdAt', 'desc').limit(limitCount).get(),
    db.collection('request_drafts').orderBy('updatedAt', 'desc').limit(limitCount).get(),
    db.collection('pricing_quotes').orderBy('updatedAt', 'desc').limit(limitCount).get(),
    db.collection('actor_selection_decisions').orderBy('createdAt', 'desc').limit(limitCount).get(),
    db.collection('missions').orderBy('updatedAt', 'desc').limit(limitCount).get(),
    db.collection('ai_analyses').count().get(),
    db.collection('ai_analyses').where('status', '==', 'low_confidence').count().get(),
    db.collection('pricing_quotes').where('status', '==', 'selected').count().get(),
    db.collection('actor_selection_decisions').where('manualReviewRequired', '==', true).count().get(),
    db.collection('request_drafts').where('requestMode', '==', 'reservation').count().get(),
    db.collection('request_drafts').where('requestMode', '==', 'immediate').count().get(),
  ]);

  const analyses = analysesSnap.docs.map((snap) => {
    const data = snap.data() as Record<string, unknown>;
    const result = (data.result ?? {}) as Record<string, unknown>;

    return {
      id: snap.id,
      requestDraftId: asString(data.requestDraftId),
      provider: asString(data.provider, 'unknown'),
      model: asString(data.model, 'unknown'),
      status: asString(data.status, 'unknown'),
      confidence: asNumber(data.confidence, 0),
      description: asString(result.description),
      riskFlags: Array.isArray(result.riskFlags) ? result.riskFlags.map((item) => asString(item)).filter(Boolean) : [],
      createdAt: toIso(data.createdAt),
    };
  });

  const drafts = draftsSnap.docs.map((snap) => {
    const data = snap.data() as Record<string, unknown>;
    const packageDraft = (data.packageDraft ?? {}) as Record<string, unknown>;
    const preferredSchedule = (data.preferredSchedule ?? {}) as Record<string, unknown>;
    const originRef = (data.originRef ?? {}) as Record<string, unknown>;
    const destinationRef = (data.destinationRef ?? {}) as Record<string, unknown>;

    return {
      id: snap.id,
      requesterUserId: asString(data.requesterUserId),
      status: asString(data.status, 'unknown'),
      requestMode: asString(data.requestMode, 'immediate'),
      sourceRequestId: asString(data.sourceRequestId),
      originName: asString(originRef.stationName, '출발역 미지정'),
      destinationName: asString(destinationRef.stationName, '도착역 미지정'),
      description: asString(packageDraft.description ?? packageDraft.itemName, '설명 없음'),
      preferredPickupTime: asString(preferredSchedule.pickupTime),
      preferredArrivalTime: asString(preferredSchedule.arrivalTime),
      selectedPricingQuoteId: asString(data.selectedPricingQuoteId),
      aiAnalysisId: asString(data.aiAnalysisId),
      updatedAt: toIso(data.updatedAt),
    };
  });

  const quotes = quotesSnap.docs.map((snap) => {
    const data = snap.data() as Record<string, unknown>;
    const finalPricing = (data.finalPricing ?? {}) as Record<string, unknown>;
    const deliveryOption = (data.selectedDeliveryOption ?? {}) as Record<string, unknown>;

    return {
      id: snap.id,
      requestDraftId: asString(data.requestDraftId),
      status: asString(data.status, 'unknown'),
      quoteType: asString(data.quoteType, 'unknown'),
      speedLabel: asString(deliveryOption.speedLabel, 'unknown'),
      requestMode: asString(deliveryOption.requestMode, 'immediate'),
      preferredPickupTime: asString(deliveryOption.preferredPickupTime),
      preferredArrivalTime: asString(deliveryOption.preferredArrivalTime),
      publicPrice: asNumber(finalPricing.publicPrice, 0),
      depositAmount: asNumber(finalPricing.depositAmount, 0),
      pricingVersion: asString(data.pricingVersion, 'unknown'),
      updatedAt: toIso(data.updatedAt),
    };
  });

  const decisions = decisionsSnap.docs.map((snap) => {
    const data = snap.data() as Record<string, unknown>;

    return {
      id: snap.id,
      requestId: asString(data.requestId),
      deliveryId: asString(data.deliveryId),
      selectedActorType: asString(data.selectedActorType, 'unknown'),
      interventionLevel: asString(data.interventionLevel, 'unknown'),
      manualReviewRequired: Boolean(data.manualReviewRequired),
      selectionReason: asString(data.selectionReason),
      riskFlags: Array.isArray(data.riskFlags) ? data.riskFlags.map((item) => asString(item)).filter(Boolean) : [],
      createdAt: toIso(data.createdAt),
    };
  });

  const missions = missionsSnap.docs.map((snap) => {
    const data = snap.data() as Record<string, unknown>;

    return {
      id: snap.id,
      requestId: asString(data.requestId),
      deliveryId: asString(data.deliveryId),
      status: asString(data.status, 'unknown'),
      missionType: asString(data.missionType, 'unknown'),
      assignedGillerUserId: asString(data.assignedGillerUserId),
      currentReward: asNumber(data.currentReward, 0),
      updatedAt: toIso(data.updatedAt),
    };
  });

  // missions collection status count query
  // "in" query allows up to 10 values, so this is safe
  const activeMissionCountSnap = await db.collection('missions')
    .where('status', 'in', ['queued', 'offered', 'accepted', 'in_progress', 'reassigning'])
    .count()
    .get();

  return NextResponse.json({
    summary: {
      analysisCount: analysisCountSnap.data().count,
      lowConfidenceCount: lowConfidenceCountSnap.data().count,
      selectedQuoteCount: selectedQuoteCountSnap.data().count,
      manualReviewCount: manualReviewCountSnap.data().count,
      activeMissionCount: activeMissionCountSnap.data().count,
      reservationDraftCount: reservationDraftCountSnap.data().count,
      immediateDraftCount: immediateDraftCountSnap.data().count,
    },
    analyses,
    drafts,
    quotes,
    decisions,
    missions,
  });
}
