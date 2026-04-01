import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const PRIVATE_DOC_PATH = ['admin_settings', 'identity_verification'] as const;
const PUBLIC_DOC_PATH = ['config_integrations', 'identity'] as const;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function defaultPayload() {
  return {
    enabled: true,
    testMode: true,
    allowTestBypass: true,
    requiredForGillerUpgrade: true,
    pass: {
      enabled: true,
      label: 'PASS',
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
      label: 'Kakao',
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

function sanitizeProvider(provider: Record<string, unknown> | undefined, fallback: ReturnType<typeof defaultPayload>['pass']) {
  return {
    enabled: Boolean(provider?.enabled ?? fallback.enabled),
    label: asString(provider?.label, fallback.label).trim() || fallback.label,
    startUrl: asString(provider?.startUrl).trim(),
    callbackUrl: asString(provider?.callbackUrl).trim(),
    clientId: asString(provider?.clientId).trim(),
    apiKey: asString(provider?.apiKey).trim(),
    webhookSecret: asString(provider?.webhookSecret).trim(),
    signatureParam: asString(provider?.signatureParam, fallback.signatureParam).trim(),
    signatureHeader: asString(provider?.signatureHeader, fallback.signatureHeader).trim().toLowerCase(),
  };
}

function computeProviderReady(provider: { enabled: boolean; startUrl: string; clientId: string; apiKey: string }) {
  if (!provider.enabled) {
    return false;
  }
  return Boolean(provider.startUrl && (provider.clientId || provider.apiKey));
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

  const data = snap.data() ?? {};
  return NextResponse.json({
    item: {
      ...defaultPayload(),
      ...data,
      pass: sanitizeProvider(
        data.pass as Record<string, unknown> | undefined,
        defaultPayload().pass
      ),
      kakao: sanitizeProvider(
        data.kakao as Record<string, unknown> | undefined,
        defaultPayload().kakao
      ),
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
    requiredForGillerUpgrade: Boolean(
      body.requiredForGillerUpgrade ?? fallback.requiredForGillerUpgrade
    ),
    pass: sanitizeProvider(body.pass as Record<string, unknown> | undefined, fallback.pass),
    kakao: sanitizeProvider(body.kakao as Record<string, unknown> | undefined, fallback.kakao),
    updatedAt: new Date(),
  };

  const passReady = computeProviderReady(privatePayload.pass);
  const kakaoReady = computeProviderReady(privatePayload.kakao);

  const publicPayload = {
    enabled: privatePayload.enabled,
    testMode: privatePayload.testMode,
    allowTestBypass: privatePayload.allowTestBypass,
    requiredForGillerUpgrade: privatePayload.requiredForGillerUpgrade,
    liveReady: passReady || kakaoReady,
    providers: {
      pass: {
        enabled: privatePayload.pass.enabled,
        label: privatePayload.pass.label,
        liveReady: passReady,
        startUrl: privatePayload.pass.startUrl,
        callbackUrl: privatePayload.pass.callbackUrl,
      },
      kakao: {
        enabled: privatePayload.kakao.enabled,
        label: privatePayload.kakao.label,
        liveReady: kakaoReady,
        startUrl: privatePayload.kakao.startUrl,
        callbackUrl: privatePayload.kakao.callbackUrl,
      },
    },
    updatedAt: new Date(),
  };

  const db = getAdminDb();
  await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).set(privatePayload, { merge: true });
  await db.collection(PUBLIC_DOC_PATH[0]).doc(PUBLIC_DOC_PATH[1]).set(publicPayload, { merge: true });

  return NextResponse.json({
    ok: true,
    item: privatePayload,
  });
}
