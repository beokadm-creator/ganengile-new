import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { runFareCacheSync } from '@/lib/fare-cache-sync';

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

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const result = await runFareCacheSync(db);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[admin/fare-cache][POST] failed:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Fare cache sync failed.',
      },
      { status: 500 }
    );
  }
}
