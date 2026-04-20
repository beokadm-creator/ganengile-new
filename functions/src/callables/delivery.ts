import * as functions from 'firebase-functions';
import { db, admin } from '../shared-admin';
import type { DeliveryRequest } from '../types';

type DeliveryDoc = {
  status?: string;
  requestId?: string;
  gllerId?: string;
  gillerId?: string;
  requesterConfirmedAt?: unknown;
  tracking?: { events?: unknown[]; progress?: number };
  [key: string]: unknown;
};

export const confirmDeliveryReceipt = functions.https.onCall(
  async (data: { deliveryId: string; photoUrl?: string; notes?: string; location?: Record<string, unknown> }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const requesterId = context.auth.uid;
    const { deliveryId, photoUrl, notes, location } = data;
    
    if (!deliveryId) {
      throw new functions.https.HttpsError('invalid-argument', 'deliveryId is required');
    }
    
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    
    return db.runTransaction(async (tx) => {
      const deliveryDoc = await tx.get(deliveryRef);
      if (!deliveryDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Delivery not found');
      }
      
      const delivery = deliveryDoc.data() as DeliveryDoc;
      if (delivery.status === 'cancelled') {
        throw new functions.https.HttpsError('failed-precondition', 'Cancelled delivery cannot be confirmed');
      }
      
      const requestId = delivery.requestId;
      if (!requestId) {
        throw new functions.https.HttpsError('failed-precondition', 'Request info missing');
      }
      
      const requestRef = db.collection('requests').doc(requestId);
      const requestDoc = await tx.get(requestRef);
      if (!requestDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }
      const request = requestDoc.data() as DeliveryRequest;
      
      const ownerId = request.requesterId ?? delivery.gllerId;
      if (ownerId && ownerId !== requesterId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized');
      }
      
      const confirmableStatuses = new Set(['delivered', 'at_locker', 'completed']);
      if (!delivery.status || !confirmableStatuses.has(delivery.status)) {
        throw new functions.https.HttpsError('failed-precondition', 'Not in confirmable status');
      }
      
      if (delivery.requesterConfirmedAt) {
        return { success: true, message: 'Already confirmed', alreadyCompleted: true };
      }
      
      const settlementRef = db.collection('settlements').doc(requestId);
      const settlementSnap = await tx.get(settlementRef);
      if (settlementSnap.exists && settlementSnap.data()?.status === 'completed') {
        return { success: true, alreadyCompleted: true };
      }
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      if (!settlementSnap.exists) {
        tx.set(settlementRef, {
          requestId,
          deliveryId,
          gillerId: delivery.gillerId,
          requesterId,
          status: 'processing',
          createdAt: now,
          updatedAt: now,
        });
      } else {
        tx.update(settlementRef, {
          status: 'processing',
          updatedAt: now,
        });
      }
      
      const trackingEvents = delivery.tracking?.events ?? [];
      tx.update(deliveryRef, {
        status: 'completed',
        requesterConfirmedAt: now,
        requesterConfirmedBy: requesterId,
        confirmationPhotos: photoUrl ? [photoUrl] : [],
        confirmationNote: notes || null,
        'tracking.events': [
          ...trackingEvents,
          {
            type: 'confirmed_by_requester',
            timestamp: new Date().toISOString(),
            description: '수령자가 배송을 확인했습니다',
            actorId: requesterId,
            location: location || null,
          }
        ],
        'tracking.progress': 100,
        updatedAt: now,
      });
      
      tx.update(requestRef, {
        status: 'completed',
        requesterConfirmedAt: now,
        requesterConfirmedBy: requesterId,
        updatedAt: now,
      });
      
      return { success: true, alreadyCompleted: false };
    });
  }
);
