/**
 * Legacy enterprise customer settlement definitions.
 */
import type { EnterpriseLegacyGillerTierLevel } from './enterprise-legacy-giller-tier';

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

export type EnterpriseLegacySettlementStatus = 'pending_payment' | 'paid' | 'failed';

export interface EnterpriseLegacySettlement {
  id: string;
  gillerId: string;
  businessId?: string;
  period: SettlementPeriod;
  b2bDeliveries: number;
  deliveryEarnings: number;
  monthlyBonus: number;
  totalSettlement: number;
  status: EnterpriseLegacySettlementStatus;
  transferInfo?: TransferInfo;
  createdAt: Date;
  updatedAt?: Date;
  reviewNote?: string;
}

export interface CreateEnterpriseLegacySettlementData {
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

export const ENTERPRISE_LEGACY_SETTLEMENT_STATUS_LABELS: Record<EnterpriseLegacySettlementStatus, string> = {
  pending_payment: '지급 대기',
  paid: '지급 완료',
  failed: '지급 실패',
};

export const ENTERPRISE_LEGACY_SETTLEMENT_CYCLE_DAYS = 5;

export const ENTERPRISE_LEGACY_TIER_MONTHLY_BONUSES: Record<EnterpriseLegacyGillerTierLevel, number> = {
  silver: 100000,
  gold: 200000,
  platinum: 300000,
};

export type EnterpriseLegacySettlementPeriod = SettlementPeriod;
export type EnterpriseLegacySettlementSummary = SettlementSummary;
export type EnterpriseLegacyTransferInfo = TransferInfo;
