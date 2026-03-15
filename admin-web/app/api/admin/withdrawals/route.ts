import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  const snap = await db
    .collection('withdraw_requests')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .get();

  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId, action, note } = await req.json();
  if (!requestId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = getAdminDb();
  const ref = db.collection('withdraw_requests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newStatus = action === 'approve' ? 'completed' : 'rejected';
  await ref.update({
    status: newStatus,
    adminNote: note ?? '',
    processedAt: new Date(),
  });

  // If rejected, refund points back to user
  if (action === 'reject') {
    const data = snap.data()!;
    const userRef = db.collection('users').doc(data.userId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const currentBalance = userSnap.data()?.pointBalance ?? 0;
      const currentSpent = userSnap.data()?.totalSpentPoints ?? 0;
      await userRef.update({
        pointBalance: currentBalance + data.amount,
        totalSpentPoints: Math.max(0, currentSpent - data.amount),
      });
      // Record refund transaction
      await db.collection('point_transactions').add({
        userId: data.userId,
        amount: data.amount,
        type: 'earn',
        category: 'withdraw_rejected',
        description: `출금 반려 환불 (${note ?? '사유 없음'})`,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + data.amount,
        status: 'completed',
        relatedRequestId: requestId,
        createdAt: new Date(),
        completedAt: new Date(),
      });
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
