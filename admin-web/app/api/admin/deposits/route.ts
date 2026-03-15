import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'paid';

  const snap = await db
    .collection('deposits')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { depositId, action } = await req.json();
  if (!depositId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = getAdminDb();
  const ref = db.collection('deposits').doc(depositId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = snap.data()!;
  if (data.status !== 'paid') return NextResponse.json({ error: 'Deposit not in paid status' }, { status: 400 });

  if (action === 'refund') {
    await ref.update({ status: 'refunded', refundedAt: new Date(), updatedAt: new Date() });
    // Return point portion to user
    if (data.pointAmount > 0) {
      const userRef = db.collection('users').doc(data.userId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const current = userSnap.data()?.pointBalance ?? 0;
        await userRef.update({ pointBalance: current + data.pointAmount });
        await db.collection('point_transactions').add({
          userId: data.userId, amount: data.pointAmount, type: 'earn',
          category: 'deposit_refund', description: `보증금 환급 (${data.depositAmount.toLocaleString()}원)`,
          balanceBefore: current, balanceAfter: current + data.pointAmount,
          status: 'completed', createdAt: new Date(), completedAt: new Date(),
        });
      }
    }
  } else if (action === 'deduct') {
    await ref.update({ status: 'deducted', deductedAt: new Date(), updatedAt: new Date() });
  }

  return NextResponse.json({ ok: true });
}
