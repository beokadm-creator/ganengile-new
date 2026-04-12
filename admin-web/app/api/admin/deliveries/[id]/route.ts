import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 관리자 권한 확인
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = await req.json();
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const deliveryRef = db.collection('deliveries').doc(id);
    const snap = await deliveryRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    await deliveryRef.update(updates);

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('[admin/deliveries/PATCH] failed:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
