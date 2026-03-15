/**
 * Admin auth — validates admin_token cookie against ADMIN_UID env var.
 * Cookie is set by /api/login after Firebase ID token verification.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token || !process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) {
    redirect('/login');
  }
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  return !!token && !!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET;
}
