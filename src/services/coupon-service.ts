import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../core/firebase';
import type { Coupon, CouponTriggerEvent, UserCoupon } from '../types/coupon';

/**
 * 트리거 이벤트(회원가입, 첫 주문 등)에 해당하는 활성 마스터 쿠폰들을 조회하여
 * 특정 유저에게 자동으로 발급합니다.
 */
export async function autoIssueCouponsByTrigger(
  userId: string,
  triggerEvent: CouponTriggerEvent
): Promise<void> {
  try {
    // 1. 해당 트리거 이벤트를 가진 활성화된 마스터 쿠폰 목록 조회
    const couponsRef = collection(db, 'coupons');
    const q = query(
      couponsRef,
      where('triggerEvent', '==', triggerEvent),
      where('isActive', '==', true)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return; // 발급할 쿠폰이 없음
    }

    // 2. 조회된 쿠폰들을 순회하며 유저에게 발급 처리
    const issuePromises = snapshot.docs.map(async (couponDoc) => {
      const couponData = couponDoc.data() as Omit<Coupon, 'id'>;
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + couponData.validDays * 24 * 60 * 60 * 1000);

      const userCouponData = {
        userId,
        couponId: couponDoc.id,
        name: couponData.name,
        description: couponData.description,
        discountType: couponData.discountType,
        discountValue: couponData.discountValue,
        maxDiscountAmount: couponData.maxDiscountAmount ?? null,
        minOrderAmount: couponData.minOrderAmount ?? null,
        purpose: couponData.purpose,
        status: 'active',
        issuedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      };

      await addDoc(collection(db, 'user_coupons'), userCouponData);
    });

    await Promise.all(issuePromises);
    console.log(`[coupon-service] Successfully issued '${triggerEvent}' coupons to user: ${userId}`);
  } catch (error) {
    console.error(`[coupon-service] Error issuing '${triggerEvent}' coupons:`, error);
  }
}

/**
 * 특정 유저의 보유 쿠폰 목록을 조회합니다.
 */
export async function getUserCoupons(userId: string): Promise<UserCoupon[]> {
  try {
    const userCouponsRef = collection(db, 'user_coupons');
    const q = query(userCouponsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as UserCoupon[];
  } catch (error) {
    console.error('[coupon-service] Error fetching user coupons:', error);
    return [];
  }
}
