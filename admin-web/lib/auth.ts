/**
 * Admin auth — validates admin_session cookie using Firebase Admin SDK.
 * Cookie is set by /api/login after Firebase ID token verification.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminApp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export async function requireAdmin() {
  const authStatus = await isAdmin();
  if (!authStatus) {
    redirect('/login');
  }
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session')?.value;
  if (!sessionCookie) return false;

  try {
    getAdminApp();
    const decodedClaims = await getAuth().verifySessionCookie(sessionCookie, true);
    
    // Check if the custom claim is true or if UID matches any in the allowed list
    const allowedUids = process.env.ADMIN_UID?.split(',').map(uid => uid.trim()) || [];
    if (decodedClaims.admin === true || allowedUids.includes(decodedClaims.uid)) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}
