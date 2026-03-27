import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();

  const [totalCount, latestSnap, missingCodeCount] = await Promise.all([
    db.collection('config_fares').count().get(),
    db.collection('config_fares').orderBy('updatedAt', 'desc').limit(1).get(),
    db.collection('config_fares').where('fare', '==', 0).count().get(),
  ]);

  const latestDoc = latestSnap.docs[0]?.data() as { updatedAt?: { toDate?: () => Date } } | undefined;
  const latestUpdatedAt = latestDoc?.updatedAt?.toDate ? latestDoc.updatedAt.toDate().toISOString() : null;

  return NextResponse.json({
    totalCount: totalCount.data().count,
    latestUpdatedAt,
    zeroFareCount: missingCodeCount.data().count,
  });
}
