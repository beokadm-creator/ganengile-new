import { NextRequest, NextResponse } from 'next/server';
import type { Firestore, Timestamp } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

function tsToISO(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
   
  const versionsSnap = await db
    .collection('consentTemplates')
    .doc(id)
    .collection('versions')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const items = versionsSnap.docs.map((doc: any) => {
    const data = doc.data() ?? {};
    return {
      id: doc.id,
      version: typeof data.version === 'string' ? data.version : '',
      content: typeof data.content === 'string' ? data.content : '',
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      effectiveDate: tsToISO(data.effectiveDate),
      createdAt: tsToISO(data.createdAt),
      createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
      changeNote: typeof data.changeNote === 'string' ? data.changeNote : '',
    };
  });

  return NextResponse.json({ items });
}
