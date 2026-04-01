import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    amount?: number;
    orderId?: string;
    orderName?: string;
  };

  const db = getAdminDb();
  const privateSnap = await db.collection('admin_settings').doc('payment').get();
  const publicSnap = await db.collection('config_integrations').doc('payment').get();
  const privateConfig = privateSnap.exists ? privateSnap.data() : {};
  const publicConfig = publicSnap.exists ? publicSnap.data() : {};

  const provider =
    typeof privateConfig?.provider === 'string' ? privateConfig.provider : 'tosspayments';
  const liveReady = Boolean(publicConfig?.liveReady ?? false);
  const testMode = Boolean(publicConfig?.testMode ?? true);

  if (testMode || !liveReady) {
    return NextResponse.json({
      ok: true,
      mode: 'test',
      provider,
      paymentKeyReady: false,
      paymentId: `test_${body.orderId ?? 'order'}_${Date.now()}`,
      amount: Number(body.amount ?? 0),
      message: 'PG 키가 준비되기 전이라 테스트 결제 성공 응답을 반환했습니다.',
    });
  }

  return NextResponse.json({
    ok: true,
    mode: 'live-placeholder',
    provider,
    paymentKeyReady: true,
    orderId: body.orderId ?? null,
    orderName: body.orderName ?? null,
    amount: Number(body.amount ?? 0),
    message:
      '실서비스 confirm/webhook 자리는 준비되어 있습니다. 실제 PG 승인 로직은 이 서버 경로에서 공급자 API로 연결하면 됩니다.',
  });
}
