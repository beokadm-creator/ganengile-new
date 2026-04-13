import { Timestamp } from 'firebase/firestore';

export type DiscountType = 'fixed' | 'percentage';
export type CouponPurpose = 'delivery_fee' | 'deposit' | 'all';
export type CouponTriggerEvent = 'signup' | 'first_order' | 'manual';
export type UserCouponStatus = 'active' | 'used' | 'expired';

// 마스터 쿠폰 (관리자가 생성하는 템플릿)
export interface Coupon {
  id: string;
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: number; // 정액이면 원(₩), 정률이면 퍼센트(%)
  maxDiscountAmount?: number; // 정률 할인 시 최대 할인 한도
  minOrderAmount?: number; // 사용 가능한 최소 주문/결제 금액
  purpose: CouponPurpose; // 배송비 전용, 보증금 전용, 모두 사용 가능
  triggerEvent: CouponTriggerEvent; // 발급 트리거
  validDays: number; // 발급일로부터 유효한 일수
  isActive: boolean; // 현재 발급 가능한지 여부
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// 사용자가 발급받은 쿠폰
export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  purpose: CouponPurpose;
  status: UserCouponStatus;
  issuedAt: Timestamp | Date;
  expiresAt: Timestamp | Date;
  usedAt?: Timestamp | Date;
  usedOrderId?: string; // 쿠폰이 사용된 주문/결제 ID
}
