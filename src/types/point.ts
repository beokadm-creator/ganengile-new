/**
 * Point and Deposit Type Definitions
 * 포인트 및 보증금 시스템 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

// ===== 포인트 타입 =====

/**
 * 포인트 유형
 */
export enum PointType {
  EARN = 'earn',           // 적립 (배송 수익)
  SPEND = 'spend',         // 사용 (보증금 결제)
  REFUND = 'refund',       // 환급 (보증금 환급)
  WITHDRAW = 'withdraw',   // 출금
  CHARGE = 'charge',       // 충전
  COMPENSATION = 'compensation', // 배상 차감 (사고/분실)
}

/**
 * 포인트 카테고리
 */
export enum PointCategory {
  DELIVERY_EARNINGS = 'delivery_earnings', // 배송 수익
  DEPOSIT_PAYMENT = 'deposit_payment',      // 보증금 결제
  DEPOSIT_REFUND = 'deposit_refund',      // 보증금 환급
  DEPOSIT_COMPENSATION = 'deposit_compensation', // 보증금 배상 차감
  CHARGE = 'charge',                       // 포인트 충전
  WITHDRAW = 'withdraw',                   // 포인트 출금
}

/**
 * 포인트 트랜잭션 상태
 */
export enum PointTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 포인트 트랜잭션
 */
export interface PointTransaction {
  transactionId: string;
  userId: string;

  // 금액
  amount: number;              // 포인트 금액 (양수: 적립/충전/환급, 음수: 사용/출금/배상)

  // 타입/카테고리
  type: PointType;
  category: PointCategory;

  // 잔액
  balanceBefore: number;        // 이전 포인트 잔액
  balanceAfter: number;         // 현재 포인트 잔액

  // 상태
  status: PointTransactionStatus;

  // 설명
  description: string;          // 설명 (예: "보증금 결제", "배송 수익", "사고 배상 차감")

  // 관련 정보
  relatedPaymentId?: string;    // 결제 ID (토스페이먼츠)
  relatedDeliveryId?: string;   // 배송 ID
  relatedRequestId?: string;    // 요청 ID
  relatedDepositId?: string;    // 보증금 ID

  // 메타데이터
  metadata?: {
    [key: string]: unknown;
  };

  // 시간
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

/**
 * 포인트 내역 조회 필터
 */
export interface PointTransactionFilter {
  startDate?: Date;
  endDate?: Date;
  type?: PointType;
  category?: PointCategory;
  limit?: number;
}

// ===== 보증금 타입 =====

/**
 * 보증금 상태
 */
export enum DepositStatus {
  PENDING = 'pending',       // 결제 대기 중
  PAID = 'paid',             // 결제 완료
  REFUNDED = 'refunded',     // 환급 완료
  DEDUCTED = 'deducted',     // 차감 완료 (배상)
}

/**
 * 보증금 결제 수단
 */
export enum DepositPaymentMethod {
  POINT_ONLY = 'point_only',           // 포인트만 결제
  TOSSPAYMENTS_ONLY = 'tosspayments_only', // 토스페이먼츠만 결제
  MIXED = 'mixed',                     // 혼합 결제 (포인트 + 토스페이먼츠)
}

/**
 * 보증금 거래
 */
export interface Deposit {
  depositId: string;
  userId: string;             // 길러 ID
  gllerId: string;            // 요청자(글러) ID
  requestId: string;          // 요청 ID
  deliveryId?: string;        // 배송 ID (완료 후 할당)

  // 금액
  itemValue: number;          // 물건 가치 (원)
  depositAmount: number;       // 보증금 금액 (원, 물건 가치의 80%)

  // 결제 정보
  paymentMethod: DepositPaymentMethod;
  pointAmount?: number;       // 포인트 사용 금액
  tossAmount?: number;        // 토스페이먼츠 결제 금액
  totalAmount: number;        // 총 결제 금액

  // 결제 ID
  paymentId?: string;         // 토스페이먼츠 결제 ID

  // 상태
  status: DepositStatus;

  // 환급/차감 정보
  refundedAt?: Timestamp;     // 환급 시간
  deductedAt?: Timestamp;     // 차감 시간
  compensationAmount?: number; // 배상 차감 금액

  // 설명
  description?: string;

  // 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== 상수 =====

/**
 * 보증금 비율
 */
export const DEPOSIT_RATE = 0.8;  // 80%

/**
 * 출금 최소 금액
 */
export const WITHDRAW_MIN_AMOUNT = 10000;  // 10,000원

/**
 * 출금 요청 데이터
 */
export interface WithdrawRequestData {
  userId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  bankCode?: string;
}

/**
 * 출금 요청
 */
export interface WithdrawRequest {
  requestId: string;
  userId: string;
  amount: number;
  bankName: string;
  accountNumber?: string;
  accountNumberMasked?: string;
  accountLast4?: string;
  accountHolder: string;
  bankCode?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Timestamp;
  completedAt?: Timestamp;
  failureReason?: string;
  integrationSnapshot?: {
    bank?: {
      testMode?: boolean;
      liveReady?: boolean;
      provider?: string;
      verificationMode?: string;
      requiresAccountHolderMatch?: boolean;
      manualReviewFallback?: boolean;
    };
  };
  processedContext?: Record<string, unknown>;
}
