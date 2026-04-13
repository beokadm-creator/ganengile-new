/**
 * Request Service
 * Re-exports everything from the new modular request services
 */

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export * from './request';

export async function updateRequestLockerId(requestId: string, lockerId: string): Promise<void> {
  const requestRef = doc(db, 'requests', requestId);
  await updateDoc(requestRef, {
    lockerId,
    updatedAt: serverTimestamp(),
  });
}