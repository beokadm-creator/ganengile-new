/**
 * B2B 길러 등급 타입 정의
 * 
 * B2B 길러의 등급, 승급 기준, 혜택을 관리합니다.
 * 기획 문서: PLANNING_B2B_BUSINESS.md
 */

/**
 * B2B 길러 등급
 */
export type B2BGillerTier = "silver" | "gold" | "platinum";

/**
 * 등급별 기준 충족 현황
 */
export interface B2BGillerCriteria {
  /** 평점 */
  rating: number;
  /** 월간 배송 건수 */
  monthlyDeliveries: number;
  /** 가입 개월 수 */
  tenure: number;
}

/**
 * 등급별 혜택
 */
export interface B2BGillerBenefits {
  /** 매칭 우선순위 (높을수록 우선) */
  priorityLevel: number;
  /** 요금 보너스 (%) */
  rateBonus: number;
  /** 월 보너스 (만원) */
  monthlyBonus: number;
}

/**
 * 승급/강감 기록
 */
export interface B2BGillerHistory {
  /** 승급 일시 */
  promotedAt?: Date;
  /** 마지막 심사 일시 */
  lastEvaluated: Date;
  /** 다음 심사 일시 */
  nextEvaluation: Date;
}

/**
 * B2B 길러 등록 상태
 */
export type B2BGillerStatus = "active" | "suspended";

/**
 * B2B 길러 등급 정보
 */
export interface B2BGillerTier {
  /** 등급 ID */
  id: string;
  /** 길러 ID */
  gillerId: string;
  /** B2B 등급 */
  tier: B2BGillerTier;
  
  // 기준 충족 현황
  /** 기준 충족 현황 */
  criteria: B2BGillerCriteria;
  
  // 혜택
  /** 혜택 */
  benefits: B2BGillerBenefits;
  
  // 기록
  /** 기록 */
  history: B2BGillerHistory;
  
  /** 상태 */
  status: B2BGillerStatus;
  
  /** 업데이트 일시 */
  updatedAt: Date;
}

/**
 * 등급별 승급 기준
 */
export const B2B_TIER_CRITERIA: Record<B2BGillerTier, B2BGillerCriteria> = {
  silver: {
    rating: 4.5,
    monthlyDeliveries: 30,
    tenure: 6
  },
  gold: {
    rating: 4.7,
    monthlyDeliveries: 50,
    tenure: 12
  },
  platinum: {
    rating: 4.9,
    monthlyDeliveries: 100,
    tenure: 24
  }
} as const;

/**
 * 등급별 혜택
 */
export const B2B_TIER_BENEFITS: Record<B2BGillerTier, B2BGillerBenefits> = {
  silver: {
    priorityLevel: 5,
    rateBonus: 20,
    monthlyBonus: 10
  },
  gold: {
    priorityLevel: 7,
    rateBonus: 30,
    monthlyBonus: 20
  },
  platinum: {
    priorityLevel: 10,
    rateBonus: 40,
    monthlyBonus: 30
  }
} as const;

/**
 * 등급별 상세 정보
 */
export const B2B_TIER_DETAILS = {
  silver: {
    name: "Silver 길러",
    description: "B2B 배송 자격을 갖춘 길러",
    criteria: B2B_TIER_CRITERIA.silver,
    benefits: B2B_TIER_BENEFITS.silver
  },
  gold: {
    name: "Gold 길러",
    description: "우수 B2B 길러",
    criteria: B2B_TIER_CRITERIA.gold,
    benefits: B2B_TIER_BENEFITS.gold
  },
  platinum: {
    name: "Platinum 길러",
    description: "최상급 B2B 길러",
    criteria: B2B_TIER_CRITERIA.platinum,
    benefits: B2B_TIER_BENEFITS.platinum
  }
} as const;
