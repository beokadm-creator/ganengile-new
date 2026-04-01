import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const PRIVATE_DOC_PATH = ['admin_settings', 'payment'] as const;
const PUBLIC_DOC_PATH = ['config_integrations', 'payment'] as const;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function defaultPayload() {
  return {
    enabled: true,
    testMode: true,
    allowTestBypass: true,
    provider: 'tosspayments',
    clientKey: '',
    secretKey: '',
    successUrl: '',
    failUrl: '',
    webhookSecret: '',
    escrowEnabled: true,
    bankVerificationRequired: true,
    manualSettlementReview: true,
    statusMessage: 'PG 키가 준비되기 전에는 테스트 모드로 보증금 결제를 우회합니다.',
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
    clientKey: asString(body.clientKey).trim(),
    secretKey: asString(body.secretKey).trim(),
    successUrl: asString(body.successUrl).trim(),
    failUrl: asString(body.failUrl).trim(),
    webhookSecret: asString(body.webhookSecret).trim(),
    escrowEnabled: Boolean(body.escrowEnabled ?? fallback.escrowEnabled),
    bankVerificationRequired: Boolean(
      body.bankVerificationRequired ?? fallback.bankVerificationRequired
    ),
    manualSettlementReview: Boolean(
      body.manualSettlementReview ?? fallback.manualSettlementReview
    ),
    statusMessage: asString(body.statusMessage, fallback.statusMessage).trim(),
    updatedAt: new Date(),
  };

  const liveReady = Boolean(
    privatePayload.enabled && privatePayload.clientKey && privatePayload.secretKey
  );

  const publicPayload = {
    enabled: privatePayload.enabled,
    testMode: privatePayload.testMode,
    allowTestBypass: privatePayload.allowTestBypass,
    provider: privatePayload.provider,
    liveReady,
    clientKey: privatePayload.clientKey,
    bankVerificationRequired: privatePayload.bankVerificationRequired,
    manualSettlementReview: privatePayload.manualSettlementReview,
    escrowEnabled: privatePayload.escrowEnabled,
    statusMessage: privatePayload.statusMessage,
    updatedAt: new Date(),
  };

  const db = getAdminDb();
  await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).set(privatePayload, { merge: true });
  await db.collection(PUBLIC_DOC_PATH[0]).doc(PUBLIC_DOC_PATH[1]).set(publicPayload, { merge: true });

  return NextResponse.json({ ok: true, item: privatePayload });
}
