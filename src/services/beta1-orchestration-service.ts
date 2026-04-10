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
import { sendMissionBundleAvailableNotification } from './matching-notification';
import { deliveryPartnerService } from './delivery-partner-service';
import { EnterpriseLegacyDeliveryService } from './enterprise-legacy-delivery-service';
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
  buildBeta1QuoteCards,
  normalizePackageSize,
  type Beta1QuoteCard,
  type Beta1RequestCreateInput,
} from './beta1-orchestration-quote-service';
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
  buildSegmentedLegDefinitions,
  formatDetailedAddress,
  splitRewardAcrossLegs,
} from './beta1-orchestration-leg-service';

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
};

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
  const quoteCards = buildBeta1QuoteCards(input);
  const selectedCard = quoteCards.find((card) => card.quoteType === input.selectedQuoteType) ?? quoteCards[0];
  let requestDraftId = '';
  let selectedQuoteId = '';

  try {
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
    requestDraftId = requestDraft.requestDraftId;

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
    selectedQuoteId = selectedQuote.pricingQuoteId;
    await markPricingQuoteSelected(selectedQuote.pricingQuoteId, requestDraft.requestDraftId);
    await updateRequestDraft(requestDraft.requestDraftId, {
      status: RequestDraftStatus.SUBMITTED,
      selectedPricingQuoteId: selectedQuote.pricingQuoteId,
    });
  } catch (error) {
    console.error('[orchestration-service] draft pipeline failed, continuing with direct request creation', error);
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
          ? '주소 구간이라 길러 선택이 없으면 external partner fallback을 우선 검토합니다.'
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
  } catch (error) {
    console.error('[orchestration-service] request created but follow-up orchestration failed', {
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
  } else if (params.requiresAddressHandling || params.urgency === 'urgent') {
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

    return await EnterpriseLegacyDeliveryService.createDelivery({
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
    console.warn('Unable to create enterprise legacy fallback delivery', error);
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
      dispatchMethod: 'manual_dashboard',
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
    if (selectedLegIds.includes(String(mission.deliveryLegId ?? '')) || !!mission.assignedGillerUserId) {
      continue;
    }

    const leg = allLegsById.get(String(mission.deliveryLegId ?? ''));
    if (!leg || !requiresAddressHandling(leg.legType)) {
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
    const externalPartnerDispatchId = await queueExternalPartnerDispatch({
      partnerId: PARTNER_QUOTES[0]?.partnerId,
      requestId: bundle.requestId,
      deliveryId: bundle.deliveryId,
      missionId: mission.id,
      deliveryLegId: leg.deliveryLegId,
      leg,
      fallbackDeliveryId,
    });
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
        selectionReason: '길러가 선택하지 않은 주소 구간을 external partner fallback으로 전환했습니다.',
        fallbackActorTypes: [ActorType.GILLER],
        fallbackPartnerIds: PARTNER_QUOTES.map((quote) => quote.partnerId),
        manualReviewRequired: false,
        riskFlags: [
          'address_leg_fallback',
          ...(externalPartnerDispatchId ? [`partner_dispatch:${externalPartnerDispatchId}`] : []),
        ],
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
