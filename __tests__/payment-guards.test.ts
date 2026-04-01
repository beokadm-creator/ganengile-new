import { Timestamp } from 'firebase/firestore';
import { canReleaseDeposit } from '../src/utils/payment-guards';
import { DepositHoldStatus, type DepositHold } from '../src/types/beta1-payment';

jest.mock('firebase/firestore', () => ({
  Timestamp: class MockTimestamp {
    static now() {
      return new MockTimestamp();
    }
  },
}));

function buildHold(
  overrides: Partial<DepositHold> = {}
): DepositHold {
  return {
    depositHoldId: 'hold-1',
    requestId: 'request-1',
    deliveryId: 'delivery-1',
    gillerUserId: 'giller-1',
    requesterUserId: 'user-1',
    itemValue: 100000,
    holdAmount: 80000,
    rate: 0.8,
    pgProvider: 'tosspayments',
    pgPaymentKey: 'payment-key',
    idempotencyKey: 'dep-release-1',
    status: DepositHoldStatus.LOCKED,
    releaseGuard: {
      deliveryCompleted: true,
      endpointVerified: true,
      allRequiredHandoversCompleted: true,
      disputeOpen: false,
      manualReviewRequired: false,
    },
    createdAt: Timestamp.now() as unknown as Timestamp,
    updatedAt: Timestamp.now() as unknown as Timestamp,
    ...overrides,
  };
}

describe('payment guards', () => {
  it('allows release only when all release guards are satisfied', () => {
    expect(canReleaseDeposit(buildHold())).toEqual({
      releasable: true,
      reason: 'ok',
    });
  });

  it('blocks release when delivery is incomplete', () => {
    expect(
      canReleaseDeposit(
        buildHold({
          releaseGuard: {
            deliveryCompleted: false,
            endpointVerified: true,
            allRequiredHandoversCompleted: true,
            disputeOpen: false,
            manualReviewRequired: false,
          },
        })
      )
    ).toEqual({
      releasable: false,
      reason: 'delivery_not_completed',
    });
  });

  it('blocks release when dispute is open', () => {
    expect(
      canReleaseDeposit(
        buildHold({
          releaseGuard: {
            deliveryCompleted: true,
            endpointVerified: true,
            allRequiredHandoversCompleted: true,
            disputeOpen: true,
            manualReviewRequired: false,
          },
        })
      )
    ).toEqual({
      releasable: false,
      reason: 'dispute_open',
    });
  });
});
