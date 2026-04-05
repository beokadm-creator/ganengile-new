import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

function toIso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const [analysesSnap, draftsSnap, quotesSnap, decisionsSnap, missionsSnap] = await Promise.all([
    db.collection('ai_analyses').orderBy('createdAt', 'desc').limit(8).get(),
    db.collection('request_drafts').orderBy('updatedAt', 'desc').limit(8).get(),
    db.collection('pricing_quotes').orderBy('updatedAt', 'desc').limit(8).get(),
    db.collection('actor_selection_decisions').orderBy('createdAt', 'desc').limit(8).get(),
    db.collection('missions').orderBy('updatedAt', 'desc').limit(8).get(),
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

  return NextResponse.json({
    summary: {
      analysisCount: analyses.length,
      lowConfidenceCount: analyses.filter((item) => item.status === 'low_confidence').length,
      selectedQuoteCount: quotes.filter((item) => item.status === 'selected').length,
      manualReviewCount: decisions.filter((item) => item.manualReviewRequired).length,
      activeMissionCount: missions.filter((item) => ['queued', 'offered', 'accepted', 'in_progress', 'reassigning'].includes(item.status)).length,
      reservationDraftCount: drafts.filter((item) => item.requestMode === 'reservation').length,
      immediateDraftCount: drafts.filter((item) => item.requestMode !== 'reservation').length,
    },
    analyses,
    drafts,
    quotes,
    decisions,
    missions,
  });
}
