import type { MissionCard, MissionGroup } from './mission-board-types';

const MAX_EXPOSURE_SCORE_MINUTES = 60;
const FEATURED_WAITING_THRESHOLD_MINUTES = 20;

export function isImmediateMission(card: MissionCard): boolean {
  return card.selectionState === 'available' && (card.windowLabel?.includes('지금') ?? false);
}

function sortMissionOptions(left: MissionCard, right: MissionCard): number {
  const leftSpan = (left.endSequence ?? left.startSequence ?? 0) - (left.startSequence ?? 0);
  const rightSpan = (right.endSequence ?? right.startSequence ?? 0) - (right.startSequence ?? 0);
  if (leftSpan !== rightSpan) {
    return rightSpan - leftSpan;
  }

  const leftReward = Number(left.rewardAmount ?? 0);
  const rightReward = Number(right.rewardAmount ?? 0);
  if (leftReward !== rightReward) {
    return rightReward - leftReward;
  }

  return Number(left.startSequence ?? 0) - Number(right.startSequence ?? 0);
}

export function getMissionPriorityScore(group: MissionGroup): number {
  const topOption = group.options[0];
  const rewardScore = group.rewardAmount;
  const exposureScore = Math.min(group.ageMinutes, MAX_EXPOSURE_SCORE_MINUTES) * 40;
  const territoryScore = group.requiresExternalPartner ? 0 : 600;
  const instantScore = isImmediateMission(topOption ?? ({} as MissionCard)) ? 1200 : 0;
  return rewardScore + exposureScore + territoryScore + instantScore;
}

export function groupMissionCards(cards: MissionCard[]): MissionGroup[] {
  const groups = new Map<string, MissionGroup>();

  cards.forEach((card) => {
    const key = String(card.bundleId ?? card.deliveryId ?? card.id);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: key,
        title: card.title,
        routeLabel: card.routeLabel ?? card.title,
        status: card.status,
        windowLabel: card.windowLabel,
        strategyTitle: card.strategyTitle,
        strategyBody: card.strategyBody,
        selectionState: card.selectionState ?? 'available',
        rewardAmount: Number(card.rewardAmount ?? 0),
        options: [card],
        originPoint: card.originPoint,
        destinationPoint: card.destinationPoint,
        fallbackLabel: card.fallbackLabel,
        candidateCount: Number(card.candidateCount ?? 0),
        requiresExternalPartner: Boolean(card.requiresExternalPartner),
        ageMinutes: Number(card.ageMinutes ?? 0),
      });
      return;
    }

    existing.options.push(card);
    existing.rewardAmount = Math.max(existing.rewardAmount, Number(card.rewardAmount ?? 0));
    existing.originPoint = existing.originPoint ?? card.originPoint;
    existing.destinationPoint = existing.destinationPoint ?? card.destinationPoint;
    existing.fallbackLabel = existing.fallbackLabel ?? card.fallbackLabel;
    existing.candidateCount = Math.max(existing.candidateCount, Number(card.candidateCount ?? 0));
    existing.requiresExternalPartner = existing.requiresExternalPartner || Boolean(card.requiresExternalPartner);
    existing.ageMinutes = Math.max(existing.ageMinutes, Number(card.ageMinutes ?? 0));

    if (existing.selectionState !== 'accepted' && card.selectionState === 'accepted') {
      existing.selectionState = 'accepted';
      existing.status = card.status;
      existing.windowLabel = card.windowLabel;
      existing.strategyTitle = card.strategyTitle;
      existing.strategyBody = card.strategyBody;
    }
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      options: [...group.options].sort(sortMissionOptions),
    }))
    .sort((left, right) => {
      if (left.selectionState !== right.selectionState) {
        return left.selectionState === 'accepted' ? -1 : 1;
      }

      const leftPriority = getMissionPriorityScore(left);
      const rightPriority = getMissionPriorityScore(right);
      return rightPriority - leftPriority;
    });
}

export function buildOptionLabel(card: MissionCard): string {
  if (card.segmentLabel) {
    return card.segmentLabel;
  }

  const start = Number(card.startSequence ?? 1);
  const end = Number(card.endSequence ?? start);
  return start === end ? `${start}구간` : `${start}-${end}구간`;
}

export function isFullSpanOption(card: MissionCard, group: MissionGroup): boolean {
  const minStart = Math.min(...group.options.map((option) => Number(option.startSequence ?? 1)));
  const maxEnd = Math.max(...group.options.map((option) => Number(option.endSequence ?? option.startSequence ?? 1)));
  return Number(card.startSequence ?? 1) === minStart && Number(card.endSequence ?? card.startSequence ?? 1) === maxEnd;
}

export function buildComparisonHint(card: MissionCard, group: MissionGroup): string | null {
  const bestReward = Math.max(...group.options.map((option) => Number(option.rewardAmount ?? 0)));
  const reward = Number(card.rewardAmount ?? 0);

  if (bestReward <= 0 || reward <= 0) {
    return null;
  }

  if (reward === bestReward) {
    return '가장 큰 보상 구간';
  }

  const gap = bestReward - reward;
  return `${gap.toLocaleString()}원 차이`;
}

export function buildQuickFacts(group: MissionGroup): string {
  const topOption = group.options[0];
  const parts = [
    topOption ? buildOptionLabel(topOption) : null,
    topOption?.rewardLabel ?? null,
    group.requiresExternalPartner ? '파트너 일부' : '길러 우선',
  ].filter(Boolean);

  return parts.join(' · ');
}

export function buildFeaturedReason(group: MissionGroup): string {
  if (group.ageMinutes > FEATURED_WAITING_THRESHOLD_MINUTES) {
    return '오래 기다린 미션';
  }

  if (!group.requiresExternalPartner) {
    return '바로 잡기 좋은 미션';
  }

  return '지금 확인할 미션';
}

export function getNextActionLabel(group: MissionGroup): string | null {
  if (group.selectionState !== 'accepted') {
    return null;
  }

  const status = group.status?.toLowerCase() ?? '';
  if (status.includes('arrival_pending')) {
    return '도착 확인';
  }
  if (status.includes('handover_pending')) {
    return '인계 진행';
  }
  if (status.includes('in_progress')) {
    return '이동 중';
  }
  if (status.includes('accepted')) {
    return '출발 준비';
  }

  return '진행 확인';
}

export function getPrimaryOption(group: MissionGroup): MissionCard | null {
  return group.options[0] ?? null;
}

export function locationDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
