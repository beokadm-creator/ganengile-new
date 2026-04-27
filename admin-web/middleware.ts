import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 인증이 필요 없는 공개 경로 설정
  const publicPaths = ['/login', '/_next/', '/favicon.ico', '/api/'];

  // 현재 요청 경로가 공개 경로에 포함되는지 확인
  const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  // 공개 경로는 바로 통과
  if (isPublicPath) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session');

  // 세션 쿠키가 없으면 로그인 페이지로 리다이렉트
  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 간단한 존재 여부만 체크 (실제 검증은 API 라우트나 서버 컴포넌트에서 수행)
  return NextResponse.next();
}

/**
 * Matcher configuration to exclude static assets and optimize middleware execution.
 * Runs on all routes except public paths.
 */
export const config = {
  matcher: ['/((?!_next/|favicon.ico|api/|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)'],
};
