/**
 * Matching Types
 * 매칭 관련 타입 정의
 * P1 Part 2: 유연한 매칭 시스템 포함
 */

import { Timestamp } from 'firebase/firestore';
import { StationInfo } from './request';

// ===== P1 Part 2: 유연한 매칭 시스템 =====

/**
 * 매칭 모드 (P1 신규)
 */
export enum MatchingMode {
  REGULAR = 'regular',       // 정규 매칭 (기존 시스템)
  ONE_TIME = 'one_time',    // 일회성 매칭 (현재 위치 기반)
  DELAYED = 'delayed',      // 지연 매칭 (30분, 1시간, 2시간 후)
  TIME_SLOT = 'time_slot',  // 시간 단위 매칭 (8:00-9:00 등)
}

/**
 * 지연 매칭 옵션 (P1 신규)
 */
export interface DelayedMatchingOptions {
  delayMinutes: 30 | 60 | 120; // 지연 시간
  maxWaitTime: number;          // 최대 대기 시간 (분)
}

/**
 * 시간 단위 매칭 옵션 (P1 신규)
 */
export interface TimeSlotMatchingOptions {
  startTime: string;  // 'HH:mm' 형식
  endTime: string;    // 'HH:mm' 형식
  date: Date;         // 매칭 날짜
}

/**
 * 환승역 정보 (P1 신규)
 */
export interface TransferStation extends StationInfo {
  transferLines: string[]; // ['1', '2'] - 환승 가능한 노선
  transferTime: number;   // 환승 소요 시간 (분)
  facilities?: {
    hasElevator: boolean;
    hasEscalator: boolean;
    hasRestroom: boolean;
  };
}

/**
 * 환승 경로 (P1 신규)
 */
export interface TransferRoute {
  pickupStation: StationInfo;
  transferStation: TransferStation;
  deliveryStation: StationInfo;

  // 경로 정보
  legs: {
    from: StationInfo;
    to: StationInfo;
    lineCode: string;
    travelTime: number;  // 분
  }[];

  totalTravelTime: number;  // 총 이동 시간 (분)
  totalTransferTime: number; // 총 환승 시간 (분)
  transferCount: number;    // 환승 횟수

  // 지하첗 요금
  baseFare: number;         // 기본 요금
  transferBonus: number;    // 환승 보너스
  totalFare: number;        // 총 요금
}

/**
 * 배송 요청 (P1 확장)
 */
export interface DeliveryRequestP1 {
  // 기존 필드
  requestId: string;
  gllerId: string;
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  status: string;

  // P1 신규 필드
  matchingMode: MatchingMode;

  // 일회성 모드
  currentLocation?: {
    latitude: number;
    longitude: number;
    stationId?: string;  // 현재 위치 근처 역
  };

  // 지연 매칭
  delayedOptions?: DelayedMatchingOptions;

  // 시간 단위 매칭
  timeSlotOptions?: TimeSlotMatchingOptions;

  // 환승 매칭
  preferredTransferStation?: string; // 선호 환승역
  allowTransferRoute: boolean;        // 환승 경로 허용 여부

  // 생성/업데이트 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 매칭 상태
 */
export enum MatchStatus {
  PENDING = 'pending',           // 길러 수락 대기 중
  ACCEPTED = 'accepted',         // 길러가 수락함
  REJECTED = 'rejected',         // 길러가 거절함
  CANCELLED = 'cancelled',       // 취소됨
  IN_PROGRESS = 'in_progress',   // 배송 중
  COMPLETED = 'completed',       // 배송 완료
}

/**
 * 매칭 점수 상세 정보
 */
export interface MatchScores {
  routeScore: number;       // 경로 적합도 점수 (0-100)
  timeScore: number;        // 시간 적합도 점수 (0-100)
  ratingScore: number;      // 평점 점수 (0-100)
  responseTimeScore: number; // 응답 시간 점수 (0-100)
}

/**
 * 경로 상세 정보
 */
export interface RouteDetails {
  travelTime: number;           // 이동 시간 (분)
  isExpressAvailable: boolean;  // 급행 열차 가능 여부
  transferCount: number;        // 환승 횟수
  congestionLevel?: 'low' | 'medium' | 'high'; // 혼잡도 (선택)
}

/**
 * 매칭 결과 (매칭 엔진 출력)
 */
export interface MatchingResult {
  gillerId: string;
  gillerName: string;
  gillerRating: number;
  totalScore: number;          // 종합 점수 (0-100)
  scores: MatchScores;         // 상세 점수
  routeDetails: RouteDetails;  // 경로 상세
  reasons: string[];           // 매칭 사유
}

/**
 * 매칭 (Firestore 문서)
 */
export interface Match {
  matchId: string;

  // 요청 정보
  requestId: string;
  gllerId: string;             // 요청자 (이용자) ID

  // 길러 정보
  gillerId: string;
  gillerName: string;
  gillerRating: number;
  gillerTotalDeliveries: number;  // 총 배송 건수

  // 매칭 점수
  matchScore: number;          // 종합 매칭 점수 (0-100)
  matchingDetails: {
    routeScore: number;
    timeScore: number;
    ratingScore: number;
    responseTimeScore: number;
    calculatedAt: Date;
  };

  // 경로 정보
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  estimatedTravelTime: number; // 예상 이동 시간 (분)

  // 상태
  status: MatchStatus;

  // 시간 정보
  createdAt: Timestamp;
  notifiedAt?: Timestamp;      // 길러에게 알림 발송 시간
  acceptedAt?: Timestamp;      // 길러 수락 시간
  rejectedAt?: Timestamp;      // 길러 거절 시간
  startedAt?: Timestamp;       // 배송 시작 시간
  completedAt?: Timestamp;     // 배송 완료 시간

  // 취소 정보
  cancelledAt?: Timestamp;
  cancellationReason?: string;
  cancelledBy?: 'gller' | 'giller' | 'system';

  // 배송비
  fee: number;

  // 길러 메모 (선택 - 길러가 요청 수락 시 남길 수 있음)
  gillerNote?: string;
}

/**
 * 매칭 생성 데이터
 */
export interface CreateMatchData {
  requestId: string;
  gllerId: string;
  gillerId: string;
  gillerName: string;
  gillerRating: number;
  gillerTotalDeliveries: number;
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  estimatedTravelTime: number;
  matchScore: number;
  matchingDetails: Match['matchingDetails'];
  fee: number;
}

/**
 * 매칭 결과 화면용 데이터 형식
 */
export interface MatchResultDisplay {
  rank: number;
  gillerId: string;
  gillerName: string;
  gillerRating: number;
  gillerTotalDeliveries: number;
  matchScore: number;
  estimatedTravelTime: number;
  hasExpressAvailable: boolean;
  transferCount: number;
  reasons: string[];
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  fee: number;
}

/**
 * 매칭 필터 옵션
 */
export interface MatchFilterOptions {
  status?: MatchStatus;
  gllerId?: string;
  gillerId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * 매칭 통계
 */
export interface MatchStatistics {
  totalMatches: number;
  acceptedMatches: number;
  rejectedMatches: number;
  completedMatches: number;
  cancelledMatches: number;
  averageResponseTime: number; // 분 단위
  averageRating: number;
}

// ===== P1 Part 2: 요금 정책 =====

/**
 * 요금 정책 타입 (P1 신규)
 */
export enum PricingType {
  BASE = 'base',              // 기본 요금
  TRANSFER = 'transfer',      // 환승 요금
  EXPRESS = 'express',        // 급행 열차 추가 요금
  NIGHT = 'night',            // 야간 할증
  PROFESSIONAL_BONUS = 'professional_bonus', // 전문 길러 보너스
  DISTANCE = 'distance',      // 거리 기반 요금
}

/**
 * 요금 계산 결과 (P1 신규)
 */
export interface PricingResult {
  // 기본 요금
  baseFare: number;

  // 추가 요금
  breakdown: {
    type: PricingType;
    amount: number;
    description: string;
  }[];

  // 할인/보너스
  discounts: {
    type: 'transfer_bonus' | 'professional_bonus' | 'night_discount';
    amount: number;
    description: string;
  }[];

  // 최종 요금
  totalFare: number;

  // 길러 수익 (보너스 포함)
  gillerEarnings: {
    base: number;
    bonus: number;
    total: number;
  };

  // 계산 시간
  calculatedAt: Date;
}

/**
 * 긴급도 레벨 (P1 개선)
 */
export enum UrgencyLevel {
  NORMAL = 'normal',       // 일반 (2시간 이내)
  URGENT = 'urgent',       // 긴급 (1시간 이내)
  VERY_URGENT = 'very_urgent', // 매우 긴급 (30분 이내)
}

/**
 * 요금 계산 옵션 (P1 개선)
 */
export interface PricingOptions {
  distance?: number;          // 거리 (km)
  travelTime?: number;        // 이동 시간 (분)
  isRushHour?: boolean;       // 러시아워 여부 (07-09, 18-20)
  urgency?: UrgencyLevel;     // 긴급도 (normal/urgent/very_urgent)
  gillerLevel?: 'regular' | 'professional' | 'master'; // 길러 등급
  isTransferRoute?: boolean;  // 환승 경로 여부
  transferCount?: number;     // 환승 횟수
}
