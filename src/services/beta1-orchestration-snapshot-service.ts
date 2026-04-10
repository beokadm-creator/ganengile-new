import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { getWalletLedger } from './beta1-wallet-service';
import type { ActorSelectionActorType, LocationRef, MissionType, MissionBundle } from '../types/beta1';
import { MissionBundleStatus as BundleStatus } from '../types/beta1';

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

type Beta1ChatRoomDoc = {
  requestId?: string;
  status?: string;
  requestInfo?: {
    from?: string;
    to?: string;
  };
};

type Beta1RequestChatDoc = {
  beta1RequestStatus?: string;
  status?: string;
  recipientName?: string;
  recipientPhone?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {};
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
    .map((docItem) => ({ id: docItem.id, ...asRecord(docItem.data()) }) as Beta1RequestDoc)
    .filter((request) => request.requesterId === userId || request.requesterUserId === userId);

  const missions = missionSnapshot.docs
    .map((docItem) => ({ id: docItem.id, ...asRecord(docItem.data()) }) as Beta1MissionDoc)
    .filter((mission) => mission.assignedGillerUserId === userId);

  const missionBundles = missionBundleSnapshot.docs
    .map((docItem) => ({
      missionBundleId: docItem.id,
      ...asRecord(docItem.data()),
    }) as Beta1MissionBundleDoc)
    .filter((bundle) => {
      if (role !== 'giller') {
        return false;
      }

      const candidateList = bundle.candidateGillerUserIds ?? [];
      const selectedBySameUser = bundle.selectedGillerUserId === userId;
      const availableToUser = candidateList.length === 0 || candidateList.includes(userId);
      const notTaken = !bundle.selectedGillerUserId || selectedBySameUser;
      return bundle.status === BundleStatus.ACTIVE && availableToUser && notTaken;
    });

  const deliveries = deliverySnapshot.docs
    .map((docItem) => ({ id: docItem.id, ...asRecord(docItem.data()) }) as Beta1DeliveryDoc)
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
    const isLockerMission = missionType === 'locker_dropoff' || missionType === 'locker_pickup';
    const isOpenMission = missionStatus === 'queued' || missionStatus === 'offered';
    const strategyTitle =
      isLockerMission
        ? '거점과 사물함 중심 인계'
        : isOpenMission
          ? '가장 가까운 실행 actor 우선'
          : '현재 leg ETA 유지';
    const strategyBody =
      isLockerMission
        ? '대면 실패 위험을 낮추기 위해 거점/사물함 인계를 먼저 정리한 미션입니다.'
        : isOpenMission
          ? '길러 위치와 다음 이동 동선을 기준으로 번들 가능성과 수락 성공률을 함께 보고 있습니다.'
          : '이미 수락된 미션이라 다음 인계 시점과 ETA를 안정적으로 유지하는 쪽이 우선입니다.';

    return {
      id: String(mission.id),
      title: isLockerMission ? '거점 연계 미션' : '이동 구간 미션',
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

  const roomData = room.data() as Beta1ChatRoomDoc;
  const requestId = roomData.requestId;
  const requestSnapshot = await getDocs(collection(db, 'requests'));
  const requestDoc = requestSnapshot.docs.find((docItem) => docItem.id === requestId);
  const request = requestDoc?.data() as Beta1RequestChatDoc | undefined;

  const status = String(request?.beta1RequestStatus ?? request?.status ?? roomData.status ?? 'pending');
  const minimalRecipient = request?.recipientName
    ? `${String(request.recipientName).slice(0, 1)}* / ${String(request.recipientPhone ?? '').slice(0, 3)}-****`
    : '수령인 정보는 미션 수락 후 열립니다.';

  return {
    title: roomData.requestInfo
      ? `${roomData.requestInfo.from ?? '출발지'} -> ${roomData.requestInfo.to ?? '도착지'}`
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

  const missions = missionSnapshot.docs.map((docItem) => asRecord(docItem.data()));
  const decisions = decisionSnapshot.docs.map((docItem) => asRecord(docItem.data()));

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
