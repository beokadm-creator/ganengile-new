type TimestampLike = {
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
};

export type MissionExposurePricing = {
  ageMinutes: number;
  bonusAmount: number;
  adjustedReward: number;
  exposureLabel: string;
  rewardBoostLabel?: string;
};

function roundToFiveHundred(value: number): number {
  return Math.max(0, Math.round(value / 500) * 500);
}

export function timestampToMillis(value: unknown): number | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as TimestampLike;
    if (typeof maybeTimestamp.toMillis === 'function') {
      return maybeTimestamp.toMillis();
    }

    if (typeof maybeTimestamp.seconds === 'number') {
      return maybeTimestamp.seconds * 1000 + Math.round((maybeTimestamp.nanoseconds ?? 0) / 1_000_000);
    }
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function getMissionExposurePricing(baseReward: number, createdAt: unknown, nowMs: number = Date.now()): MissionExposurePricing {
  const createdAtMs = timestampToMillis(createdAt);
  const ageMinutes = createdAtMs ? Math.max(0, Math.floor((nowMs - createdAtMs) / 60000)) : 0;

  let multiplier = 0;
  let minimumBonus = 0;
  let exposureLabel = '방금 등록';

  if (ageMinutes >= 45) {
    multiplier = 0.2;
    minimumBonus = 2000;
    exposureLabel = '45분 이상 대기';
  } else if (ageMinutes >= 30) {
    multiplier = 0.15;
    minimumBonus = 1500;
    exposureLabel = '30분 이상 대기';
  } else if (ageMinutes >= 20) {
    multiplier = 0.1;
    minimumBonus = 1000;
    exposureLabel = '20분 이상 대기';
  } else if (ageMinutes >= 10) {
    multiplier = 0.05;
    minimumBonus = 500;
    exposureLabel = '10분 이상 대기';
  } else if (ageMinutes >= 5) {
    exposureLabel = '방금 올라온 미션';
  }

  const percentageBonus = roundToFiveHundred(baseReward * multiplier);
  const bonusAmount = Math.max(minimumBonus, percentageBonus);
  const adjustedReward = baseReward + bonusAmount;

  return {
    ageMinutes,
    bonusAmount,
    adjustedReward,
    exposureLabel,
    rewardBoostLabel: bonusAmount > 0 ? `+${bonusAmount.toLocaleString()}원 할증` : undefined,
  };
}
