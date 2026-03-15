import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();
  if (!idToken) return NextResponse.json({ error: '토큰이 없습니다.' }, { status: 400 });

  try {
    // Firebase Admin으로 ID 토큰 검증
    getAdminApp();
    const decoded = await getAuth().verifyIdToken(idToken);

    // 허용된 관리자 UID 확인
    const allowedUid = process.env.ADMIN_UID;
    if (!allowedUid || decoded.uid !== allowedUid) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    // 검증 성공 — 세션 쿠키에 UID 저장
    const res = NextResponse.json({ ok: true });
    res.cookies.set('admin_token', decoded.uid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8시간
      path: '/',
    });
    return res;
  } catch (err: any) {
    console.error('Login error:', err.message);
    return NextResponse.json({ error: '인증 실패: 유효하지 않은 토큰입니다.' }, { status: 401 });
  }
}
