import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

function toMillis(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') {
      return maybe.toDate().getTime();
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }
  return 0;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  let snap;
  try {
    snap = await db
      .collectionGroup('verification')
      .where('status', '==', status)
      .orderBy('submittedAt', 'desc')
      .limit(100)
      .get();
  } catch (error) {
    console.error('Verification query with submittedAt ordering failed, falling back to local sort', error);
    snap = await db.collectionGroup('verification').where('status', '==', status).limit(100).get();
  }

  const items = snap.docs.map((doc) => {
    const data = doc.data();
    const userId = doc.ref.parent.parent?.id ?? doc.id;
    return { id: doc.id, userId, ...data } as Record<string, unknown> & { id: string; userId: string };
  }).sort((left, right) => {
    const rightTime = toMillis(right['submittedAt'] ?? right['updatedAt'] ?? right['reviewedAt']);
    const leftTime = toMillis(left['submittedAt'] ?? left['updatedAt'] ?? left['reviewedAt']);
    return rightTime - leftTime;
  });

  const userIds = Array.from(new Set(items.map((item) => item.userId).filter(Boolean)));
  const userRefs = userIds.map((id) => db.collection('users').doc(id));
  const userSnaps = userRefs.length ? await db.getAll(...userRefs) : [];
  const userNameMap = new Map<string, string>();
  userSnaps.forEach((snap) => {
    if (snap.exists) {
      userNameMap.set(snap.id, snap.data()?.name ?? '');
    }
  });

  const enriched = items.map((item) => ({
    ...item,
    userName: item.userId ? userNameMap.get(item.userId) : '',
  }));

  return NextResponse.json({ items: enriched });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, action, reason } = await req.json();
  if (!userId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const status =
    action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'under_review';

  const db = getAdminDb();
  const ref = db.collection('users').doc(userId).collection('verification').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
    reviewedAt: new Date(),
    reviewedBy: 'admin',
  };
  if (status === 'rejected') {
    updateData.rejectionReason = reason ?? '';
  }

  try {
    await ref.update(updateData);
    await db.collection('users').doc(userId).update({
      isVerified: status === 'approved',
      updatedAt: new Date(),
    });
  } catch (error: unknown) {
    console.error('Failed to update verification:', error);
    return NextResponse.json(
      { error: 'Failed to update verification', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }

  try {
    let appSnap = await db
      .collection('giller_applications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!appSnap.empty) {
      await appSnap.docs[0].ref.update({ verificationStatus: status });
    }
  } catch (error: unknown) {
    console.warn('Giller application query with orderBy failed, falling back to local sort', error);
    
    // Check if this is an index error from Firestore
    if (error instanceof Error && error.message.includes('FAILED_PRECONDITION') && error.message.includes('requires an index')) {
      const linkMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
      if (linkMatch) {
        console.info('Please create the missing index using this link:', linkMatch[0]);
      }
    }
    
    // Fallback: get all for user and sort in memory
    const fallbackSnap = await db
      .collection('giller_applications')
      .where('userId', '==', userId)
      .get();
      
    if (!fallbackSnap.empty) {
      const sortedDocs = fallbackSnap.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.data().createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      
      await sortedDocs[0].ref.update({ verificationStatus: status });
    }
  }

  return NextResponse.json({ ok: true, status });
}
