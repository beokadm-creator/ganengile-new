import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
  };

  const db = getAdminDb();
  const privateSnap = await db.collection('admin_settings').doc('bank_verification').get();
  const publicSnap = await db.collection('config_integrations').doc('bank').get();
  const privateConfig = privateSnap.exists ? privateSnap.data() : {};
  const publicConfig = publicSnap.exists ? publicSnap.data() : {};

  const verificationMode =
    typeof privateConfig?.verificationMode === 'string'
      ? privateConfig.verificationMode
      : 'manual_review';
  const provider =
    typeof privateConfig?.provider === 'string' ? privateConfig.provider : 'manual_review';
  const liveReady = Boolean(publicConfig?.liveReady ?? false);
  const testMode = Boolean(publicConfig?.testMode ?? true);

  if (testMode || !liveReady) {
    return NextResponse.json({
      ok: true,
      mode: 'test',
      provider,
      verificationMode,
      accountHolderMatch: true,
      result: 'test_bypass',
      message: '실서비스 키가 준비되기 전이라 테스트 또는 수동 검토 응답을 반환했습니다.',
    });
  }

  return NextResponse.json({
    ok: true,
    mode: 'live-placeholder',
    provider,
    verificationMode,
    accountHolderMatch:
      Boolean(body.accountHolder) && Boolean(body.bankName) && Boolean(body.accountNumber),
    result: 'pending_provider_call',
    message:
      '실서비스 호출 자리는 준비되어 있습니다. 실제 계좌 인증 API 호출은 여기에서 공급자별 SDK 또는 REST로 연결하면 됩니다.',
  });
}
