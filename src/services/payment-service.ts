/**
 * Payment Service (P4) - Consolidated
 * 결제 및 수익 정산 시스템 (세금 처리 포함)
 * NOTE: This file consolidates legacy modules and acts as the main payment service.
 * Legacy PaymentService.ts should be deprecated/migrated.
 *
 * 세금 정책:
 * - 사업소득 원천징수 3.3% 기준 적용
 * - 지방소득세 0.3% 포함
 * - 금액 페널티도 현물성 수익으로 간주
 * - 연간 3,000,000원 초과 시 종합소득세 신고 필요
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { calculateBadgeBonus } from './matching-service';
import { getRuntimeSettlementPolicy } from './settlement-policy-service';

// ==================== Constants ====================

/**
 * 세금 신고 기준
 */
export const TAX_THRESHOLDS = {
  YEARLY_REPORT: 3_000_000, // 연간 300만원 초과 시 종합소득세 신호 필요
  QUARTERLY_REPORT: 750_000, // 분기별 75만원 초과 시 예정신고 (선택)
} as const;

// ==================== Enums ====================

/**
 * Payment status
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/**
 * Payment type
 */
export enum PaymentType {
  REQUEST_FEE = 'request_fee', // Gller pays request fee
  GILLER_EARNING = 'giller_earning', // Giller receives payment
  WITHDRAWAL = 'withdrawal', // Giller withdraws earnings
  TAX_PAYMENT = 'tax_payment', // 세금 납부 (관리자 전용)
}

// ==================== Interfaces ====================

/**
 * Payment interface (세금 필드 추가)
 */
export interface Payment {
  paymentId: string;
  userId: string;
  type: PaymentType;
  amount: number; // 총 금액 (세전)
  fee?: number; // 플랫폼 수수료
  tax?: number; // 원천징수세 (3.3%)
  netAmount?: number; // 최종 수익 (수수료 + 세금 차감 후)
  status: PaymentStatus;
  requestId?: string;
  deliveryId?: string;
  description: string;
  metadata?: PaymentMetadata;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Payment metadata (확장)
 */
export interface PaymentMetadata {
  platformFeeRate?: number;
  taxRate?: number;
  taxWithheld?: number;
  isTaxable?: boolean; // 과세 대상 여부
  taxExemptReason?: string; // 면제 사유
  [key: string]: any;
}

export interface CreateGillerEarningOptions {
  /**
   * true면 amount를 "이미 플랫폼 수수료 차감된 길러 세전 금액"으로 간주
   * (정산 파이프라인에서 이중 차감 방지용)
   */
  platformFeeAlreadyDeducted?: boolean;
  /** 정산 스냅샷 보관용 플랫폼 수수료 금액 */
  platformFeeAmount?: number;
}

/**
 * Tax report (연말정산용)
 */
export interface TaxReport {
  userId: string;
  year: number;
  totalEarnings: number; // 총 수익 (세전)
  totalTaxWithheld: number; // 총 원천징수세
  totalPlatformFee: number; // 총 플랫폼 수수료
  totalNetIncome: number; // 총 순수익 (세후)
  paymentCount: number; // 총 건수
  requiresFiling: boolean; // 종합소득세 신고 필요 여부
  generatedAt: Date;
}

/**
 * Monthly earnings with tax breakdown
 */
export interface MonthlyEarningsWithTax {
  year: number;
  month: number;
  total: number; // 총 수익 (세전)
  count: number; // 건수
  average: number; // 평균 수익
  platformFee: number; // 플랫폼 수수료
  taxWithheld: number; // 원천징수세
  netIncome: number; // 순수익 (세후)
}

// ==================== Core Functions ====================

/**
 * Create payment for request fee
 * @param userId User ID (gller)
 * @param requestId Request ID
 * @param amount Fee amount
 * @returns Payment ID
 */
export async function createRequestPayment(
  userId: string,
  requestId: string,
  amount: number,
  couponDiscountAmount: number = 0,
  pointUsedAmount: number = 0
): Promise<string> {
  try {
    const settlementPolicy = await getRuntimeSettlementPolicy();
    
    // 세무/재무적 분류:
    // - amount: 원래 배송 요금 (매출 기준액)
    // - couponDiscountAmount: 쿠폰 사용액 (매출 에누리/할인 성격, 플랫폼/길러가 부담하는 할인액)
    // - pointUsedAmount: 포인트 사용액 (부채 상계 성격, 이미 선수금/비용으로 잡힌 포인트를 차감하여 결제 대금으로 인정)
    // - finalAmountToPay: 실제 PG사를 통해 결제해야 하는 남은 현금 결제액
    const finalAmountToPay = Math.max(0, amount - couponDiscountAmount - pointUsedAmount);

    const paymentData = {
      userId,
      type: PaymentType.REQUEST_FEE,
      amount,
      fee: Math.round(amount * settlementPolicy.platformFeeRate),
      tax: 0, // 글러는 세금 없음 (요청자)
      netAmount: Math.round(amount * (1 - settlementPolicy.platformFeeRate)),
      status: PaymentStatus.PENDING,
      requestId,
      description: '배송 요청 수수료',
      metadata: {
        platformFeeRate: settlementPolicy.platformFeeRate,
        taxRate: 0,
        isTaxable: false,
        // 재무 회계용 추가 메타데이터
        accounting: {
          originalGrossAmount: amount,
          revenueDiscountAmount: couponDiscountAmount, // 쿠폰(바우처)는 매출할인으로 인식
          liabilityOffsetAmount: pointUsedAmount,      // 포인트는 기충전 부채(선수금) 상계로 인식
          actualCashPaymentRequired: finalAmountToPay
        }
      },
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'payments'), paymentData);

    // Request payment created

    return docRef.id;
  } catch (error) {
    console.error('Error creating request payment:', error);
    throw error;
  }
}

/**
 * Create earning for giller (세금 처리 포함)
 *
 * 계산 로직:
 * 1. 수수료 10% 차감
 * 2. 수수료 차감 후 금액에서 3.3% 원천징수
 * 3. 최종 수익 = 수수료 차감 - 세금
 *
 * @param userId User ID (giller)
 * @param requestId Request ID
 * @param amount Earning amount (세전)
 * @param isTaxable 과세 대상 여부 (기본 true)
 * @returns Payment ID
 */
export async function createGillerEarning(
  userId: string,
  requestId: string,
  amount: number,
  isTaxable: boolean = true,
  options?: CreateGillerEarningOptions & {
    couponDiscountApplied?: number;
    pointOffsetApplied?: number;
  }
): Promise<string> {
  try {
    const settlementPolicy = await getRuntimeSettlementPolicy();
    // 0. 배지 보너스 계산 (P2-9)
    const { feeBonus: badgeBonus } = await calculateBadgeBonus(userId);
    const baseAmount = amount;
    const bonusAmount = Math.round(baseAmount * badgeBonus);
    const totalAmount = baseAmount + bonusAmount; // 배지 보너스가 포함된 총 금액

    const platformFeeAlreadyDeducted = options?.platformFeeAlreadyDeducted === true;
    const platformFeeSnapshot = options?.platformFeeAmount ?? null;

    // 1. 플랫폼 수수료 차감
    // - 기본: 기존 동작 유지(총액에서 10% 차감)
    // - 신규: 정산단에서 이미 차감된 금액이면 추가 차감 금지
    const platformFee = platformFeeAlreadyDeducted
      ? 0
      : Math.round(totalAmount * settlementPolicy.platformFeeRate);
    const afterFee = totalAmount - platformFee;

    // 2. 세금 계산 (수수료 차감 후 금액 기준)
    let tax = 0;
    let netAmount = afterFee;

    if (isTaxable) {
      tax = Math.round(afterFee * settlementPolicy.combinedWithholdingRate);
      netAmount = afterFee - tax;
    }

    const withholdingBreakdown = {
      businessIncomeTax: Math.round(afterFee * settlementPolicy.businessIncomeTaxRate),
      localIncomeTax: Math.round(afterFee * settlementPolicy.localIncomeTaxRate),
    };

    const paymentData = {
      userId,
      type: PaymentType.GILLER_EARNING,
      amount: totalAmount, // 세전 금액 (배지 보너스 포함)
      fee: platformFee,
      tax, // 원천징수세
      netAmount, // 최종 수익 (세후)
      status: PaymentStatus.COMPLETED,
      requestId,
      description: `배송 완료 수익${badgeBonus > 0 ? ` (배지 보너스 ${(badgeBonus * 100).toFixed(0)}%)` : ''}`,
      metadata: {
        platformFeeRate: settlementPolicy.platformFeeRate,
        platformFeeAlreadyDeducted,
        platformFeeSnapshot,
        taxRate: isTaxable ? settlementPolicy.combinedWithholdingRate : 0,
        taxRateBusinessIncome: isTaxable ? settlementPolicy.businessIncomeTaxRate : 0,
        taxRateLocalIncome: isTaxable ? settlementPolicy.localIncomeTaxRate : 0,
        taxWithheld: tax,
        taxWithheldBusinessIncome: isTaxable ? withholdingBreakdown.businessIncomeTax : 0,
        taxWithheldLocalIncome: isTaxable ? withholdingBreakdown.localIncomeTax : 0,
        isTaxable,
        baseAmount, // 기본 요금
        bonusAmount, // 배지 보너스
        badgeBonusRate: badgeBonus, // 배지 보너스율
        // 재무 회계용 메타데이터 기록 (길러 정산 시 참고용)
        accounting: {
          originalGrossAmount: baseAmount,
          revenueDiscountAmount: options?.couponDiscountApplied ?? 0, // 결제 시 사용된 쿠폰 할인(매출할인)
          liabilityOffsetAmount: options?.pointOffsetApplied ?? 0,    // 결제 시 사용된 포인트(부채 상계)
        }
      } as PaymentMetadata,
      createdAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'payments'), paymentData);

    // Giller earning created: breakdown details logged internally

    // Update user's total earnings (세후 기준)
    await updateUserEarnings(userId, netAmount);

    // Update user's tax累计 (원천징수세 누적)
    if (tax > 0) {
      await updateUserTaxWithheld(userId, tax);
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating giller earning:', error);
    throw error;
  }
}

/**
 * Check if giller earning already exists for a request
 */
export async function hasGillerEarningForRequest(
  userId: string,
  requestId: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('requestId', '==', requestId),
      limit(1)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking giller earning for request:', error);
    return false;
  }
}

/**
 * Get giller earning payment for a request (if exists)
 */
export async function getGillerEarningForRequest(
  userId: string,
  requestId: string
): Promise<Payment | null> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('requestId', '==', requestId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnapshot = snapshot.docs[0];
    const data = docSnapshot.data();
    return {
      paymentId: docSnapshot.id,
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      fee: data.fee,
      tax: data.tax,
      netAmount: data.netAmount,
      status: data.status,
      requestId: data.requestId,
      deliveryId: data.deliveryId,
      description: data.description,
      metadata: data.metadata,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      completedAt: data.completedAt?.toDate(),
    };
  } catch (error) {
    console.error('Error getting giller earning for request:', error);
    return null;
  }
}

/**
 * Update user's total earnings (세후 기준, denormalized)
 * @param userId User ID
 * @param amount Amount to add (세후)
 */
async function updateUserEarnings(userId: string, amount: number): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);

    // Increment total earnings (세후 기준)
    await updateDoc(userRef, {
      totalEarnings: increment(amount),
      earningsUpdatedAt: serverTimestamp(),
    });

    // Updated earnings for user
  } catch (error) {
    console.error('Error updating user earnings:', error);
  }
}

/**
 * Update user's total tax withheld (원천징수세 누적)
 * @param userId User ID
 * @param taxAmount Tax amount to add
 */
async function updateUserTaxWithheld(userId: string, taxAmount: number): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);

    // Increment total tax withheld
    await updateDoc(userRef, {
      totalTaxWithheld: increment(taxAmount),
      taxUpdatedAt: serverTimestamp(),
    });

    // Updated tax withheld for user
  } catch (error) {
    console.error('Error updating user tax withheld:', error);
  }
}

/**
 * Get user's payment history
 * @param userId User ID
 * @param limit Max number of items
 * @returns Array of payments
 */
export async function getUserPayments(
  userId: string,
  limit: number = 50
): Promise<Payment[]> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const payments: Payment[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      payments.push({
        paymentId: docSnapshot.id,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        fee: data.fee,
        tax: data.tax,
        netAmount: data.netAmount,
        status: data.status,
        requestId: data.requestId,
        deliveryId: data.deliveryId,
        description: data.description,
        metadata: data.metadata,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        completedAt: data.completedAt?.toDate(),
      });
    });

    return payments.slice(0, limit);
  } catch (error) {
    console.error('Error getting user payments:', error);
    return [];
  }
}

/**
 * Get user's total earnings (세후 기준)
 * @param userId User ID
 * @returns Total earnings (after tax)
 */
export async function getUserTotalEarnings(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);

    let total = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      total += data.netAmount ?? data.amount ?? 0; // 세후 기준 (fallback to gross if missing)
    });

    return total;
  } catch (error) {
    console.error('Error getting user total earnings:', error);
    return 0;
  }
}

/**
 * Get user's total earnings (세전 기준)
 * @param userId User ID
 * @returns Total earnings (before tax)
 */
export async function getUserTotalEarningsGross(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);

    let total = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      total += data.amount ?? 0; // 세전 기준
    });

    return total;
  } catch (error) {
    console.error('Error getting user total gross earnings:', error);
    return 0;
  }
}

/**
 * Get user's total tax withheld
 * @param userId User ID
 * @returns Total tax withheld
 */
export async function getUserTotalTaxWithheld(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);

    let totalTax = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      totalTax += data.tax ?? 0;
    });

    return totalTax;
  } catch (error) {
    console.error('Error getting user total tax withheld:', error);
    return 0;
  }
}

/**
 * Get user's net income (세후 기준)
 * @param userId User ID
 * @returns Net income (after tax)
 */
export async function getUserNetIncome(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);

    let netIncome = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      netIncome += data.netAmount ?? 0;
    });

    return netIncome;
  } catch (error) {
    console.error('Error getting user net income:', error);
    return 0;
  }
}

/**
 * Get user's earnings by month (세금 내역 포함)
 * @param userId User ID
 * @param year Year
 * @param month Month (1-12)
 * @returns Monthly earnings with tax breakdown
 */
export async function getUserMonthlyEarnings(
  userId: string,
  year: number,
  month: number
): Promise<MonthlyEarningsWithTax> {
  try {
    const rangeStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const rangeEnd = new Date(year, month, 1, 0, 0, 0, 0);

    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED),
      where('createdAt', '>=', Timestamp.fromDate(rangeStart)),
      where('createdAt', '<', Timestamp.fromDate(rangeEnd)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    let total = 0;
    let count = 0;
    let platformFee = 0;
    let taxWithheld = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      total += data.amount ?? 0;
      count++;
      platformFee += data.fee ?? 0;
      taxWithheld += data.tax ?? 0;
    });

    const netIncome = total - platformFee - taxWithheld;
    const average = count > 0 ? total / count : 0;

    return {
      year,
      month,
      total,
      count,
      average: Math.round(average),
      platformFee,
      taxWithheld,
      netIncome,
    };
  } catch (error) {
    console.error('Error getting user monthly earnings:', error);
    return {
      year,
      month,
      total: 0,
      count: 0,
      average: 0,
      platformFee: 0,
      taxWithheld: 0,
      netIncome: 0,
    };
  }
}

/**
 * Generate annual tax report (연말정산용)
 * @param userId User ID
 * @param year Year
 * @returns Tax report
 */
export async function generateAnnualTaxReport(
  userId: string,
  year: number
): Promise<TaxReport> {
  try {
    const rangeStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const rangeEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0);

    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED),
      where('createdAt', '>=', Timestamp.fromDate(rangeStart)),
      where('createdAt', '<', Timestamp.fromDate(rangeEnd)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    let totalEarnings = 0;
    let totalTaxWithheld = 0;
    let totalPlatformFee = 0;
    let paymentCount = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      totalEarnings += data.amount ?? 0;
      totalTaxWithheld += data.tax ?? 0;
      totalPlatformFee += data.fee ?? 0;
      paymentCount++;
    });

    const totalNetIncome = totalEarnings - totalPlatformFee - totalTaxWithheld;
    const requiresFiling = totalEarnings > TAX_THRESHOLDS.YEARLY_REPORT;

    const report: TaxReport = {
      userId,
      year,
      totalEarnings,
      totalTaxWithheld,
      totalPlatformFee,
      totalNetIncome,
      paymentCount,
      requiresFiling,
      generatedAt: new Date(),
    };

    // Save report to Firestore (optional)
    await saveTaxReport(userId, year, report);

    return report;
  } catch (error) {
    console.error('Error generating annual tax report:', error);
    throw error;
  }
}

/**
 * Save tax report to Firestore
 * @param userId User ID
 * @param year Year
 * @param report Tax report
 */
async function saveTaxReport(userId: string, year: number, report: TaxReport): Promise<void> {
  try {
    const reportRef = doc(db, 'users', userId, 'tax_reports', year.toString());

    await setDoc(reportRef, {
      ...report,
      generatedAt: serverTimestamp(),
    }, { merge: true });

    // Tax report saved for user
  } catch (error) {
    console.error('Error saving tax report:', error);
    throw error;
  }
}

/**
 * Get user's available balance for withdrawal (세후 기준)
 * @param userId User ID
 * @returns Available balance
 */
export async function getUserAvailableBalance(userId: string): Promise<number> {
  try {
    // Get total net income (세후)
    const netIncome = await getUserNetIncome(userId);

    // Get previous withdrawals
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.WITHDRAWAL),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);
    let withdrawnAmount = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      withdrawnAmount += data.amount ?? 0;
    });

    return netIncome - withdrawnAmount;
  } catch (error) {
    console.error('Error getting user available balance:', error);
    return 0;
  }
}

/**
 * Request withdrawal (세후 기준)
 * @param userId User ID
 * @param amount Amount to withdraw
 * @param bankInfo Bank information
 * @returns Payment ID
 */
export async function requestWithdrawal(
  userId: string,
  amount: number,
  bankInfo: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }
): Promise<string> {
  try {
    // Check if user has enough balance (세후 기준)
    const availableBalance = await getUserAvailableBalance(userId);

    if (amount > availableBalance) {
      throw new Error(`출금 가능 금액: ${availableBalance.toLocaleString()}원`);
    }

    // Create withdrawal request
    const paymentData = {
      userId,
      type: PaymentType.WITHDRAWAL,
      amount,
      status: PaymentStatus.PENDING,
      description: '출금 요청',
      metadata: {
        bankName: bankInfo.bankName,
        accountNumber: bankInfo.accountNumber,
        accountHolder: bankInfo.accountHolder,
      },
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'payments'), paymentData);

    // Withdrawal requested

    return docRef.id;
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    throw error;
  }
}

/**
 * Get payment by ID
 * @param paymentId Payment ID
 * @returns Payment or null
 */
export async function getPayment(paymentId: string): Promise<Payment | null> {
  try {
    const docRef = doc(db, 'payments', paymentId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      return null;
    }

    const data = docSnapshot.data();
    if (!data) {
      return null;
    }
    return {
      paymentId: docSnapshot.id,
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      fee: data.fee,
      tax: data.tax,
      netAmount: data.netAmount,
      status: data.status,
      requestId: data.requestId,
      deliveryId: data.deliveryId,
      description: data.description,
      metadata: data.metadata,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      completedAt: data.completedAt?.toDate(),
    };
  } catch (error) {
    console.error('Error getting payment:', error);
    return null;
  }
}

/**
 * Get tax summary for display (사용자 앱용)
 * @param userId User ID
 * @returns Tax summary
 */
export async function getTaxSummary(userId: string): Promise<{
  totalEarnings: number; // 세전 총 수익
  totalTaxWithheld: number; // 총 원천징수세
  effectiveTaxRate: number; // 실질 세율
  currentYear: {
    earnings: number;
    taxWithheld: number;
    requiresFiling: boolean;
  };
}> {
  try {
    const currentYear = new Date().getFullYear();

    // Get total earnings (all time)
    const totalEarnings = await getUserTotalEarningsGross(userId);
    const totalTaxWithheld = await getUserTotalTaxWithheld(userId);

    // Get current year data
    const currentYearReport = await generateAnnualTaxReport(userId, currentYear);

    const effectiveTaxRate = totalEarnings > 0
      ? (totalTaxWithheld / totalEarnings) * 100
      : 0;

    return {
      totalEarnings,
      totalTaxWithheld,
      effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
      currentYear: {
        earnings: currentYearReport.totalEarnings,
        taxWithheld: currentYearReport.totalTaxWithheld,
        requiresFiling: currentYearReport.requiresFiling,
      },
    };
  } catch (error) {
    console.error('Error getting tax summary:', error);
    return {
      totalEarnings: 0,
      totalTaxWithheld: 0,
      effectiveTaxRate: 0,
      currentYear: {
        earnings: 0,
        taxWithheld: 0,
        requiresFiling: false,
      },
    };
  }
}

// ==================== Admin Functions ====================

/**
 * Get total tax collected from all users (관리자용)
 * @param year Year (optional)
 * @param month Month (optional)
 * @returns Total tax collected
 */
export async function getTotalTaxCollected(
  year?: number,
  month?: number
): Promise<{
  total: number;
  count: number;
  breakdown: { [key: string]: number };
}> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);

    let total = 0;
    let count = 0;
    const breakdown: { [key: string]: number } = {};

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const tax = data.tax ?? 0;

      if (tax > 0) {
        const createdAt = data.createdAt?.toDate();

        // Filter by year/month if provided
        if (year && createdAt) {
          if (createdAt.getFullYear() !== year) return;
          if (month !== undefined && createdAt.getMonth() + 1 !== month) return;
        }

        total += tax;
        count++;

        // Group by month (if year provided)
        if (year && createdAt) {
          const monthKey = `${year}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
          breakdown[monthKey] = (breakdown[monthKey] ?? 0) + tax;
        }
      }
    });

    return { total, count, breakdown };
  } catch (error) {
    console.error('Error getting total tax collected:', error);
    return { total: 0, count: 0, breakdown: {} };
  }
}
