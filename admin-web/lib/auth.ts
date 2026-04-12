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
    
    // Check if the custom claim is true or if UID matches
    const allowedUid = process.env.ADMIN_UID;
    if (decodedClaims.admin === true || (allowedUid && decodedClaims.uid === allowedUid)) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}
