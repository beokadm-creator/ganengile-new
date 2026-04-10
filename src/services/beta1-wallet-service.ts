import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../core/firebase';
import {
  type WalletLedger,
  type WalletBalances,
  type WithdrawalEligibilityDecision,
  type WithdrawalEligibilityInput,
  WithdrawalEligibilityStatus,
} from '../types/beta1-wallet';
import { WITHDRAW_MIN_AMOUNT } from '../types/point';
import { getWalletSummary } from '../utils/wallet-balance';

export function normalizeWalletBalances(userData: Record<string, unknown>): WalletBalances {
  const walletBalances =
    typeof userData.walletBalances === 'object' && userData.walletBalances !== null
      ? (userData.walletBalances as Record<string, unknown>)
      : {};

  return {
    chargeBalance: typeof walletBalances.chargeBalance === 'number' ? walletBalances.chargeBalance : 0,
    earnedBalance:
      typeof walletBalances.earnedBalance === 'number'
        ? walletBalances.earnedBalance
        : typeof userData.pointBalance === 'number'
          ? userData.pointBalance
          : 0,
    promoBalance: typeof walletBalances.promoBalance === 'number' ? walletBalances.promoBalance : 0,
    lockedChargeBalance: typeof walletBalances.lockedChargeBalance === 'number' ? walletBalances.lockedChargeBalance : 0,
    lockedEarnedBalance: typeof walletBalances.lockedEarnedBalance === 'number' ? walletBalances.lockedEarnedBalance : 0,
    lockedPromoBalance: typeof walletBalances.lockedPromoBalance === 'number' ? walletBalances.lockedPromoBalance : 0,
    pendingWithdrawalBalance:
      typeof walletBalances.pendingWithdrawalBalance === 'number' ? walletBalances.pendingWithdrawalBalance : 0,
  };
}

function resolveTimestamp(value: unknown): Timestamp {
  return value instanceof Timestamp ? value : Timestamp.now();
}

export function createWalletLedgerSnapshot(
  userId: string,
  userData: Record<string, unknown>,
  updatedAt?: unknown
): WalletLedger {
  const balances = normalizeWalletBalances(userData);
  const summary = getWalletSummary(balances);

  return {
    walletLedgerId: userId,
    userId,
    balances,
    summary,
    updatedAt: resolveTimestamp(updatedAt),
  };
}

export async function getWalletLedger(userId: string): Promise<WalletLedger> {
  const ledgerSnap = await getDoc(doc(db, 'wallet_ledgers', userId));
  if (ledgerSnap.exists()) {
    const ledgerData = (ledgerSnap.data() ?? {}) as Record<string, unknown>;
    const balances =
      typeof ledgerData.balances === 'object' && ledgerData.balances !== null
        ? normalizeWalletBalances({ walletBalances: ledgerData.balances })
        : normalizeWalletBalances({});

    return {
      walletLedgerId: ledgerSnap.id,
      userId,
      balances,
      summary: getWalletSummary(balances),
      updatedAt: resolveTimestamp(ledgerData.updatedAt),
    };
  }

  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) {
    return createWalletLedgerSnapshot(userId, {}, Timestamp.now());
  }

  const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
  return createWalletLedgerSnapshot(userId, userData, userData.updatedAt);
}

export function evaluateWithdrawalEligibility(input: WithdrawalEligibilityInput): WithdrawalEligibilityDecision {
  const reasons: WithdrawalEligibilityStatus[] = [];
  const withdrawableBalance = getWalletSummary(input.balances).withdrawableBalance;

  if (!input.isIdentityVerified) {
    reasons.push(WithdrawalEligibilityStatus.IDENTITY_UNVERIFIED);
  }

  if (!input.isPayoutAccountVerified) {
    reasons.push(WithdrawalEligibilityStatus.PAYOUT_ACCOUNT_UNVERIFIED);
  }

  if (!input.payoutAccountOwnerMatchesUser) {
    reasons.push(WithdrawalEligibilityStatus.ACCOUNT_OWNER_MISMATCH);
  }

  if (input.hasOpenDispute) {
    reasons.push(WithdrawalEligibilityStatus.DISPUTE_OPEN);
  }

  if (input.hasRiskHold) {
    reasons.push(WithdrawalEligibilityStatus.MANUAL_HOLD);
  }

  if (input.requiresManualReview) {
    reasons.push(WithdrawalEligibilityStatus.RISK_REVIEW_REQUIRED);
  }

  if (input.amount < input.minimumAmount) {
    reasons.push(WithdrawalEligibilityStatus.BELOW_MINIMUM);
  }

  if (withdrawableBalance <= 0 || input.amount > withdrawableBalance) {
    reasons.push(WithdrawalEligibilityStatus.INSUFFICIENT_BALANCE);
  }

  const status = reasons[0] ?? WithdrawalEligibilityStatus.ELIGIBLE;

  return {
    allowed: reasons.length === 0,
    status,
    reasons,
    withdrawableBalance,
  };
}

export async function getWithdrawalEligibility(userId: string, amount?: number): Promise<WithdrawalEligibilityDecision> {
  const [userSnap, walletLedger] = await Promise.all([
    getDoc(doc(db, 'users', userId)),
    getWalletLedger(userId),
  ]);

  if (!userSnap.exists()) {
    return {
      allowed: false,
      status: WithdrawalEligibilityStatus.IDENTITY_UNVERIFIED,
      reasons: [WithdrawalEligibilityStatus.IDENTITY_UNVERIFIED],
      withdrawableBalance: 0,
    };
  }

  const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
  const gillerInfo =
    typeof userData.gillerInfo === 'object' && userData.gillerInfo !== null
      ? (userData.gillerInfo as Record<string, unknown>)
      : {};
  const bankAccount =
    typeof gillerInfo.bankAccount === 'object' && gillerInfo.bankAccount !== null
      ? (gillerInfo.bankAccount as Record<string, unknown>)
      : {};

  const identityStatus =
    typeof gillerInfo.identityVerificationStatus === 'string'
      ? gillerInfo.identityVerificationStatus
      : userData.isVerified
        ? 'approved'
        : 'not_submitted';
  const bankStatus =
    typeof bankAccount.verificationStatus === 'string'
      ? bankAccount.verificationStatus
      : 'not_submitted';

  const disputesSnap = await getDocs(
    query(
      collection(db, 'disputes'),
      where('userId', '==', userId),
      where('status', 'in', ['pending', 'in_review'])
    )
  );

  return evaluateWithdrawalEligibility({
    amount: amount ?? walletLedger.summary.withdrawableBalance,
    balances: walletLedger.balances,
    minimumAmount: WITHDRAW_MIN_AMOUNT,
    isIdentityVerified: identityStatus === 'approved' || identityStatus === 'approved_test_bypass',
    isPayoutAccountVerified:
      bankStatus === 'verified' || bankStatus === 'approved' || bankStatus === 'approved_test_bypass',
    payoutAccountOwnerMatchesUser: Boolean(bankAccount.accountHolder),
    hasOpenDispute: !disputesSnap.empty,
    requiresManualReview: Boolean(userData.manualWithdrawalHold ?? false),
    hasRiskHold: Boolean(userData.riskHold ?? false),
  });
}
