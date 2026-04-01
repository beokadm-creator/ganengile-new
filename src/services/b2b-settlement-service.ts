import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  B2BSettlement,
  B2BSettlementStatus,
  CreateB2BSettlementData,
  SettlementPeriod,
  TransferInfo,
} from '../types/b2b-settlement';
import {
  SETTLEMENT_CYCLE_DAYS,
  SETTLEMENT_STATUS_LABELS,
  TIER_MONTHLY_BONUSES,
} from '../types/b2b-settlement';
import type { B2BDelivery } from '../types/b2b-delivery';
import type { B2BGillerTierLevel } from '../types/b2b-giller-tier';
import { B2BGillerService } from './b2b-giller-service';

const SETTLEMENT_COLLECTION = 'b2b_settlements';
const DELIVERY_COLLECTION = 'b2b_deliveries';
const USERS_COLLECTION = 'users';

type FirestoreTransferInfo = {
  accountNumber?: string;
  bank?: string;
  transferredAt?: Date | Timestamp | null;
  transactionId?: string;
};

type TimestampLike = {
  toDate(): Date;
};

type DeliveryCompletedAt = Date | TimestampLike | string | number;

type DeliveryPricingSnapshot = {
  gillerEarning?: number;
};

type B2BDeliverySnapshot = Partial<Omit<B2BDelivery, 'completedAt' | 'pricing'>> & {
  completedAt?: DeliveryCompletedAt;
  pricing?: DeliveryPricingSnapshot;
};

type FirestoreSettlementDoc = DocumentData & {
  gillerId?: string;
  businessId?: string;
  period?: {
    start?: Date | Timestamp | null;
    end?: Date | Timestamp | null;
  };
  b2bDeliveries?: number;
  deliveryEarnings?: number;
  monthlyBonus?: number;
  totalSettlement?: number;
  status?: B2BSettlementStatus;
  transferInfo?: FirestoreTransferInfo;
  createdAt?: Date | Timestamp | null;
  updatedAt?: Date | Timestamp | null;
  reviewNote?: string;
};

type StatsResult = {
  totalSettlements: number;
  totalAmount: number;
  averagePerSettlement: number;
  tierBreakdown: Record<string, number>;
};

function toDate(value: Date | Timestamp | null | undefined, fallback: Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  return fallback;
}

function toCompletedAtDate(value: DeliveryCompletedAt | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toSettlementStatus(value: unknown): B2BSettlementStatus {
  return value === 'paid' || value === 'failed' ? value : 'pending_payment';
}

function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/\s+/g, '');
  if (cleaned.length <= 4) {
    return cleaned;
  }
  return `${'*'.repeat(Math.max(0, cleaned.length - 4))}${cleaned.slice(-4)}`;
}

function getTierLevel(tier: { tier: B2BGillerTierLevel } | null): B2BGillerTierLevel | null {
  return tier?.tier ?? null;
}

function mapSettlement(snapshot: { id: string; data(): DocumentData }): B2BSettlement {
  const raw = snapshot.data() as FirestoreSettlementDoc;
  const now = new Date();
  const transferInfo = raw.transferInfo;

  return {
    id: snapshot.id,
    gillerId: raw.gillerId ?? '',
    businessId: raw.businessId,
    period: {
      start: toDate(raw.period?.start, now),
      end: toDate(raw.period?.end, now),
    },
    b2bDeliveries: typeof raw.b2bDeliveries === 'number' ? raw.b2bDeliveries : 0,
    deliveryEarnings: typeof raw.deliveryEarnings === 'number' ? raw.deliveryEarnings : 0,
    monthlyBonus: typeof raw.monthlyBonus === 'number' ? raw.monthlyBonus : 0,
    totalSettlement: typeof raw.totalSettlement === 'number' ? raw.totalSettlement : 0,
    status: toSettlementStatus(raw.status),
    transferInfo: transferInfo
      ? {
          accountNumber: transferInfo.accountNumber ?? '',
          bank: transferInfo.bank ?? '',
          transferredAt: transferInfo.transferredAt ? toDate(transferInfo.transferredAt, now) : undefined,
          transactionId: transferInfo.transactionId,
        }
      : undefined,
    createdAt: toDate(raw.createdAt, now),
    updatedAt: raw.updatedAt ? toDate(raw.updatedAt, now) : undefined,
    reviewNote: raw.reviewNote,
  };
}

async function getGillerTierBonus(gillerId: string): Promise<{ tier: B2BGillerTierLevel | null; monthlyBonus: number }> {
  const tier = await B2BGillerService.getB2BGillerTier(gillerId);
  const tierLevel = getTierLevel(tier);

  return {
    tier: tierLevel,
    monthlyBonus: tierLevel ? TIER_MONTHLY_BONUSES[tierLevel] : 0,
  };
}

async function aggregateB2BDeliveries(
  gillerId: string,
  startDate: Date,
  endDate: Date,
): Promise<{ b2bDeliveries: number; deliveryEarnings: number; businessId?: string }> {
  const deliveriesQuery = query(collection(db, DELIVERY_COLLECTION), where('gillerId', '==', gillerId));
  const querySnapshot = await getDocs(deliveriesQuery);
  const deliveries = querySnapshot.docs
    .map((deliveryDoc) => deliveryDoc.data() as B2BDeliverySnapshot)
    .filter((delivery) => {
      const completedAt = toCompletedAtDate(delivery.completedAt);
      if (!completedAt) return false;

      return completedAt >= startDate && completedAt < endDate && delivery.status === 'delivered';
    });

  return deliveries.reduce<{ b2bDeliveries: number; deliveryEarnings: number; businessId?: string }>(
    (acc, delivery) => {
      const gillerEarning = typeof delivery.pricing?.gillerEarning === 'number'
        ? delivery.pricing.gillerEarning
        : 0;

      return {
        b2bDeliveries: acc.b2bDeliveries + 1,
        deliveryEarnings: acc.deliveryEarnings + gillerEarning,
        businessId: acc.businessId ?? delivery.businessId,
      };
    },
    { b2bDeliveries: 0, deliveryEarnings: 0, businessId: undefined },
  );
}

async function getGillerAccountInfo(gillerId: string): Promise<TransferInfo | null> {
  const userDoc = await getDoc(doc(db, USERS_COLLECTION, gillerId));
  if (!userDoc.exists()) {
    return null;
  }

  const raw = userDoc.data() as DocumentData & {
    bankAccount?: {
      bankName?: string;
      accountNumberMasked?: string;
      accountLast4?: string;
    };
    bankInfo?: {
      bankName?: string;
      accountNumberMasked?: string;
      accountLast4?: string;
    };
  };

  const bankInfo = raw.bankAccount ?? raw.bankInfo;
  const bank = bankInfo?.bankName;
  const maskedAccount = bankInfo?.accountNumberMasked;
  const last4 = bankInfo?.accountLast4;

  if (!bank) {
    return null;
  }

  return {
    bank,
    accountNumber: maskedAccount ?? (last4 ? `****${last4}` : ''),
  };
}

export class B2BSettlementService {
  static async generateMonthlySettlements(): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const activeGillers = await B2BGillerService.getActiveB2BGillers();

    for (const giller of activeGillers) {
      const aggregated = await aggregateB2BDeliveries(giller.gillerId, periodStart, periodEnd);
      if (aggregated.b2bDeliveries === 0) {
        continue;
      }

      const existingQuery = query(collection(db, SETTLEMENT_COLLECTION), where('gillerId', '==', giller.gillerId));
      const existingSnapshot = await getDocs(existingQuery);
      const alreadyExists = existingSnapshot.docs.some((settlementDoc) => {
        const settlement = mapSettlement(settlementDoc);
        return settlement.period.start.getTime() === periodStart.getTime()
          && settlement.period.end.getTime() === periodEnd.getTime();
      });

      if (alreadyExists) {
        continue;
      }

      const { monthlyBonus } = await getGillerTierBonus(giller.gillerId);
      const totalSettlement = aggregated.deliveryEarnings + monthlyBonus;
      const transferInfo = await getGillerAccountInfo(giller.gillerId);

      await addDoc(collection(db, SETTLEMENT_COLLECTION), {
        gillerId: giller.gillerId,
        businessId: aggregated.businessId,
        period: { start: periodStart, end: periodEnd },
        b2bDeliveries: aggregated.b2bDeliveries,
        deliveryEarnings: aggregated.deliveryEarnings,
        monthlyBonus,
        totalSettlement,
        status: 'pending_payment' as B2BSettlementStatus,
        transferInfo: transferInfo
          ? {
              bank: transferInfo.bank,
              accountNumber: maskAccountNumber(transferInfo.accountNumber),
              transactionId: 'manual-review-required',
            }
          : undefined,
        reviewNote: transferInfo
          ? '실지급 전 운영 수동 검토가 필요합니다.'
          : '계좌 정보가 없어 운영 검토가 필요합니다.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  static async getSettlement(settlementId: string): Promise<B2BSettlement | null> {
    const settlementDoc = await getDoc(doc(db, SETTLEMENT_COLLECTION, settlementId));
    if (!settlementDoc.exists()) {
      return null;
    }
    return mapSettlement(settlementDoc);
  }

  static async getGillerSettlements(gillerId: string, status?: B2BSettlementStatus): Promise<B2BSettlement[]> {
    let settlementsQuery = query(collection(db, SETTLEMENT_COLLECTION), where('gillerId', '==', gillerId));
    if (status) {
      settlementsQuery = query(settlementsQuery, where('status', '==', status));
    }

    const querySnapshot = await getDocs(settlementsQuery);
    return querySnapshot.docs.map(mapSettlement);
  }

  static async getPendingSettlements(): Promise<B2BSettlement[]> {
    const settlementsQuery = query(collection(db, SETTLEMENT_COLLECTION), where('status', '==', 'pending_payment'));
    const querySnapshot = await getDocs(settlementsQuery);
    return querySnapshot.docs.map(mapSettlement);
  }

  static async createManualSettlement(data: CreateB2BSettlementData): Promise<string> {
    const bonusInfo = await getGillerTierBonus(data.gillerId);
    const settlementDoc = await addDoc(collection(db, SETTLEMENT_COLLECTION), {
      gillerId: data.gillerId,
      businessId: data.businessId,
      period: { start: data.periodStart, end: data.periodEnd },
      b2bDeliveries: 0,
      deliveryEarnings: 0,
      monthlyBonus: data.monthlyBonus ?? bonusInfo.monthlyBonus,
      totalSettlement: data.monthlyBonus ?? bonusInfo.monthlyBonus,
      status: 'pending_payment' as B2BSettlementStatus,
      reviewNote: '수동 생성된 정산 건입니다. 운영 검토 후 지급 처리하세요.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return settlementDoc.id;
  }

  static async markAsFailed(settlementId: string, reason: string): Promise<void> {
    await updateDoc(doc(db, SETTLEMENT_COLLECTION, settlementId), {
      status: 'failed' as B2BSettlementStatus,
      reviewNote: reason,
      updatedAt: serverTimestamp(),
    });
  }

  static async markAsPaid(
    settlementId: string,
    transferInfo: {
      accountNumber: string;
      bank: string;
      transferredAt: Date;
      transactionId: string;
    },
  ): Promise<void> {
    await updateDoc(doc(db, SETTLEMENT_COLLECTION, settlementId), {
      status: 'paid' as B2BSettlementStatus,
      transferInfo: {
        bank: transferInfo.bank,
        accountNumber: maskAccountNumber(transferInfo.accountNumber),
        transferredAt: transferInfo.transferredAt,
        transactionId: transferInfo.transactionId,
      },
      reviewNote: '운영 확인 후 지급 완료 처리되었습니다.',
      updatedAt: serverTimestamp(),
    });
  }

  static async getTotalSettlementAmount(period: SettlementPeriod): Promise<number> {
    const querySnapshot = await getDocs(collection(db, SETTLEMENT_COLLECTION));
    return querySnapshot.docs
      .map(mapSettlement)
      .filter((settlement) => settlement.period.start >= period.start && settlement.period.start <= period.end)
      .reduce((sum, settlement) => sum + settlement.totalSettlement, 0);
  }

  static async getPendingPaymentTotal(): Promise<number> {
    const pendingSettlements = await this.getPendingSettlements();
    return pendingSettlements.reduce((sum, settlement) => sum + settlement.totalSettlement, 0);
  }

  static async retrySettlement(
    settlementId: string,
    maxRetries = 3,
  ): Promise<{ success: boolean; attempt: number; error?: string }> {
    const settlement = await this.getSettlement(settlementId);
    if (!settlement) {
      return { success: false, attempt: 0, error: '정산 건을 찾지 못했습니다.' };
    }

    if (settlement.status === 'paid') {
      return { success: true, attempt: 0, error: '이미 지급 완료된 정산입니다.' };
    }

    const transferInfo = await getGillerAccountInfo(settlement.gillerId);
    if (!transferInfo) {
      const error = '계좌 정보가 없어 운영 검토가 필요합니다.';
      await this.markAsFailed(settlementId, error);
      return { success: false, attempt: 0, error };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        await updateDoc(doc(db, SETTLEMENT_COLLECTION, settlementId), {
          status: 'pending_payment' as B2BSettlementStatus,
          transferInfo: {
            bank: transferInfo.bank,
            accountNumber: maskAccountNumber(transferInfo.accountNumber),
            transactionId: `manual-review-${Date.now()}-${attempt}`,
          },
          reviewNote: `자동 이체 대신 운영 수동 검토 큐로 재등록했습니다. 시도 ${attempt}/${maxRetries}`,
          updatedAt: serverTimestamp(),
        });

        return { success: true, attempt };
      } catch (error) {
        if (attempt === maxRetries) {
          const message = error instanceof Error ? error.message : '정산 재시도 중 오류가 발생했습니다.';
          await this.markAsFailed(settlementId, message);
          return { success: false, attempt, error: message };
        }
      }
    }

    return { success: false, attempt: maxRetries, error: '재시도 한도를 초과했습니다.' };
  }

  static calculateNextSettlementDate(currentDate: Date = new Date()): Date {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(SETTLEMENT_CYCLE_DAYS);
    return nextMonth;
  }

  static async getSettlementStats(months = 6): Promise<StatsResult> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const querySnapshot = await getDocs(collection(db, SETTLEMENT_COLLECTION));
    const settlements = querySnapshot.docs.map(mapSettlement).filter((settlement) => settlement.createdAt >= startDate);
    const totalSettlements = settlements.length;
    const totalAmount = settlements.reduce((sum, settlement) => sum + settlement.totalSettlement, 0);
    const averagePerSettlement = totalSettlements > 0 ? Math.round(totalAmount / totalSettlements) : 0;
    const tierBreakdown: Record<string, number> = { silver: 0, gold: 0, platinum: 0 };

    for (const settlement of settlements) {
      const tier = await B2BGillerService.getB2BGillerTier(settlement.gillerId);
      const tierLevel = getTierLevel(tier);
      if (tierLevel) {
        tierBreakdown[tierLevel] += 1;
      }
    }

    return { totalSettlements, totalAmount, averagePerSettlement, tierBreakdown };
  }

  static async generateSettlementReport(
    settlementId: string,
  ): Promise<{ success: boolean; reportUrl?: string; reportText?: string; error?: string }> {
    const settlement = await this.getSettlement(settlementId);
    if (!settlement) {
      return { success: false, error: '정산 건을 찾지 못했습니다.' };
    }

    const gillerDoc = await getDoc(doc(db, USERS_COLLECTION, settlement.gillerId));
    const giller = gillerDoc.exists() ? (gillerDoc.data() as DocumentData & { name?: string }) : null;
    const tier = await B2BGillerService.getB2BGillerTier(settlement.gillerId);
    const tierLabel = getTierLevel(tier)?.toUpperCase() ?? 'N/A';

    const reportText = [
      '가는길에 B2B 정산 리포트',
      `정산 ID: ${settlement.id}`,
      `길러 ID: ${settlement.gillerId}`,
      `길러명: ${giller?.name ?? '미등록'}`,
      `등급: ${tierLabel}`,
      `정산 기간: ${settlement.period.start.toLocaleDateString('ko-KR')} ~ ${settlement.period.end.toLocaleDateString('ko-KR')}`,
      `배송 건수: ${settlement.b2bDeliveries}건`,
      `배송 수익: ${settlement.deliveryEarnings.toLocaleString('ko-KR')}원`,
      `월간 보너스: ${settlement.monthlyBonus.toLocaleString('ko-KR')}원`,
      `총 정산액: ${settlement.totalSettlement.toLocaleString('ko-KR')}원`,
      `상태: ${this.getSettlementStatusLabel(settlement.status)}`,
      `운영 메모: ${settlement.reviewNote ?? '없음'}`,
    ].join('\n');

    return {
      success: true,
      reportText,
      reportUrl: '',
    };
  }

  static async backupSettlementData(): Promise<void> {
    const snapshot = await getDocs(collection(db, SETTLEMENT_COLLECTION));
    console.warn(`B2B settlement backup requested for ${snapshot.size} documents.`);
  }

  static getSettlementStatusLabel(status: B2BSettlementStatus): string {
    return SETTLEMENT_STATUS_LABELS[status];
  }
}
