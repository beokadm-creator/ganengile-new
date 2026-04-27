import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

   
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') ?? '200');

  const snap = await db.collection('non_subway_lockers').orderBy('updatedAt', 'desc').limit(limit).get();
  const items = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ items });
}
