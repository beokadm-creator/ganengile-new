import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { couponId, userId } = await req.json();
    
    if (!couponId || !userId) {
      return NextResponse.json({ error: 'Missing couponId or userId' }, { status: 400 });
    }

    const db = getAdminDb();
    
    // 1. Verify coupon exists and is active
    const couponSnap = await db.collection('coupons').doc(couponId).get();
    if (!couponSnap.exists) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }
    
    const couponData = couponSnap.data()!;
    if (!couponData.isActive) {
      return NextResponse.json({ error: 'This coupon is not active' }, { status: 400 });
    }

    // 2. Verify user exists
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Issue the coupon
    const now = new Date();
    const expiresAt = new Date(now.getTime() + couponData.validDays * 24 * 60 * 60 * 1000);

    const userCouponData = {
      userId,
      couponId,
      name: couponData.name,
      description: couponData.description,
      discountType: couponData.discountType,
      discountValue: couponData.discountValue,
      maxDiscountAmount: couponData.maxDiscountAmount ?? null,
      minOrderAmount: couponData.minOrderAmount ?? null,
      purpose: couponData.purpose,
      status: 'active',
      issuedAt: now,
      expiresAt,
    };

    const docRef = await db.collection('user_coupons').add(userCouponData);

    return NextResponse.json({ ok: true, userCouponId: docRef.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
