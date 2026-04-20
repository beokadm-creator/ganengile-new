/**
 * Request Service
 * Re-exports everything from the new modular request services
 */

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

import { getDeliveryByRequestId } from './delivery-service';

export * from './request';

export async function updateRequestLockerId(requestId: string, lockerId: string): Promise<void> {
  const requestRef = doc(db, 'requests', requestId);
  await updateDoc(requestRef, {
    lockerId,
    pickupLockerId: lockerId,
    updatedAt: serverTimestamp(),
  });

  const delivery = await getDeliveryByRequestId(requestId);
  if (delivery && delivery.deliveryId) {
    const deliveryRef = doc(db, 'deliveries', delivery.deliveryId);
    await updateDoc(deliveryRef, {
      lockerId,
      pickupLockerId: lockerId,
      updatedAt: serverTimestamp(),
    });
  }
}