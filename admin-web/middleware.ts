import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

/**
 * Admin authentication middleware for Next.js.
 * 
 * Protects all admin routes and API routes by verifying the admin_session cookie.
 * - Admin routes (/(admin)/*): redirect to /login if not authenticated
 * - API routes (/api/*): return 401 JSON if not authenticated
 * - Public routes (/login, /_next/*, /favicon.ico): skip auth check
 */
const PUBLIC_PATHS = ['/login', '/api/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some(path => pathname.startsWith(path)) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('admin_session')?.value;

  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    getAdminApp();
    const decodedClaims = await getAuth().verifySessionCookie(sessionCookie, true);

    const allowedUids = process.env.ADMIN_UID?.split(',').map(uid => uid.trim()) || [];
    const isAdmin = decodedClaims.admin === true || allowedUids.includes(decodedClaims.uid);

    if (!isAdmin) {
      throw new Error('Not admin');
    }

    return NextResponse.next();
  } catch (error) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

/**
 * Matcher configuration to exclude static assets and optimize middleware execution.
 * Runs on all routes except:
 * - _next/static (static files)
 * - _next/image (image optimization files)
 * - favicon.ico
 * - Static assets with extensions: .png, .jpg, .jpeg, .svg, .gif, .ico, .webp
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico.*\\.(png|jpg|jpeg|svg|gif|ico|webp)$).*)'],
};
