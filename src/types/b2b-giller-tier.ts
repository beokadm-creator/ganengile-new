/**
 * B2B 길러 등급 정의
 */

export type B2BGillerTierLevel = 'silver' | 'gold' | 'platinum';

export interface B2BGillerCriteria {
  rating: number;
  monthlyDeliveries: number;
  tenure: number;
}

export interface B2BGillerBenefits {
  priorityLevel: number;
  rateBonus: number;
  monthlyBonus: number;
}

export interface B2BGillerHistory {
  promotedAt?: Date;
  lastEvaluated: Date;
  nextEvaluation: Date;
}

export type B2BGillerStatus = 'active' | 'suspended';

export interface B2BGillerTier {
  id: string;
  gillerId: string;
  tier: B2BGillerTierLevel;
  criteria: B2BGillerCriteria;
  benefits: B2BGillerBenefits;
  history: B2BGillerHistory;
  status: B2BGillerStatus;
  updatedAt: Date;
}

export const B2B_TIER_CRITERIA: Record<B2BGillerTierLevel, B2BGillerCriteria> = {
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

export const B2B_TIER_BENEFITS: Record<B2BGillerTierLevel, B2BGillerBenefits> = {
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

export const B2B_TIER_DETAILS = {
  silver: {
    name: 'Silver 길러',
    description: 'B2B 배송 참여 기준을 충족한 기본 등급입니다.',
    criteria: B2B_TIER_CRITERIA.silver,
    benefits: B2B_TIER_BENEFITS.silver,
  },
  gold: {
    name: 'Gold 길러',
    description: '배송 품질과 수행량이 안정적인 우수 길러 등급입니다.',
    criteria: B2B_TIER_CRITERIA.gold,
    benefits: B2B_TIER_BENEFITS.gold,
  },
  platinum: {
    name: 'Platinum 길러',
    description: '가장 높은 우선순위와 보너스를 받는 최상위 등급입니다.',
    criteria: B2B_TIER_CRITERIA.platinum,
    benefits: B2B_TIER_BENEFITS.platinum,
  },
} as const;
