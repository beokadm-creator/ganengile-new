import {
  Timestamp,
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  updateDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { createAIAnalysis, createPricingQuote, createRequestDraft, markPricingQuoteSelected, updateRequestDraft } from './request-draft-service';
import type { StationInfo } from '../types/request';
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
import { calculatePhase1DeliveryFee, type PackageSizeType } from './pricing-service';
import { getAIIntegrationConfig } from './integration-config-service';
import { buildRequestDraftFromLegacyInput } from '../utils/request-draft-adapters';
import { getWalletLedger } from './beta1-wallet-service';

export interface Beta1RequestCreateInput {
  requesterUserId: string;
  requestMode?: 'immediate' | 'reservation';
  sourceRequestId?: string;
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
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

export function buildBeta1QuoteCards(input: Beta1RequestCreateInput): Beta1QuoteCard[] {
  const reservationMode = input.requestMode === 'reservation';
  const base = calculatePhase1DeliveryFee({
    stationCount: 5,
    weight: input.weightKg,
    packageSize: normalizePackageSize(input.packageSize),
    urgency: input.urgency ?? 'normal',
  });

  const cards: Beta1QuoteCard[] = [
    {
      quoteType: 'fastest',
      label: reservationMode ? '예약 우선 배정' : '가장 빠르게',
      headline: reservationMode ? '예약 요청이지만 빠른 배정 가능성을 열어둡니다.' : '지금 바로 미션을 열어 가장 빠른 연결을 노립니다.',
      etaLabel: reservationMode ? '예약 시간 우선 배정' : '약 70분',
      priceLabel: `${(base.totalFee + (reservationMode ? 900 : 2500)).toLocaleString()}원`,
      recommendationReason: reservationMode ? '예약 시간대를 지키면서도 빠른 actor를 먼저 검토합니다.' : '시간 제약이 크고 길러 재매칭까지 함께 고려합니다.',
      includesLocker: false,
      includesAddressPickup: true,
      includesAddressDropoff: true,
      pricing: {
        publicPrice: base.totalFee + (reservationMode ? 900 : 2500),
        depositAmount: input.itemValue ? Math.round(input.itemValue * 0.1) : 0,
        baseFee: base.baseFee,
        distanceFee: base.distanceFee,
        weightFee: base.weightFee,
        sizeFee: base.sizeFee,
        urgencySurcharge: reservationMode ? base.urgencySurcharge : base.urgencySurcharge + 1800,
        publicFare: base.publicFare,
        lockerFee: 0,
        addressPickupFee: 900,
        addressDropoffFee: 800,
        serviceFee: base.serviceFee,
        vat: base.vat,
      },
    },
    {
      quoteType: 'balanced',
      label: reservationMode ? '예약 균형형' : '추천 균형형',
      headline: reservationMode ? '동선 안정성과 시간대 적합성을 함께 맞춥니다.' : '미션 속도와 리스크를 균형 있게 맞춥니다.',
      etaLabel: reservationMode ? '예약 시간대 맞춤 배정' : '약 95분',
      priceLabel: `${(base.totalFee + (reservationMode ? -200 : 0)).toLocaleString()}원`,
      recommendationReason: reservationMode ? '예약 요청에서는 시간대 합의와 leg 안정성이 더 중요합니다.' : '가장 안정적인 성공률과 비용 균형을 제공합니다.',
      includesLocker: input.directParticipationMode === 'locker_assisted',
      includesAddressPickup: false,
      includesAddressDropoff: true,
      pricing: {
        publicPrice: base.totalFee + (reservationMode ? -200 : 0),
        depositAmount: input.itemValue ? Math.round(input.itemValue * 0.1) : 0,
        baseFee: base.baseFee,
        distanceFee: base.distanceFee,
        weightFee: base.weightFee,
        sizeFee: base.sizeFee,
        urgencySurcharge: base.urgencySurcharge,
        publicFare: base.publicFare,
        lockerFee: input.directParticipationMode === 'locker_assisted' ? 1000 : 0,
        addressPickupFee: 0,
        addressDropoffFee: 900,
        serviceFee: base.serviceFee,
        vat: base.vat,
      },
    },
    {
      quoteType: 'lowest_price',
      label: '가장 저렴하게',
      headline: reservationMode ? '여유 시간대와 직접 참여를 활용해 비용을 낮춥니다.' : '사용자 직접 참여와 사물함 경유를 우선 적용합니다.',
      etaLabel: reservationMode ? '여유 시간대 중심 배정' : '약 120분',
      priceLabel: `${Math.max(3000, base.totalFee - (reservationMode ? 1600 : 1400)).toLocaleString()}원`,
      recommendationReason: reservationMode ? '급하지 않을수록 예약 전환의 비용 절감 효과가 커집니다.' : '직접 참여 범위를 활용해 전체 가격을 낮춥니다.',
      includesLocker: true,
      includesAddressPickup: false,
      includesAddressDropoff: false,
      pricing: {
        publicPrice: Math.max(3000, base.totalFee - (reservationMode ? 1600 : 1400)),
        depositAmount: input.itemValue ? Math.round(input.itemValue * (reservationMode ? 0.07 : 0.08)) : 0,
        baseFee: base.baseFee,
        distanceFee: Math.max(0, base.distanceFee - 300),
        weightFee: base.weightFee,
        sizeFee: base.sizeFee,
        urgencySurcharge: Math.max(0, base.urgencySurcharge - 200),
        publicFare: base.publicFare,
        lockerFee: 700,
        addressPickupFee: 0,
        addressDropoffFee: 0,
        serviceFee: Math.max(0, base.serviceFee - 150),
        vat: base.vat,
      },
    },
    {
      quoteType: 'locker_included',
      label: reservationMode ? '예약 거점형' : '사물함 우선',
      headline: reservationMode ? '사물함과 거점 중심으로 예약 실패 리스크를 줄입니다.' : '사물함과 거점 연계를 우선 적용해 매칭 리스크를 낮춥니다.',
      etaLabel: reservationMode ? '거점 기준 예약 배정' : '약 100분',
      priceLabel: `${(base.totalFee + (reservationMode ? 200 : 500)).toLocaleString()}원`,
      recommendationReason: reservationMode ? '예약형에서는 거점 연계가 시간 약속 유지에 유리합니다.' : '대면 인계보다 실패율이 낮고 채팅 합의도 단순해집니다.',
      includesLocker: true,
      includesAddressPickup: false,
      includesAddressDropoff: true,
      pricing: {
        publicPrice: base.totalFee + (reservationMode ? 200 : 500),
        depositAmount: input.itemValue ? Math.round(input.itemValue * 0.1) : 0,
        baseFee: base.baseFee,
        distanceFee: base.distanceFee,
        weightFee: base.weightFee,
        sizeFee: base.sizeFee,
        urgencySurcharge: base.urgencySurcharge,
        publicFare: base.publicFare,
        lockerFee: 1200,
        addressPickupFee: 0,
        addressDropoffFee: 600,
        serviceFee: base.serviceFee,
        vat: base.vat,
      },
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
    preferredSchedule: {
      pickupTime: input.preferredPickupTime,
      arrivalTime: input.preferredArrivalTime,
    },
  });

  const aiAnalysis = await createAIAnalysis({
    requestDraftId: requestDraft.requestDraftId,
    requesterUserId: input.requesterUserId,
    inputPhotoIds: [],
    provider: aiConfig.provider,
    model: aiConfig.analysisModel,
    confidence: 0.72,
    result: {
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
    },
    status: AIAnalysisStatus.COMPLETED,
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const requestRef = await addDoc(collection(db, 'requests'), requestPayload);
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
  let selectionReason = '吏?섏쿋 湲곕컲 湲몃윭 誘몄뀡??媛???좎뿰?⑸땲??';
  const fallbackActorTypes: ActorSelectionActorType[] = [ActorType.LOCKER, ActorType.EXTERNAL_PARTNER];

  if (params.preferLocker) {
    selectedActorType = ActorType.LOCKER;
    selectionReason = '鍮꾨?硫??멸퀎瑜??곗꽑 ?곸슜???щℓ移?由ъ뒪?щ? ??땅?덈떎.';
  } else if (params.requiresAddressHandling || params.urgency === 'urgent') {
    selectedActorType = ActorType.EXTERNAL_PARTNER;
    selectedPartnerId = PARTNER_QUOTES[0].partnerId;
    selectionReason = '二쇱냼 湲곕컲 利됱떆 泥섎━ 援ш컙?대?濡??몃? ?뚰듃?덈? ?곗꽑 寃?좏빀?덈떎.';
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
  const missionSnapshot = await getDocs(collection(db, 'missions'));
  const deliveryMissions = missionSnapshot.docs
    .map((missionDoc) => ({ missionId: missionDoc.id, ...(missionDoc.data() as Record<string, unknown>) }) as { missionId: string; deliveryId?: string; sequence?: number; assignedGillerUserId?: string; status?: string; requestId?: string })
    .filter((mission) => mission.deliveryId === deliveryId)
    .sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0));

  if (deliveryMissions.length === 0) {
    return [];
  }

  const grouped = new Map<string, string[]>();
  for (const mission of deliveryMissions) {
    const owner = String(mission.assignedGillerUserId ?? mission.status ?? 'unassigned');
    const missionIds = grouped.get(owner) ?? [];
    missionIds.push(String(mission.missionId));
    grouped.set(owner, missionIds);
  }

  const bundles: MissionBundle[] = Array.from(grouped.entries()).map(([owner, missionIds], index) => ({
    missionBundleId: `${deliveryId}-bundle-${index + 1}`,
    requestId: String(deliveryMissions[0].requestId ?? ''),
    deliveryId,
    missionIds,
    status: BundleStatus.ACTIVE as MissionBundleStatus,
    strategy: owner === 'unassigned' ? 'multi_actor' : 'single_actor',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }));

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
  const missionType: MissionType = params.deliveryLeg.legType === 'last_mile_address' ? 'last_mile' : 'subway_transport';
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
  const [requestSnapshot, missionSnapshot, wallet] = await Promise.all([
    getDocs(collection(db, 'requests')),
    getDocs(collection(db, 'missions')),
    getUserWalletSummary(userId),
  ]);

  const requests = requestSnapshot.docs
    .map((docItem) => ({ id: docItem.id, ...(docItem.data() as Record<string, unknown>) }) as Beta1RequestDoc)
    .filter((request) => (request.requesterId === userId || request.requesterUserId === userId));

  const missions = missionSnapshot.docs
    .map((docItem) => ({ id: docItem.id, ...(docItem.data() as Record<string, unknown>) }) as Beta1MissionDoc)
    .filter((mission) => mission.assignedGillerUserId === userId);

  const activeRequests = requests.filter((request) =>
    ['pending', 'accepted', 'in_transit', 'delivered'].includes(String(request.status ?? ''))
  );
  const activeMissions = missions.filter((mission) =>
    ['queued', 'offered', 'accepted', 'arrival_pending', 'handover_pending', 'in_progress'].includes(String(mission.status ?? ''))
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
        : status === 'match_pending' || status === 'pending'
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

  const missionCards = activeMissions.slice(0, 3).map((mission) => {
    const missionType = String(mission.missionType ?? 'mission');
    const missionStatus = String(mission.status ?? 'queued');
    const recommendedReward = Number(mission.currentReward ?? 0);
    const strategyTitle =
      missionType === 'locker_dropoff' || missionType === 'locker_pickup'
        ? '거점과 사물함 중심 인계'
        : missionStatus === 'queued' || missionStatus === 'offered'
          ? '가장 가까운 실행 actor 우선'
          : '현재 leg ETA 유지';
    const strategyBody =
      missionType === 'locker_dropoff' || missionType === 'locker_pickup'
        ? '대면 실패 위험을 낮추기 위해 거점/사물함 인계를 먼저 정리한 미션입니다.'
        : missionStatus === 'queued' || missionStatus === 'offered'
          ? '길러 위치와 다음 이동 동선을 기준으로 번들 가능성과 수락 성공률을 함께 보고 있습니다.'
          : '이미 수락된 미션이라 다음 인계 시점과 ETA를 안정적으로 유지하는 쪽이 우선입니다.';

    return {
      id: String(mission.id),
      title: missionType === 'locker_dropoff' || missionType === 'locker_pickup' ? '거점 연계 미션' : '이동 구간 미션',
      status: missionStatus,
      windowLabel: missionStatus === 'queued' ? '지금 수락 가능' : '시간 확인 필요',
      rewardLabel: `${recommendedReward.toLocaleString()}원`,
      strategyTitle,
      strategyBody,
    };
  });

  return {
    role,
    headline: role === 'requester' ? '선택만 하면 되는 배송' : '가는길에 미션 보드',
    subheadline: role === 'requester'
      ? '요청, 가격, 진행 상태만 간단히 확인하세요.'
      : '지금 확인할 미션만 보여드립니다.',
    activeRequestCount: activeRequests.length,
    activeMissionCount: activeMissions.length,
    pendingRewardTotal: activeMissions.reduce((sum, mission) => sum + Number(mission.currentReward ?? 0), 0),
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
    : '?섎졊???뺣낫??誘몄뀡 ?섎씫 ???대┰?덈떎.';

  return {
    title: roomData.requestInfo
      ? `${roomData.requestInfo.from} ??${roomData.requestInfo.to}`
      : '가는길에 채팅',
    subtitle: status === 'match_pending'
      ? '媛寃⑷낵 誘몄뀡 援ъ“瑜??④퍡 ?뺤씤?섎뒗 ?묒쓽 梨꾪똿'
      : '?멸퀎? ETA 以묒떖???ㅽ뻾 梨꾪똿',
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

  const legType: DeliveryLegType = 'subway_transport';
  const actorType: DeliveryActorType = deliveryData.gillerId ? 'giller' : 'system';
  const deliveryLegPayload = {
    deliveryId,
    requestId: String(deliveryData.requestId ?? ''),
    legType,
    actorType,
    sequence: 1,
    originRef: toLocationRef(deliveryData.pickupStation as StationInfo),
    destinationRef: toLocationRef(deliveryData.deliveryStation as StationInfo),
    status: DeliveryLegStatus.READY,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const legRef = await addDoc(collection(db, 'delivery_legs'), deliveryLegPayload);

  await createMissionForDeliveryLeg({
    requestId: String(deliveryData.requestId ?? ''),
    deliveryId,
    deliveryLeg: {
      deliveryLegId: legRef.id,
      deliveryId,
      requestId: String(deliveryData.requestId ?? ''),
      legType,
      actorType,
      sequence: 1,
      originRef: toLocationRef(deliveryData.pickupStation as StationInfo),
      destinationRef: toLocationRef(deliveryData.deliveryStation as StationInfo),
      status: DeliveryLegStatus.READY,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    assignedGillerUserId: deliveryData.gillerId,
    currentReward: Number(deliveryData.fee?.breakdown?.gillerFee ?? deliveryData.fee?.totalFee ?? 0),
  });

  await updateDoc(doc(db, 'deliveries', deliveryId), {
    currentLegId: legRef.id,
    beta1DeliveryStatus: typeof deliveryData.status === 'string' ? deliveryData.status : 'accepted',
    updatedAt: serverTimestamp(),
  });
}

