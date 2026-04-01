import {
  WalletBalancePolicy,
  WalletBalances,
  WalletSpendBreakdown,
  WalletSummary,
} from '../types/beta1-wallet';

const safe = (value?: number): number => Math.max(0, value ?? 0);

export function getWalletSummary(balances: WalletBalances): WalletSummary {
  const chargeBalance = safe(balances.chargeBalance);
  const earnedBalance = safe(balances.earnedBalance);
  const promoBalance = safe(balances.promoBalance);
  const lockedChargeBalance = safe(balances.lockedChargeBalance);
  const lockedEarnedBalance = safe(balances.lockedEarnedBalance);
  const lockedPromoBalance = safe(balances.lockedPromoBalance);
  const pendingWithdrawalBalance = safe(balances.pendingWithdrawalBalance);

  const totalUsableBalance = Math.max(
    0,
    chargeBalance +
      earnedBalance +
      promoBalance -
      lockedChargeBalance -
      lockedEarnedBalance -
      lockedPromoBalance -
      pendingWithdrawalBalance
  );
  const withdrawableBalance = Math.max(
    0,
    earnedBalance - lockedEarnedBalance - pendingWithdrawalBalance
  );
  const lockedBalance =
    lockedChargeBalance + lockedEarnedBalance + lockedPromoBalance;

  return {
    totalUsableBalance,
    withdrawableBalance,
    lockedBalance,
    pendingWithdrawalBalance,
    chargeBalance,
    earnedBalance,
    promoBalance,
  };
}

export function allocateWalletSpend(
  balances: WalletBalances,
  amount: number,
  policy: WalletBalancePolicy = WalletBalancePolicy.CHARGE_FIRST
): WalletSpendBreakdown {
  const spendAmount = Math.max(0, amount);

  const availableCharge = safe(balances.chargeBalance) - safe(balances.lockedChargeBalance);
  const availableEarned = safe(balances.earnedBalance) - safe(balances.lockedEarnedBalance);
  const availablePromo = safe(balances.promoBalance) - safe(balances.lockedPromoBalance);

  const totalAvailable = availableCharge + availableEarned + availablePromo;

  if (spendAmount > totalAvailable) {
    throw new Error(
      `Insufficient wallet balance. Available: ${totalAvailable}, required: ${spendAmount}`
    );
  }

  let remaining = spendAmount;
  let fromChargeBalance = 0;
  let fromEarnedBalance = 0;
  let fromPromoBalance = 0;

  switch (policy) {
    case WalletBalancePolicy.CHARGE_FIRST:
    default:
      fromChargeBalance = Math.min(availableCharge, remaining);
      remaining -= fromChargeBalance;

      fromEarnedBalance = Math.min(availableEarned, remaining);
      remaining -= fromEarnedBalance;

      fromPromoBalance = Math.min(availablePromo, remaining);
      remaining -= fromPromoBalance;
      break;
  }

  if (remaining > 0) {
    throw new Error(`Failed to allocate wallet spend. Remaining: ${remaining}`);
  }

  return {
    amount: spendAmount,
    policy,
    fromChargeBalance,
    fromEarnedBalance,
    fromPromoBalance,
    remainingChargeBalance: safe(balances.chargeBalance) - fromChargeBalance,
    remainingEarnedBalance: safe(balances.earnedBalance) - fromEarnedBalance,
    remainingPromoBalance: safe(balances.promoBalance) - fromPromoBalance,
  };
}
