import {
  Timestamp,
  addDoc,
  collection,
  deleteField,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  setDoc,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateShortId } from '../utils/id-generator';
import { createAIAnalysis, createPricingQuote, createRequestDraft, markPricingQuoteSelected, updateRequestDraft } from './request-draft-service';
import type {
  ActorSelectionActorType,
  ActorSelectionDecision,
  AIInterventionLevel,
  DeliveryActorType,
  DeliveryLeg,
  DeliveryLegType,
  LocationRef,
  Mission,
  MissionBundle,
  MissionBundleStatus,
  MissionType,
  PartnerMissionQuote,
  PricingQuote,
} from '../types/beta1';
import {
  ActorSelectionActorType as ActorType,
  AIAnalysisStatus,
  DeliveryLegStatus,
  MissionBundleStatus as BundleStatus,
  MissionStatus as MissionState,
  PricingQuoteStatus,
  RequestDraftStatus,
} from '../types/beta1';
import { getAIIntegrationConfig } from './integration-config-service';
import { buildRequestDraftFromLegacyInput, type LegacyStationInfo as StationInfo } from '../utils/request-draft-adapters';
import { findMatchesForRequest } from './matching-service';
import {
  sendMissionBundleAvailableNotification,
  sendMissionReturnedNotification,
  sendRequestProgressNotification,
} from './matching-notification';
import { deliveryPartnerService } from './delivery-partner-service';
import { getMissionExposurePricing } from './mission-exposure-pricing-service';
import {
  buildMissionWindowLabel,
  buildSegmentedLegDefinitions,
  describeLegType,
  describeLocationRef,
  formatDetailedAddress,
  mapLegTypeToMissionType,
  requiresAddressHandling,
  splitRewardAcrossLegs,
  toAddressLocationRef,
  toLocationRef,
} from './beta1-orchestration-leg-service';
import {
  applyAIQuoteResponseToCards,
  buildBeta1BasePricing,
  buildBeta1QuoteCards,
  normalizePackageSize,
  type Beta1QuoteCard,
  type Beta1RequestCreateInput,
} from './beta1-orchestration-quote-service';
import { generatePricingQuotesForBeta1Input } from './beta1-ai-service';
import { getPricingPolicyConfig } from './pricing-policy-config-service';
import { getRoutePricingOverrideByStations } from './route-pricing-override-service';
import { getUserActiveRoutes } from './route-service';
import { getUserById } from './user-service';
import type { StationInfo as RequestStationInfo } from '../types/request';
import type { GillerTerritory } from '../types/user';

function cleanForFirestore<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(cleanForFirestore) as unknown as T;
  }
  if (value.constructor.name === 'Timestamp' || value.constructor.name === 'FieldValue' || (value as Record<string, unknown>)?._methodName) {
    return value;
  }
  const cleanObj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) {
      cleanObj[k] = cleanForFirestore(v);
    }
  }
  return cleanObj as T;
}

export {
  getBeta1AdminSnapshot,
  getBeta1ChatContext,
  getBeta1HomeSnapshot,
} from './beta1-orchestration-snapshot-service';
export type {
  Beta1AdminSnapshot,
  Beta1ChatContext,
  Beta1HomeSnapshot,
} from './beta1-orchestration-snapshot-service';
export { buildBeta1QuoteCards } from './beta1-orchestration-quote-service';
export type {
  Beta1QuoteCard,
  Beta1RequestCreateInput,
} from './beta1-orchestration-quote-service';
export {
  applyAIQuoteResponseToCards,
  buildBeta1BasePricing,
} from './beta1-orchestration-quote-service';
export {
  buildSegmentedLegDefinitions,
  formatDetailedAddress,
  splitRewardAcrossLegs,
} from './beta1-orchestration-leg-service';



type Beta1LegDoc = DeliveryLeg & { id?: string };

type Beta1MissionDoc = {
  id: string;
  requestId?: string;
  deliveryId?: string;
  deliveryLegId?: string;
  sequence?: number;
  missionType?: MissionType;
  status?: string;
  currentReward?: number;
  assignedGillerUserId?: string;
  originRef?: LocationRef;
  destinationRef?: LocationRef;
  createdAt?: unknown;
};

type Beta1MissionBundleDoc = MissionBundle & {
  bundleType?: 'single_leg' | 'contiguous_range';
  startSequence?: number;
  endSequence?: number;
  title?: string;
  summary?: string;
  windowLabel?: string;
  rewardTotal?: number;
  recommendedActorType?: ActorSelectionActorType;
  candidateGillerUserIds?: string[];
  selectedGillerUserId?: string;
  requiresExternalPartner?: boolean;
  fallbackDeliveryIds?: string[];
  createdAt?: unknown;
};

function normalizeLocationLabel(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function resolveLocationLabel(ref?: LocationRef | null): string {
  return normalizeLocationLabel(ref?.stationName ?? ref?.addressText ?? ref?.roadAddress ?? '');
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function computeTerritoryBonus(
  territories: GillerTerritory[] | undefined,
  originRef?: LocationRef,
  destinationRef?: LocationRef
): number {
  if (!territories?.length) {
    return 0;
  }

  const points = [originRef, destinationRef].filter((item): item is LocationRef => item != null);
  if (!points.length) {
    return 0;
  }

  let maxBonus = 0;

  territories.forEach((territory, territoryIndex) => {
    const radiusMeters = Math.max(1, territory.radiusKm) * 1000;
    let coveredCount = 0;

    points.forEach((point) => {
      if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
        return;
      }

      const distance = calculateDistanceMeters(
        territory.latitude,
        territory.longitude,
        point.latitude,
        point.longitude
      );

      if (distance <= radiusMeters) {
        coveredCount += 1;
      }
    });

    let territoryBonus = 0;
    if (coveredCount >= 2) {
      territoryBonus = 18;
    } else if (coveredCount === 1) {
      territoryBonus = 10;
    }

    if (territoryIndex === 0 && territoryBonus > 0) {
      territoryBonus += 4;
    }

    maxBonus = Math.max(maxBonus, territoryBonus);
  });

  return maxBonus;
}

function computeRouteFitBonus(
  routes: Awaited<ReturnType<typeof getUserActiveRoutes>>,
  originRef?: LocationRef,
  destinationRef?: LocationRef
): number {
  if (!routes.length) {
    return 0;
  }

  const originLabel = resolveLocationLabel(originRef);
  const destinationLabel = resolveLocationLabel(destinationRef);
  if (!originLabel && !destinationLabel) {
    return 0;
  }

  let bestBonus = 0;

  routes.forEach((route) => {
    const routeStart = normalizeLocationLabel(route.startStation?.stationName);
    const routeEnd = normalizeLocationLabel(route.endStation?.stationName);

    const exactForward = originLabel && destinationLabel && routeStart === originLabel && routeEnd === destinationLabel;
    const exactReverse = originLabel && destinationLabel && routeStart === destinationLabel && routeEnd === originLabel;
    const startHit = originLabel && (routeStart === originLabel || routeEnd === originLabel);
    const endHit = destinationLabel && (routeStart === destinationLabel || routeEnd === destinationLabel);

    let bonus = 0;
    if (exactForward || exactReverse) {
      bonus = 22;
    } else if (startHit && endHit) {
      bonus = 16;
    } else if (startHit || endHit) {
      bonus = 8;
    }

    bestBonus = Math.max(bestBonus, bonus);
  });

  return bestBonus;
}

async function rankCandidateGillersForBundle(params: {
  requestId: string;
  originRef?: LocationRef;
  destinationRef?: LocationRef;
  hasAddressLeg: boolean;
  topN?: number;
}): Promise<string[]> {
  let baseMatches: any[] = [];
  try {
    const rawMatches = await findMatchesForRequest(params.requestId, Math.max(5, (params.topN ?? 5) * 2));
    baseMatches = Array.isArray(rawMatches) ? rawMatches : [];
  } catch (error) {
    console.error('[orchestration-service] Failed to fetch base matches:', error);
    baseMatches = [];
  }

  const rescored = await Promise.all(
    baseMatches.map(async (match) => {
      const [routes, user] = await Promise.all([
        getUserActiveRoutes(match.gillerId).catch(() => []),
        getUserById(match.gillerId).catch(() => null),
      ]);

      const routeBonus = computeRouteFitBonus(routes, params.originRef, params.destinationRef);
      const territoryBonus = computeTerritoryBonus(user?.gillerProfile?.territories, params.originRef, params.destinationRef);
      const gillerType = user?.gillerProfile?.type;
      
      let professionalismBonus = 0;
      if (gillerType === 'professional') {
        professionalismBonus = params.hasAddressLeg ? 10 : 6;
      }

      return {
        gillerId: match.gillerId,
        totalScore: match.totalScore + routeBonus + territoryBonus + professionalismBonus,
      };
    })
  );

  return rescored
    .sort((left, right) => right.totalScore - left.totalScore)
    .map((item) => item.gillerId)
    .filter((gillerId, index, list) => list.indexOf(gillerId) === index)
    .slice(0, params.topN ?? 5);
}

type Beta1AddressDetail = {
  roadAddress?: string;
  detailAddress?: string;
};

type Beta1DeliveryExecutionDoc = {
  requestId?: string;
  gillerId?: string;
  status?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  pickupAddressDetail?: Beta1AddressDetail;
  deliveryAddressDetail?: Beta1AddressDetail;
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  fee?: {
    breakdown?: {
      gillerFee?: number;
    };
    totalFee?: number;
  };
};

async function createDeliveryLegRecord(params: {
  requestId: string;
  deliveryId: string;
  legType: DeliveryLegType;
  actorType: DeliveryActorType;
  sequence: number;
  originRef: LocationRef;
  destinationRef: LocationRef;
  status?: DeliveryLegStatus;
}): Promise<DeliveryLeg> {
  const legPayload = {
    requestId: params.requestId,
    deliveryId: params.deliveryId,
    legType: params.legType,
    actorType: params.actorType,
    sequence: params.sequence,
    originRef: params.originRef,
    destinationRef: params.destinationRef,
    status: params.status ?? DeliveryLegStatus.READY,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const legRef = await addDoc(collection(db, 'delivery_legs'), legPayload);

  return {
    deliveryLegId: legRef.id,
    ...legPayload,
    status: params.status ?? DeliveryLegStatus.READY,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function resolveRequestedHour(preferredPickupTime?: string): number {
  const value = preferredPickupTime?.trim();
  if (!value || value === 'now' || value === '지금 바로') {
    return new Date().getHours();
  }

  const matched = value.match(/(\d{1,2}):(\d{2})/);
  if (!matched) {
    return new Date().getHours();
  }

  const hour = Number(matched[1]);
  return Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : new Date().getHours();
}

function toRequestStationInfo(station: StationInfo): RequestStationInfo {
  return {
    id: station.id ?? station.stationId,
    stationId: station.stationId,
    stationName: station.stationName,
    line: station.line ?? '',
    lineCode: station.lineCode ?? '',
    lat: station.lat ?? 0,
    lng: station.lng ?? 0,
  };
}

function isPeakHour(hour: number): boolean {
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
}

function pricingCardToQuote(
  card: Beta1QuoteCard,
  requestDraftId: string,
  requesterUserId: string
): Omit<PricingQuote, 'pricingQuoteId'> {
  return {
    requestDraftId,
    requesterUserId,
    quoteType: card.quoteType,
    pricingVersion: 'beta1-v2',
    selectedDeliveryOption: {
      speedLabel: card.label,
      includesLocker: card.includesLocker,
      includesAddressPickup: card.includesAddressPickup,
      includesAddressDropoff: card.includesAddressDropoff,
      requestMode: undefined,
      preferredPickupTime: undefined,
      preferredArrivalTime: undefined,
    },
    suggestedByAI: {
      startingPrice: card.pricing.publicPrice,
      suggestedDeposit: card.pricing.depositAmount,
    },
    finalPricing: card.pricing,
    status: PricingQuoteStatus.PRESENTED,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function createBeta1Request(input: Beta1RequestCreateInput): Promise<{
  requestId: string;
  requestDraftId: string;
  pricingQuoteId: string;
  quoteCards: Beta1QuoteCard[];
}> {
  const pickupAddress = formatDetailedAddress(input.pickupRoadAddress, input.pickupDetailAddress);
  const deliveryAddress = formatDetailedAddress(input.deliveryRoadAddress, input.deliveryDetailAddress);
  const pricingPolicy = await getPricingPolicyConfig();
  const requestedHour = resolveRequestedHour(input.preferredPickupTime);
  const routeOverride = await getRoutePricingOverrideByStations({
    pickupStationId: input.pickupStation.stationId,
    deliveryStationId: input.deliveryStation.stationId,
    requestMode: input.requestMode,
  });
  let quoteCards = buildBeta1QuoteCards(input, pricingPolicy, routeOverride);
  let recommendedQuoteType: Beta1QuoteCard['quoteType'] = input.selectedQuoteType;

  const aiQuoteResponse =
    input.aiQuoteOverride ??
    (await (async () => {
      try {
        return await generatePricingQuotesForBeta1Input({
          requesterUserId: input.requesterUserId,
          pickupStation: toRequestStationInfo(input.pickupStation),
          deliveryStation: toRequestStationInfo(input.deliveryStation),
          packageDescription: input.packageDescription,
          itemValue: input.itemValue,
          weightKg: input.weightKg,
          packageSize: normalizePackageSize(input.packageSize),
          requestMode: input.requestMode,
          preferredPickupTime: input.preferredPickupTime,
          preferredArrivalTime: input.preferredArrivalTime,
          urgency: input.urgency,
          directParticipationMode: input.directParticipationMode,
          basePricing: buildBeta1BasePricing(input, pricingPolicy),
        });
      } catch (error) {
        console.error('[orchestration-service] pricing AI fallback to deterministic cards', error);
        return null;
      }
    })());

  if (aiQuoteResponse) {
    const applied = applyAIQuoteResponseToCards(quoteCards, aiQuoteResponse);
    quoteCards = applied.quoteCards;
    recommendedQuoteType = applied.recommendedQuoteType;
  }

  const selectedCard =
    quoteCards.find((card) => card.quoteType === input.selectedQuoteType) ??
    quoteCards.find((card) => card.quoteType === recommendedQuoteType) ??
    quoteCards[0];
  let requestDraftId = '';
  let selectedQuoteId = '';

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  };

  const runDraftPipeline = async (): Promise<{ requestDraftId: string; selectedQuoteId: string }> => {
    const aiConfig = await getAIIntegrationConfig();
    const requestDraft = await createRequestDraft(
      buildRequestDraftFromLegacyInput({
        requesterUserId: input.requesterUserId,
        pickupStation: input.pickupStation,
        deliveryStation: input.deliveryStation,
        selectedPhotoIds: input.selectedPhotoIds,
        itemName: input.packageItemName,
        category: input.packageCategory,
        description: input.packageDescription,
        estimatedValue: input.itemValue,
        estimatedWeightKg: input.weightKg,
        estimatedSize: normalizePackageSize(input.packageSize),
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
      })
    );

    await updateRequestDraft(requestDraft.requestDraftId, {
      requestMode: input.requestMode ?? 'immediate',
      sourceRequestId: input.sourceRequestId,
      originType: input.originType ?? 'station',
      destinationType: input.destinationType ?? 'station',
      originRef:
        (input.originType ?? 'station') === 'address' && pickupAddress
          ? {
              ...toAddressLocationRef(pickupAddress, input.pickupStation),
              roadAddress: input.pickupRoadAddress?.trim(),
              detailAddress: input.pickupDetailAddress?.trim(),
            }
          : toLocationRef(input.pickupStation),
      destinationRef:
        (input.destinationType ?? 'station') === 'address' && deliveryAddress
          ? {
              ...toAddressLocationRef(deliveryAddress, input.deliveryStation),
              roadAddress: input.deliveryRoadAddress?.trim(),
              detailAddress: input.deliveryDetailAddress?.trim(),
            }
          : toLocationRef(input.deliveryStation),
      preferredSchedule: {
        pickupTime: input.preferredPickupTime,
        arrivalTime: input.preferredArrivalTime,
      },
    });

    const aiResult = input.aiAnalysisOverride?.result ?? {
      itemName: input.packageItemName ?? undefined,
      category: input.packageCategory ?? undefined,
      description: input.packageDescription ?? undefined,
      estimatedValue: input.itemValue ?? undefined,
      estimatedWeightKg: input.weightKg ?? undefined,
      estimatedSize: normalizePackageSize(input.packageSize) ?? undefined,
      handlingNotes:
        input.requestMode === 'reservation'
          ? [
              input.directParticipationMode === 'locker_assisted' ? 'locker_preferred' : 'meetup_preferred',
              'reservation_window_preferred',
            ]
          : [
              input.directParticipationMode === 'locker_assisted' ? 'locker_preferred' : 'meetup_preferred',
              'fast_match_priority',
            ],
      riskFlags: input.requestMode === 'reservation' ? ['reserved_window'] : ['tight_sla_candidate'],
    };

    const aiAnalysis = await createAIAnalysis({
      requestDraftId: requestDraft.requestDraftId,
      requesterUserId: input.requesterUserId,
      inputPhotoIds: input.selectedPhotoIds ?? [],
      provider: input.aiAnalysisOverride?.provider ?? aiConfig.provider,
      model: input.aiAnalysisOverride?.model ?? aiConfig.analysisModel,
      confidence: input.aiAnalysisOverride?.confidence ?? 0.72,
      result: aiResult,
      status: input.aiAnalysisOverride?.fallbackUsed ? AIAnalysisStatus.LOW_CONFIDENCE : AIAnalysisStatus.COMPLETED,
    });

    await updateRequestDraft(requestDraft.requestDraftId, {
      aiAnalysisId: aiAnalysis.aiAnalysisId,
      status: RequestDraftStatus.READY_FOR_REVIEW,
    });

    const quoteDocs = await Promise.all(
      quoteCards.map((card) =>
        createPricingQuote({
          ...pricingCardToQuote(card, requestDraft.requestDraftId, input.requesterUserId),
          selectedDeliveryOption: {
            ...pricingCardToQuote(card, requestDraft.requestDraftId, input.requesterUserId).selectedDeliveryOption,
            requestMode: input.requestMode ?? 'immediate',
            preferredPickupTime: input.preferredPickupTime,
            preferredArrivalTime: input.preferredArrivalTime,
          },
        })
      )
    );

    const selectedQuote = quoteDocs.find((quote) => quote.quoteType === selectedCard.quoteType) ?? quoteDocs[0];
    await markPricingQuoteSelected(selectedQuote.pricingQuoteId, requestDraft.requestDraftId);
    await updateRequestDraft(requestDraft.requestDraftId, {
      status: RequestDraftStatus.SUBMITTED,
      selectedPricingQuoteId: selectedQuote.pricingQuoteId,
    });

    return { requestDraftId: requestDraft.requestDraftId, selectedQuoteId: selectedQuote.pricingQuoteId };
  };

  try {
    const result = await withTimeout(runDraftPipeline(), 8000);
    requestDraftId = result.requestDraftId;
    selectedQuoteId = result.selectedQuoteId;
  } catch (error) {
    console.error('[orchestration-service] draft pipeline skipped:', error);
    requestDraftId = '';
    selectedQuoteId = '';
  }

  // 기본 마감기한 정책: 예약 모드면 예약시간 기준 + 2시간, 즉시 모드면 현재 + 2시간
  const deadlineHours = 2;
  let deadlineTimestamp = Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * deadlineHours));
  if (input.requestMode === 'reservation' && input.preferredPickupTime) {
    const pickupDate = new Date(input.preferredPickupTime);
    if (!Number.isNaN(pickupDate.getTime())) {
      deadlineTimestamp = Timestamp.fromDate(new Date(pickupDate.getTime() + 1000 * 60 * 60 * deadlineHours));
    }
  }

  const requestPayload = {
    requestDraftId: requestDraftId || null,
    requesterId: input.requesterUserId,
    requesterUserId: input.requesterUserId,
    pricingQuoteId: selectedQuoteId || null,
    originType: input.originType ?? 'station',
    destinationType: input.destinationType ?? 'station',
    pickupAddress: pickupAddress ?? '',
    deliveryAddress: deliveryAddress ?? '',
    pickupAddressDetail: input.pickupRoadAddress
      ? {
          roadAddress: input.pickupRoadAddress.trim(),
          detailAddress: input.pickupDetailAddress?.trim() ?? '',
          fullAddress: pickupAddress ?? '',
        }
      : null,
    deliveryAddressDetail: input.deliveryRoadAddress
      ? {
          roadAddress: input.deliveryRoadAddress.trim(),
          detailAddress: input.deliveryDetailAddress?.trim() ?? '',
          fullAddress: deliveryAddress ?? '',
        }
      : null,
    pickupStation: input.pickupStation,
    deliveryStation: input.deliveryStation,
    packageInfo: {
      size: input.packageSize ?? null,
      weight: input.weightKg ?? null,
      weightKg: input.weightKg ?? null,
      description: input.packageDescription ?? null,
      imageUrl: input.selectedPhotoIds?.[0] ?? null,
      isFragile: false,
      isPerishable: false,
    },
    recipientName: input.recipientName ?? null,
    recipientPhone: input.recipientPhone ?? null,
    pickupLocationDetail: input.pickupLocationDetail?.trim() || null,
    storageLocation: input.storageLocation?.trim() || null,
    lockerId: input.lockerId?.trim() || null,
    pickupLockerId: input.pickupLockerId?.trim() || null,
    dropoffLockerId: input.dropoffLockerId?.trim() || null,
    pickupStorageLocation: input.pickupStorageLocation?.trim() || null,
    dropoffStorageLocation: input.dropoffStorageLocation?.trim() || null,
    pickupLockerFee: input.pickupLockerFee ?? null,
    dropoffLockerFee: input.dropoffLockerFee ?? null,
    specialInstructions: input.specialInstructions?.trim() || null,
    deadline: deadlineTimestamp,
    preferredTime: {
      departureTime: input.preferredPickupTime ?? '지금 바로',
      arrivalTime: input.preferredArrivalTime ?? '협의 가능',
    },
    pricingContext: {
      requestMode: input.requestMode ?? 'immediate',
      weather: input.pricingContextOverride?.weather ?? 'clear',
      isPeakTime: input.pricingContextOverride?.isPeakTime ?? isPeakHour(requestedHour),
      isProfessionalPeak: input.pricingContextOverride?.isProfessionalPeak ?? false,
      nearbyGillerCount: input.pricingContextOverride?.nearbyGillerCount ?? null,
      requestedHour: input.pricingContextOverride?.requestedHour ?? requestedHour,
      urgencyBucket:
        input.pricingContextOverride?.urgencyBucket ??
        (input.urgency === 'urgent' ? 'urgent' : input.urgency === 'fast' ? 'fast' : 'normal'),
    },
    pricingPolicyVersion: input.pricingPolicyVersion ?? pricingPolicy.version,
    requestMode: input.requestMode ?? 'immediate',
    sourceRequestId: input.sourceRequestId ?? null,
    missionProgress: {
      acceptedMissionCount: 0,
      totalMissionCount: 0,
      partiallyMatched: false,
      lastBundleId: null,
      lastMatchedAt: null,
      rewardBoostAmount: 0,
    },
    status: 'pending',
    beta1RequestStatus: 'match_pending',
    beta1EngineVersion: 'beta1-v2',
    fee: {
      ...selectedCard.pricing,
      totalFee: selectedCard.pricing.publicPrice,
    },
    initialNegotiationFee: selectedCard.pricing.publicPrice,
    itemValue: input.itemValue ?? 0,
    selectedPhotoIds: input.selectedPhotoIds ?? [],
    selectedCouponId: input.selectedCouponId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const requestId = generateShortId('R');
  const requestRef = doc(collection(db, 'requests'), requestId);
  const cleanRequestPayload = cleanForFirestore(requestPayload);
  await setDoc(requestRef, cleanRequestPayload);

  const deliveryId = generateShortId('D');
  const deliveryRef = doc(collection(db, 'deliveries'), deliveryId);
  const deliveryPayload = {
    requestId: requestRef.id,
    requesterId: input.requesterUserId,
    pickupStation: input.pickupStation,
    deliveryStation: input.deliveryStation,
    pickupLocationDetail: input.pickupLocationDetail?.trim() || null,
    storageLocation: input.storageLocation?.trim() || null,
    lockerId: input.lockerId?.trim() || null,
    pickupLockerId: input.pickupLockerId?.trim() || null,
    dropoffLockerId: input.dropoffLockerId?.trim() || null,
    pickupStorageLocation: input.pickupStorageLocation?.trim() || null,
    dropoffStorageLocation: input.dropoffStorageLocation?.trim() || null,
    pickupLockerFee: input.pickupLockerFee ?? null,
    dropoffLockerFee: input.dropoffLockerFee ?? null,
    specialInstructions: input.specialInstructions?.trim() || null,
    recipientName: input.recipientName ?? null,
    recipientPhone: input.recipientPhone ?? null,
    pricingPolicyVersion: input.pricingPolicyVersion ?? pricingPolicy.version,
    status: 'pending',
    beta1DeliveryStatus: 'created',
    selectedCouponId: input.selectedCouponId ?? null,
    fee: {
      ...selectedCard.pricing,
      totalFee: selectedCard.pricing.publicPrice,
      breakdown: {
        gillerFee: Math.round(selectedCard.pricing.publicPrice * (1 - (pricingPolicy.platformFeeRate ?? 0.3))),
      },
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const cleanDeliveryPayload = cleanForFirestore(deliveryPayload);
  await setDoc(deliveryRef, cleanDeliveryPayload);

  await updateDoc(doc(db, 'requests', requestRef.id), {
    primaryDeliveryId: deliveryRef.id,
    updatedAt: serverTimestamp(),
  });

  try {
    const legDefinitions = buildSegmentedLegDefinitions({
      requestId: requestRef.id,
      deliveryId: deliveryRef.id,
      originType: input.originType ?? 'station',
      destinationType: input.destinationType ?? 'station',
      pickupStation: input.pickupStation,
      deliveryStation: input.deliveryStation,
      pickupAddress,
      pickupRoadAddress: input.pickupRoadAddress,
      pickupDetailAddress: input.pickupDetailAddress,
      deliveryAddress,
      deliveryRoadAddress: input.deliveryRoadAddress,
      deliveryDetailAddress: input.deliveryDetailAddress,
    });
    await updateDoc(doc(db, 'requests', requestRef.id), {
      missionProgress: {
        acceptedMissionCount: 0,
        totalMissionCount: legDefinitions.length,
        partiallyMatched: false,
        lastBundleId: null,
        lastMatchedAt: null,
        rewardBoostAmount: 0,
      },
      updatedAt: serverTimestamp(),
    });
    const legRewards = splitRewardAcrossLegs(
      Math.max(0, Math.round(selectedCard.pricing.publicPrice * (1 - (pricingPolicy.platformFeeRate ?? 0.3)))),
      legDefinitions.length
    );

    const activePartners = await deliveryPartnerService.getActivePartners();
    const fallbackPartnerId = activePartners.length > 0 ? activePartners[0].partnerId : undefined;

    for (let index = 0; index < legDefinitions.length; index += 1) {
      const definition = legDefinitions[index];
      const deliveryLeg = await createDeliveryLegRecord({
        requestId: requestRef.id,
        deliveryId: deliveryRef.id,
        legType: definition.legType,
        actorType: definition.actorType,
        sequence: definition.sequence,
        originRef: definition.originRef,
        destinationRef: definition.destinationRef,
      });

      await createMissionForDeliveryLeg({
        requestId: requestRef.id,
        deliveryId: deliveryRef.id,
        deliveryLeg,
        currentReward: legRewards[index] ?? 0,
      });

      await persistActorSelectionDecision({
        requestId: requestRef.id,
        deliveryId: deliveryRef.id,
        deliveryLegId: deliveryLeg.deliveryLegId,
        interventionLevel: requiresAddressHandling(definition.legType) ? 'guarded_execute' : 'recommend',
        selectedActorType: requiresAddressHandling(definition.legType) ? ActorType.EXTERNAL_PARTNER : ActorType.GILLER,
        selectedPartnerId: requiresAddressHandling(definition.legType) ? fallbackPartnerId : undefined,
        selectionReason: requiresAddressHandling(definition.legType)
          ? '주소 구간이라 길러 선택이 없으면 external partner fallback을 우선 검토합니다.'
          : '역간 이동 구간이라 길러 수행을 우선 제안합니다.',
        fallbackActorTypes: requiresAddressHandling(definition.legType)
          ? [ActorType.GILLER]
          : [ActorType.EXTERNAL_PARTNER],
        fallbackPartnerIds: [], // 하드코딩 제거: 동적 설정 또는 빈 배열
        manualReviewRequired: false,
        riskFlags: requiresAddressHandling(definition.legType) ? ['address_leg'] : [],
      });
    }

    // UI 블로킹 방지를 위해 번들링 및 매칭(길러 탐색) 로직은 백그라운드에서 비동기로 실행합니다.
    bundleMissionsForDelivery(deliveryRef.id)
      .then(async (bundles) => {
        const candidateGillerIds = Array.from(
          new Set(
            bundles.flatMap((bundle) => bundle.candidateGillerUserIds ?? [])
          )
        );

        await Promise.all(
          candidateGillerIds.map((gillerId) =>
            sendMissionBundleAvailableNotification(
              gillerId,
              requestRef.id,
              input.pickupStation.stationName,
              input.deliveryStation.stationName,
              selectedCard.pricing.publicPrice,
              bundles.length
            )
          )
        );
      })
      .catch((err) => {
        console.error('[orchestration-service] background bundling failed', err);
      });

  } catch (error) {
    console.error('[orchestration-service] orchestration failed, but request was created', {
      requestId: requestRef.id,
      deliveryId: deliveryRef.id,
      error,
    });
  }

  return {
    requestId: requestRef.id,
    requestDraftId,
    pricingQuoteId: selectedQuoteId,
    quoteCards,
  };
}

export async function selectActorForMission(params: {
  requestId: string;
  missionType: Mission['missionType'];
  preferLocker: boolean;
  requiresAddressHandling: boolean;
  urgency: 'normal' | 'fast' | 'urgent';
}): Promise<Omit<ActorSelectionDecision, 'decisionId' | 'createdAt' | 'updatedAt'>> {
  const interventionLevel: AIInterventionLevel = params.requiresAddressHandling ? 'guarded_execute' : 'recommend';
  let selectedActorType: ActorSelectionActorType = ActorType.GILLER;
  let selectedPartnerId: string | undefined;
  let selectionReason = '지하철 기반 구간이라 길러 미션으로 이어지는 흐름이 자연스럽습니다.';
  const fallbackActorTypes: ActorSelectionActorType[] = [ActorType.LOCKER, ActorType.EXTERNAL_PARTNER];

  if (params.preferLocker) {
    selectedActorType = ActorType.LOCKER;
    selectionReason = '비대면 인계가 유리해 보관함 연계를 우선 적용합니다.';
  } else if (params.requiresAddressHandling || params.urgency === 'urgent') {
    const activePartners = await deliveryPartnerService.getActivePartners();
    selectedActorType = ActorType.EXTERNAL_PARTNER;
    selectedPartnerId = activePartners.length > 0 ? activePartners[0].partnerId : undefined;
    selectionReason = '주소 기반 즉시 처리 구간이라 외부 파트너를 우선 검토합니다.';
  }

  return {
    requestId: params.requestId,
    interventionLevel,
    selectedActorType,
    selectedPartnerId,
    selectionReason,
    fallbackActorTypes,
    fallbackPartnerIds: [],
    manualReviewRequired: params.urgency === 'urgent' && params.requiresAddressHandling,
    riskFlags: params.urgency === 'urgent' ? ['tight_sla'] : [],
  };
}

export async function bundleMissionsForDelivery(deliveryId: string): Promise<MissionBundle[]> {
  const [missionSnapshot, legSnapshot, deliveryDoc] = await Promise.all([
    getDocs(query(collection(db, 'missions'), where('deliveryId', '==', deliveryId))),
    getDocs(query(collection(db, 'delivery_legs'), where('deliveryId', '==', deliveryId))),
    getDoc(doc(db, 'deliveries', deliveryId)),
  ]);

  const deliveryMissions = missionSnapshot.docs
    .map((missionDoc) => ({
      id: missionDoc.id,
      ...(missionDoc.data() as Record<string, unknown>),
    }) as Beta1MissionDoc)
    .sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0));

  if (deliveryMissions.length === 0) {
    return [];
  }

  const legsById = new Map(
    legSnapshot.docs.map((legDoc) => {
      const leg = { id: legDoc.id, ...(legDoc.data() as Record<string, unknown>) } as Beta1LegDoc;
      return [legDoc.id, leg] as const;
    })
  );

  const requestId = String(deliveryMissions[0].requestId ?? '');
  const _deliveryData = (deliveryDoc.data() as Record<string, unknown> | undefined) ?? {};

  const bundles: MissionBundle[] = [];
  let bundleIndex = 0;

  for (let start = 0; start < deliveryMissions.length; start += 1) {
    // 번들 생성 최적화: 구간 전체(Whole)와 단일 구간(Single)만 번들로 생성 (O(N^2) 방지)
    const endIndices = [start];
    if (start === 0 && deliveryMissions.length > 1) {
      endIndices.push(deliveryMissions.length - 1);
    }
    
    for (const end of endIndices) {
      bundleIndex += 1;
      const missionGroup = deliveryMissions.slice(start, end + 1);
      const firstMission = missionGroup[0];
      const lastMission = missionGroup[missionGroup.length - 1];
      const firstLeg = legsById.get(String(firstMission.deliveryLegId ?? ''));
      const lastLeg = legsById.get(String(lastMission.deliveryLegId ?? ''));
      const missionIds = missionGroup.map((mission) => String(mission.id));
      const rewardTotal = missionGroup.reduce((sum, mission) => sum + Number(mission.currentReward ?? 0), 0);
      const legTypes = missionGroup.map((mission) => legsById.get(String(mission.deliveryLegId ?? ''))?.legType ?? 'subway_transport');
      const hasAddressLeg = legTypes.some((legType) => requiresAddressHandling(legType));
      const selectedGillerUserId = missionGroup.every((mission) => mission.assignedGillerUserId)
        ? String(missionGroup[0].assignedGillerUserId)
        : undefined;
      const title = `${describeLocationRef(firstMission.originRef ?? firstLeg?.originRef ?? { type: 'station' })} -> ${describeLocationRef(lastMission.destinationRef ?? lastLeg?.destinationRef ?? { type: 'station' })}`;
      const summary = legTypes.map((legType) => describeLegType(legType)).join(' · ');
      let candidateGillerUserIds: string[] = [];

      try {
        candidateGillerUserIds = await rankCandidateGillersForBundle({
          requestId,
          originRef: firstMission.originRef ?? firstLeg?.originRef,
          destinationRef: lastMission.destinationRef ?? lastLeg?.destinationRef,
          hasAddressLeg,
          topN: 5,
        });
      } catch (error) {
        console.error('[orchestration-service] 번들별 매칭 후보 조회 실패:', {
          requestId,
          deliveryId,
          bundleStart: start,
          bundleEnd: end,
          error,
        });
        candidateGillerUserIds = [];
      }

      bundles.push({
        missionBundleId: `${deliveryId}-bundle-${bundleIndex}`,
        requestId,
        deliveryId,
        missionIds,
        status: BundleStatus.ACTIVE as MissionBundleStatus,
        strategy: hasAddressLeg ? 'partner_fallback' : missionGroup.length > 1 ? 'multi_actor' : 'single_actor',
        bundleType: missionGroup.length > 1 ? 'contiguous_range' : 'single_leg',
        startSequence: Number(firstMission.sequence ?? start + 1),
        endSequence: Number(lastMission.sequence ?? end + 1),
        title,
        summary,
        windowLabel: buildMissionWindowLabel(missionGroup.length, hasAddressLeg),
        rewardTotal,
        recommendedActorType: hasAddressLeg ? ActorType.EXTERNAL_PARTNER : ActorType.GILLER,
        candidateGillerUserIds,
        selectedGillerUserId,
        requiresExternalPartner: hasAddressLeg,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  }

  await Promise.all(
    bundles.map((bundle) => {
      const cleanBundle = cleanForFirestore({
        ...bundle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return setDoc(doc(db, 'mission_bundles', bundle.missionBundleId), cleanBundle);
    })
  );

  return bundles;
}

export async function createMissionForDeliveryLeg(params: {
  requestId: string;
  deliveryId: string;
  deliveryLeg: DeliveryLeg;
  assignedGillerUserId?: string;
  currentReward?: number;
}): Promise<Mission> {
  const missionType = mapLegTypeToMissionType(params.deliveryLeg.legType);
  const missionPayload = {
    requestId: params.requestId,
    deliveryId: params.deliveryId,
    deliveryLegId: params.deliveryLeg.deliveryLegId,
    sequence: params.deliveryLeg.sequence,
    missionType,
    status: params.assignedGillerUserId ? MissionState.ACCEPTED : MissionState.QUEUED,
    originRef: params.deliveryLeg.originRef,
    destinationRef: params.deliveryLeg.destinationRef,
    recommendedReward: params.currentReward ?? 0,
    minimumReward: params.currentReward ?? 0,
    currentReward: params.currentReward ?? 0,
    assignedGillerUserId: params.assignedGillerUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const missionRef = await addDoc(collection(db, 'missions'), cleanForFirestore(missionPayload));
  return {
    missionId: missionRef.id,
    requestId: params.requestId,
    deliveryId: params.deliveryId,
    deliveryLegId: params.deliveryLeg.deliveryLegId,
    sequence: params.deliveryLeg.sequence,
    missionType,
    status: missionPayload.status,
    originRef: params.deliveryLeg.originRef,
    destinationRef: params.deliveryLeg.destinationRef,
    recommendedReward: params.currentReward ?? 0,
    minimumReward: params.currentReward ?? 0,
    currentReward: params.currentReward ?? 0,
    assignedGillerUserId: params.assignedGillerUserId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

async function dispatchMissionToB2BFallback(params: {
  requestId: string;
  mission: Beta1MissionDoc;
  leg: Beta1LegDoc;
  requestDoc?: Record<string, unknown>;
}): Promise<string | null> {
  if (!requiresAddressHandling(params.leg.legType)) {
    return null;
  }

  try {
    // 실제 외부 파트너 연동이 진행되는 시점에서는 delivery_partners 컬렉션에서
    // 매칭 가능한 파트너의 ID나 견적 ID를 받아오는 로직이 필요합니다.
    // 현재는 시스템 식별용 Fallback ID를 발급합니다.
    return `beta1-fallback:${params.requestId}:${params.mission.id}`;
  } catch (error) {
    console.warn('Unable to prepare fallback plan id', error);
    return null;
  }
}

async function queueExternalPartnerDispatch(params: {
  partnerId?: string;
  requestId: string;
  deliveryId?: string;
  missionId: string;
  deliveryLegId?: string;
  leg: Beta1LegDoc;
  fallbackDeliveryId?: string | null;
}): Promise<string | null> {
  if (!params.partnerId) {
    return null;
  }

  try {
    return await deliveryPartnerService.queueDispatch({
      partnerId: params.partnerId,
      missionId: params.missionId,
      requestId: params.requestId,
      deliveryId: params.deliveryId,
      deliveryLegId: params.deliveryLegId,
      partnerCapability: requiresAddressHandling(params.leg.legType) ? 'address_dropoff' : 'station_to_station',
      dispatchMethod: 'api',
      opsMemo: params.fallbackDeliveryId
        ? `fallback_delivery:${params.fallbackDeliveryId}`
        : 'queued_from_beta1_external_partner_selection',
      originRef: params.leg.originRef,
      destinationRef: params.leg.destinationRef,
      payload: {
        legType: params.leg.legType,
        actorType: 'external_partner',
      },
    });
  } catch (error) {
    console.warn('Unable to queue external partner dispatch', error);
    return null;
  }
}

export async function acceptMissionBundleForGiller(bundleId: string, gillerUserId: string): Promise<void> {
  const bundleRef = doc(db, 'mission_bundles', bundleId);
  
  let result;
  try {
    result = await runTransaction(db, async (transaction: any): Promise<any> => {
      const bundleSnapshot = await transaction.get(bundleRef);
      if (!bundleSnapshot.exists()) {
        throw new Error('Mission bundle not found');
      }

      const bundle = {
        missionBundleId: bundleSnapshot.id,
        ...(bundleSnapshot.data() as Record<string, unknown>),
      } as Beta1MissionBundleDoc;

      if (bundle.selectedGillerUserId && bundle.selectedGillerUserId !== gillerUserId) {
        throw new Error('Mission bundle already accepted by another giller');
      }

      const missionDocs = await Promise.all(
        (bundle.missionIds ?? []).map(async (missionId) => {
          const snapshot = await transaction.get(doc(db, 'missions', missionId));
          return snapshot.exists()
            ? ({ id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as Beta1MissionDoc)
            : null;
        })
      );
      const selectedMissions = missionDocs.filter(Boolean) as Beta1MissionDoc[];
      
      const requestRef = bundle.requestId ? doc(db, 'requests', bundle.requestId) : null;
      const requestSnapshot = requestRef ? await transaction.get(requestRef) : null;
      const requestData = (requestSnapshot?.data() as Record<string, unknown> | undefined) ?? {};
      
      const siblingBundleSnapshots = await getDocs(query(collection(db, 'mission_bundles'), where('deliveryId', '==', bundle.deliveryId)));
      const siblingBundles = siblingBundleSnapshots.docs.map((snapshot) => ({
        missionBundleId: snapshot.id,
        ...(snapshot.data() as Record<string, unknown>),
      })) as Beta1MissionBundleDoc[];
      
      const baseSelectedRewardTotal = selectedMissions.reduce((sum, mission) => sum + Number(mission.currentReward ?? 0), 0);
      const exposurePricing = getMissionExposurePricing(baseSelectedRewardTotal, bundle.createdAt);
      const bonusAmount = exposurePricing.bonusAmount;
      const perMissionBonus =
        selectedMissions.length > 0 && bonusAmount > 0
          ? Math.floor(bonusAmount / selectedMissions.length / 100) * 100
          : 0;
      const bonusRemainder = selectedMissions.length > 0 ? bonusAmount - perMissionBonus * selectedMissions.length : 0;

      selectedMissions.forEach((mission, index) => {
        const rewardBonus = perMissionBonus + (index === 0 ? bonusRemainder : 0);
        const nextReward = Number(mission.currentReward ?? 0) + rewardBonus;

        transaction.update(doc(db, 'missions', mission.id), {
          assignedGillerUserId: gillerUserId,
          status: MissionState.ACCEPTED,
          currentReward: nextReward,
          recommendedReward: nextReward,
          minimumReward: Number(mission.currentReward ?? 0),
          updatedAt: serverTimestamp(),
        });
      });

      const selectedLegIds = selectedMissions.map((mission) => String(mission.deliveryLegId ?? ''));
      selectedLegIds.forEach((deliveryLegId) => {
        if (deliveryLegId) {
          transaction.update(doc(db, 'delivery_legs', deliveryLegId), {
            actorType: 'giller',
            status: DeliveryLegStatus.READY,
            updatedAt: serverTimestamp(),
          });
        }
      });

      transaction.update(bundleRef, {
        selectedGillerUserId: gillerUserId,
        status: BundleStatus.ACTIVE,
        rewardTotal: exposurePricing.adjustedReward,
        updatedAt: serverTimestamp(),
      });

      // To avoid nested async calls inside transaction that might break locks,
      // we prepare the data and return it to be processed outside or simply read needed states.
      // Fetching all missions to calculate coversEntireDelivery
      const allMissionSnapshots = await getDocs(query(collection(db, 'missions'), where('deliveryId', '==', bundle.deliveryId)));
      const allMissions = allMissionSnapshots.docs.map((snapshot) => ({
        id: snapshot.id,
        ...(snapshot.data() as Record<string, unknown>),
      })) as Beta1MissionDoc[];

      const coversEntireDelivery = selectedMissions.length === allMissions.length;
      const acceptedMissionCount = allMissions.filter(
        (mission) => Boolean(mission.assignedGillerUserId) || selectedLegIds.includes(String(mission.deliveryLegId ?? ''))
      ).length;
      const totalMissionCount = allMissions.length;
      const partiallyMatched = acceptedMissionCount > 0 && acceptedMissionCount < totalMissionCount;
      
      const deliveryUpdate: Record<string, unknown> = {
        beta1DeliveryStatus: coversEntireDelivery ? 'assigned' : 'created',
        updatedAt: serverTimestamp(),
      };
      if (coversEntireDelivery) {
        deliveryUpdate.gillerId = gillerUserId;
      }
      transaction.update(doc(db, 'deliveries', bundle.deliveryId), deliveryUpdate);

      if (requestRef) {
        transaction.update(requestRef, {
          matchedGillerId: coversEntireDelivery ? gillerUserId : null,
          status: coversEntireDelivery ? 'accepted' : 'pending',
          beta1RequestStatus: coversEntireDelivery ? 'accepted' : 'match_pending',
          missionProgress: {
            acceptedMissionCount,
            totalMissionCount,
            partiallyMatched,
            lastBundleId: bundle.missionBundleId,
            lastMatchedAt: serverTimestamp(),
            rewardBoostAmount: bonusAmount,
          },
          updatedAt: serverTimestamp(),
        });
      }

      const blockedMissionIds = new Set([...selectedMissions.map((mission) => mission.id)]);
      siblingBundles
        .filter((candidate) => candidate.missionBundleId !== bundle.missionBundleId)
        .filter((candidate) => (candidate.missionIds ?? []).some((missionId) => blockedMissionIds.has(missionId)))
        .forEach((candidate) => {
          transaction.update(doc(db, 'mission_bundles', candidate.missionBundleId), {
            status: BundleStatus.CANCELLED,
            updatedAt: serverTimestamp(),
          });
        });

      return {
        bundle,
        requestData,
        partiallyMatched,
        siblingBundles,
        blockedMissionIds,
        acceptedMissionCount,
        totalMissionCount,
        coversEntireDelivery,
      };
    });
  } catch (error) {
    console.error('Transaction failed during acceptMissionBundleForGiller', error);
    throw error;
  }

  const {
    bundle,
    requestData,
    partiallyMatched,
    siblingBundles,
    blockedMissionIds,
    acceptedMissionCount,
    totalMissionCount,
    coversEntireDelivery,
  } = result;

  // 알림 등 트랜잭션 외부 작업 수행
  if (partiallyMatched && bundle.requestId) {
    const remainingBundles = siblingBundles
      .filter((candidate: any) => candidate.missionBundleId !== bundle.missionBundleId)
      .filter((candidate: any) => candidate.status === BundleStatus.ACTIVE)
      .filter((candidate: any) => (candidate.missionIds ?? []).every((missionId: string) => !blockedMissionIds.has(missionId)));

    const pickupStationRecord = (requestData.pickupStation as { stationName?: string } | undefined) ?? {};
    const deliveryStationRecord = (requestData.deliveryStation as { stationName?: string } | undefined) ?? {};
    const feeRecord = (requestData.fee as { totalFee?: number } | undefined) ?? {};
    const remainingCandidateIds = Array.from(
      new Set(
        remainingBundles.flatMap((candidate: any) => candidate.candidateGillerUserIds ?? [])
      )
    ).filter((candidateId) => candidateId !== gillerUserId);

    await Promise.all(
      remainingCandidateIds.map((candidateId) =>
        sendMissionBundleAvailableNotification(
          candidateId as string,
          bundle.requestId,
          String(pickupStationRecord.stationName ?? '출발역'),
          String(deliveryStationRecord.stationName ?? '도착역'),
          Number(feeRecord.totalFee ?? 0),
          remainingBundles.length
        )
      )
    );
  }

  if (bundle.requestId && requestData.requesterId) {
    await sendRequestProgressNotification(
      String(requestData.requesterId),
      bundle.requestId,
      acceptedMissionCount,
      totalMissionCount,
      coversEntireDelivery
    );
  }
}

export async function releaseMissionBundleForGiller(bundleId: string, gillerUserId: string): Promise<void> {
  const bundleRef = doc(db, 'mission_bundles', bundleId);
  
  let result;
  try {
    result = await runTransaction(db, async (transaction: any): Promise<any> => {
      const bundleSnapshot = await transaction.get(bundleRef);
      if (!bundleSnapshot.exists()) {
        throw new Error('Mission bundle not found');
      }

      const bundle = {
        missionBundleId: bundleSnapshot.id,
        ...(bundleSnapshot.data() as Record<string, unknown>),
      } as Beta1MissionBundleDoc;

      if (bundle.selectedGillerUserId !== gillerUserId) {
        throw new Error('내가 맡은 미션만 반납할 수 있습니다.');
      }

      const missionDocs = await Promise.all(
        (bundle.missionIds ?? []).map(async (missionId) => {
          const snapshot = await transaction.get(doc(db, 'missions', missionId));
          return snapshot.exists()
            ? ({ id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as Beta1MissionDoc)
            : null;
        })
      );
      const selectedMissions = missionDocs.filter(Boolean) as Beta1MissionDoc[];

      if (
        selectedMissions.some((mission) =>
          ['in_progress', 'arrival_pending', 'handover_pending', 'completed'].includes(String(mission.status ?? ''))
        )
      ) {
        throw new Error('이미 진행된 구간은 반납할 수 없습니다.');
      }

      const legSnapshots = await Promise.all(
        selectedMissions.map((mission) => transaction.get(doc(db, 'delivery_legs', String(mission.deliveryLegId ?? ''))))
      );
      const selectedLegs = legSnapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) }) as Beta1LegDoc);

      selectedMissions.forEach((mission) => {
        transaction.update(doc(db, 'missions', mission.id), {
          assignedGillerUserId: deleteField(),
          status: MissionState.QUEUED,
          updatedAt: serverTimestamp(),
        });
      });

      selectedLegs.forEach((leg) => {
        transaction.update(doc(db, 'delivery_legs', leg.deliveryLegId), {
          actorType: requiresAddressHandling(leg.legType) ? 'external_partner' : 'giller',
          status: DeliveryLegStatus.READY,
          updatedAt: serverTimestamp(),
        });
      });

      transaction.update(bundleRef, {
        selectedGillerUserId: deleteField(),
        status: BundleStatus.ACTIVE,
        updatedAt: serverTimestamp(),
      });

      const siblingBundleSnapshots = await getDocs(query(collection(db, 'mission_bundles'), where('deliveryId', '==', bundle.deliveryId)));
      const siblingBundles = siblingBundleSnapshots.docs.map((snapshot) => ({
        missionBundleId: snapshot.id,
        ...(snapshot.data() as Record<string, unknown>),
      })) as Beta1MissionBundleDoc[];

      siblingBundles
        .filter((candidate) => (candidate.missionIds ?? []).some((missionId) => (bundle.missionIds ?? []).includes(missionId)))
        .forEach((candidate) => {
          transaction.update(doc(db, 'mission_bundles', candidate.missionBundleId), {
            status: BundleStatus.ACTIVE,
            updatedAt: serverTimestamp(),
          });
        });

      const requestRef = bundle.requestId ? doc(db, 'requests', bundle.requestId) : null;
      if (requestRef) {
        const allMissionSnapshots = await getDocs(query(collection(db, 'missions'), where('deliveryId', '==', bundle.deliveryId)));
        const allMissions = allMissionSnapshots.docs.map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() as Record<string, unknown>),
        })) as Beta1MissionDoc[];

        // selectedMissions 은 이제 막 취소되었으므로, 남은 수락 건수 계산
        const acceptedMissionCount = allMissions.filter(
          (mission) => Boolean(mission.assignedGillerUserId) && !selectedMissions.some((sm) => sm.id === mission.id)
        ).length;
        const totalMissionCount = allMissions.length;

        transaction.update(requestRef, {
          matchedGillerId: null,
          status: 'pending',
          beta1RequestStatus: 'match_pending',
          missionProgress: {
            acceptedMissionCount,
            totalMissionCount,
            partiallyMatched: acceptedMissionCount > 0,
            lastBundleId: null,
            lastMatchedAt: null,
            rewardBoostAmount: 0,
          },
          updatedAt: serverTimestamp(),
        });
      }
      
      const deliveryRef = bundle.deliveryId ? doc(db, 'deliveries', bundle.deliveryId) : null;
      if (deliveryRef) {
        transaction.update(deliveryRef, {
          gillerId: null,
          beta1DeliveryStatus: 'created',
          updatedAt: serverTimestamp(),
        });
      }

      return { bundle, requestData: requestData || {}, siblingBundles };
    });
  } catch (error) {
    console.error('Transaction failed during releaseMissionBundleForGiller', error);
    throw error;
  }

  const { bundle, requestData, siblingBundles } = result;

  if (bundle.requestId) {
    const pickupStationRecord = (requestData.pickupStation as { stationName?: string } | undefined) ?? {};
    const deliveryStationRecord = (requestData.deliveryStation as { stationName?: string } | undefined) ?? {};
    const feeRecord = (requestData.fee as { totalFee?: number } | undefined) ?? {};
    const reactivatedBundles = siblingBundles.filter((candidate: any) => candidate.status === BundleStatus.ACTIVE);
    const candidateIds = Array.from(
      new Set(
        reactivatedBundles.flatMap((candidate: any) => candidate.candidateGillerUserIds ?? [])
      )
    ).filter((candidateId) => candidateId !== gillerUserId);

    await Promise.all(
      candidateIds.map((candidateId) =>
        sendMissionBundleAvailableNotification(
          candidateId as string,
          bundle.requestId,
          String(pickupStationRecord.stationName ?? '출발역'),
          String(deliveryStationRecord.stationName ?? '도착역'),
          Number(feeRecord.totalFee ?? 0),
          reactivatedBundles.length
        )
      )
    );

    if (requestData.requesterId) {
      await sendMissionReturnedNotification(String(requestData.requesterId), bundle.requestId);
    }
  }
}

export async function persistActorSelectionDecision(
  decision: Omit<ActorSelectionDecision, 'decisionId' | 'createdAt' | 'updatedAt'>
): Promise<ActorSelectionDecision> {
  const payload = {
    ...decision,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'actor_selection_decisions'), cleanForFirestore(payload));

  return {
    decisionId: ref.id,
    ...decision,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function syncDeliveryToBeta1Execution(deliveryId: string): Promise<void> {
  const deliverySnapshot = await getDocs(collection(db, 'deliveries'));
  const deliveryDoc = deliverySnapshot.docs.find((item) => item.id === deliveryId);
  if (!deliveryDoc) {
    return;
  }

  const deliveryData = deliveryDoc.data() as Beta1DeliveryExecutionDoc;
  const existingLegs = await getDocs(collection(db, 'delivery_legs'));
  const hasLeg = existingLegs.docs.some((legDoc) => legDoc.data().deliveryId === deliveryId);
  if (hasLeg) {
    return;
  }

  const requestId = String(deliveryData.requestId ?? '');
  const legDefinitions = buildSegmentedLegDefinitions({
    requestId,
    deliveryId,
    originType: deliveryData.pickupAddress ? 'address' : 'station',
    destinationType: deliveryData.deliveryAddress ? 'address' : 'station',
    pickupStation: deliveryData.pickupStation,
    deliveryStation: deliveryData.deliveryStation,
    pickupAddress: String(deliveryData.pickupAddress ?? ''),
    pickupRoadAddress: deliveryData.pickupAddressDetail?.roadAddress,
    pickupDetailAddress: deliveryData.pickupAddressDetail?.detailAddress,
    deliveryAddress: String(deliveryData.deliveryAddress ?? ''),
    deliveryRoadAddress: deliveryData.deliveryAddressDetail?.roadAddress,
    deliveryDetailAddress: deliveryData.deliveryAddressDetail?.detailAddress,
  });
  const legRewards = splitRewardAcrossLegs(
    Number(deliveryData.fee?.breakdown?.gillerFee ?? deliveryData.fee?.totalFee ?? 0),
    legDefinitions.length
  );

  let firstLegId: string | undefined;
  for (let index = 0; index < legDefinitions.length; index += 1) {
    const definition = legDefinitions[index];
    const deliveryLeg = await createDeliveryLegRecord({
      requestId,
      deliveryId,
      legType: definition.legType,
      actorType: deliveryData.gillerId ? 'giller' : definition.actorType,
      sequence: definition.sequence,
      originRef: definition.originRef,
      destinationRef: definition.destinationRef,
    });
    firstLegId ??= deliveryLeg.deliveryLegId;

    await createMissionForDeliveryLeg({
      requestId,
      deliveryId,
      deliveryLeg,
      assignedGillerUserId: deliveryData.gillerId,
      currentReward: legRewards[index] ?? 0,
    });
  }

  await bundleMissionsForDelivery(deliveryId).catch(() => []);

  await updateDoc(doc(db, 'deliveries', deliveryId), {
    currentLegId: firstLegId,
    beta1DeliveryStatus: typeof deliveryData.status === 'string' ? deliveryData.status : 'accepted',
    updatedAt: serverTimestamp(),
  });
}
