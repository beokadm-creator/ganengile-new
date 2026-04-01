/**
 * Payment and Settlement Type Definitions
 * P4: 寃곗젣 諛??섏닔猷??뺤궛 ?쒖뒪??
 */

import { Timestamp } from 'firebase/firestore';
import { GillerType } from './user';
import { UrgencyLevel } from './matching';

// ===== Payment Types =====

/**
 * 寃곗젣 ?곹깭 (PaymentStatus)
 * Payment status enum
 */
export enum PaymentStatus {
  /** 寃곗젣 ?湲?以?*/
  PENDING = 'pending',
  /** 寃곗젣 ?꾨즺 */
  COMPLETED = 'completed',
  /** 寃곗젣 ?ㅽ뙣 */
  FAILED = 'failed',
  /** 寃곗젣 痍⑥냼 */
  CANCELLED = 'cancelled',
  /** ?섎텋 泥섎━ 以?*/
  REFUNDING = 'refunding',
  /** ?섎텋 ?꾨즺 */
  REFUNDED = 'refunded',
}

/**
 * 寃곗젣 ?섎떒 (PaymentMethod)
 * Payment method enum
 */
export enum PaymentMethod {
  /** ?좎슜移대뱶 */
  CREDIT_CARD = 'credit_card',
  /** 媛꾪렪寃곗젣 (移댁뭅?ㅽ럹?? ?ㅼ씠踰꾪럹???? */
  EASY_PAYMENT = 'easy_payment',
  /** ?ъ씤??寃곗젣 */
  POINT = 'point',
  /** ?쇳빀 寃곗젣 */
  MIXED = 'mixed',
}

/**
 * 寃곗젣 ?뺣낫 (Payment)
 * Payment information stored in Firestore
 */
export interface Payment {
  /** 寃곗젣 ID */
  paymentId: string;

  /** ?곌???諛곗넚/?붿껌 ID */
  deliveryId?: string;
  requestId?: string;
  matchId?: string;

  /** 寃곗젣??(?댁슜?? ID */
  gllerId: string;

  /** 寃곗젣 湲덉븸 (KRW) */
  amount: number;

  /** 寃곗젣 ?섏닔猷?(platform commission) */
  commission: {
    baseCommission: number;      // 湲곕낯 ?섏닔猷?(5%)
    gradeBonus: number;          // 湲몃윭 ?깃툒 蹂대꼫??(0~2?깃툒)
    urgencySurcharge: number;    // 湲닿툒??surcharge
    totalCommission: number;     // 珥??섏닔猷?
  };

  /** 寃곗젣 ?섎떒 */
  paymentMethod: PaymentMethod;

  /** 寃곗젣 ?곹깭 */
  status: PaymentStatus;

  /** 寃곗젣 ?쒕룄 ?잛닔 */
  attemptCount: number;

  /** 寃곗젣 ?ㅽ뙣 ?ъ쑀 (?ㅽ뙣 ?? */
  failureReason?: string;

  /** 寃곗젣 ?꾨즺 ?쒓컙 */
  completedAt?: Timestamp;

  /** 寃곗젣 痍⑥냼 ?쒓컙 */
  cancelledAt?: Timestamp;

  /** ?섎텋 ?뺣낫 */
  refund?: {
    amount: number;
    reason: string;
    refundedAt?: Timestamp;
    status: 'pending' | 'completed' | 'failed';
  };

  /** 寃곗젣 硫뷀??곗씠??(PG???묐떟 ?? */
  metadata?: {
    pgProvider?: string;         // PG??(e.g., 'kakaopay', 'tosspayments')
    pgTransactionId?: string;    // PG??嫄곕옒 ID
    pgResponse?: Record<string, any>;  // PG???묐떟 ?꾩껜
  };

  /** ?앹꽦 ?쒓컙 */
  createdAt: Timestamp;

  /** ?낅뜲?댄듃 ?쒓컙 */
  updatedAt: Timestamp;
}

/**
 * 寃곗젣 ?앹꽦 ?곗씠??
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
 * ?뺤궛 ?곹깭 (SettlementStatus)
 * Settlement status enum
 */
export enum SettlementStatus {
  /** ?뺤궛 ?湲?以?*/
  PENDING = 'pending',
  /** ?뺤궛 泥섎━ 以?*/
  PROCESSING = 'processing',
  /** ?뺤궛 ?꾨즺 */
  COMPLETED = 'completed',
  /** ?뺤궛 ?ㅽ뙣 */
  FAILED = 'failed',
  /** ?뺤궛 蹂대쪟 */
  ON_HOLD = 'on_hold',
}

/**
 * 湲몃윭 怨꾩쥖 ?뺣낫 (GillerBankAccount)
 * Giller's bank account information
 */
export interface GillerBankAccount {
  /** ???肄붾뱶 */
  bankCode: string;

  /** ??됰챸 */
  bankName: string;

  /** 怨꾩쥖踰덊샇 */
  accountNumber?: string;
  accountNumberMasked?: string;
  accountLast4?: string;

  /** ?덇툑二쇰챸 */
  accountHolder: string;

  /** 怨꾩쥖 ?곹깭 */
  status: 'active' | 'inactive' | 'verified';

  /** 湲곕낯 怨꾩쥖 ?щ? */
  isDefault: boolean;

  /** 寃利??쒓컙 */
  verifiedAt?: Timestamp;

  /** ?앹꽦 ?쒓컙 */
  createdAt: Timestamp;
}

/**
 * ?뺤궛 ?뺣낫 (Settlement)
 * Settlement information stored in Firestore
 */
export interface Settlement {
  /** ?뺤궛 ID */
  settlementId: string;

  /** ?곌???寃곗젣 ID */
  paymentId: string;

  /** ?곌???諛곗넚/留ㅼ묶 ID */
  deliveryId?: string;
  matchId?: string;

  /** 湲몃윭 ID */
  gillerId: string;

  /** 湲몃윭紐?(鍮꾩젙洹쒗솕???곗씠?? */
  gillerName: string;

  /** ?뺤궛 湲덉븸 ?곸꽭 */
  amount: {
    totalPayment: number;         // 珥?寃곗젣 湲덉븸
    platformFee: number;          // ?뚮옯???섏닔猷?
    gillerEarnings: number;       // 湲몃윭 ?섏씡
    tax: number;                  // ?멸툑 (3.3%)
    netAmount: number;            // ?ㅼ젣 吏湲됱븸 (?섏씡 - ?멸툑)
  };

  /** 湲몃윭 怨꾩쥖 ?뺣낫 */
  bankAccount: {
    bankCode: string;
    bankName: string;
    accountNumber?: string;
    accountNumberMasked?: string;
    accountLast4?: string;
    accountHolder: string;
  };

  /** ?뺤궛 ?곹깭 */
  status: SettlementStatus;

  /** ?뺤궛 ?덉젙??*/
  scheduledFor: Date;

  /** ?뺤궛 ?꾨즺??*/
  completedAt?: Timestamp;

  /** ?뺤궛 ?ㅽ뙣 ?ъ쑀 */
  failureReason?: string;

  /** ?ъ떆???잛닔 */
  retryCount: number;

  /** 硫뷀??곗씠??*/
  metadata?: {
    processedBy?: string;         // 泥섎━??(system ?먮뒗 admin ID)
    batchId?: string;             // ?쇨큵 ?뺤궛 諛곗튂 ID
    notes?: string;
  };

  /** ?앹꽦 ?쒓컙 */
  createdAt: Timestamp;

  /** ?낅뜲?댄듃 ?쒓컙 */
  updatedAt: Timestamp;
}

/**
 * ?뺤궛 ?앹꽦 ?곗씠??
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
 * ?뺤궛 ?댁뿭 議고쉶 ?꾪꽣
 * Settlement history filter options
 */
export interface SettlementFilterOptions {
  /** 湲몃윭 ID ?꾪꽣 */
  gillerId?: string;

  /** ?곹깭 ?꾪꽣 */
  status?: SettlementStatus[];

  /** ?좎쭨 踰붿쐞 ?꾪꽣 */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** 理쒖냼 湲덉븸 ?꾪꽣 */
  minAmount?: number;

  /** 理쒕? 湲덉븸 ?꾪꽣 */
  maxAmount?: number;

  /** ?섏씠吏?ㅼ씠??*/
  pagination?: {
    limit: number;
    offset: number;
  };

  /** ?뺣젹 */
  sort?: {
    field: 'createdAt' | 'scheduledFor' | 'amount';
    order: 'asc' | 'desc';
  };
}

/**
 * ?뺤궛 ?듦퀎 (SettlementStatistics)
 * Settlement statistics for giller
 */
export interface SettlementStatistics {
  /** 珥??뺤궛 ?잛닔 */
  totalSettlements: number;

  /** 珥??섏씡 */
  totalEarnings: number;

  /** 珥??멸툑 */
  totalTax: number;

  /** 珥?吏湲됱븸 */
  totalNetAmount: number;

  /** ?덉젙 ?뺤궛湲?(?뺤궛 ?湲?以? */
  pendingAmount: number;

  /** ?꾨즺???뺤궛湲?*/
  completedAmount: number;

  /** 蹂대쪟 以묒씤 ?뺤궛湲?*/
  onHoldAmount: number;

  /** ?됯퇏 ?뺤궛 二쇨린 (?? */
  averageSettlementDays: number;

  /** 留덉?留??뺤궛??*/
  lastSettlementDate?: Date;
}

/**
 * 寃곗젣 ?섏닔猷?怨꾩궛 寃곌낵
 * Commission calculation result
 */
export interface CommissionCalculationResult {
  /** 湲곕낯 ?섏닔猷?(5%) */
  baseCommission: number;

  /** 湲몃윭 ?깃툒 蹂대꼫??(0~2?깃툒) */
  gradeBonus: number;

  /** 湲닿툒??surcharge */
  urgencySurcharge: number;

  /** 珥??섏닔猷?*/
  totalCommission: number;

  /** 湲몃윭 ?섏씡 */
  gillerEarnings: number;

  /** 理쒖냼 ?섏닔猷??곸슜 ?щ? */
  appliedMinimum: boolean;

  /** 怨꾩궛 ?쒓컙 */
  calculatedAt: Date;
}

/**
 * ?섏닔猷?怨꾩궛 ?듭뀡
 * Commission calculation options
 */
export interface CommissionCalculationOptions {
  /** 寃곗젣 湲덉븸 */
  amount: number;

  /** 湲몃윭 ?깃툒 */
  gillerGrade: GillerType;

  /** 湲닿툒??*/
  urgencyLevel: UrgencyLevel;
}

// ===== Firestore Collection Names =====

/**
 * Firestore 而щ젆???대쫫 ?곸닔
 * Firestore collection name constants
 */
export const PAYMENT_COLLECTIONS = {
  PAYMENTS: 'payments',
  SETTLEMENTS: 'settlements',
} as const;

