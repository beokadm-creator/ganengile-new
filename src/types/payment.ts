/**
 * Payment and Settlement Type Definitions
 * P4: 결제 및 수수료 정산 시스템
 */

import { Timestamp } from 'firebase/firestore';
import { GillerType } from './user';
import { UrgencyLevel } from './matching';

// ===== Payment Types =====

/**
 * 결제 상태 (PaymentStatus)
 * Payment status enum
 */
export enum PaymentStatus {
  /** 결제 대기 중 */
  PENDING = 'pending',
  /** 결제 완료 */
  COMPLETED = 'completed',
  /** 결제 실패 */
  FAILED = 'failed',
  /** 결제 취소 */
  CANCELLED = 'cancelled',
  /** 환불 처리 중 */
  REFUNDING = 'refunding',
  /** 환불 완료 */
  REFUNDED = 'refunded',
}

/**
 * 결제 수단 (PaymentMethod)
 * Payment method enum
 */
export enum PaymentMethod {
  /** 신용카드 */
  CREDIT_CARD = 'credit_card',
  /** 간편결제 (카카오페이, 네이버페이 등) */
  EASY_PAYMENT = 'easy_payment',
  /** 포인트 결제 */
  POINT = 'point',
  /** 혼합 결제 */
  MIXED = 'mixed',
}

/**
 * 결제 정보 (Payment)
 * Payment information stored in Firestore
 */
export interface Payment {
  /** 결제 ID */
  paymentId: string;

  /** 연관된 배송/요청 ID */
  deliveryId?: string;
  requestId?: string;
  matchId?: string;

  /** 결제자 (이용자) ID */
  gllerId: string;

  /** 결제 금액 (KRW) */
  amount: number;

  /** 결제 수수료 (platform commission) */
  commission: {
    baseCommission: number;      // 기본 수수료 (5%)
    gradeBonus: number;          // 길러 등급 보너스 (0~2등급)
    urgencySurcharge: number;    // 긴급도 surcharge
    totalCommission: number;     // 총 수수료
  };

  /** 결제 수단 */
  paymentMethod: PaymentMethod;

  /** 결제 상태 */
  status: PaymentStatus;

  /** 결제 시도 횟수 */
  attemptCount: number;

  /** 결제 실패 사유 (실패 시) */
  failureReason?: string;

  /** 결제 완료 시간 */
  completedAt?: Timestamp;

  /** 결제 취소 시간 */
  cancelledAt?: Timestamp;

  /** 환불 정보 */
  refund?: {
    amount: number;
    reason: string;
    refundedAt?: Timestamp;
    status: 'pending' | 'completed' | 'failed';
  };

  /** 결제 메타데이터 (PG사 응답 등) */
  metadata?: {
    pgProvider?: string;         // PG사 (e.g., 'kakaopay', 'tosspayments')
    pgTransactionId?: string;    // PG사 거래 ID
    pgResponse?: Record<string, any>;  // PG사 응답 전체
  };

  /** 생성 시간 */
  createdAt: Timestamp;

  /** 업데이트 시간 */
  updatedAt: Timestamp;
}

/**
 * 결제 생성 데이터
 * Data for creating a new payment
 */
export interface CreatePaymentData {
  deliveryId?: string;
  requestId?: string;
  matchId?: string;
  gllerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  gillerGrade?: GillerType;
  urgencyLevel?: UrgencyLevel;
  metadata?: {
    pgProvider?: string;
    pgTransactionId?: string;
    pgResponse?: Record<string, any>;
  };
}

// ===== Settlement Types =====

/**
 * 정산 상태 (SettlementStatus)
 * Settlement status enum
 */
export enum SettlementStatus {
  /** 정산 대기 중 */
  PENDING = 'pending',
  /** 정산 처리 중 */
  PROCESSING = 'processing',
  /** 정산 완료 */
  COMPLETED = 'completed',
  /** 정산 실패 */
  FAILED = 'failed',
  /** 정산 보류 */
  ON_HOLD = 'on_hold',
}

/**
 * 길러 계좌 정보 (GillerBankAccount)
 * Giller's bank account information
 */
export interface GillerBankAccount {
  /** 은행 코드 */
  bankCode: string;

  /** 은행명 */
  bankName: string;

  /** 계좌번호 */
  accountNumber: string;

  /** 예금주명 */
  accountHolder: string;

  /** 계좌 상태 */
  status: 'active' | 'inactive' | 'verified';

  /** 기본 계좌 여부 */
  isDefault: boolean;

  /** 검증 시간 */
  verifiedAt?: Timestamp;

  /** 생성 시간 */
  createdAt: Timestamp;
}

/**
 * 정산 정보 (Settlement)
 * Settlement information stored in Firestore
 */
export interface Settlement {
  /** 정산 ID */
  settlementId: string;

  /** 연관된 결제 ID */
  paymentId: string;

  /** 연관된 배송/매칭 ID */
  deliveryId?: string;
  matchId?: string;

  /** 길러 ID */
  gillerId: string;

  /** 길러명 (비정규화된 데이터) */
  gillerName: string;

  /** 정산 금액 상세 */
  amount: {
    totalPayment: number;         // 총 결제 금액
    platformFee: number;          // 플랫폼 수수료
    gillerEarnings: number;       // 길러 수익
    tax: number;                  // 세금 (3.3%)
    netAmount: number;            // 실제 지급액 (수익 - 세금)
  };

  /** 길러 계좌 정보 */
  bankAccount: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };

  /** 정산 상태 */
  status: SettlementStatus;

  /** 정산 예정일 */
  scheduledFor: Date;

  /** 정산 완료일 */
  completedAt?: Timestamp;

  /** 정산 실패 사유 */
  failureReason?: string;

  /** 재시도 횟수 */
  retryCount: number;

  /** 메타데이터 */
  metadata?: {
    processedBy?: string;         // 처리자 (system 또는 admin ID)
    batchId?: string;             // 일괄 정산 배치 ID
    notes?: string;
  };

  /** 생성 시간 */
  createdAt: Timestamp;

  /** 업데이트 시간 */
  updatedAt: Timestamp;
}

/**
 * 정산 생성 데이터
 * Data for creating a new settlement
 */
export interface CreateSettlementData {
  paymentId: string;
  deliveryId?: string;
  matchId?: string;
  gillerId: string;
  gillerName: string;
  totalPayment: number;
  platformFee: number;
  bankAccount: GillerBankAccount;
  scheduledFor: Date;
}

/**
 * 정산 내역 조회 필터
 * Settlement history filter options
 */
export interface SettlementFilterOptions {
  /** 길러 ID 필터 */
  gillerId?: string;

  /** 상태 필터 */
  status?: SettlementStatus[];

  /** 날짜 범위 필터 */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** 최소 금액 필터 */
  minAmount?: number;

  /** 최대 금액 필터 */
  maxAmount?: number;

  /** 페이지네이션 */
  pagination?: {
    limit: number;
    offset: number;
  };

  /** 정렬 */
  sort?: {
    field: 'createdAt' | 'scheduledFor' | 'amount';
    order: 'asc' | 'desc';
  };
}

/**
 * 정산 통계 (SettlementStatistics)
 * Settlement statistics for giller
 */
export interface SettlementStatistics {
  /** 총 정산 횟수 */
  totalSettlements: number;

  /** 총 수익 */
  totalEarnings: number;

  /** 총 세금 */
  totalTax: number;

  /** 총 지급액 */
  totalNetAmount: number;

  /** 예정 정산금 (정산 대기 중) */
  pendingAmount: number;

  /** 완료된 정산금 */
  completedAmount: number;

  /** 보류 중인 정산금 */
  onHoldAmount: number;

  /** 평균 정산 주기 (일) */
  averageSettlementDays: number;

  /** 마지막 정산일 */
  lastSettlementDate?: Date;
}

/**
 * 결제 수수료 계산 결과
 * Commission calculation result
 */
export interface CommissionCalculationResult {
  /** 기본 수수료 (5%) */
  baseCommission: number;

  /** 길러 등급 보너스 (0~2등급) */
  gradeBonus: number;

  /** 긴급도 surcharge */
  urgencySurcharge: number;

  /** 총 수수료 */
  totalCommission: number;

  /** 길러 수익 */
  gillerEarnings: number;

  /** 최소 수수료 적용 여부 */
  appliedMinimum: boolean;

  /** 계산 시간 */
  calculatedAt: Date;
}

/**
 * 수수료 계산 옵션
 * Commission calculation options
 */
export interface CommissionCalculationOptions {
  /** 결제 금액 */
  amount: number;

  /** 길러 등급 */
  gillerGrade: GillerType;

  /** 긴급도 */
  urgencyLevel: UrgencyLevel;
}

// ===== Firestore Collection Names =====

/**
 * Firestore 컬렉션 이름 상수
 * Firestore collection name constants
 */
export const PAYMENT_COLLECTIONS = {
  PAYMENTS: 'payments',
  SETTLEMENTS: 'settlements',
} as const;
