import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as UnknownRecord;
  const partnerId = asString(body.partnerId).trim();
  if (!partnerId) {
    return NextResponse.json({ ok: false, error: 'partnerId is required' }, { status: 400 });
  }

  const db = getAdminDb();
  const [publicSnap, privateSnap] = await Promise.all([
    db.collection('delivery_partners').doc(partnerId).get(),
    db.collection('admin_delivery_partner_integrations').doc(partnerId).get(),
  ]);

  if (!publicSnap.exists) {
    return NextResponse.json({ ok: false, error: 'partner not found' }, { status: 404 });
  }

  const publicConfig = (publicSnap.data() ?? {}) as UnknownRecord;
  const privateConfig = (privateSnap.data() ?? {}) as UnknownRecord;
  const baseUrl = asString(privateConfig.baseUrl).trim();
  const apiKey = asString(privateConfig.apiKey).trim();
  const apiSecret = asString(privateConfig.apiSecret).trim();
  const healthcheckPath = asString(privateConfig.healthcheckPath).trim();
  const integrationMode = asString(publicConfig.integrationMode, 'manual_ops');

  const checks = {
    hasBaseUrl: Boolean(baseUrl),
    hasApiKey: Boolean(apiKey),
    hasApiSecret: Boolean(apiSecret),
    hasHealthcheckPath: Boolean(healthcheckPath),
  };

  const connectionStatus =
    integrationMode === 'manual_ops'
      ? 'connected'
      : checks.hasBaseUrl && checks.hasApiKey
        ? 'connected'
        : checks.hasBaseUrl || checks.hasApiKey || checks.hasApiSecret
          ? 'degraded'
          : 'error';

  const message =
    integrationMode === 'manual_ops'
      ? '수동 운영형 파트너입니다. 대시보드 기반 dispatch로 연결됩니다.'
      : connectionStatus === 'connected'
        ? '기본 연동 정보가 준비되어 있습니다. 실제 API ping은 다음 단계에서 붙이면 됩니다.'
        : connectionStatus === 'degraded'
          ? '일부 연동 정보만 등록되어 있습니다. API 키 또는 베이스 URL을 확인해 주세요.'
          : '연동 정보가 비어 있습니다.';

  await db.collection('delivery_partners').doc(partnerId).set(
    {
      connectionStatus,
      lastConnectionCheckedAt: new Date(),
      lastConnectionMessage: message,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  await db.collection('admin_delivery_partner_integrations').doc(partnerId).set(
    {
      lastTestedAt: new Date(),
      statusMessage: message,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  return NextResponse.json({
    ok: connectionStatus !== 'error',
    partnerId,
    integrationMode,
    connectionStatus,
    message,
    checks,
  });
}
