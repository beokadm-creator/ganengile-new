import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';

  let query = db.collection('users').orderBy('pointBalance', 'desc').limit(50);
  const snap = await query.get();

  let items = snap.docs.map((doc) => ({
    id: doc.id,
    displayName: doc.data().displayName ?? doc.data().name ?? '(이름없음)',
    email: doc.data().email ?? '',
    pointBalance: doc.data().pointBalance ?? 0,
    totalEarnedPoints: doc.data().totalEarnedPoints ?? 0,
    totalSpentPoints: doc.data().totalSpentPoints ?? 0,
    updatedAt: doc.data().updatedAt,
  }));

  if (search) {
    items = items.filter(
      (u) => u.displayName.includes(search) || u.email.includes(search) || u.id.includes(search)
    );
  }

  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, type, amount, reason } = await req.json();
  if (!userId || !type || !amount || !reason) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = getAdminDb();
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const current = userSnap.data()?.pointBalance ?? 0;
  const delta = type === 'earn' ? Number(amount) : -Number(amount);
  const newBalance = Math.max(0, current + delta);

  const totalUpdate: Record<string, any> = { pointBalance: newBalance, updatedAt: new Date() };
  if (type === 'earn') {
    totalUpdate.totalEarnedPoints = (userSnap.data()?.totalEarnedPoints ?? 0) + Number(amount);
  } else {
    totalUpdate.totalSpentPoints = (userSnap.data()?.totalSpentPoints ?? 0) + Number(amount);
  }
  await userRef.update(totalUpdate);

  await db.collection('point_transactions').add({
    userId,
    amount: delta,
    type: type === 'earn' ? 'earn' : 'spend',
    category: 'admin_adjustment',
    description: `관리자 수동 조정: ${reason}`,
    balanceBefore: current,
    balanceAfter: newBalance,
    status: 'completed',
    createdAt: new Date(),
    completedAt: new Date(),
  });

  return NextResponse.json({ ok: true, newBalance });
}
