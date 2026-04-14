import {
  WithdrawalEligibilityDecision,
  WithdrawalEligibilityInput,
  WithdrawalEligibilityStatus,
} from '../types/beta1-wallet';
import { getWalletSummary } from './wallet-balance';

export function evaluateWithdrawalEligibility(
  input: WithdrawalEligibilityInput
): WithdrawalEligibilityDecision {
  const reasons: WithdrawalEligibilityStatus[] = [];
  const summary = getWalletSummary(input.balances);

  if (input.amount < input.minimumAmount) {
    reasons.push(WithdrawalEligibilityStatus.BELOW_MINIMUM);
  }

  if (summary.withdrawableBalance < input.amount) {
    reasons.push(WithdrawalEligibilityStatus.INSUFFICIENT_BALANCE);
  }

  if (!input.isIdentityVerified) {
    reasons.push(WithdrawalEligibilityStatus.IDENTITY_UNVERIFIED);
  }

  if (input.hasOpenDispute) {
    reasons.push(WithdrawalEligibilityStatus.DISPUTE_OPEN);
  }

  if (input.requiresManualReview) {
    reasons.push(WithdrawalEligibilityStatus.MANUAL_HOLD);
  }

  if (input.hasRiskHold) {
    reasons.push(WithdrawalEligibilityStatus.RISK_REVIEW_REQUIRED);
  }

  return {
    allowed: reasons.length === 0,
    status: reasons[0] ?? WithdrawalEligibilityStatus.ELIGIBLE,
    reasons,
    withdrawableBalance: summary.withdrawableBalance,
  };
}
