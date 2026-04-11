import { getFunctions, httpsCallable } from 'firebase/functions';
import type { RequestDraft } from '../types/beta1';
import type { StationInfo, CreateRequestData } from '../types/request';

export interface Beta1AIAnalysisResponse {
  provider: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  confidence: number;
  result: {
    itemName?: string;
    category?: string;
    description?: string;
    estimatedValue?: number;
    estimatedWeightKg?: number;
    estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
    riskFlags: string[];
    handlingNotes: string[];
  };
}

export interface Beta1AIQuoteSuggestion {
  quoteType: 'fastest' | 'balanced' | 'lowest_price' | 'locker_included';
  speedLabel: string;
  headline: string;
  recommendationReason: string;
  etaMinutes: number;
  includesLocker: boolean;
  includesAddressPickup: boolean;
  includesAddressDropoff: boolean;
  pricing: {
    publicPrice: number;
    depositAmount: number;
    baseFee: number;
    distanceFee: number;
    weightFee: number;
    sizeFee: number;
    urgencySurcharge: number;
    publicFare: number;
    lockerFee: number;
    addressPickupFee: number;
    addressDropoffFee: number;
    serviceFee: number;
    vat: number;
  };
}

export interface Beta1AIQuoteResponse {
  provider: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  recommendedQuoteType: Beta1AIQuoteSuggestion['quoteType'];
  quotes: Beta1AIQuoteSuggestion[];
}

export interface Beta1MissionPlanResponse {
  provider: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  actorSelection: {
    interventionLevel: 'assist' | 'recommend' | 'guarded_execute' | 'human_review' | 'disallowed';
    selectedActorType: 'requester' | 'giller' | 'external_partner' | 'locker';
    selectedPartnerId?: string;
    selectionReason: string;
    fallbackActorTypes: Array<'requester' | 'giller' | 'external_partner' | 'locker'>;
    fallbackPartnerIds: string[];
    manualReviewRequired: boolean;
    riskFlags: string[];
  };
  bundleStrategy: 'single_actor' | 'multi_actor' | 'locker_assisted' | 'partner_fallback';
  missionSummary: string;
}

function stationPayload(station: StationInfo) {
  return {
    stationId: station.stationId,
    stationName: station.stationName,
    line: station.line,
  };
}

function toAIUrgency(value?: 'normal' | 'fast' | 'urgent' | 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
  if (value === 'urgent' || value === 'high') return 'high';
  if (value === 'fast' || value === 'medium') return 'medium';
  return 'low';
}

export async function analyzeRequestDraftWithAI(
  requestDraft: Pick<RequestDraft, 'requesterUserId' | 'requestMode' | 'originRef' | 'destinationRef' | 'packageDraft' | 'recipient' | 'preferredSchedule'>
): Promise<Beta1AIAnalysisResponse> {
  const functions = getFunctions();
  const callable = httpsCallable<
    {
      requesterUserId: string;
      requestMode?: 'immediate' | 'reservation';
      origin: { stationId?: string; stationName?: string };
      destination: { stationId?: string; stationName?: string };
      packageDraft?: RequestDraft['packageDraft'];
      recipient?: RequestDraft['recipient'];
      preferredSchedule?: RequestDraft['preferredSchedule'];
    },
    Beta1AIAnalysisResponse
  >(functions, 'beta1AnalyzeRequestDraft');

  const response = await callable({
    requesterUserId: requestDraft.requesterUserId,
    requestMode: requestDraft.requestMode,
    origin: {
      stationId: requestDraft.originRef.stationId,
      stationName: requestDraft.originRef.stationName,
    },
    destination: {
      stationId: requestDraft.destinationRef.stationId,
      stationName: requestDraft.destinationRef.stationName,
    },
    packageDraft: requestDraft.packageDraft,
    recipient: requestDraft.recipient,
    preferredSchedule: requestDraft.preferredSchedule,
  });

  return response.data;
}

export async function generatePricingQuotesWithAI(requestData: CreateRequestData): Promise<Beta1AIQuoteResponse> {
  const functions = getFunctions();
  const callable = httpsCallable<
    {
      requesterUserId: string;
      pickupStation: ReturnType<typeof stationPayload>;
      deliveryStation: ReturnType<typeof stationPayload>;
      packageDraft: {
        description?: string;
        estimatedValue?: number;
        estimatedWeightKg?: number;
        estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
      };
      requestMode?: 'immediate' | 'reservation';
      preferredPickupTime?: string;
      preferredArrivalTime?: string;
      urgency?: 'low' | 'medium' | 'high';
      directParticipationMode: 'none' | 'requester_to_station' | 'locker_assisted';
      basePricing: {
        publicPrice: number;
        depositAmount: number;
        baseFee: number;
        distanceFee: number;
        weightFee: number;
        sizeFee: number;
        urgencySurcharge: number;
        publicFare: number;
        serviceFee: number;
        vat: number;
      };
    },
    Beta1AIQuoteResponse
  >(functions, 'beta1GeneratePricingQuotes');

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
    throw new Error('Base pricing is required for AI quote generation.');
  }

  const response = await callable({
    requesterUserId: requestData.requesterId,
    pickupStation: stationPayload(requestData.pickupStation),
    deliveryStation: stationPayload(requestData.deliveryStation),
    packageDraft: {
      description: requestData.packageInfo?.description,
      estimatedValue: requestData.itemValue,
      estimatedWeightKg: requestData.packageInfo?.weightKg,
      estimatedSize: requestData.packageInfo?.size,
    },
    requestMode: requestData.requestMode,
    preferredPickupTime: requestData.preferredTime?.departureTime,
    preferredArrivalTime: requestData.preferredTime?.arrivalTime,
    urgency: toAIUrgency(requestData.urgency),
    directParticipationMode: requestData.storageLocation ? 'locker_assisted' : 'none',
    basePricing: {
      publicPrice: fee.totalFee,
      depositAmount: requestData.itemValue ? Math.round(requestData.itemValue) : 0,
      baseFee: fee.baseFee,
      distanceFee: fee.distanceFee,
      weightFee: fee.weightFee,
      sizeFee: fee.sizeFee,
      urgencySurcharge: fee.urgencySurcharge,
      publicFare: fee.publicFare ?? 0,
      serviceFee: fee.serviceFee,
      vat: fee.vat,
    },
  });

  return response.data;
}

export async function generatePricingQuotesForBeta1Input(input: {
  requesterUserId: string;
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  packageDescription?: string;
  itemValue?: number;
  weightKg?: number;
  packageSize?: 'small' | 'medium' | 'large' | 'xl';
  requestMode?: 'immediate' | 'reservation';
  preferredPickupTime?: string;
  preferredArrivalTime?: string;
  urgency?: 'normal' | 'fast' | 'urgent';
  directParticipationMode?: 'none' | 'requester_to_station' | 'locker_assisted';
  basePricing: {
    publicPrice: number;
    depositAmount: number;
    baseFee: number;
    distanceFee: number;
    weightFee: number;
    sizeFee: number;
    urgencySurcharge: number;
    publicFare: number;
    serviceFee: number;
    vat: number;
  };
}): Promise<Beta1AIQuoteResponse> {
  const functions = getFunctions();
  const callable = httpsCallable<
    {
      requesterUserId: string;
      pickupStation: ReturnType<typeof stationPayload>;
      deliveryStation: ReturnType<typeof stationPayload>;
      packageDraft: {
        description?: string;
        estimatedValue?: number;
        estimatedWeightKg?: number;
        estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
      };
      requestMode?: 'immediate' | 'reservation';
      preferredPickupTime?: string;
      preferredArrivalTime?: string;
      urgency?: 'low' | 'medium' | 'high';
      directParticipationMode: 'none' | 'requester_to_station' | 'locker_assisted';
      basePricing: {
        publicPrice: number;
        depositAmount: number;
        baseFee: number;
        distanceFee: number;
        weightFee: number;
        sizeFee: number;
        urgencySurcharge: number;
        publicFare: number;
        serviceFee: number;
        vat: number;
      };
    },
    Beta1AIQuoteResponse
  >(functions, 'beta1GeneratePricingQuotes');

  const response = await callable({
    requesterUserId: input.requesterUserId,
    pickupStation: stationPayload(input.pickupStation),
    deliveryStation: stationPayload(input.deliveryStation),
    packageDraft: {
      description: input.packageDescription,
      estimatedValue: input.itemValue,
      estimatedWeightKg: input.weightKg,
      estimatedSize: input.packageSize,
    },
    requestMode: input.requestMode,
    preferredPickupTime: input.preferredPickupTime,
    preferredArrivalTime: input.preferredArrivalTime,
    urgency: toAIUrgency(input.urgency),
    directParticipationMode: input.directParticipationMode ?? 'none',
    basePricing: input.basePricing,
  });

  return response.data;
}

export async function planMissionExecutionWithAI(input: {
  requestId: string;
  deliveryId: string;
  assignedGillerUserId?: string;
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  requestContext?: {
    itemDescription?: string;
    itemValue?: number;
    urgency?: string;
    requestMode?: 'immediate' | 'reservation';
    preferredPickupTime?: string;
    preferredArrivalTime?: string;
  };
}): Promise<Beta1MissionPlanResponse> {
  const functions = getFunctions();
  const callable = httpsCallable<
    {
      requestId: string;
      deliveryId: string;
      assignedGillerUserId?: string;
      pickupStation: ReturnType<typeof stationPayload>;
      deliveryStation: ReturnType<typeof stationPayload>;
      requestContext?: {
        itemDescription?: string;
        itemValue?: number;
        urgency?: string;
        requestMode?: 'immediate' | 'reservation';
        preferredPickupTime?: string;
        preferredArrivalTime?: string;
      };
    },
    Beta1MissionPlanResponse
  >(functions, 'beta1PlanMissionExecution');

  const response = await callable({
    requestId: input.requestId,
    deliveryId: input.deliveryId,
    assignedGillerUserId: input.assignedGillerUserId,
    pickupStation: stationPayload(input.pickupStation),
    deliveryStation: stationPayload(input.deliveryStation),
    requestContext: input.requestContext,
  });

  return response.data;
}
