import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const DOC_PATH = ['admin_settings', 'payment'] as const;
const PUBLIC_DOC_PATH = ['config_integrations', 'payment'] as const;

function defaultPayload() {
  return {
    testMode: true, // 기본값: 테스트 모드 ON
    tossClientKey: '',
  };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const snap = await db.collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();

  if (!snap.exists) {
    return NextResponse.json({ item: defaultPayload() });
  }

  const data = snap.data() || {};
  return NextResponse.json({
    item: { ...defaultPayload(), ...data },
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const testMode = Boolean(body?.testMode ?? true);

  const payload = {
    testMode,
    tossClientKey: String(body?.tossClientKey || '').trim(),
    updatedAt: new Date(),
  };

  const db = getAdminDb();

  await db.collection(DOC_PATH[0]).doc(DOC_PATH[1]).set(payload, { merge: true });

  // 앱에서 읽을 공개 설정 동기화 (testMode만, 키는 제외)
  await db.collection(PUBLIC_DOC_PATH[0]).doc(PUBLIC_DOC_PATH[1]).set(
    { testMode, updatedAt: new Date() },
    { merge: true }
  );

  return NextResponse.json({ ok: true, item: payload });
}
