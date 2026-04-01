import { WalletBalancePolicy } from '../src/types/beta1-wallet';
import { allocateWalletSpend, getWalletSummary } from '../src/utils/wallet-balance';

describe('wallet-balance', () => {
  it('calculates usable and withdrawable balances separately', () => {
    const summary = getWalletSummary({
      chargeBalance: 15000,
      earnedBalance: 40000,
      promoBalance: 5000,
      lockedEarnedBalance: 7000,
      pendingWithdrawalBalance: 3000,
    });

    expect(summary.totalUsableBalance).toBe(50000);
    expect(summary.withdrawableBalance).toBe(30000);
    expect(summary.pendingWithdrawalBalance).toBe(3000);
  });

  it('spends charge balance first before earned balance', () => {
    const result = allocateWalletSpend(
      {
        chargeBalance: 10000,
        earnedBalance: 15000,
        promoBalance: 2000,
      },
      18000,
      WalletBalancePolicy.CHARGE_FIRST
    );

    expect(result.fromChargeBalance).toBe(10000);
    expect(result.fromEarnedBalance).toBe(8000);
    expect(result.fromPromoBalance).toBe(0);
    expect(result.remainingEarnedBalance).toBe(7000);
  });

  it('throws when usable balance is insufficient', () => {
    expect(() =>
      allocateWalletSpend(
        {
          chargeBalance: 2000,
          earnedBalance: 1000,
        },
        5000
      )
    ).toThrow('Insufficient wallet balance');
  });
});
