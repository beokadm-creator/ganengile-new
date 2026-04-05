import {
  Timestamp,
  addDoc,
  collection,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
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
  QuoteType,
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
import { calculatePhase1DeliveryFee, estimateStationCountFromCoords, type PackageSizeType } from './pricing-service';
import { getAIIntegrationConfig } from './integration-config-service';
import { buildRequestDraftFromLegacyInput, type LegacyStationInfo as StationInfo } from '../utils/request-draft-adapters';
import { getWalletLedger } from './beta1-wallet-service';
import { findMatchesForRequest } from './matching-service';
import { sendMissionBundleAvailableNotification } from './matching-notification';
import { B2BDeliveryService } from './b2b-delivery-service';

export interface Beta1RequestCreateInput {
  requesterUserId: string;
  requestMode?: 'immediate' | 'reservation';
  sourceRequestId?: string;
  originType?: 'station' | 'address';
  destinationType?: 'station' | 'address';
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  pickupRoadAddress?: string;
  pickupDetailAddress?: string;
  deliveryRoadAddress?: string;
  deliveryDetailAddress?: string;
  selectedPhotoIds?: string[];
  packageItemName?: string;
  packageCategory?: string;
  packageDescription: string;
  packageSize: PackageSizeType;
  weightKg: number;
  itemValue?: number;
  recipientName: string;
  recipientPhone: string;
  urgency?: 'normal' | 'fast' | 'urgent';
  selectedQuoteType: QuoteType;
  directParticipationMode: 'none' | 'requester_to_station' | 'locker_assisted';
  preferredPickupTime?: string;
  preferredArrivalTime?: string;
  aiAnalysisOverride?: {
    provider: string;
    model: string;
    confidence: number;
    fallbackUsed?: boolean;
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
  };
}

export interface Beta1QuoteCard {
  quoteType: QuoteType;
  label: string;
  headline: string;
  etaLabel: string;
  priceLabel: string;
  recommendationReason: string;
  includesLocker: boolean;
  includesAddressPickup: boolean;
  includesAddressDropoff: boolean;
  pricing: PricingQuote['finalPricing'];
}

type QuotePricingOverrides = Partial<
  Pick<
    PricingQuote['finalPricing'],
    | 'baseFee'
    | 'distanceFee'
    | 'weightFee'
    | 'sizeFee'
    | 'urgencySurcharge'
    | 'publicFare'
    | 'lockerFee'
    | 'addressPickupFee'
    | 'addressDropoffFee'
    | 'serviceFee'
    | 'vat'
  >
>;

export interface Beta1HomeSnapshot {
  role: 'requester' | 'giller';
  headline: string;
  subheadline: string;
  activeRequestCount: number;
  activeMissionCount: number;
  pendingRewardTotal: number;
  recommendations: string[];
  requestCards: Array<{
    id: string;
    title: string;
    status: string;
    modeLabel: string;
    etaLabel: string;
    detail: string;
    strategyTitle: string;
    strategyBody: string;
  }>;
  missionCards: Array<{
    id: string;
    title: string;
    status: string;
    windowLabel: string;
    rewardLabel: string;
    strategyTitle: string;
    strategyBody: string;
    bundleId?: string;
    missionIds?: string[];
    actionLabel?: string;
    legSummary?: string;
    fallbackLabel?: string;
    selectionState?: 'available' | 'accepted' | 'fallback';
  }>;
  wallet: {
    chargeBalance: number;
    earnedBalance: number;
    promoBalance: number;
    pendingWithdrawalBalance: number;
    withdrawableBalance: number;
  };
}

export interface Beta1ChatContext {
  title: string;
  subtitle: string;
  trustSummary: string[];
  requestId?: string;
  deliveryId?: string;
  missionId?: string;
  currentDeliveryStatus?: string;
  recipientRevealLevel: 'minimal' | 'accepted' | 'handover_ready';
  recipientSummary: string;
  actionLabel?: string;
}

export interface Beta1AdminSnapshot {
  pendingMissions: number;
  reassigningMissions: number;
  disputedDeliveries: number;
  partnerFallbackCases: number;
  manualReviewDecisions: number;
  cards: Array<{
    title: string;
    value: number;
    tone: 'critical' | 'warning' | 'positive' | 'neutral';
    hint: string;
  }>;
}

const PARTNER_QUOTES: PartnerMissionQuote[] = [
  {
    partnerId: 'partner-a',
    estimatedPickupMinutes: 18,
    estimatedCompletionMinutes: 42,
    quotedCost: 7800,
    successRate: 0.93,
    coverageScore: 0.91,
    available: true,
  },
  {
    partnerId: 'partner-b',
    estimatedPickupMinutes: 12,
    estimatedCompletionMinutes: 39,
    quotedCost: 9200,
    successRate: 0.96,
    coverageScore: 0.88,
    available: true,
  },
];

type SupportedPackageSize = Exclude<PackageSizeType, 'extra_large'>;

type Beta1RequestDoc = {
  id: string;
  requesterId?: string;
  requesterUserId?: string;
  pickupStation?: { stationName?: string };
  deliveryStation?: { stationName?: string };
  requestMode?: 'immediate' | 'reservation';
  preferredTime?: { departureTime?: string; arrivalTime?: string };
  beta1RequestStatus?: string;
  status?: string;
};

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
};

type Beta1LegDoc = DeliveryLeg & { id?: string };

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
};

type Beta1DeliveryDoc = {
  id: string;
  requestId?: string;
  gillerId?: string;
  status?: string;
  beta1DeliveryStatus?: string;
  pickupStation?: { stationName?: string };
  deliveryStation?: { stationName?: string };
  fee?: { breakdown?: { gillerFee?: number }; totalFee?: number };
};

function normalizePackageSize(packageSize: PackageSizeType): SupportedPackageSize {
  return packageSize === 'extra_large' ? 'xl' : packageSize;
}

function toLocationRef(station: StationInfo): LocationRef {
  return {
    type: 'station',
    stationId: station.stationId,
    stationName: station.stationName,
    latitude: station.lat,
    longitude: station.lng,
  };
}

function toAddressLocationRef(address: string, station: StationInfo): LocationRef {
  return {
    type: 'address',
    addressText: address,
    roadAddress: address,
    stationId: station.stationId,
    stationName: station.stationName,
    latitude: station.lat,
    longitude: station.lng,
  };
}

function formatDetailedAddress(roadAddress?: string, detailAddress?: string): string | undefined {
  const road = (roadAddress ?? '').trim();
  const detail = (detailAddress ?? '').trim();
  if (!road) return undefined;
  return detail ? `${road} ${detail}` : road;
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

function describeLocationRef(location: LocationRef): string {
  if (location.type === 'address') {
    return location.addressText ?? location.roadAddress ?? '주소';
  }
  if (location.type === 'locker') {
    return location.lockerId ?? location.stationName ?? '보관함';
  }
  return location.stationName ?? '역';
}

function describeLegType(legType: DeliveryLegType): string {
  switch (legType) {
    case 'pickup_address':
      return '주소 수거';
    case 'pickup_station':
      return '출발역 인계';
    case 'locker_dropoff':
      return '보관함 투입';
    case 'locker_pickup':
      return '보관함 수령';
    case 'meetup_handover':
      return '대면 인계';
    case 'last_mile_address':
      return '도착지 전달';
    case 'subway_transport':
    default:
      return '역간 이동';
  }
}

function requiresAddressHandling(legType: DeliveryLegType): boolean {
  return legType === 'pickup_address' ?? legType === 'last_mile_address';
}

function buildMissionWindowLabel(missionCount: number, requiresPartner: boolean): string {
  if (requiresPartner) {
    return '주소 구간 포함, 빠른 선택 권장';
  }
  return missionCount > 1 ? '연속 구간 선택 가능' : '지금 수락 가능';
}

function splitRewardAcrossLegs(totalReward: number, legCount: number): number[] {
  if (legCount <= 0) {
    return [];
  }

  const base = Math.floor(totalReward / legCount);
  const rewards = Array.from({ length: legCount }, () => base);
  let remainder = totalReward - base * legCount;

  for (let index = 0; index < rewards.length && remainder > 0; index += 1) {
    rewards[index] += 1;
    remainder -= 1;
  }

  return rewards;
}

function buildSegmentedLegDefinitions(input: {
  requestId: string;
  deliveryId: string;
  originType: 'station' | 'address';
  destinationType: 'station' | 'address';
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  pickupAddress?: string;
  pickupRoadAddress?: string;
  pickupDetailAddress?: string;
  deliveryAddress?: string;
  deliveryRoadAddress?: string;
  deliveryDetailAddress?: string;
}): Array<{
  legType: DeliveryLegType;
  actorType: DeliveryActorType;
  sequence: number;
  originRef: LocationRef;
  destinationRef: LocationRef;
}> {
  const legs: Array<{
    legType: DeliveryLegType;
    actorType: DeliveryActorType;
    sequence: number;
    originRef: LocationRef;
    destinationRef: LocationRef;
  }> = [];

  if (input.originType === 'address' && input.pickupAddress) {
    legs.push({
      legType: 'pickup_address',
      actorType: 'giller',
      sequence: legs.length + 1,
      originRef: {
        ...toAddressLocationRef(input.pickupAddress, input.pickupStation),
        roadAddress: input.pickupRoadAddress?.trim(),
        detailAddress: input.pickupDetailAddress?.trim(),
      },
      destinationRef: toLocationRef(input.pickupStation),
    });
  }

  if (
    input.pickupStation.stationId !== input.deliveryStation.stationId ?? input.pickupStation.stationName !== input.deliveryStation.stationName
  ) {
    legs.push({
      legType: 'subway_transport',
      actorType: 'giller',
      sequence: legs.length + 1,
      originRef: toLocationRef(input.pickupStation),
      destinationRef: toLocationRef(input.deliveryStation),
    });
  }

  if (input.destinationType === 'address' && input.deliveryAddress) {
    legs.push({
      legType: 'last_mile_address',
      actorType: 'giller',
      sequence: legs.length + 1,
      originRef: toLocationRef(input.deliveryStation),
      destinationRef: {
        ...toAddressLocationRef(input.deliveryAddress, input.deliveryStation),
        roadAddress: input.deliveryRoadAddress?.trim(),
        detailAddress: input.deliveryDetailAddress?.trim(),
      },
    });
  }

  if (legs.length === 0) {
    legs.push({
      legType: 'subway_transport',
      actorType: 'giller',
      sequence: 1,
      originRef: toLocationRef(input.pickupStation),
      destinationRef: toLocationRef(input.deliveryStation),
    });
  }

  return legs.map((leg, index) => ({
    ...leg,
    sequence: index + 1,
  }));
}

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

function buildQuotePricing(
  base: ReturnType<typeof calculatePhase1DeliveryFee>,
  input: Beta1RequestCreateInput,
  overrides: QuotePricingOverrides = {}
): PricingQuote['finalPricing'] {
  const pricing: PricingQuote['finalPricing'] = {
    publicPrice: 0,
    depositAmount: input.itemValue ? Math.round(input.itemValue) : 0,
    baseFee: overrides.baseFee ?? base.baseFee,
    distanceFee: overrides.distanceFee ?? base.distanceFee,
    weightFee: overrides.weightFee ?? base.weightFee,
    sizeFee: overrides.sizeFee ?? base.sizeFee,
    urgencySurcharge: overrides.urgencySurcharge ?? base.urgencySurcharge,
    publicFare: overrides.publicFare ?? base.publicFare,
    lockerFee: overrides.lockerFee ?? 0,
    addressPickupFee: overrides.addressPickupFee ?? 0,
    addressDropoffFee: overrides.addressDropoffFee ?? 0,
    serviceFee: overrides.serviceFee ?? base.serviceFee,
    vat: overrides.vat ?? base.vat,
  };

  pricing.publicPrice =
    pricing.baseFee +
    pricing.distanceFee +
    pricing.weightFee +
    pricing.sizeFee +
    pricing.urgencySurcharge +
    pricing.publicFare +
    pricing.lockerFee +
    pricing.addressPickupFee +
    pricing.addressDropoffFee +
    pricing.serviceFee +
    pricing.vat;

  return pricing;
}

function hasUsableCoords(station: StationInfo) {
  return (
    Number.isFinite(station.lat) &&
    Number.isFinite(station.lng) &&
    station.lat !== 0 &&
    station.lng !== 0
  );
}

function resolveEstimatedStationCount(input: Beta1RequestCreateInput) {
  if (hasUsableCoords(input.pickupStation) && hasUsableCoords(input.deliveryStation)) {
    return estimateStationCountFromCoords(
      input.pickupStation.lat,
      input.pickupStation.lng,
      input.deliveryStation.lat,
      input.deliveryStation.lng
    );
  }

  return 5;
}

export function buildBeta1QuoteCards(input: Beta1RequestCreateInput): Beta1QuoteCard[] {
  const reservationMode = input.requestMode === 'reservation';
  const originType = input.originType ?? 'station';
  const destinationType = input.destinationType ?? 'station';
  const hasAddressPickup = originType === 'address';
  const hasAddressDropoff = destinationType === 'address';
  const addressPickupFee = hasAddressPickup ? 900 : 0;
  const addressDropoffFee = hasAddressDropoff ? 800 : 0;
  const stationCount = resolveEstimatedStationCount(input);
  const base = calculatePhase1DeliveryFee({
    stationCount,
    weight: input.weightKg,
    packageSize: normalizePackageSize(input.packageSize),
    urgency: input.urgency ?? 'normal',
  });

  const fastestPricing = buildQuotePricing(base, input, {
    urgencySurcharge: reservationMode ? base.urgencySurcharge + 900 : base.urgencySurcharge + 2500,
    addressPickupFee,
    addressDropoffFee,
  });

  const balancedPricing = buildQuotePricing(base, input, {
    urgencySurcharge: reservationMode ? Math.max(0, base.urgencySurcharge - 200) : base.urgencySurcharge,
    lockerFee: input.directParticipationMode === 'locker_assisted' ? 1000 : 0,
    addressPickupFee,
    addressDropoffFee,
  });

  const lowestPricePricing = buildQuotePricing(base, input, {
    distanceFee: Math.max(0, base.distanceFee - 300),
    urgencySurcharge: Math.max(0, base.urgencySurcharge - (reservationMode ? 600 : 200)),
    lockerFee: 700,
    addressPickupFee: Math.round(addressPickupFee * 0.6),
    addressDropoffFee: Math.round(addressDropoffFee * 0.6),
    serviceFee: Math.max(0, base.serviceFee - 150),
  });
  lowestPricePricing.publicPrice = Math.max(3000, lowestPricePricing.publicPrice);

  const lockerIncludedPricing = buildQuotePricing(base, input, {
    lockerFee: 1200 + (reservationMode ? 200 : 500),
    addressPickupFee: Math.round(addressPickupFee * 0.7),
    addressDropoffFee: Math.round(addressDropoffFee * 0.7),
  });

  const cards: Beta1QuoteCard[] = [
    {
      quoteType: 'fastest',
      label: reservationMode ? '예약 우선 배정' : '가장 빠르게',
      headline: reservationMode ? '예약 요청이지만 빠른 배정 가능성을 열어둡니다.' : '지금 바로 미션을 열어 가장 빠른 연결을 노립니다.',
      etaLabel: reservationMode ? '예약 시간 우선 배정' : '약 70분',
      priceLabel: `${fastestPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: reservationMode
        ? '예약 시간대와 주소/역 혼합 조건을 함께 고려해 빠른 actor를 먼저 검토합니다.'
        : '시간 제약과 주소/역 혼합 동선을 함께 반영해 가장 빠른 연결을 노립니다.',
      includesLocker: false,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: fastestPricing,
    },
    {
      quoteType: 'balanced',
      label: reservationMode ? '예약 균형형' : '추천 균형형',
      headline: reservationMode ? '동선 안정성과 시간대 적합성을 함께 맞춥니다.' : '미션 속도와 리스크를 균형 있게 맞춥니다.',
      etaLabel: reservationMode ? '예약 시간대 맞춤 배정' : hasAddressPickup ?? hasAddressDropoff ? '약 105분' : '약 95분',
      priceLabel: `${balancedPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: reservationMode
        ? '예약 요청에서는 시간대 합의와 주소/역 인계 안정성이 더 중요합니다.'
        : '주소 픽업이나 주소 도착이 포함돼도 가장 안정적인 균형을 제공합니다.',
      includesLocker: input.directParticipationMode === 'locker_assisted',
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: balancedPricing,
    },
    {
      quoteType: 'lowest_price',
      label: '가장 저렴하게',
      headline: reservationMode ? '여유 시간대와 직접 참여를 활용해 비용을 낮춥니다.' : '사용자 직접 참여와 사물함 경유를 우선 적용합니다.',
      etaLabel: reservationMode ? '여유 시간대 중심 배정' : hasAddressPickup ?? hasAddressDropoff ? '약 130분' : '약 120분',
      priceLabel: `${lowestPricePricing.publicPrice.toLocaleString()}원`,
      recommendationReason: reservationMode
        ? '급하지 않을수록 주소/역 혼합 요청도 예약 전환으로 비용 절감 효과가 커집니다.'
        : '직접 참여와 거점 활용으로 주소 구간 비용을 최대한 낮춥니다.',
      includesLocker: true,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: lowestPricePricing,
    },
    {
      quoteType: 'locker_included',
      label: reservationMode ? '예약 거점형' : '사물함 우선',
      headline: reservationMode ? '사물함과 거점 중심으로 예약 실패 리스크를 줄입니다.' : '사물함과 거점 연계를 우선 적용해 매칭 리스크를 낮춥니다.',
      etaLabel: reservationMode ? '거점 기준 예약 배정' : hasAddressPickup ?? hasAddressDropoff ? '약 110분' : '약 100분',
      priceLabel: `${lockerIncludedPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: reservationMode
        ? '예약형에서는 거점 연계가 주소/역 혼합 요청의 시간 약속 유지에 유리합니다.'
        : '사물함과 거점 연계로 주소 인계 실패율을 낮춥니다.',
      includesLocker: true,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: lockerIncludedPricing,
    },
  ];

  return cards;
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
      (input.originType ?? 'station') === 'address' &&
      formatDetailedAddress(input.pickupRoadAddress, input.pickupDetailAddress)
        ? {
            ...toAddressLocationRef(
              formatDetailedAddress(input.pickupRoadAddress, input.pickupDetailAddress) ?? '',
              input.pickupStation
            ),
            roadAddress: input.pickupRoadAddress?.trim(),
            detailAddress: input.pickupDetailAddress?.trim(),
          }
        : toLocationRef(input.pickupStation),
    destinationRef:
      (input.destinationType ?? 'station') === 'address' &&
      formatDetailedAddress(input.deliveryRoadAddress, input.deliveryDetailAddress)
        ? {
            ...toAddressLocationRef(
              formatDetailedAddress(input.deliveryRoadAddress, input.deliveryDetailAddress) ?? '',
              input.deliveryStation
            ),
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
    itemName: input.packageItemName,
    category: input.packageCategory,
    description: input.packageDescription,
    estimatedValue: input.itemValue,
    estimatedWeightKg: input.weightKg,
    estimatedSize: normalizePackageSize(input.packageSize),
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

  const quoteCards = buildBeta1QuoteCards(input);
  const selectedCard = quoteCards.find((card) => card.quoteType === input.selectedQuoteType) ?? quoteCards[1];

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

  const selectedQuote = quoteDocs.find((quote) => quote.quoteType === selectedCard.quoteType) ?? quoteDocs[1];
  await markPricingQuoteSelected(selectedQuote.pricingQuoteId, requestDraft.requestDraftId);
  await updateRequestDraft(requestDraft.requestDraftId, {
    status: RequestDraftStatus.SUBMITTED,
    selectedPricingQuoteId: selectedQuote.pricingQuoteId,
  });

  const requestPayload = {
    requestDraftId: requestDraft.requestDraftId,
    requesterId: input.requesterUserId,
    requesterUserId: input.requesterUserId,
    pricingQuoteId: selectedQuote.pricingQuoteId,
    originType: input.originType ?? 'station',
    destinationType: input.destinationType ?? 'station',
    pickupAddress: formatDetailedAddress(input.pickupRoadAddress, input.pickupDetailAddress) ?? '',
    deliveryAddress: formatDetailedAddress(input.deliveryRoadAddress, input.deliveryDetailAddress) ?? '',
    pickupAddressDetail: input.pickupRoadAddress
      ? {
          roadAddress: input.pickupRoadAddress.trim(),
          detailAddress: input.pickupDetailAddress?.trim() ?? '',
          fullAddress: formatDetailedAddress(input.pickupRoadAddress, input.pickupDetailAddress) ?? '',
        }
      : null,
    deliveryAddressDetail: input.deliveryRoadAddress
      ? {
          roadAddress: input.deliveryRoadAddress.trim(),
          detailAddress: input.deliveryDetailAddress?.trim() ?? '',
          fullAddress: formatDetailedAddress(input.deliveryRoadAddress, input.deliveryDetailAddress) ?? '',
        }
      : null,
    pickupStation: input.pickupStation,
    deliveryStation: input.deliveryStation,
    packageInfo: {
      size: input.packageSize,
      weight: input.weightKg,
      weightKg: input.weightKg,
      description: input.packageDescription,
      isFragile: false,
      isPerishable: false,
    },
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    deadline: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 120)),
    preferredTime: {
      departureTime: input.preferredPickupTime ?? '지금 바로',
      arrivalTime: input.preferredArrivalTime ?? '협의 가능',
    },
    requestMode: input.requestMode ?? 'immediate',
    sourceRequestId: input.sourceRequestId ?? null,
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const requestRef = await addDoc(collection(db, 'requests'), requestPayload);

  const deliveryRef = await addDoc(collection(db, 'deliveries'), {
    requestId: requestRef.id,
    requesterId: input.requesterUserId,
    pickupStation: input.pickupStation,
    deliveryStation: input.deliveryStation,
    status: 'pending',
    beta1DeliveryStatus: 'created',
    fee: {
      ...selectedCard.pricing,
      totalFee: selectedCard.pricing.publicPrice,
      breakdown: {
        gillerFee: Math.round(selectedCard.pricing.publicPrice * 0.7),
      },
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'requests', requestRef.id), {
    primaryDeliveryId: deliveryRef.id,
    updatedAt: serverTimestamp(),
  });

  const legDefinitions = buildSegmentedLegDefinitions({
    requestId: requestRef.id,
    deliveryId: deliveryRef.id,
    originType: input.originType ?? 'station',
    destinationType: input.destinationType ?? 'station',
    pickupStation: input.pickupStation,
    deliveryStation: input.deliveryStation,
    pickupAddress: formatDetailedAddress(input.pickupRoadAddress, input.pickupDetailAddress),
    pickupRoadAddress: input.pickupRoadAddress,
    pickupDetailAddress: input.pickupDetailAddress,
    deliveryAddress: formatDetailedAddress(input.deliveryRoadAddress, input.deliveryDetailAddress),
    deliveryRoadAddress: input.deliveryRoadAddress,
    deliveryDetailAddress: input.deliveryDetailAddress,
  });
  const legRewards = splitRewardAcrossLegs(
    Math.max(0, Math.round(selectedCard.pricing.publicPrice * 0.7)),
    legDefinitions.length
  );

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
      selectedPartnerId: requiresAddressHandling(definition.legType) ? PARTNER_QUOTES[0]?.partnerId : undefined,
      selectionReason: requiresAddressHandling(definition.legType)
        ? '주소 구간이라 길러 선택이 없으면 B2B fallback을 우선 검토합니다.'
        : '역간 이동 구간이라 길러 수행을 우선 제안합니다.',
      fallbackActorTypes: requiresAddressHandling(definition.legType)
        ? [ActorType.GILLER]
        : [ActorType.EXTERNAL_PARTNER],
      fallbackPartnerIds: PARTNER_QUOTES.map((quote) => quote.partnerId),
      manualReviewRequired: false,
      riskFlags: requiresAddressHandling(definition.legType) ? ['address_leg'] : [],
    });
  }

  const bundles = await bundleMissionsForDelivery(deliveryRef.id);
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

  return {
    requestId: requestRef.id,
    requestDraftId: requestDraft.requestDraftId,
    pricingQuoteId: selectedQuote.pricingQuoteId,
    quoteCards,
  };
}

export function selectActorForMission(params: {
  missionType: Mission['missionType'];
  preferLocker: boolean;
  requiresAddressHandling: boolean;
  urgency: 'normal' | 'fast' | 'urgent';
}): Omit<ActorSelectionDecision, 'decisionId' | 'createdAt' | 'updatedAt'> {
  const interventionLevel: AIInterventionLevel = params.requiresAddressHandling ? 'guarded_execute' : 'recommend';
  let selectedActorType: ActorSelectionActorType = ActorType.GILLER;
  let selectedPartnerId: string | undefined;
  let selectionReason = '지하철 기반 구간이라 길러 미션으로 이어지는 흐름이 자연스럽습니다.';
  const fallbackActorTypes: ActorSelectionActorType[] = [ActorType.LOCKER, ActorType.EXTERNAL_PARTNER];

  if (params.preferLocker) {
    selectedActorType = ActorType.LOCKER;
    selectionReason = '비대면 인계가 유리해 보관함 연계를 우선 적용합니다.';
  } else if (params.requiresAddressHandling ?? params.urgency === 'urgent') {
    selectedActorType = ActorType.EXTERNAL_PARTNER;
    selectedPartnerId = PARTNER_QUOTES[0].partnerId;
    selectionReason = '주소 기반 즉시 처리 구간이라 외부 파트너를 우선 검토합니다.';
  }

  return {
    requestId: '',
    interventionLevel,
    selectedActorType,
    selectedPartnerId,
    selectionReason,
    fallbackActorTypes,
    fallbackPartnerIds: PARTNER_QUOTES.map((quote) => quote.partnerId),
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

  let candidateGillerUserIds: string[] = [];
  try {
    const matches = await findMatchesForRequest(requestId, 5);
    candidateGillerUserIds = matches.map((match) => match.gillerId);
  } catch (error) {
    console.error('[orchestration-service] 매칭 후보 조회 실패:', error);
    candidateGillerUserIds = [];
  }

  const bundles: MissionBundle[] = [];
  let bundleIndex = 0;

  for (let start = 0; start < deliveryMissions.length; start += 1) {
    for (let end = start; end < deliveryMissions.length; end += 1) {
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
    bundles.map((bundle) =>
      setDoc(doc(db, 'mission_bundles', bundle.missionBundleId), {
        ...bundle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    )
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

  const missionRef = await addDoc(collection(db, 'missions'), missionPayload);
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
    const requestData = params.requestDoc ?? {};
    const pickupStationName =
      String(
        (requestData.pickupStation as { stationName?: string } | undefined)?.stationName ??
          params.leg.originRef.stationName ??
          '출발역'
      );
    const deliveryStationName =
      String(
        (requestData.deliveryStation as { stationName?: string } | undefined)?.stationName ??
          params.leg.destinationRef.stationName ??
          '도착역'
      );

    return await B2BDeliveryService.createDelivery({
      contractId: 'beta1-fallback-contract',
      businessId: 'beta1-fallback',
      pickupLocation: {
        station: pickupStationName,
        address: describeLocationRef(params.leg.originRef),
        latitude: params.leg.originRef.latitude,
        longitude: params.leg.originRef.longitude,
      },
      dropoffLocation: {
        station: deliveryStationName,
        address: describeLocationRef(params.leg.destinationRef),
        latitude: params.leg.destinationRef.latitude,
        longitude: params.leg.destinationRef.longitude,
      },
      scheduledTime: new Date(Date.now() + 1000 * 60 * 15),
      weight: Number((requestData.packageInfo as { weightKg?: number; weight?: number } | undefined)?.weightKg ?? (requestData.packageInfo as { weight?: number } | undefined)?.weight ?? 1),
      notes: `beta1 mission fallback:${params.requestId}:${params.mission.id}`,
    });
  } catch (error) {
    console.warn('Unable to create B2B fallback delivery', error);
    return null;
  }
}

export async function acceptMissionBundleForGiller(bundleId: string, gillerUserId: string): Promise<void> {
  const bundleRef = doc(db, 'mission_bundles', bundleId);
  const bundleSnapshot = await getDoc(bundleRef);
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
      const snapshot = await getDoc(doc(db, 'missions', missionId));
      return snapshot.exists()
        ? ({ id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as Beta1MissionDoc)
        : null;
    })
  );
  const selectedMissions = missionDocs.filter(Boolean) as Beta1MissionDoc[];
  const requestSnapshot = bundle.requestId ? await getDoc(doc(db, 'requests', bundle.requestId)) : null;
  const requestData = (requestSnapshot?.data() as Record<string, unknown> | undefined) ?? {};
  const siblingBundleSnapshots = await getDocs(query(collection(db, 'mission_bundles'), where('deliveryId', '==', bundle.deliveryId)));
  const siblingBundles = siblingBundleSnapshots.docs.map((snapshot) => ({
    missionBundleId: snapshot.id,
    ...(snapshot.data() as Record<string, unknown>),
  })) as Beta1MissionBundleDoc[];

  await Promise.all(
    selectedMissions.map((mission) =>
      updateDoc(doc(db, 'missions', mission.id), {
        assignedGillerUserId: gillerUserId,
        status: MissionState.ACCEPTED,
        updatedAt: serverTimestamp(),
      })
    )
  );

  const selectedLegIds = selectedMissions.map((mission) => String(mission.deliveryLegId ?? ''));
  await Promise.all(
    selectedLegIds.map((deliveryLegId) =>
      updateDoc(doc(db, 'delivery_legs', deliveryLegId), {
        actorType: 'giller',
        status: DeliveryLegStatus.READY,
        updatedAt: serverTimestamp(),
      })
    )
  );

  await setDoc(
    bundleRef,
    {
      ...bundle,
      selectedGillerUserId: gillerUserId,
      status: BundleStatus.ACTIVE,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const [allMissionSnapshots, allLegSnapshots] = await Promise.all([
    getDocs(query(collection(db, 'missions'), where('deliveryId', '==', bundle.deliveryId))),
    getDocs(query(collection(db, 'delivery_legs'), where('deliveryId', '==', bundle.deliveryId))),
  ]);
  const allMissions = allMissionSnapshots.docs.map((snapshot) => ({
    id: snapshot.id,
    ...(snapshot.data() as Record<string, unknown>),
  })) as Beta1MissionDoc[];
  const allLegsById = new Map(
    allLegSnapshots.docs.map((snapshot) => {
      const leg = { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as Beta1LegDoc;
      return [snapshot.id, leg] as const;
    })
  );

  const fallbackDeliveryIds: string[] = [];
  const fallbackMissionIds: string[] = [];
  for (const mission of allMissions) {
    if (selectedLegIds.includes(String(mission.deliveryLegId ?? '')) ?? mission.assignedGillerUserId) {
      continue;
    }

    const leg = allLegsById.get(String(mission.deliveryLegId ?? ''));
    if (!leg ?? !requiresAddressHandling(leg.legType)) {
      continue;
    }

    const fallbackDeliveryId = await dispatchMissionToB2BFallback({
      requestId: bundle.requestId,
      mission,
      leg,
      requestDoc: requestData,
    });

    if (!fallbackDeliveryId) {
      continue;
    }

    fallbackDeliveryIds.push(fallbackDeliveryId);
    fallbackMissionIds.push(mission.id);
    await Promise.all([
      updateDoc(doc(db, 'missions', mission.id), {
        status: MissionState.OFFERED,
        fallbackPlanId: fallbackDeliveryId,
        updatedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, 'delivery_legs', leg.deliveryLegId), {
        actorType: 'external_partner',
        status: DeliveryLegStatus.READY,
        updatedAt: serverTimestamp(),
      }),
      persistActorSelectionDecision({
        requestId: bundle.requestId,
        deliveryId: bundle.deliveryId,
        deliveryLegId: leg.deliveryLegId,
        missionId: mission.id,
        interventionLevel: 'guarded_execute',
        selectedActorType: ActorType.EXTERNAL_PARTNER,
        selectedPartnerId: PARTNER_QUOTES[0]?.partnerId,
        selectionReason: '길러가 선택하지 않은 주소 구간을 B2B fallback으로 전환했습니다.',
        fallbackActorTypes: [ActorType.GILLER],
        fallbackPartnerIds: PARTNER_QUOTES.map((quote) => quote.partnerId),
        manualReviewRequired: false,
        riskFlags: ['address_leg_fallback'],
      }),
    ]);
  }

  const coversEntireDelivery = selectedMissions.length === allMissions.length;
  const deliveryUpdate: Record<string, unknown> = {
    beta1DeliveryStatus: coversEntireDelivery ? 'assigned' : 'created',
    updatedAt: serverTimestamp(),
  };
  if (coversEntireDelivery) {
    deliveryUpdate.gillerId = gillerUserId;
  }
  await updateDoc(doc(db, 'deliveries', bundle.deliveryId), deliveryUpdate);

  if (bundle.requestId) {
    await updateDoc(doc(db, 'requests', bundle.requestId), {
      matchedGillerId: coversEntireDelivery ? gillerUserId : null,
      status: coversEntireDelivery ? 'accepted' : 'pending',
      beta1RequestStatus: coversEntireDelivery ? 'accepted' : 'match_pending',
      updatedAt: serverTimestamp(),
    });
  }

  const blockedMissionIds = new Set([...selectedMissions.map((mission) => mission.id), ...fallbackMissionIds]);
  await Promise.all(
    siblingBundles
      .filter((candidate) => candidate.missionBundleId !== bundle.missionBundleId)
      .filter((candidate) => (candidate.missionIds ?? []).some((missionId) => blockedMissionIds.has(missionId)))
      .map((candidate) =>
        updateDoc(doc(db, 'mission_bundles', candidate.missionBundleId), {
          status: BundleStatus.CANCELLED,
          updatedAt: serverTimestamp(),
        })
      )
  );

  if (fallbackDeliveryIds.length > 0) {
    await setDoc(
      bundleRef,
      {
        fallbackDeliveryIds,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

async function getUserWalletSummary(userId: string): Promise<Beta1HomeSnapshot['wallet']> {
  const walletLedger = await getWalletLedger(userId);
  return {
    chargeBalance: walletLedger.summary.chargeBalance,
    earnedBalance: walletLedger.summary.earnedBalance,
    promoBalance: walletLedger.summary.promoBalance,
    pendingWithdrawalBalance: walletLedger.summary.pendingWithdrawalBalance,
    withdrawableBalance: walletLedger.summary.withdrawableBalance,
  };
}

export async function getBeta1HomeSnapshot(userId: string, role: 'requester' | 'giller'): Promise<Beta1HomeSnapshot> {
  const [requestSnapshot, missionSnapshot, deliverySnapshot, missionBundleSnapshot, wallet] = await Promise.all([
    getDocs(collection(db, 'requests')),
    getDocs(collection(db, 'missions')),
    getDocs(collection(db, 'deliveries')),
    getDocs(collection(db, 'mission_bundles')),
    getUserWalletSummary(userId),
  ]);

  const requests = requestSnapshot.docs
    .map((docItem) => ({ id: docItem.id, ...(docItem.data() as Record<string, unknown>) }) as Beta1RequestDoc)
    .filter((request) => (request.requesterId === userId ?? request.requesterUserId === userId));

  const missions = missionSnapshot.docs
    .map((docItem) => ({ id: docItem.id, ...(docItem.data() as Record<string, unknown>) }) as Beta1MissionDoc)
    .filter((mission) => mission.assignedGillerUserId === userId);

  const missionBundles = missionBundleSnapshot.docs
    .map((docItem) => ({
      missionBundleId: docItem.id,
      ...(docItem.data() as Record<string, unknown>),
    }) as Beta1MissionBundleDoc)
    .filter((bundle) => {
      if (role !== 'giller') {
        return false;
      }

      const candidateList = bundle.candidateGillerUserIds ?? [];
      const selectedBySameUser = bundle.selectedGillerUserId === userId;
      const availableToUser = candidateList.length === 0 ?? candidateList.includes(userId);
      const notTaken = !bundle.selectedGillerUserId ?? selectedBySameUser;
      return bundle.status === BundleStatus.ACTIVE && availableToUser && notTaken;
    });

  const deliveries = deliverySnapshot.docs
    .map((docItem) => ({ id: docItem.id, ...(docItem.data() as Record<string, unknown>) }) as Beta1DeliveryDoc)
    .filter((delivery) => delivery.gillerId === userId);

  const activeRequests = requests.filter((request) =>
    ['pending', 'accepted', 'in_transit', 'delivered'].includes(String(request.status ?? ''))
  );
  const activeMissions = missions.filter((mission) =>
    ['queued', 'offered', 'accepted', 'arrival_pending', 'handover_pending', 'in_progress'].includes(String(mission.status ?? ''))
  );
  const activeDeliveries = deliveries.filter((delivery) =>
    ['accepted', 'pickup_pending', 'picked_up', 'in_transit', 'arrival_pending', 'handover_pending'].includes(
      String(delivery.beta1DeliveryStatus ?? delivery.status ?? '')
    )
  );

  const requestCards = activeRequests.slice(0, 3).map((request) => {
    const pickupName = String((request.pickupStation as { stationName?: string } | undefined)?.stationName ?? '출발역');
    const deliveryName = String((request.deliveryStation as { stationName?: string } | undefined)?.stationName ?? '도착역');
    const requestMode = String(request.requestMode ?? 'immediate');
    const preferredTime = request.preferredTime as { departureTime?: string; arrivalTime?: string } | undefined;
    const modeLabel = requestMode === 'reservation' ? '예약형' : '즉시형';
    const status = String(request.beta1RequestStatus ?? request.status ?? 'unknown');
    const strategyTitle = requestMode === 'reservation' ? '시간대와 동선 안정성 우선' : '빠른 재매칭과 SLA 우선';
    const strategyBody =
      requestMode === 'reservation'
        ? preferredTime?.departureTime
          ? `희망 출발 ${preferredTime.departureTime}${preferredTime.arrivalTime ? `, 희망 도착 ${preferredTime.arrivalTime}` : ''} 기준으로 안정적인 leg를 먼저 맞춥니다.`
          : '예약형 요청이라 시간 약속을 지키는 길러/거점 조합을 먼저 찾고 있습니다.'
        : status === 'match_pending' ?? status === 'pending'
          ? '즉시형 요청이라 빠른 actor 연결과 재매칭 가능성을 우선 계산하고 있습니다.'
          : '즉시형 요청이라 현재 ETA와 인계 단계를 짧게 유지하는 전략으로 진행합니다.';

    return {
      id: String(request.id),
      title: `${pickupName} -> ${deliveryName}`,
      status,
      modeLabel,
      etaLabel:
        requestMode === 'reservation'
          ? preferredTime?.departureTime
            ? `예약 시간 ${preferredTime.departureTime}`
            : '예약 시간 조정 중'
          : 'ETA 조정 중',
      detail:
        requestMode === 'reservation'
          ? '예약형 요청으로 시간대 적합성과 안정적인 handover를 먼저 봅니다.'
          : '즉시형 요청으로 빠른 매칭과 SLA 회복을 우선 봅니다.',
      strategyTitle,
      strategyBody,
    };
  });

  const missionCardsFromBundles = missionBundles.map((bundle) => {
    const rewardTotal = Number(bundle.rewardTotal ?? 0);
    const selectedByUser = bundle.selectedGillerUserId === userId;
    const selectionState: 'available' | 'accepted' | 'fallback' =
      selectedByUser ? 'accepted' : bundle.fallbackDeliveryIds?.length ? 'fallback' : 'available';
    const fallbackLabel =
      bundle.fallbackDeliveryIds && bundle.fallbackDeliveryIds.length > 0
        ? `주소 구간 ${bundle.fallbackDeliveryIds.length}건은 B2B fallback 진행`
        : bundle.requiresExternalPartner
          ? '주소 구간 미선택 시 B2B fallback'
          : undefined;

    return {
      id: bundle.missionBundleId,
      bundleId: bundle.missionBundleId,
      missionIds: bundle.missionIds,
      title: bundle.title ?? '구간 선택 미션',
      status: selectedByUser ? 'accepted' : 'available',
      windowLabel: bundle.windowLabel ?? '연속 구간 선택 가능',
      rewardLabel: `${rewardTotal.toLocaleString()}원`,
      strategyTitle: selectedByUser ? '내가 맡은 구간' : '어디까지 수행할지 선택',
      strategyBody:
        bundle.summary ??
        '길러가 선택한 범위만 먼저 확정하고, 남는 주소 구간은 fallback actor를 붙입니다.',
      actionLabel: selectedByUser ? '수락 완료' : '이 구간 수행하기',
      legSummary: bundle.summary,
      fallbackLabel,
      selectionState,
    };
  });

  const missionCardsFromMissions = activeMissions.map((mission) => {
    const missionType = String(mission.missionType ?? 'mission');
    const missionStatus = String(mission.status ?? 'queued');
    const recommendedReward = Number(mission.currentReward ?? 0);
    const strategyTitle =
      missionType === 'locker_dropoff' ?? missionType === 'locker_pickup'
        ? '거점과 사물함 중심 인계'
        : missionStatus === 'queued' ?? missionStatus === 'offered'
          ? '가장 가까운 실행 actor 우선'
          : '현재 leg ETA 유지';
    const strategyBody =
      missionType === 'locker_dropoff' ?? missionType === 'locker_pickup'
        ? '대면 실패 위험을 낮추기 위해 거점/사물함 인계를 먼저 정리한 미션입니다.'
        : missionStatus === 'queued' ?? missionStatus === 'offered'
          ? '길러 위치와 다음 이동 동선을 기준으로 번들 가능성과 수락 성공률을 함께 보고 있습니다.'
          : '이미 수락된 미션이라 다음 인계 시점과 ETA를 안정적으로 유지하는 쪽이 우선입니다.';

    return {
      id: String(mission.id),
      title: missionType === 'locker_dropoff' ?? missionType === 'locker_pickup' ? '거점 연계 미션' : '이동 구간 미션',
      status: missionStatus,
      windowLabel: missionStatus === 'queued' ? '지금 수락 가능' : '시간 확인 필요',
      rewardLabel: `${recommendedReward.toLocaleString()}원`,
      strategyTitle,
      strategyBody,
      actionLabel: '진행 상태 보기',
      selectionState: 'accepted' as const,
    };
  });

  const deliveryFallbackCards = activeDeliveries
    .filter((delivery) => !activeMissions.some((mission) => mission.deliveryId === delivery.id))
    .map((delivery) => {
      const deliveryStatus = String(delivery.beta1DeliveryStatus ?? delivery.status ?? 'accepted');
      const pickupName = String(delivery.pickupStation?.stationName ?? '출발역');
      const deliveryName = String(delivery.deliveryStation?.stationName ?? '도착역');
      const reward = Number(delivery.fee?.breakdown?.gillerFee ?? delivery.fee?.totalFee ?? 0);
      return {
        id: `delivery-${delivery.id}`,
        title: `${pickupName} -> ${deliveryName}`,
        status: deliveryStatus,
        windowLabel: deliveryStatus === 'accepted' ? '지금 진행 중' : '인계 일정 확인',
        rewardLabel: `${reward.toLocaleString()}원`,
        strategyTitle: '수락한 배송 유지',
        strategyBody: '미션 문서가 늦게 생성되더라도 수락한 배송이 홈 목록에서 사라지지 않도록 배송 문서를 함께 기준으로 보여줍니다.',
        actionLabel: '배송 보기',
        selectionState: 'accepted' as const,
      };
    });

  const missionCards = [...missionCardsFromBundles, ...missionCardsFromMissions, ...deliveryFallbackCards].slice(0, 6);
  const activeMissionLikeCount = missionBundles.length + activeMissions.length + deliveryFallbackCards.length;
  const pendingRewardTotal =
    missionBundles.reduce((sum, bundle) => sum + Number(bundle.rewardTotal ?? 0), 0) +
    activeMissions.reduce((sum, mission) => sum + Number(mission.currentReward ?? 0), 0) +
    deliveryFallbackCards.reduce((sum, card) => sum + Number(card.rewardLabel.replace(/[^\d]/g, '') ?? 0), 0);

  return {
    role,
    headline: role === 'requester' ? '선택만 하면 되는 배송' : '가는길에 미션 보드',
    subheadline: role === 'requester'
      ? '요청, 가격, 진행 상태만 간단히 확인하세요.'
      : '지금 확인할 미션만 보여드립니다.',
    activeRequestCount: activeRequests.length,
    activeMissionCount: activeMissionLikeCount,
    pendingRewardTotal,
    recommendations: role === 'requester'
      ? ['급하면 즉시 요청, 아니면 예약 요청이 더 잘 맞습니다.', '사물함 옵션은 대면 인계 부담을 줄여줍니다.']
      : ['바로 받을 수 있는 미션부터 확인하세요.', '시간 조율이 필요한 제안은 아래에서 따로 확인할 수 있습니다.'],
    requestCards,
    missionCards,
    wallet,
  };
}

export async function getBeta1ChatContext(chatRoomId: string): Promise<Beta1ChatContext | null> {
  const chatSnapshot = await getDocs(collection(db, 'chatRooms'));
  const room = chatSnapshot.docs.find((docItem) => docItem.id === chatRoomId);
  if (!room) {
    return null;
  }

  const roomData = room.data() as Record<string, any>;
  const requestId = roomData.requestId as string | undefined;
  const requestSnapshot = await getDocs(collection(db, 'requests'));
  const requestDoc = requestSnapshot.docs.find((docItem) => docItem.id === requestId);
  const request = requestDoc?.data() as Record<string, any> | undefined;

  const status = String(request?.beta1RequestStatus ?? request?.status ?? roomData.status ?? 'pending');
  const minimalRecipient = request?.recipientName
    ? `${String(request.recipientName).slice(0, 1)}* / ${String(request.recipientPhone ?? '').slice(0, 3)}-****`
    : '수령인 정보는 미션 수락 후 열립니다.';

  return {
    title: roomData.requestInfo
      ? `${roomData.requestInfo.from} ??${roomData.requestInfo.to}`
      : '가는길에 채팅',
    subtitle: status === 'match_pending'
      ? '가격과 미션 구조를 함께 확인하는 준비 채팅'
      : '단계와 ETA 전달을 위한 실행 채팅',
    trustSummary: [
      '수령인 상세 정보는 인계 직전까지 최소 공개합니다.',
      '사진, 위치, 인증 이벤트는 배송 상태와 분리해 기록합니다.',
      '환불과 패널티 확정은 운영 검토가 필요한 영역입니다.',
    ],
    requestId,
    currentDeliveryStatus: status,
    recipientRevealLevel: status === 'match_pending' ? 'minimal' : status === 'match_confirmed' ? 'accepted' : 'handover_ready',
    recipientSummary: status === 'match_pending' ? minimalRecipient : '수령인 정보 확인 가능',
    actionLabel: status === 'match_pending' ? '미션 수락 전 확인 정보' : '인계 준비 정보',
  };
}

export async function getBeta1AdminSnapshot(): Promise<Beta1AdminSnapshot> {
  const [missionSnapshot, deliverySnapshot, decisionSnapshot] = await Promise.all([
    getDocs(collection(db, 'missions')),
    getDocs(collection(db, 'deliveries')),
    getDocs(collection(db, 'actor_selection_decisions')),
  ]);

  const missions = missionSnapshot.docs.map((docItem) => docItem.data() as Record<string, unknown>);
  const decisions = decisionSnapshot.docs.map((docItem) => docItem.data() as Record<string, unknown>);

  const pendingMissions = missions.filter((mission) => ['queued', 'offered'].includes(typeof mission.status === 'string' ? mission.status : '')).length;
  const reassigningMissions = missions.filter((mission) => mission.status === 'reassigning').length;
  const disputedDeliveries = deliverySnapshot.docs.filter((delivery) => String(delivery.data().status ?? '') === 'disputed').length;
  const partnerFallbackCases = decisions.filter((decision) => String(decision.selectedActorType) === 'external_partner').length;
  const manualReviewDecisions = decisions.filter((decision) => Boolean(decision.manualReviewRequired)).length;

  return {
    pendingMissions,
    reassigningMissions,
    disputedDeliveries,
    partnerFallbackCases,
    manualReviewDecisions,
    cards: [
      {
        title: '즉시 게시 필요 미션',
        value: pendingMissions,
        tone: pendingMissions > 8 ? 'critical' : 'warning',
        hint: 'AI 가격과 미션 구조를 함께 조정해 우선 재배치합니다.',
      },
      {
        title: '재매칭 진행 중',
        value: reassigningMissions,
        tone: reassigningMissions > 0 ? 'warning' : 'positive',
        hint: '취소와 지연, SLA 위험 구간을 다시 묶고 있습니다.',
      },
      {
        title: '운영 검토 필요 결정',
        value: manualReviewDecisions,
        tone: manualReviewDecisions > 0 ? 'critical' : 'neutral',
        hint: 'AI는 제안만 하고 최종 확정하지 않는 영역입니다.',
      },
      {
        title: '외부 파트너 전환 케이스',
        value: partnerFallbackCases,
        tone: 'neutral',
        hint: '주소 픽업과 라스트마일 보완 흐름을 모니터링합니다.',
      },
    ],
  };
}

export async function persistActorSelectionDecision(
  decision: Omit<ActorSelectionDecision, 'decisionId' | 'createdAt' | 'updatedAt'>
): Promise<ActorSelectionDecision> {
  const ref = await addDoc(collection(db, 'actor_selection_decisions'), {
    ...decision,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

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

  const deliveryData = deliveryDoc.data() as Record<string, any>;
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
    pickupStation: deliveryData.pickupStation as StationInfo,
    deliveryStation: deliveryData.deliveryStation as StationInfo,
    pickupAddress: String(deliveryData.pickupAddress ?? ''),
    pickupRoadAddress: deliveryData.pickupAddressDetail?.roadAddress as string | undefined,
    pickupDetailAddress: deliveryData.pickupAddressDetail?.detailAddress as string | undefined,
    deliveryAddress: String(deliveryData.deliveryAddress ?? ''),
    deliveryRoadAddress: deliveryData.deliveryAddressDetail?.roadAddress as string | undefined,
    deliveryDetailAddress: deliveryData.deliveryAddressDetail?.detailAddress as string | undefined,
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
    if (!firstLegId) {
      firstLegId = deliveryLeg.deliveryLegId;
    }

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

