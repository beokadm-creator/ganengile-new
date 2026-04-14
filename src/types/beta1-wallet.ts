export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
};

export enum WalletBalancePolicy {
  CHARGE_FIRST = 'charge_first',
}

export enum WalletEntryType {
  CHARGE = 'charge',
  EARN_SETTLEMENT = 'earn_settlement',
  EARN_REWARD = 'earn_reward',
  REFUND = 'refund',
  SPEND = 'spend',
  WITHDRAW_REQUEST = 'withdraw_request',
  WITHDRAW_COMPLETE = 'withdraw_complete',
  WITHDRAW_FAIL = 'withdraw_fail',
  ADJUSTMENT = 'adjustment',
  GIFT_SEND = 'gift_send',
  GIFT_RECEIVE = 'gift_receive',
}

export enum WalletFundingSource {
  CHARGE = 'charge',
  EARNED = 'earned',
  PROMO = 'promo',
}

export enum WithdrawalEligibilityStatus {
  ELIGIBLE = 'eligible',
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  BELOW_MINIMUM = 'below_minimum',
  IDENTITY_UNVERIFIED = 'identity_unverified',
  PAYOUT_ACCOUNT_UNVERIFIED = 'payout_account_unverified',
  ACCOUNT_OWNER_MISMATCH = 'account_owner_mismatch',
  RISK_REVIEW_REQUIRED = 'risk_review_required',
  DISPUTE_OPEN = 'dispute_open',
  MANUAL_HOLD = 'manual_hold',
}

export interface WalletBalances {
  chargeBalance: number;
  earnedBalance: number;
  promoBalance?: number;
  lockedChargeBalance?: number;
  lockedEarnedBalance?: number;
  lockedPromoBalance?: number;
  pendingWithdrawalBalance?: number;
}

export interface WalletSummary {
  totalUsableBalance: number;
  withdrawableBalance: number;
  lockedBalance: number;
  pendingWithdrawalBalance: number;
  chargeBalance: number;
  earnedBalance: number;
  promoBalance: number;
}

export interface WalletSpendBreakdown {
  amount: number;
  policy: WalletBalancePolicy;
  fromChargeBalance: number;
  fromEarnedBalance: number;
  fromPromoBalance: number;
  remainingChargeBalance: number;
  remainingEarnedBalance: number;
  remainingPromoBalance: number;
}

export interface WalletLedger {
  walletLedgerId: string;
  userId: string;
  balances: WalletBalances;
  summary: WalletSummary;
  updatedAt: FirestoreTimestamp;
}

export interface WalletEntry {
  walletEntryId: string;
  walletLedgerId: string;
  userId: string;
  type: WalletEntryType;
  fundingSource: WalletFundingSource;
  amount: number;
  balanceBefore: WalletSummary;
  balanceAfter: WalletSummary;
  description: string;
  relatedRequestId?: string;
  relatedDeliveryId?: string;
  relatedSettlementId?: string;
  relatedPaymentId?: string;
  relatedWithdrawalRequestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: FirestoreTimestamp;
}

export interface WithdrawalEligibilityInput {
  amount: number;
  balances: WalletBalances;
  minimumAmount: number;
  isIdentityVerified: boolean;
  hasOpenDispute?: boolean;
  requiresManualReview?: boolean;
  hasRiskHold?: boolean;
}

export interface WithdrawalEligibilityDecision {
  allowed: boolean;
  status: WithdrawalEligibilityStatus;
  reasons: WithdrawalEligibilityStatus[];
  withdrawableBalance: number;
}
