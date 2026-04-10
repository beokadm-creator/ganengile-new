import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  createAIAnalysis,
  createPricingQuote,
  createRequestDraft,
  markPricingQuoteSelected,
  updateRequestDraft,
} from './request-draft-service';
import {
  analyzeRequestDraftWithAI,
  generatePricingQuotesWithAI,
} from './beta1-ai-service';
import type { CreateRequestData } from '../types/request';
import type {
  AIAnalysis,
  DeliveryActorType,
  DeliveryLeg,
  DeliveryLegType,
  Mission,
  MissionType,
  PricingQuote,
  RequestDraft,
} from '../types/beta1';
import {
  AIAnalysisStatus,
  DeliveryLegStatus,
  MissionStatus,
  PricingQuoteStatus,
  RequestDraftStatus,
} from '../types/beta1';
import {
  type LegacyRequestPricingInput,
  type LegacyStationInfo,
  buildPricingQuoteFromLegacyRequest,
  buildRequestDraftFromLegacyInput,
  mapLegacyStationToLocationRef,
} from '../utils/request-draft-adapters';
import { syncDeliveryToBeta1Execution } from './beta1-orchestration-service';

export interface RequestCreationBootstrapResult {
  requestDraft: RequestDraft;
  aiAnalysis?: AIAnalysis;
  selectedPricingQuote?: PricingQuote;
}

export interface DeliveryPlanBootstrapInput {
  deliveryId: string;
  requestId: string;
  requesterUserId: string;
  assignedGillerUserId?: string;
  pickupStation: LegacyStationInfo;
  deliveryStation: LegacyStationInfo;
  deadline?: Date | Timestamp;
  currentReward?: number;
}

export interface DeliveryPlanBootstrapResult {
  deliveryLeg: DeliveryLeg;
  mission: Mission;
}

function resolveMissionWindowEnd(deadline?: Date | Timestamp): Timestamp | undefined {
  if (!deadline) {
    return undefined;
  }

  return deadline instanceof Timestamp ? deadline : Timestamp.fromDate(deadline);
}

function mapLegTypeToMissionType(legType: DeliveryLegType): MissionType {
  switch (legType) {
    case 'pickup_address':
    case 'pickup_station':
      return 'pickup';
    case 'locker_dropoff':
      return 'locker_dropoff';
    case 'locker_pickup':
      return 'locker_pickup';
    case 'meetup_handover':
      return 'meetup_handover';
    case 'last_mile_address':
      return 'last_mile';
    case 'subway_transport':
    default:
      return 'subway_transport';
  }
}

async function createRequestDraftAnalysis(
  requestDraft: RequestDraft
): Promise<AIAnalysis | undefined> {
  try {
    const aiResult = await analyzeRequestDraftWithAI({
      requesterUserId: requestDraft.requesterUserId,
      originRef: requestDraft.originRef,
      destinationRef: requestDraft.destinationRef,
      packageDraft: requestDraft.packageDraft,
      recipient: requestDraft.recipient,
    });

    const aiAnalysis = await createAIAnalysis({
      requestDraftId: requestDraft.requestDraftId,
      requesterUserId: requestDraft.requesterUserId,
      inputPhotoIds: requestDraft.selectedPhotoIds,
      provider: aiResult.provider,
      model: aiResult.model,
      confidence: aiResult.confidence,
      result: aiResult.result,
      status: aiResult.fallbackUsed ? AIAnalysisStatus.LOW_CONFIDENCE : AIAnalysisStatus.COMPLETED,
    });

    await updateRequestDraft(requestDraft.requestDraftId, {
      aiAnalysisId: aiAnalysis.aiAnalysisId,
      packageDraft: {
        ...requestDraft.packageDraft,
        itemName: aiResult.result.itemName ?? requestDraft.packageDraft?.itemName,
        category: aiResult.result.category ?? requestDraft.packageDraft?.category,
        description: aiResult.result.description ?? requestDraft.packageDraft?.description,
        estimatedValue: aiResult.result.estimatedValue ?? requestDraft.packageDraft?.estimatedValue,
        estimatedWeightKg: aiResult.result.estimatedWeightKg ?? requestDraft.packageDraft?.estimatedWeightKg,
        estimatedSize: aiResult.result.estimatedSize ?? requestDraft.packageDraft?.estimatedSize,
      },
      status: RequestDraftStatus.READY_FOR_REVIEW,
    });

    return aiAnalysis;
  } catch (error) {
    console.error('[beta1-engine] AI 분석 실패, 폴백 진행:', error);
    await updateRequestDraft(requestDraft.requestDraftId, {
      status: RequestDraftStatus.READY_FOR_REVIEW,
    });
    return undefined;
  }
}

function buildFallbackQuote(
  requestData: LegacyRequestPricingInput,
  requestDraftId: string
): Omit<PricingQuote, 'pricingQuoteId'> {
  return buildPricingQuoteFromLegacyRequest(requestData, requestDraftId);
}

async function createPricingQuotes(
  requestData: CreateRequestData,
  requestDraftId: string
): Promise<PricingQuote> {
  let quoteInputs: Array<Omit<PricingQuote, 'pricingQuoteId'>> = [buildFallbackQuote(requestData, requestDraftId)];
  let recommendedQuoteType: PricingQuote['quoteType'] = 'balanced';

  try {
    const aiQuotes = await generatePricingQuotesWithAI(requestData);
    recommendedQuoteType = aiQuotes.recommendedQuoteType;
    quoteInputs = aiQuotes.quotes.map((quote) => ({
      requestDraftId,
      requesterUserId: requestData.requesterId,
      quoteType: quote.quoteType,
      pricingVersion: aiQuotes.fallbackUsed ? 'beta1-ai-fallback-v1' : 'beta1-ai-v1',
      selectedDeliveryOption: {
        speedLabel: quote.speedLabel,
        includesLocker: quote.includesLocker,
        includesAddressPickup: quote.includesAddressPickup,
        includesAddressDropoff: quote.includesAddressDropoff,
      },
      suggestedByAI: {
        startingPrice: quote.pricing.publicPrice,
        suggestedDeposit: quote.pricing.depositAmount,
      },
      finalPricing: quote.pricing,
      status: PricingQuoteStatus.PRESENTED,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
  } catch (error) {
    console.error('[beta1-engine] AI 가격 견적 생성 실패:', error);
    // Deterministic fallback remains available.
  }

  const createdQuotes = await Promise.all(quoteInputs.map((quote) => createPricingQuote(quote)));
  const selectedQuote =
    createdQuotes.find((quote) => quote.quoteType === recommendedQuoteType) ??
    createdQuotes.find((quote) => quote.quoteType === 'balanced') ??
    createdQuotes[0];

  await Promise.all(
    createdQuotes.map((quote) =>
      updateDoc(doc(db, 'pricing_quotes', quote.pricingQuoteId), {
        status: quote.pricingQuoteId === selectedQuote.pricingQuoteId ? PricingQuoteStatus.SELECTED : PricingQuoteStatus.PRESENTED,
        updatedAt: serverTimestamp(),
      })
    )
  );
  await markPricingQuoteSelected(selectedQuote.pricingQuoteId, requestDraftId);

  return {
    ...selectedQuote,
    status: PricingQuoteStatus.SELECTED,
  };
}

export async function bootstrapRequestCreationEngine(
  requestData: CreateRequestData
): Promise<RequestCreationBootstrapResult> {
  const requestDraft = await createRequestDraft(
    buildRequestDraftFromLegacyInput({
      requesterUserId: requestData.requesterId,
      pickupStation: requestData.pickupStation,
      deliveryStation: requestData.deliveryStation,
      itemName: requestData.packageInfo?.description,
      description: requestData.packageInfo?.description,
      estimatedValue: requestData.itemValue,
      estimatedWeightKg: requestData.packageInfo?.weightKg,
      estimatedSize: requestData.packageInfo?.size,
      recipientName: undefined,
      recipientPhone: undefined,
    })
  );

  await updateRequestDraft(requestDraft.requestDraftId, {
    status: RequestDraftStatus.ANALYZING,
  });

  const aiAnalysis = await createRequestDraftAnalysis(requestDraft);
  const fee = requestData.fee ?? requestData.feeBreakdown;
  if (!fee) {
    return {
      requestDraft: {
        ...requestDraft,
        aiAnalysisId: aiAnalysis?.aiAnalysisId,
      },
      aiAnalysis,
    };
  }

  const selectedPricingQuote = await createPricingQuotes(requestData, requestDraft.requestDraftId);

  return {
    requestDraft: {
      ...requestDraft,
      aiAnalysisId: aiAnalysis?.aiAnalysisId,
      selectedPricingQuoteId: selectedPricingQuote.pricingQuoteId,
    },
    aiAnalysis,
    selectedPricingQuote,
  };
}

export async function bootstrapAcceptedDeliveryPlan(
  input: DeliveryPlanBootstrapInput
): Promise<DeliveryPlanBootstrapResult> {
  await syncDeliveryToBeta1Execution(input.deliveryId);

  const [legSnapshot, missionSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'delivery_legs'), where('deliveryId', '==', input.deliveryId))),
    getDocs(query(collection(db, 'missions'), where('deliveryId', '==', input.deliveryId))),
  ]);

  const firstLeg = legSnapshot.docs
    .map((snapshot) => ({
      deliveryLegId: snapshot.id,
      ...(snapshot.data() as Omit<DeliveryLeg, 'deliveryLegId'>),
    }))
    .sort((left, right) => left.sequence - right.sequence)[0];
  const firstMission = missionSnapshot.docs
    .map((snapshot) => ({
      missionId: snapshot.id,
      ...(snapshot.data() as Omit<Mission, 'missionId'>),
    }))
    .sort((left, right) => left.sequence - right.sequence)[0];

  if (!firstLeg || !firstMission) {
    const originRef = mapLegacyStationToLocationRef(input.pickupStation);
    const destinationRef = mapLegacyStationToLocationRef(input.deliveryStation);
    const actorType: DeliveryActorType = input.assignedGillerUserId ? 'giller' : 'system';
    const legType: DeliveryLegType = 'subway_transport';
    return {
      deliveryLeg: {
        deliveryLegId: '',
        deliveryId: input.deliveryId,
        requestId: input.requestId,
        legType,
        actorType,
        sequence: 1,
        originRef,
        destinationRef,
        status: DeliveryLegStatus.READY,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      mission: {
        missionId: '',
        requestId: input.requestId,
        deliveryId: input.deliveryId,
        deliveryLegId: '',
        sequence: 1,
        missionType: mapLegTypeToMissionType(legType),
        status: input.assignedGillerUserId ? MissionStatus.ACCEPTED : MissionStatus.QUEUED,
        originRef,
        destinationRef,
        windowStartAt: Timestamp.now(),
        windowEndAt: resolveMissionWindowEnd(input.deadline),
        recommendedReward: input.currentReward,
        minimumReward: input.currentReward,
        currentReward: input.currentReward,
        assignedGillerUserId: input.assignedGillerUserId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    };
  }

  return {
    deliveryLeg: firstLeg,
    mission: firstMission,
  };
}
