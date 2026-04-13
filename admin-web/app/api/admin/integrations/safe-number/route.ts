import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const PRIVATE_DOC_PATH = ['admin_settings', 'safe_number'] as const;
const PUBLIC_DOC_PATH = ['config_integrations', 'safe_number'] as const;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function defaultPayload() {
  return {
    enabled: true,
    testMode: true,
    allowTestBypass: true,
    provider: '050-sejong',
    apiBaseUrl: '',
    apiKey: '',
    secretKey: '',
    statusMessage: '안심번호 서비스 점검 중입니다.',
  };
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).get();

  if (!snap.exists) {
    return NextResponse.json({ item: defaultPayload() });
  }

  return NextResponse.json({
    item: {
      ...defaultPayload(),
      ...(snap.data() ?? {}),
    },
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const fallback = defaultPayload();

  const privatePayload = {
    enabled: Boolean(body.enabled ?? fallback.enabled),
    testMode: Boolean(body.testMode ?? fallback.testMode),
    allowTestBypass: Boolean(body.allowTestBypass ?? fallback.allowTestBypass),
    provider: asString(body.provider, fallback.provider).trim(),
    apiBaseUrl: asString(body.apiBaseUrl).trim(),
    apiKey: asString(body.apiKey).trim(),
    secretKey: asString(body.secretKey).trim(),
    statusMessage: asString(body.statusMessage, fallback.statusMessage).trim(),
    updatedAt: new Date(),
  };

  const liveReady = Boolean(
    privatePayload.enabled &&
      privatePayload.apiBaseUrl &&
      privatePayload.apiKey
  );

  const publicPayload = {
    enabled: privatePayload.enabled,
    testMode: privatePayload.testMode,
    allowTestBypass: privatePayload.allowTestBypass,
    provider: privatePayload.provider,
    liveReady,
    statusMessage: privatePayload.statusMessage,
    updatedAt: new Date(),
  };

  const db = getAdminDb();
  await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).set(privatePayload, { merge: true });
  await db.collection(PUBLIC_DOC_PATH[0]).doc(PUBLIC_DOC_PATH[1]).set(publicPayload, { merge: true });

  return NextResponse.json({ ok: true, item: privatePayload });
}
