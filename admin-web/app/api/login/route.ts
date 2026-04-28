import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const idToken = typeof body.idToken === 'string' ? body.idToken : undefined;
  if (!idToken) return NextResponse.json({ error: '토큰이 없습니다.' }, { status: 400 });

  try {
    // Firebase Admin으로 ID 토큰 검증
    const app = getAdminApp();
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);

    // 허용된 관리자 UID 확인 (콤마로 구분된 여러 관리자 지원)
    const allowedUids = process.env.ADMIN_UID?.split(',').map(uid => uid.trim()) || [];
    if (allowedUids.length === 0 || !allowedUids.includes(decoded.uid)) {
      if (decoded.admin) {
        // 권한 박탈자: 커스텀 클레임 영구 회수
        await auth.setCustomUserClaims(decoded.uid, { admin: false });
      }
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    // Set custom claim admin: true if not set
    if (!decoded.admin) {
      await auth.setCustomUserClaims(decoded.uid, { admin: true });
    }

    // 검증 성공 — 세션 쿠키 발급
    const expiresIn = 60 * 60 * 8 * 1000; // 8시간
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true });
    res.cookies.set('admin_session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000,
      path: '/',
    });
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Login error:', msg);
    return NextResponse.json({ error: '인증 실패: 유효하지 않은 토큰입니다.' }, { status: 401 });
  }
}
