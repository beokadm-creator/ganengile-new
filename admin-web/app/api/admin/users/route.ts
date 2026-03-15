import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const role = searchParams.get('role') ?? '';

  let query: FirebaseFirestore.Query = db.collection('users').orderBy('createdAt', 'desc').limit(100);

  if (role) {
    query = db.collection('users').where('role', '==', role).orderBy('createdAt', 'desc').limit(100);
  }

  const snap = await query.get();

  let items = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name ?? d.displayName ?? '(이름없음)',
      email: d.email ?? '',
      role: d.role ?? '',
      isActive: d.isActive ?? true,
      pointBalance: d.pointBalance ?? 0,
      gillerApplicationStatus: d.gillerApplicationStatus ?? null,
      createdAt: d.createdAt,
    };
  });

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.includes(q)
    );
  }

  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, isActive } = await req.json();
  if (!userId || isActive === undefined) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = getAdminDb();
  await db.collection('users').doc(userId).update({ isActive, updatedAt: new Date() });

  return NextResponse.json({ ok: true });
}
