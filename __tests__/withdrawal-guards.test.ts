import { WithdrawalEligibilityStatus } from '../src/types/beta1-wallet';
import { evaluateWithdrawalEligibility } from '../src/utils/withdrawal-guards';

describe('withdrawal-guards', () => {
  it('allows withdrawal only when all payout checks pass', () => {
    const decision = evaluateWithdrawalEligibility({
      amount: 20000,
      minimumAmount: 10000,
      balances: {
        chargeBalance: 5000,
        earnedBalance: 50000,
        pendingWithdrawalBalance: 5000,
      },
      isIdentityVerified: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe(WithdrawalEligibilityStatus.ELIGIBLE);
    expect(decision.withdrawableBalance).toBe(45000);
  });

  it('blocks withdrawal when identity or account verification fails', () => {
    const decision = evaluateWithdrawalEligibility({
      amount: 20000,
      minimumAmount: 10000,
      balances: {
        chargeBalance: 10000,
        earnedBalance: 25000,
      },
      isIdentityVerified: false,
      hasRiskHold: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual([
      WithdrawalEligibilityStatus.IDENTITY_UNVERIFIED,
      WithdrawalEligibilityStatus.RISK_REVIEW_REQUIRED,
    ]);
  });

  it('blocks withdrawal when withdrawable balance is insufficient because funds are locked or pending', () => {
    const decision = evaluateWithdrawalEligibility({
      amount: 15000,
      minimumAmount: 10000,
      balances: {
        chargeBalance: 30000,
        earnedBalance: 20000,
        lockedEarnedBalance: 8000,
        pendingWithdrawalBalance: 5000,
      },
      isIdentityVerified: true,
      isPayoutAccountVerified: true,
      payoutAccountOwnerMatchesUser: true,
      hasOpenDispute: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.withdrawableBalance).toBe(7000);
    expect(decision.reasons).toEqual([
      WithdrawalEligibilityStatus.INSUFFICIENT_BALANCE,
      WithdrawalEligibilityStatus.DISPUTE_OPEN,
    ]);
  });
});
