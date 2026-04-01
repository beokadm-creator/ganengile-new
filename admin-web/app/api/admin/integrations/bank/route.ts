import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const PRIVATE_DOC_PATH = ['admin_settings', 'bank_verification'] as const;
const PUBLIC_DOC_PATH = ['config_integrations', 'bank'] as const;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function defaultPayload() {
  return {
    enabled: true,
    testMode: true,
    allowTestBypass: true,
    provider: 'manual_review',
    verificationMode: 'manual_review',
    apiBaseUrl: '',
    clientId: '',
    apiKey: '',
    secretKey: '',
    webhookSecret: '',
    requiresAccountHolderMatch: true,
    manualReviewFallback: true,
    statusMessage: 'API 준비 전에는 테스트 모드 또는 운영 수동 검토로 계좌 인증을 대신합니다.',
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
    verificationMode: asString(body.verificationMode, fallback.verificationMode).trim(),
    apiBaseUrl: asString(body.apiBaseUrl).trim(),
    clientId: asString(body.clientId).trim(),
    apiKey: asString(body.apiKey).trim(),
    secretKey: asString(body.secretKey).trim(),
    webhookSecret: asString(body.webhookSecret).trim(),
    requiresAccountHolderMatch: Boolean(
      body.requiresAccountHolderMatch ?? fallback.requiresAccountHolderMatch
    ),
    manualReviewFallback: Boolean(
      body.manualReviewFallback ?? fallback.manualReviewFallback
    ),
    statusMessage: asString(body.statusMessage, fallback.statusMessage).trim(),
    updatedAt: new Date(),
  };

  const liveReady = Boolean(
    privatePayload.enabled &&
      privatePayload.apiBaseUrl &&
      (privatePayload.apiKey || (privatePayload.clientId && privatePayload.secretKey))
  );

  const publicPayload = {
    enabled: privatePayload.enabled,
    testMode: privatePayload.testMode,
    allowTestBypass: privatePayload.allowTestBypass,
    provider: privatePayload.provider,
    verificationMode: privatePayload.verificationMode,
    liveReady,
    requiresAccountHolderMatch: privatePayload.requiresAccountHolderMatch,
    manualReviewFallback: privatePayload.manualReviewFallback,
    statusMessage: privatePayload.statusMessage,
    updatedAt: new Date(),
  };

  const db = getAdminDb();
  await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).set(privatePayload, { merge: true });
  await db.collection(PUBLIC_DOC_PATH[0]).doc(PUBLIC_DOC_PATH[1]).set(publicPayload, { merge: true });

  return NextResponse.json({ ok: true, item: privatePayload });
}
