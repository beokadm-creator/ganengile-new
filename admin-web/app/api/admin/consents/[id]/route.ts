import { NextRequest, NextResponse } from 'next/server';
import type { Firestore, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
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
  const db: Firestore = getAdminDb();
  const doc = await db.collection('consentTemplates').doc(id).get();

  if (!doc.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = doc.data() ?? {};
  return NextResponse.json({
    item: {
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
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body: unknown = await req.json();
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const db: Firestore = getAdminDb();
  const docRef = db.collection('consentTemplates').doc(id);
  const existing = await docRef.get();

  if (!existing.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const existingData = existing.data();
  const previousVersion = typeof existingData.version === 'string' ? existingData.version : '0.0.0';
  const newVersion = typeof record.version === 'string' ? record.version : previousVersion;

  if (previousVersion !== newVersion) {
    await docRef.collection('versions').doc(previousVersion).set({
      version: previousVersion,
      content: typeof existingData.content === 'string' ? existingData.content : '',
      title: typeof existingData.title === 'string' ? existingData.title : '',
      description: typeof existingData.description === 'string' ? existingData.description : '',
      effectiveDate: existingData.effectiveDate ?? null,
      createdAt: existingData.createdAt ?? new Date(),
      createdBy: 'admin',
      changeNote: typeof record.changeNote === 'string'
        ? record.changeNote
        : `${previousVersion} \u2192 ${newVersion}`,
    });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof record.title === 'string') updates.title = record.title;
  if (typeof record.description === 'string') updates.description = record.description;
  if (typeof record.content === 'string') updates.content = record.content;
  if (typeof record.version === 'string') updates.version = record.version;
  if (record.category === 'required' || record.category === 'optional') updates.category = record.category;
  if (typeof record.sortOrder === 'number') updates.sortOrder = record.sortOrder;
  if (typeof record.effectiveDate === 'string') updates.effectiveDate = record.effectiveDate;

  await docRef.update(updates);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db: Firestore = getAdminDb();
  await db.collection('consentTemplates').doc(id).delete();

  return NextResponse.json({ ok: true });
}
