import type { B2BGillerTierLevel } from './b2b-giller-tier';

export interface SettlementPeriod {
  start: Date;
  end: Date;
}

export interface TransferInfo {
  accountNumber: string;
  bank: string;
  transferredAt?: Date;
  transactionId?: string;
}

export type B2BSettlementStatus = 'pending_payment' | 'paid' | 'failed';

export interface B2BSettlement {
  id: string;
  gillerId: string;
  businessId?: string;
  period: SettlementPeriod;
  b2bDeliveries: number;
  deliveryEarnings: number;
  monthlyBonus: number;
  totalSettlement: number;
  status: B2BSettlementStatus;
  transferInfo?: TransferInfo;
  createdAt: Date;
  updatedAt?: Date;
  reviewNote?: string;
}

export interface CreateB2BSettlementData {
  gillerId: string;
  periodStart: Date;
  periodEnd: Date;
  monthlyBonus?: number;
  businessId?: string;
}

export interface SettlementSummary {
  period: SettlementPeriod;
  b2bDeliveries: number;
  deliveryEarnings: number;
  monthlyBonus: number;
  totalSettlement: number;
}

export const SETTLEMENT_STATUS_LABELS: Record<B2BSettlementStatus, string> = {
  pending_payment: '지급 대기',
  paid: '지급 완료',
  failed: '지급 실패',
};

export const SETTLEMENT_CYCLE_DAYS = 5;

export const TIER_MONTHLY_BONUSES: Record<B2BGillerTierLevel, number> = {
  silver: 100000,
  gold: 200000,
  platinum: 300000,
};
