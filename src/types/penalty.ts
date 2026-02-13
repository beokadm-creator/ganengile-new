/**
 * Penalty Types
 * 페널티 시스템 관련 타입
 */

import { Timestamp } from 'firebase/firestore';

export enum PenaltyType {
  LATE_ARRIVAL = 'late_arrival',         // 지연
  NO_SHOW = 'no_show',                   // 노쇼
  LOW_RATING = 'low_rating',             // 평점 저하
  CANCELLATION = 'cancellation',         // 취소
  PACKAGE_DAMAGE = 'package_damage',     // 물품 파손
  MISCONDUCT = 'misconduct',             // 비위
}

export enum PenaltySeverity {
  WARNING = 'warning',       // 경고
  MILD = 'mild',           // 경미
  MODERATE = 'moderate',   // 중간
  SEVERE = 'severe',       // 심각
}

/**
 * 페널티 기준 (지연)
 */
export interface LateArrivalPenalty {
  minutes: number;
  severity: PenaltySeverity;
  ratingPenalty: number;    // 평점 차감
  fine: number;             // 벌금 (원)
  suspensionDays?: number;   // 정지 기간 (일)
}

export const LATE_ARRIVAL_PENALTIES: LateArrivalPenalty[] = [
  { minutes: 5, severity: PenaltySeverity.WARNING, ratingPenalty: 0, fine: 0 },
  { minutes: 15, severity: PenaltySeverity.MILD, ratingPenalty: -0.5, fine: 1000 },
  { minutes: 30, severity: PenaltySeverity.MODERATE, ratingPenalty: -1.0, fine: 0, suspensionDays: 7 },
];

/**
 * 페널티 기준 (노쇼)
 */
export interface NoShowPenalty {
  count: number;           // 누적 횟수
  ratingPenalty: number;    // 평점 차감
  suspensionDays: number;   // 정지 기간 (일)
  compensation: number;     // 보상금 (원)
}

export const NO_SHOW_PENALTIES: NoShowPenalty[] = [
  { count: 1, ratingPenalty: -2.0, suspensionDays: 30, compensation: 5000 },
  { count: 2, ratingPenalty: -2.0, suspensionDays: 60, compensation: 10000 },
  { count: 3, ratingPenalty: -2.0, suspensionDays: 0, compensation: 0 },  // 영구 정지
];

/**
 * 페널티 기준 (평점)
 */
export interface RatingPenaltyThreshold {
  minRating: number;
  maxRating: number;
  action: string;          // 조치
  matchingPenalty?: number; // 매칭 우선순위 차감 (%)
  suspensionDays?: number;  // 정지 기간 (일)
  requiresRetraining?: boolean; // 재교육 필요
}

export const RATING_PENALTIES: RatingPenaltyThreshold[] = [
  { minRating: 2.5, maxRating: 3.0, action: '경고' },
  { minRating: 2.0, maxRating: 2.5, action: '7일 정지 + 재교육', matchingPenalty: 20, suspensionDays: 7, requiresRetraining: true },
  { minRating: 1.5, maxRating: 2.0, action: '30일 정지 + 재평가', matchingPenalty: 50, suspensionDays: 30, requiresRetraining: true },
  { minRating: 0.0, maxRating: 1.5, action: '영구 정지 (10건+)', suspensionDays: 0 },
];

/**
 * 페널티 기준 (취소)
 */
export interface CancellationPenalty {
  timing: 'before_pickup' | 'after_pickup';
  count: number;           // 누적 횟수
  ratingPenalty: number;    // 평점 차감
  suspensionDays?: number;  // 정지 기간 (일)
  fine?: number;            // 벌금 (원)
}

export const CANCELLATION_PENALTIES: CancellationPenalty[] = [
  { timing: 'before_pickup', count: 1, ratingPenalty: 0 },
  { timing: 'before_pickup', count: 3, ratingPenalty: -0.5, suspensionDays: 3 },
  { timing: 'after_pickup', count: 1, ratingPenalty: -1.0, suspensionDays: 7, fine: 3000 },
  { timing: 'after_pickup', count: 2, ratingPenalty: -1.5, suspensionDays: 14, fine: 6000 },
];

/**
 * 경고 정보
 */
export interface Warning {
  warningId: string;
  userId: string;
  type: PenaltyType;
  severity: PenaltySeverity;
  message: string;
  expiresAt?: Date;       // 경고 만료 시간 (30일 후 소멸)
  createdAt: Date;
}

/**
 * 페널티 기록
 */
export interface Penalty {
  penaltyId: string;
  userId: string;
  type: PenaltyType;
  severity: PenaltySeverity;
  reason: string;
  
  // 지연 관련
  lateMinutes?: number;
  
  // 노쇼 관련
  noShowCount?: number;
  
  // 평점 관련
  ratingAtTime?: number;
  
  // 취소 관련
  cancelledAtPickup?: boolean;
  
  // 금액 페널티
  fine: number;
  
  // 정지
  suspensionDays?: number;
  suspensionStartsAt?: Date;
  suspensionEndsAt?: Date;
  isPermanent: boolean;
  
  // 경고
  warningId?: string;
  
  createdAt: Date;
  createdBy: 'system' | 'admin';
}

/**
 * 사용자 페널티 요약 (최근 30일)
 */
export interface PenaltySummary {
  userId: string;
  totalPenalties: number;
  totalFines: number;
  totalSuspensionDays: number;
  isSuspended: boolean;
  suspensionEndsAt?: Date;
  warnings: Warning[];
  recentPenalties: Penalty[];
}
