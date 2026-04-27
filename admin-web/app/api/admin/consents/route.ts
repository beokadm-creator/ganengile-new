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

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

   
  const snap = await db.collection('consentTemplates').orderBy('sortOrder', 'asc').get();

  const items = snap.docs.map((doc: any) => {
    const data = doc.data() ?? {};
    return {
      id: doc.id,
      key: typeof data.key === 'string' ? data.key : doc.id,
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      content: typeof data.content === 'string' ? data.content : '',
      version: typeof data.version === 'string' ? data.version : '1.0.0',
      category: data.category === 'optional' ? 'optional' : 'required',
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
      effectiveDate: tsToISO(data.effectiveDate),
      createdAt: tsToISO(data.createdAt),
      updatedAt: tsToISO(data.updatedAt),
    };
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const key = typeof record.key === 'string' ? record.key : '';
  const title = typeof record.title === 'string' ? record.title : '';
  const description = typeof record.description === 'string' ? record.description : '';
  const content = typeof record.content === 'string' ? record.content : '';
  const version = typeof record.version === 'string' ? record.version : '1.0.0';
  const category = record.category === 'optional' ? 'optional' : 'required';
  const sortOrder = typeof record.sortOrder === 'number' ? record.sortOrder : 0;
  const effectiveDate = typeof record.effectiveDate === 'string' ? record.effectiveDate : '';
  const changeNote = typeof record.changeNote === 'string' ? record.changeNote : '';

  if (!key || !title || !content) {
    return NextResponse.json({ error: 'key, title, content are required' }, { status: 400 });
  }

   
  const docRef = db.collection('consentTemplates').doc(key);
  const now = new Date();

  const existing = await docRef.get();
  if (existing.exists) {
    const prev = existing.data() ?? {};
    const prevVersion = typeof prev.version === 'string' ? prev.version : '0.0.0';

    if (prevVersion !== version) {
      await docRef.collection('versions').doc(prevVersion).set({
        version: prevVersion,
        content: typeof prev.content === 'string' ? prev.content : '',
        title: typeof prev.title === 'string' ? prev.title : '',
        description: typeof prev.description === 'string' ? prev.description : '',
        effectiveDate: prev.effectiveDate ?? null,
        createdAt: prev.createdAt ?? now,
        createdBy: 'admin',
        changeNote: changeNote || `${prevVersion} \u2192 ${version}`,
      });
    }
  }

  const templateData: Record<string, unknown> = {
    id: key,
    key,
    title,
    description,
    content,
    version,
    category,
    sortOrder,
    effectiveDate: effectiveDate || now.toISOString().split('T')[0],
    updatedAt: now,
  };

  if (!existing.exists) {
    templateData.createdAt = now;
  }

  await docRef.set(templateData, { merge: true });

  return NextResponse.json({ ok: true, id: key });
}
