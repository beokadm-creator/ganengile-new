/**
 * Penalty Types
 * 페널티 시스템 관련 타입 정의
 */

import { DeliveryStatus, DeliveryType } from './delivery';

// ==================== Cancellation Reason Types ====================

/**
 * 취소 사유 카테고리
 */
export enum CancelReasonCategory {
  /** 긴급 상황 (페널티 면제) */
  EMERGENCY = 'emergency',

  /** 합의 취소 (가벼운 페널티) */
  AGREED = 'agreed',

  /** 노쇼 (무거운 페널티) */
  NOSHOW = 'noshow',

  /** 시스템 오류 (페널티 없음) */
  SYSTEM_ERROR = 'system_error',

  /** 기타 사유 */
  OTHER = 'other',
}

/**
 * 취소 사유 세부 유형
 */
export enum CancelReason {
  // 긴급 상황 - 페널티 면제
  MEDICAL_EMERGENCY = 'medical_emergency',
  ACCIDENT = 'accident',
  FAMILY_EMERGENCY = 'family_emergency',
  NATURAL_DISASTER = 'natural_disaster',

  // 합의 취소 - 가벼운 페널티
  MUTUAL_AGREEMENT = 'mutual_agreement',
  SCHEDULE_CONFLICT = 'schedule_conflict',
  CHANGE_OF_MIND = 'change_of_mind',

  // 노쇼 - 무거운 페널티
  COURIER_NO_SHOW = 'courier_no_show',
  GLER_NO_SHOW = 'gler_no_show',

  // 시스템 오류 - 페널티 없음
  APP_CRASH = 'app_crash',
  SERVER_ERROR = 'server_error',
  MATCHING_ERROR = 'matching_error',

  // 기타
  OTHER = 'other',
}

/**
 * 취소 사유 정보
 */
export interface CancellationReasonInfo {
  /** 취소 사유 */
  reason: CancelReason;

  /** 카테고리 */
  category: CancelReasonCategory;

  /** 상세 설명 */
  description: string;

  /** 증빙 자료 URL 리스트 */
  evidenceUrls?: string[];

  /** 긴급 상황 여부 */
  isEmergency?: boolean;
}

// ==================== Penalty Types ====================

/**
 * 페널티 타입
 */
export enum PenaltyType {
  /** 평점 페널티 */
  RATING = 'rating',

  /** 금액 페널티 */
  MONETARY = 'monetary',

  /** 정지 페널티 */
  SUSPENSION = 'suspension',
}

/**
 * 페널티 심각도
 */
export enum PenaltySeverity {
  /** 가벼움 */
  LOW = 'low',

  /** 보통 */
  MEDIUM = 'medium',

  /** 무거움 */
  HIGH = 'high',

  /** 매우 무거움 */
  CRITICAL = 'critical',
}

/**
 * 페널티 상태
 */
export enum PenaltyStatus {
  /** 적용 대기중 */
  PENDING = 'pending',

  /** 활성화됨 */
  ACTIVE = 'active',

  /** 만료됨 */
  EXPIRED = 'expired',

  /** 감면됨 */
  REDUCED = 'reduced',

  /** 이의 제기됨 */
  APPEALED = 'appealed',

  /** 취소됨 */
  CANCELLED = 'cancelled',
}

/**
 * 단일 페널티 정보
 */
export interface PenaltyValue {
  /** 페널티 타입 */
  type: PenaltyType;

  /** 심각도 */
  severity: PenaltySeverity;

  /** 평점 페널티 값 (음수) */
  ratingPenalty?: number;

  /** 금액 페널티 (원) */
  monetaryPenalty?: number;

  /** 정지 기간 (일) */
  suspensionDays?: number;

  /** 정지 시작일 */
  suspensionStartDate?: Date;

  /** 정지 종료일 */
  suspensionEndDate?: Date;

  /** 설명 */
  description: string;
}

// ==================== Cancellation Record Types ====================

/**
 * 취소 기록
 */
export interface CancellationRecord {
  /** 기록 ID */
  recordId: string;

  /** 배송 ID */
  deliveryId: string;

  /** 요청 ID */
  requestId: string;

  /** 취소한 사용자 ID */
  cancelledByUserId: string;

  /** 취소한 사용자 역할 */
  cancelledByRole: 'gller' | 'giller';

  /** 취소 사유 정보 */
  reason: CancellationReasonInfo;

  /** 적용된 페널티 */
  appliedPenalty: PenaltyValue;

  /** 반복 위반 여부 */
  isRepeatViolation: boolean;

  /** 반복 횟수 (해월 내) */
  violationCount: number;

  /** 증빙 감면 적용 여부 */
  evidenceReductionApplied: boolean;

  /** 증빙 감면율 (0-1) */
  evidenceReductionRate?: number;

  /** 최종 페널티 (감면 후) */
  finalPenalty: PenaltyValue;

  /** 페널티 상태 */
  penaltyStatus: PenaltyStatus;

  /** 이의 제기 정보 */
  appealInfo?: {
    isAppealed: boolean;
    appealReason: string;
    appealDate: Date;
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: Date;
    adminNotes?: string;
  };

  /** 생성일 */
  createdAt: Date;

  /** 업데이트일 */
  updatedAt: Date;
}

// ==================== User Penalty Status Types ====================

/**
 * 사용자 페널티 상태
 */
export interface UserPenaltyStatus {
  /** 사용자 ID */
  userId: string;

  /** 현재 평점 */
  currentRating: number;

  /** 기본 평점 (페널티 없을 시 복구 값) */
  baseRating: number;

  /** 활성 페널티 목록 */
  activePenalties: PenaltyValue[];

  /** 누적 페널티 금액 (미결제) */
  unpaidPenaltyAmount: number;

  /** 정지 상태 */
  suspensionStatus: {
    /** 정지 중 여부 */
    isSuspended: boolean;

    /** 정지 시작일 */
    suspendedAt?: Date;

    /** 정지 종료일 */
    suspendedUntil?: Date;

    /** 정지 사유 */
    reason?: string;

    /** 남은 정지 일수 */
    remainingDays?: number;
  };

  /** 취소 기록 (최근 N건) */
  recentCancellations: {
    /** 취소 횟수 (지난 30일) */
    last30Days: number;

    /** 취소 횟수 (지난 7일) */
    last7Days: number;

    /** 취소 횟수 (오늘) */
    today: number;

    /** 마지막 취소일 */
    lastCancellationAt?: Date;
  };

  /** 위반 이력 */
  violationHistory: {
    /** 총 위반 횟수 */
    totalViolations: number;

    /** 노쇼 횟수 */
    noShowCount: number;

    /** 합의 취소 횟수 */
    agreedCancellationCount: number;

    /** 긴급 취소 횟수 */
    emergencyCancellationCount: number;
  };

  /** 페널티 경고 레벨 */
  warningLevel: {
    /** 현재 레벨 (0-3) */
    level: number;

    /** 다음 페널티 레벨까지 남은 위반 횟수 */
    violationsUntilNextLevel: number;

    /** 메시지 */
    message: string;
  };

  /** 업데이트일 */
  updatedAt: Date;
}

// ==================== Penalty Policy Types ====================

/**
 * 페널티 정책
 */
export interface PenaltyPolicy {
  /** 정책 ID */
  policyId: string;

  /** 정책 버전 */
  version: string;

  /** 정책명 */
  name: string;

  /** 활성화 여부 */
  isActive: boolean;

  /** 유효 기간 */
  validPeriod: {
    startDate: Date;
    endDate?: Date;
  };

  /** 페널티 매트릭스 */
  penaltyMatrix: {
    /** 긴급 상황 */
    emergency: {
      /** 페널티 면제 */
      isExempt: true;
    };

    /** 합의 취소 */
    agreedCancellation: {
      /** 평점 페널티 */
      ratingPenalty: number;

      /** 금액 페널티 (원) */
      monetaryPenalty: number;

      /** 정지 기간 (일) */
      suspensionDays: number;
    };

    /** 노쇼 (길러) */
    gillerNoShow: {
      /** 평점 페널티 */
      ratingPenalty: number;

      /** 금액 페널티 (원) */
      monetaryPenalty: number;

      /** 정지 기간 (일) */
      suspensionDays: number;

      /** 심각도 */
      severity: PenaltySeverity;
    };

    /** 노쇼 (글러) */
    glerNoShow: {
      /** 평점 페널티 */
      ratingPenalty: number;

      /** 금액 페널티 (원) */
      monetaryPenalty: number;

      /** 정지 기간 (일) */
      suspensionDays: number;

      /** 심각도 */
      severity: PenaltySeverity;
    };
  };

  /** 반복 위반 가중치 */
  repeatViolationMultiplier: {
    /** 반복 기간 (일) */
    windowDays: number;

    /** 반복 횟수별 가중치 */
    multipliers: {
      /** 2회 위반 */
      secondViolation: number;

      /** 3회 위반 */
      thirdViolation: number;

      /** 4회 이상 위반 */
      fourthOrMore: number;
    };
  };

  /** 증빙 감면 */
  evidenceReduction: {
    /** 최대 감면율 */
    maxReductionRate: number;

    /** 허용되는 증빙 유형 */
    acceptedEvidenceTypes: string[];

    /** 감면 적용 가이드라인 */
    guidelines: string[];
  };

  /** 첫 위반 경고 */
  firstViolationWarning: {
    /** 경고 활성화 */
    enabled: boolean;

    /** 경고 메시지 */
    message: string;
  };

  /** 경고 레벨 설정 */
  warningLevels: {
    level0: {
      threshold: number;
      message: string;
    };
    level1: {
      threshold: number;
      message: string;
    };
    level2: {
      threshold: number;
      message: string;
    };
    level3: {
      threshold: number;
      message: string;
    };
  };

  /** 정지 기간 설정 */
  suspensionPeriods: {
    /** 1차 위반 정지 기간 */
    firstViolation: number;

    /** 2차 위반 정지 기간 */
    secondViolation: number;

    /** 3차 위반 정지 기간 */
    thirdViolation: number;

    /** 영구 정지까지 횟수 */
    permanentBanThreshold: number;
  };

  /** 생성일 */
  createdAt: Date;

  /** 업데이트일 */
  updatedAt: Date;

  /** 생성자 */
  createdBy: string;
}

// ==================== Penalty Calculation Result ====================

/**
 * 페널티 계산 결과
 */
export interface PenaltyCalculationResult {
  /** 취소 사유 */
  reason: CancelReason;

  /** 카테고리 */
  category: CancelReasonCategory;

  /** 기본 페널티 */
  basePenalty: PenaltyValue;

  /** 반복 위반 여부 */
  isRepeatViolation: boolean;

  /** 반복 횟수 */
  violationCount: number;

  /** 반복 위반 가중치 */
  repeatMultiplier: number;

  /** 가중된 페널티 */
  weightedPenalty: PenaltyValue;

  /** 증빙 감면 적용 가능 여부 */
  evidenceReductionAvailable: boolean;

  /** 증빙 제출 시 감면된 페널티 */
  reducedPenalty?: PenaltyValue;

  /** 첫 위반 경고 적용 여부 */
  isFirstViolationWarning: boolean;

  /** 경고 메시지 */
  warningMessage?: string;

  /** 최종 페널티 */
  finalPenalty: PenaltyValue;
}

// ==================== Objection/Appeal Types ====================

/**
 * 이의 제기 상태
 */
export enum ObjectionStatus {
  /** 접수 대기 */
  PENDING = 'pending',

  /** 검토 중 */
  UNDER_REVIEW = 'under_review',

  /** 승인됨 (페널티 취소) */
  APPROVED = 'approved',

  /** 거부됨 (페널티 유지) */
  REJECTED = 'rejected',

  /** 추가 정보 요청 */
  INFO_REQUESTED = 'info_requested',
}

/**
 * 이의 제기 요청
 */
export interface ObjectionRequest {
  /** 이의 제기 ID */
  objectionId: string;

  /** 취소 기록 ID */
  cancellationRecordId: string;

  /** 사용자 ID */
  userId: string;

  /** 이의 제기 사유 */
  reason: string;

  /** 상세 설명 */
  description: string;

  /** 추가 증거 URL */
  additionalEvidenceUrls?: string[];

  /** 상태 */
  status: ObjectionStatus;

  /** 관리자 메모 */
  adminNotes?: string;

  /** 검토자 ID */
  reviewedBy?: string;

  /** 검토일 */
  reviewedAt?: Date;

  /** 생성일 */
  createdAt: Date;

  /** 업데이트일 */
  updatedAt: Date;
}
