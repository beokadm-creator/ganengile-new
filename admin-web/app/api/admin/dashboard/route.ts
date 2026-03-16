import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    pendingWithdrawals,
    pendingDisputes,
    pendingGillerApps,
    activeDeliveries,
    todayRequests,
    totalUsers,
    fareCount,
    fareLatest,
  ] = await Promise.all([
    db.collection('withdraw_requests').where('status', '==', 'pending').count().get(),
    db.collection('disputes').where('status', '==', 'pending').count().get(),
    db.collection('giller_applications').where('status', '==', 'pending').count().get(),
    db.collection('delivery_requests').where('status', 'in', ['matched', 'picked_up', 'in_locker']).count().get(),
    db.collection('delivery_requests').where('createdAt', '>=', todayStart).count().get(),
    db.collection('users').count().get(),
    db.collection('config_fares').count().get(),
    db.collection('config_fares').orderBy('updatedAt', 'desc').limit(1).get(),
  ]);

  const latestFareDoc = fareLatest.docs[0]?.data() as { updatedAt?: { toDate?: () => Date } } | undefined;
  const latestUpdatedAt = latestFareDoc?.updatedAt?.toDate ? latestFareDoc.updatedAt.toDate().toISOString() : null;

  return NextResponse.json({
    pendingWithdrawals: pendingWithdrawals.data().count,
    pendingDisputes: pendingDisputes.data().count,
    pendingGillerApps: pendingGillerApps.data().count,
    activeDeliveries: activeDeliveries.data().count,
    todayRequests: todayRequests.data().count,
    totalUsers: totalUsers.data().count,
    fareCount: fareCount.data().count,
    fareLatestUpdatedAt: latestUpdatedAt,
  });
}
