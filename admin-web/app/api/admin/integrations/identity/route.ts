import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const DOC_PATH = ['admin_settings', 'identity_verification'] as const;

function defaultPayload() {
  return {
    pass: {
      enabled: true,
      startUrl: '',
      callbackUrl: '',
      clientId: '',
      apiKey: '',
      webhookSecret: '',
      signatureParam: 'signature',
      signatureHeader: 'x-signature',
    },
    kakao: {
      enabled: true,
      startUrl: '',
      callbackUrl: '',
      clientId: '',
      apiKey: '',
      webhookSecret: '',
      signatureParam: 'signature',
      signatureHeader: 'x-signature',
    },
  };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const ref = db.collection(DOC_PATH[0]).doc(DOC_PATH[1]);
  const snap = await ref.get();

  if (!snap.exists) {
    return NextResponse.json({ item: defaultPayload() });
  }

  const data = snap.data() || {};
  return NextResponse.json({
    item: {
      ...defaultPayload(),
      ...data,
      pass: {
        ...defaultPayload().pass,
        ...(data.pass || {}),
      },
      kakao: {
        ...defaultPayload().kakao,
        ...(data.kakao || {}),
      },
    },
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const payload = {
    pass: {
      enabled: Boolean(body?.pass?.enabled ?? true),
      startUrl: String(body?.pass?.startUrl || '').trim(),
      callbackUrl: String(body?.pass?.callbackUrl || '').trim(),
      clientId: String(body?.pass?.clientId || '').trim(),
      apiKey: String(body?.pass?.apiKey || '').trim(),
      webhookSecret: String(body?.pass?.webhookSecret || '').trim(),
      signatureParam: String(body?.pass?.signatureParam || 'signature').trim(),
      signatureHeader: String(body?.pass?.signatureHeader || 'x-signature').trim().toLowerCase(),
    },
    kakao: {
      enabled: Boolean(body?.kakao?.enabled ?? true),
      startUrl: String(body?.kakao?.startUrl || '').trim(),
      callbackUrl: String(body?.kakao?.callbackUrl || '').trim(),
      clientId: String(body?.kakao?.clientId || '').trim(),
      apiKey: String(body?.kakao?.apiKey || '').trim(),
      webhookSecret: String(body?.kakao?.webhookSecret || '').trim(),
      signatureParam: String(body?.kakao?.signatureParam || 'signature').trim(),
      signatureHeader: String(body?.kakao?.signatureHeader || 'x-signature').trim().toLowerCase(),
    },
    updatedAt: new Date(),
  };

  const db = getAdminDb();
  const ref = db.collection(DOC_PATH[0]).doc(DOC_PATH[1]);
  await ref.set(payload, { merge: true });

  return NextResponse.json({ ok: true, item: payload });
}
