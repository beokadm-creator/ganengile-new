/**
 * Legacy enterprise customer giller tier definitions.
 */

export type EnterpriseLegacyGillerTierLevel = 'silver' | 'gold' | 'platinum';

export interface EnterpriseLegacyGillerCriteria {
  rating: number;
  monthlyDeliveries: number;
  tenure: number;
}

export interface EnterpriseLegacyGillerBenefits {
  priorityLevel: number;
  rateBonus: number;
  monthlyBonus: number;
}

export interface EnterpriseLegacyGillerHistory {
  promotedAt?: Date;
  lastEvaluated: Date;
  nextEvaluation: Date;
}

export type EnterpriseLegacyGillerStatus = 'active' | 'suspended';

export interface EnterpriseLegacyGillerTier {
  id: string;
  gillerId: string;
  tier: EnterpriseLegacyGillerTierLevel;
  criteria: EnterpriseLegacyGillerCriteria;
  benefits: EnterpriseLegacyGillerBenefits;
  history: EnterpriseLegacyGillerHistory;
  status: EnterpriseLegacyGillerStatus;
  updatedAt: Date;
}

export const ENTERPRISE_LEGACY_TIER_CRITERIA: Record<EnterpriseLegacyGillerTierLevel, EnterpriseLegacyGillerCriteria> = {
  silver: {
    rating: 4.5,
    monthlyDeliveries: 30,
    tenure: 6,
  },
  gold: {
    rating: 4.7,
    monthlyDeliveries: 50,
    tenure: 12,
  },
  platinum: {
    rating: 4.9,
    monthlyDeliveries: 100,
    tenure: 24,
  },
} as const;

export const ENTERPRISE_LEGACY_TIER_BENEFITS: Record<EnterpriseLegacyGillerTierLevel, EnterpriseLegacyGillerBenefits> = {
  silver: {
    priorityLevel: 5,
    rateBonus: 20,
    monthlyBonus: 10,
  },
  gold: {
    priorityLevel: 7,
    rateBonus: 30,
    monthlyBonus: 20,
  },
  platinum: {
    priorityLevel: 10,
    rateBonus: 40,
    monthlyBonus: 30,
  },
} as const;

export const ENTERPRISE_LEGACY_TIER_DETAILS = {
  silver: {
    name: 'Silver 길러',
    description: 'B2B 배송 참여 기준을 충족한 기본 등급입니다.',
    criteria: ENTERPRISE_LEGACY_TIER_CRITERIA.silver,
    benefits: ENTERPRISE_LEGACY_TIER_BENEFITS.silver,
  },
  gold: {
    name: 'Gold 길러',
    description: '배송 품질과 수행량이 안정적인 우수 길러 등급입니다.',
    criteria: ENTERPRISE_LEGACY_TIER_CRITERIA.gold,
    benefits: ENTERPRISE_LEGACY_TIER_BENEFITS.gold,
  },
  platinum: {
    name: 'Platinum 길러',
    description: '가장 높은 우선순위와 보너스를 받는 최상위 등급입니다.',
    criteria: ENTERPRISE_LEGACY_TIER_CRITERIA.platinum,
    benefits: ENTERPRISE_LEGACY_TIER_BENEFITS.platinum,
  },
} as const;
