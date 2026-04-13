import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const snap = await db.collection('coupons').orderBy('createdAt', 'desc').get();

  const items = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() ?? null,
      updatedAt: data.updatedAt?.toDate() ?? null,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const db = getAdminDb();
    
    const now = new Date();
    const couponData = {
      name: body.name,
      description: body.description ?? '',
      discountType: body.discountType,
      discountValue: Number(body.discountValue),
      maxDiscountAmount: body.maxDiscountAmount ? Number(body.maxDiscountAmount) : null,
      minOrderAmount: body.minOrderAmount ? Number(body.minOrderAmount) : null,
      purpose: body.purpose,
      triggerEvent: body.triggerEvent,
      validDays: Number(body.validDays),
      isActive: body.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('coupons').add(couponData);

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const db = getAdminDb();
    
    // Clean up updates
    const cleanedUpdates: Record<string, any> = {
      updatedAt: new Date()
    };
    
    if (updates.name !== undefined) cleanedUpdates.name = updates.name;
    if (updates.description !== undefined) cleanedUpdates.description = updates.description;
    if (updates.discountType !== undefined) cleanedUpdates.discountType = updates.discountType;
    if (updates.discountValue !== undefined) cleanedUpdates.discountValue = Number(updates.discountValue);
    if (updates.maxDiscountAmount !== undefined) cleanedUpdates.maxDiscountAmount = updates.maxDiscountAmount ? Number(updates.maxDiscountAmount) : null;
    if (updates.minOrderAmount !== undefined) cleanedUpdates.minOrderAmount = updates.minOrderAmount ? Number(updates.minOrderAmount) : null;
    if (updates.purpose !== undefined) cleanedUpdates.purpose = updates.purpose;
    if (updates.triggerEvent !== undefined) cleanedUpdates.triggerEvent = updates.triggerEvent;
    if (updates.validDays !== undefined) cleanedUpdates.validDays = Number(updates.validDays);
    if (updates.isActive !== undefined) cleanedUpdates.isActive = Boolean(updates.isActive);

    await db.collection('coupons').doc(id).update(cleanedUpdates);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
