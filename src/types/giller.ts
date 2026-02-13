/**
 * Giller Types
 * 길러 등급, 배지, 승급/강감 관련 타입
 */

export enum GillerType {
  REGULAR = 'regular',      // 일반 길러
  PROFESSIONAL = 'professional',  // 전문 길러
}

export enum GillerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

/**
 * 길러 등급별 제한
 */
export interface GillerLimits {
  maxRoutes: number;           // 최대 동선 수
  maxDailyDeliveries: number;   // 일일 최대 배송 건수
}

/**
 * 길러 혜택
 */
export interface GillerBenefits {
  priorityMatching: 'normal' | 'high' | 'highest';  // 매칭 우선순위
  rateBonus: number;           // 요금 보너스 (%)
  supportLevel: 'standard' | 'priority';  // 고객 지원 수준
  exclusiveRequests: boolean;  // 전문 길러 전용 요청 접근
  analytics: boolean;          // 상세 통계 대시보드
  earlyAccess: boolean;        // 신규 기능 먼저 체험
}

/**
 * 길러 통계
 */
export interface GillerStats {
  totalCompletedDeliveries: number;
  totalEarnings: number;
  rating: number;              // 1.0 ~ 5.0
  accountAgeDays: number;
  recentPenalties: number;     // 최근 30일 페널티 건수
  recentActivity: number;      // 최근 30일 배송 건수
}

/**
 * 승급 정보
 */
export interface GillerPromotion {
  isEligible: boolean;
  appliedAt?: Date;
  score?: number;              // 승급 점수 (0~100)
}

/**
 * 길러 프로필 (확장)
 */
export interface GillerProfile {
  userId: string;
  gillerType: GillerType;
  status: GillerStatus;

  // 등급별 제한
  limits: GillerLimits;

  // 혜택
  benefits: GillerBenefits;

  // 통계
  stats: GillerStats;

  // 승급 정보
  promotion?: GillerPromotion;
}

/**
 * 승급 기준
 */
export interface PromotionCriteria {
  minCompletedDeliveries: number;  // 최소 완료 건수
  minRating: number;               // 최소 평점
  minAccountAgeDays: number;       // 최소 가입 기간 (일)
  maxRecentPenalties: number;      // 최근 페널티 최대 건수
  minRecentActivity: number;       // 최근 활동 (최근 30일 배송 건수)
}

/**
 * 일반 길러 설정
 */
export const REGULAR_GILLER_CONFIG = {
  limits: {
    maxRoutes: 5,
    maxDailyDeliveries: 10,
  },
  benefits: {
    priorityMatching: 'normal' as const,
    rateBonus: 0,
    supportLevel: 'standard' as const,
    exclusiveRequests: false,
    analytics: false,
    earlyAccess: false,
  },
};

/**
 * 전문 길러 설정
 */
export const PROFESSIONAL_GILLER_CONFIG = {
  limits: {
    maxRoutes: 10,
    maxDailyDeliveries: 20,
  },
  benefits: {
    priorityMatching: 'high' as const,
    rateBonus: 15,  // 15% 보너스
    supportLevel: 'priority' as const,
    exclusiveRequests: true,
    analytics: true,
    earlyAccess: true,
  },
};
