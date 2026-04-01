import { Timestamp } from 'firebase/firestore';

export enum PaymentOrderStatus {
  CREATED = 'created',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  PARTIALLY_REFUNDED = 'partially_refunded',
  REFUNDED = 'refunded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum DepositHoldStatus {
  REQUESTED = 'requested',
  AUTHORIZED = 'authorized',
  LOCKED = 'locked',
  RELEASING = 'releasing',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  CLAIMED = 'claimed',
  ON_HOLD = 'on_hold',
}

export enum SettlementLedgerStatus {
  OPEN = 'open',
  LOCKED = 'locked',
  READY_FOR_PAYOUT = 'ready_for_payout',
  PAID_OUT = 'paid_out',
  HELD = 'held',
  REVERSED = 'reversed',
}

export enum SettlementShareStatus {
  PENDING = 'pending',
  CALCULATED = 'calculated',
  HELD = 'held',
  READY = 'ready',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export interface PaymentOrder {
  paymentOrderId: string;
  requestId: string;
  requesterUserId: string;
  pricingQuoteId?: string;
  pgProvider: 'tosspayments' | 'other';
  pgPaymentKey?: string;
  orderId: string;
  orderName: string;
  amount: number;
  currency: 'KRW';
  status: PaymentOrderStatus;
  metadata?: {
    pgTransactionId?: string;
    rawResponseRef?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DepositHold {
  depositHoldId: string;
  requestId: string;
  deliveryId?: string;
  gillerUserId: string;
  requesterUserId: string;
  itemValue: number;
  holdAmount: number;
  rate: number;
  pgProvider: 'tosspayments' | 'point' | 'mixed';
  pgPaymentKey?: string;
  idempotencyKey: string;
  status: DepositHoldStatus;
  releaseGuard: {
    deliveryCompleted: boolean;
    endpointVerified: boolean;
    allRequiredHandoversCompleted: boolean;
    disputeOpen: boolean;
    manualReviewRequired: boolean;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SettlementLedger {
  settlementLedgerId: string;
  requestId: string;
  deliveryId: string;
  paymentOrderId: string;
  platformFeeAmount: number;
  totalCollectedAmount: number;
  totalPayoutAmount: number;
  totalHeldAmount: number;
  status: SettlementLedgerStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SettlementShare {
  settlementShareId: string;
  settlementLedgerId: string;
  requestId: string;
  deliveryId: string;
  deliveryLegId?: string;
  gillerUserId?: string;
  actorType: 'giller' | 'external_partner' | 'platform';
  contribution: {
    legType?: string;
    score: number;
    weight: number;
  };
  grossAmount: number;
  platformFeeAmount: number;
  taxAmount: number;
  netAmount: number;
  status: SettlementShareStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PaymentEvent {
  paymentEventId: string;
  requestId?: string;
  deliveryId?: string;
  paymentOrderId?: string;
  depositHoldId?: string;
  settlementLedgerId?: string;
  eventType:
    | 'payment_authorized'
    | 'payment_captured'
    | 'payment_cancel_requested'
    | 'payment_cancelled'
    | 'deposit_locked'
    | 'deposit_release_requested'
    | 'deposit_released'
    | 'deposit_claimed'
    | 'settlement_locked'
    | 'settlement_paid'
    | 'manual_review_required';
  actorUserId?: string;
  reason?: string;
  idempotencyKey?: string;
  createdAt: Timestamp;
}
