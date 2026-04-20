import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { fareCacheScheduler } from '../scheduled/fare-cache-scheduler';

/**
 * Callable Function: Manual Fare Cache Sync (Admin only)
 */
export const triggerFareCacheSync = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data() as { role?: unknown } | undefined;
  const role = typeof userData?.role === 'string' ? userData.role : undefined;
  if (role !== 'admin' && role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin role required.');
  }
  try {
    const result = await fareCacheScheduler();
    return { success: true, result };
  } catch (error) {
    console.error('Manual fare cache sync error:', error);
    throw new functions.https.HttpsError('internal', 'Fare cache sync failed.');
  }
});
