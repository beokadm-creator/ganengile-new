import type { DepositHold } from '../types/beta1-payment';
import { DepositHoldStatus } from '../types/beta1-payment';

export interface DepositReleaseDecision {
  releasable: boolean;
  reason:
    | 'ok'
    | 'wrong_status'
    | 'delivery_not_completed'
    | 'endpoint_not_verified'
    | 'handover_incomplete'
    | 'dispute_open'
    | 'manual_review_required';
}

export function canReleaseDeposit(hold: DepositHold): DepositReleaseDecision {
  if (
    hold.status !== DepositHoldStatus.LOCKED &&
    hold.status !== DepositHoldStatus.ON_HOLD
  ) {
    return { releasable: false, reason: 'wrong_status' };
  }

  if (!hold.releaseGuard.deliveryCompleted) {
    return { releasable: false, reason: 'delivery_not_completed' };
  }

  if (!hold.releaseGuard.endpointVerified) {
    return { releasable: false, reason: 'endpoint_not_verified' };
  }

  if (!hold.releaseGuard.allRequiredHandoversCompleted) {
    return { releasable: false, reason: 'handover_incomplete' };
  }

  if (hold.releaseGuard.disputeOpen) {
    return { releasable: false, reason: 'dispute_open' };
  }

  if (hold.releaseGuard.manualReviewRequired) {
    return { releasable: false, reason: 'manual_review_required' };
  }

  return { releasable: true, reason: 'ok' };
}
