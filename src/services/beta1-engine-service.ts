import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
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
import type { CreateRequestData, StationInfo } from '../types/request';
import type {
  AIAnalysis,
  DeliveryActorType,
  DeliveryLeg,
  DeliveryLegType,
  LocationRef,
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
  buildPricingQuoteFromLegacyFee,
  buildRequestDraftFromLegacyInput,
} from '../utils/request-draft-adapters';

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
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  deadline?: Date | Timestamp;
  currentReward?: number;
}

export interface DeliveryPlanBootstrapResult {
  deliveryLeg: DeliveryLeg;
  mission: Mission;
}

function stationToLocationRef(station: StationInfo): LocationRef {
  return {
    type: 'station',
    stationId: station.stationId,
    stationName: station.stationName,
    latitude: station.lat,
    longitude: station.lng,
  };
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
  } catch {
    await updateRequestDraft(requestDraft.requestDraftId, {
      status: RequestDraftStatus.READY_FOR_REVIEW,
    });
    return undefined;
  }
}

function buildFallbackQuote(
  requestData: CreateRequestData,
  requestDraftId: string
): Omit<PricingQuote, 'pricingQuoteId'> {
  const fee = (requestData.fee ?? requestData.feeBreakdown) as
    | {
        baseFee: number;
        distanceFee: number;
        weightFee: number;
        sizeFee: number;
        urgencySurcharge: number;
        publicFare?: number;
        serviceFee: number;
        vat: number;
        totalFee: number;
      }
    | undefined;
  if (!fee) {
    throw new Error('Fee is required to create a pricing quote.');
  }

  return buildPricingQuoteFromLegacyFee({
    requestDraftId,
    requesterUserId: requestData.requesterId,
    publicPrice: fee.totalFee,
    depositAmount: requestData.itemValue ? Math.round(requestData.itemValue * 0.1) : 0,
    baseFee: fee.baseFee,
    distanceFee: fee.distanceFee,
    weightFee: fee.weightFee,
    sizeFee: fee.sizeFee,
    urgencySurcharge: fee.urgencySurcharge,
    publicFare: fee.publicFare,
    serviceFee: fee.serviceFee,
    vat: fee.vat,
    speedLabel: 'Balanced',
    includesAddressDropoff: true,
  });
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
  } catch {
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
  const originRef = stationToLocationRef(input.pickupStation);
  const destinationRef = stationToLocationRef(input.deliveryStation);
  const actorType: DeliveryActorType = input.assignedGillerUserId ? 'giller' : 'system';
  const legType: DeliveryLegType = 'subway_transport';

  const deliveryLegPayload = {
    deliveryId: input.deliveryId,
    requestId: input.requestId,
    legType,
    actorType,
    sequence: 1,
    originRef,
    destinationRef,
    status: DeliveryLegStatus.READY,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const deliveryLegRef = await addDoc(collection(db, 'delivery_legs'), deliveryLegPayload);
  const missionPayload = {
    requestId: input.requestId,
    deliveryId: input.deliveryId,
    deliveryLegId: deliveryLegRef.id,
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const missionRef = await addDoc(collection(db, 'missions'), missionPayload);

  await updateDoc(doc(db, 'deliveries', input.deliveryId), {
    currentLegId: deliveryLegRef.id,
    updatedAt: serverTimestamp(),
  });

  return {
    deliveryLeg: {
      deliveryLegId: deliveryLegRef.id,
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
      missionId: missionRef.id,
      requestId: input.requestId,
      deliveryId: input.deliveryId,
      deliveryLegId: deliveryLegRef.id,
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
