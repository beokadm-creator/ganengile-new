/**
 * User Types - P1 Professional Giller & Badge System
 * 사용자 관련 타입 정의 (전문 길러 시스템 포함)
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 사용자 역할
 */
export enum UserRole {
  // 이용자 (배송 요청)
  GLER = 'gller',

  // 길러 (배송 대행)
  GILLER = 'giller',

  // 둘 다
  BOTH = 'both',
}

/**
 * 길러 등급 (P1 신규)
 */
export enum GillerType {
  REGULAR = 'regular',      // 일반 길러
  PROFESSIONAL = 'professional',  // 전문 길러
  MASTER = 'master',        // 마스터 길러
}

/**
 * 길러 상태 (P1 신규)
 */
export enum GillerStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

/**
 * 사용자 기본 정보 (P1 확장)
 */
export interface User {
  uid: string;
  email: string;
  name: string;
  phoneNumber?: string;

  // 역할 (길러/이용자/둘다)
  role: UserRole;

  // 온보딩 완료 여부
  hasCompletedOnboarding?: boolean;

  // 프로필 사진
  profilePhoto?: string;

  // 평점
  rating?: number;
  totalRatings?: number;

  // FCM 토큰 (푸시 알림)
  fcmToken?: string;
  fcmTokenUpdatedAt?: Timestamp;

  // 생성/업데이트 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // 계정 상태
  isActive: boolean;
  isVerified?: boolean;

  // 약관 동의
  agreedTerms: {
    giller: boolean;
    gller: boolean;
    privacy: boolean;
    marketing: boolean; // 선택적
  };

  // ===== P1 신규 필드: 전문 길러 시스템 =====

  // 길러 프로필 (전문 길러 시스템)
  gillerProfile?: {
    // 등급
    type: GillerType;  // regular | professional | master
    status: GillerStatus;  // active | suspended | inactive

    // 제한 사항
    limits: {
      maxRoutes: number;        // 일반 5, 전문 10, 마스터 15
      maxDailyDeliveries: number; // 일반 10, 전문 20, 마스터 30
    };

    // 혜택
    benefits: {
      priorityMatching: 'normal' | 'high' | 'highest';
      rateBonus: number;  // 0%, 15%, 25%
      supportLevel: 'standard' | 'priority' | 'dedicated';
      exclusiveRequests: boolean;
      analytics: boolean;
      earlyAccess: boolean;
    };

    // 승급 정보
    promotion?: {
      appliedAt: Date;
      approvedAt?: Date;
      status: 'pending' | 'approved' | 'rejected';
    };
  };

  // 통계 (확장)
  stats: {
    completedDeliveries: number;
    totalEarnings: number;
    rating: number;
    recentPenalties: number;  // P1 신규: 최근 페널티 수
    accountAgeDays: number;   // P1 신규: 계정 나이(일)
    recent30DaysDeliveries: number;  // P1 신규: 최근 30일 배송 수
  };

  // 배지 (P1 신규)
  badges: {
    activity: string[];    // 활동 배지 ID
    quality: string[];     // 품질 배지 ID
    expertise: string[];   // 전문성 배지 ID
    community: string[];   // 커뮤니티 배지 ID
  };

  // 배지 혜택 (P1 신규)
  badgeBenefits: {
    profileFrame: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
    totalBadges: number;
    currentTier: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
  };

  // ===== 기존 필드 (호환성 유지) =====

  // 길러 전용 필드 (role이 GILLER 또는 BOTH일 때만)
  gillerInfo?: {
    totalDeliveries?: number;
    totalEarnings?: number;
    equipment?: {
      hasInsulatedBag?: boolean;
      hasHeatedBag?: boolean;
      vehicleType?: 'walk' | 'bike' | 'motorcycle' | 'car';
    };
  };

  // 이용자 전용 필드 (role이 GLER 또는 BOTH일 때만)
  gllerInfo?: {
    totalRequests?: number;
    successfulDeliveries?: number;
  };
}

/**
 * 회원가입 폼 데이터
 */
export interface RegistrationFormData {
  // 1단계: 기본 정보
  email: string;
  password: string;
  name: string;
  phoneNumber?: string;

  // 2단계: 역할 선택
  role: UserRole;

  // 3단계: 프로필 사진
  profilePhoto?: string; // Firebase Storage URL

  // 4단계: 약관 동의
  agreedTerms: {
    giller: boolean; // 길러 약관 동의
    gller: boolean;  // 이용자 약관 동의
    privacy: boolean;
    marketing: boolean;
  };
}

// ===== P1 신규: 배지 시스템 =====

/**
 * 배지 카테고리 (P1 신규)
 */
export enum BadgeCategory {
  ACTIVITY = 'activity',    // 활동
  QUALITY = 'quality',      // 품질
  EXPERTISE = 'expertise',  // 전문성
  COMMUNITY = 'community',  // 커뮤니티
}

/**
 * 배지 등급 (P1 신규)
 */
export enum BadgeTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

/**
 * 배지 (P1 신규)
 */
export interface Badge {
  id: string;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;  // Emoji
  tier: BadgeTier;

  requirement: {
    type: string;
    value: number | object;
    [key: string]: any; // 유연한 추가 속성 허용
  };

  createdAt: Timestamp;
}

/**
 * 배지 요구사항 타입 (P1 신규)
 */
export enum BadgeRequirementType {
  COMPLETED_DELIVERIES = 'completedDeliveries',           // 완료 배송 수
  WEEKLY_DELIVERIES = 'weeklyDeliveries',                 // 주간 배송 수
  CONSECUTIVE_WEEKS = 'consecutiveWeeks',                 // 연속 주간 활동
  CONSECUTIVE_DELIVERIES_WITHOUT_DELAY = 'consecutiveDeliveriesWithoutDelay',  // 지연 없는 연속 배송
  MIN_RATING = 'minRating',                               // 최소 평점
  NO_SHOW_COUNT = 'noShowCount',                          // 노쇼 횟수
  UNIQUE_LINES_USED = 'uniqueLinesUsed',                  // 이용 노선 수
  TRANSFER_DELIVERIES = 'transferDeliveries',             // 환승 배송 수
  DELAY_RATE = 'delayRate',                               // 지연율
}

/**
 * 약관 내용
 */
export interface TermsContent {
  title: string;
  content: string;
  version: string;
  effectiveDate: string;
}

/**
 * 길러 약관 (예시)
 */
export const GILLER_TERMS: TermsContent = {
  title: '길러 이용약관',
  content: `
제1조(목적)
본 약관은 '가는길에' 서비스에서 길러(배송 대행자)로서의 역할과 책임에 대해 정의합니다.

제2조(길러의 의무)
1. 길러는 지정된 시간 내에 배송을 완료해야 합니다.
2. 배송 물품의 안전을 최우선으로 고려해야 합니다.
3. 요청자의 연락에 신속히 응답해야 합니다.

제3조(수수료 및 정산)
1. 배송 완료 후 수수료가 정산됩니다.
2. 정산은 주 1회 이루어집니다.

제4조(책임)
1. 배송 중 물품의 분실, 파손 시 책임을 집니다.
2. 사고 발생 시 즉시 신고해야 합니다.
  `,
  version: '1.0.0',
  effectiveDate: '2026-02-05',
};

/**
 * 이용자 약관 (예시)
 */
export const GLER_TERMS: TermsContent = {
  title: '이용자 이용약관',
  content: `
제1조(목적)
본 약관은 '가는길에' 서비스에서 이용자(배송 요청자)로서의 권리와 의무에 대해 정의합니다.

제2조(이용자의 의무)
1. 정확한 배송 정보를 입력해야 합니다.
2. 배송비를 지정된 방법으로 결제해야 합니다.
3. 길러에게 예의를 갖춰야 합니다.

제3조(배송 취소)
1. 배송 시작 전에는 취소 가능합니다.
2. 시작 후에는 길러의 동의가 필요합니다.

제4조(면책)
1. 길러의 귀책 사유가 아닌 지연에 대해 책임지지 않습니다.
  `,
  version: '1.0.0',
  effectiveDate: '2026-02-05',
};

/**
 * 개인정보 처리방침 (공통)
 */
export const PRIVACY_POLICY: TermsContent = {
  title: '개인정보 처리방침',
  content: `
제1조(개인정보의 수집 항목)
1. 필수 정보: 이메일, 이름, 연락처
2. 선택 정보: 프로필 사진, 배송 선호 정보

제2조(수집 목적)
1. 서비스 제공 및 이용자 식별
2. 배송 매칭 및 연락
3. 결제 및 정산

제3조(보유 및 이용 기간)
1. 회원 탈퇴 시 즉시 파기
2. 관계 법령에 따라 보관

제4조(제3자 제공)
1. 원칙적으로 제3자에게 제공하지 않음
2. 법령에 따라 제공하는 경우 예외
  `,
  version: '1.0.0',
  effectiveDate: '2026-02-05',
};
