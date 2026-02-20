/**
 * Delivery Service
 * Handles delivery flow: accept → pickup → in_transit → arrived → completed → rating
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { uploadPickupPhoto, uploadDeliveryPhoto } from './storage-service';
import type { DeliveryStatus, DeliveryRequest } from '../types/delivery';

/**
 * Pickup verification data
 */
export interface PickupVerificationData {
  deliveryId: string;
  gillerId: string;
  qrCodeData?: string;
  verificationCode: string; // 4-digit code
  photoUri: string; // Photo as base64 or file URI
  location: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Delivery completion data
 */
export interface DeliveryCompletionData {
  deliveryId: string;
  gillerId: string;
  verificationCode: string; // Recipient's 6-digit code
  photoUri?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

/**
 * Giller accepts a delivery request
 * Updates request status from 'matched' to 'accepted'
 */
export async function gillerAcceptRequest(
  requestId: string,
  gillerId: string
): Promise<{ success: boolean; message: string; deliveryId?: string }> {
  try {
    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists) {
      return { success: false, message: '요청을 찾을 수 없습니다.' };
    }

    const request = requestDoc.data();

    if (request.status !== 'matched') {
      return { success: false, message: '수락할 수 없는 요청입니다.' };
    }

    // Update request status
    await updateDoc(requestRef, {
      status: 'accepted',
      matchedGillerId: gillerId,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create delivery document
    const deliveryData = {
      requestId,
      gllerId: request.gllerId,
      gillerId,
      pickupStation: request.pickupStation,
      deliveryStation: request.deliveryStation,
      deliveryType: request.deliveryType || 'standard',
      packageInfo: request.packageInfo,
      fee: request.fee,
      recipientInfo: {
        name: request.recipientName,
        phone: request.recipientPhone,
        verificationCode: request.recipientVerificationCode,
      },
      status: 'accepted' as DeliveryStatus,
      tracking: {
        events: [
          {
            type: 'accepted',
            timestamp: new Date(),
            description: '길러가 배송을 수락했습니다',
            actorId: gillerId,
          },
        ],
        progress: 20,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const deliveryRef = await addDoc(collection(db, 'deliveries'), deliveryData);

    return {
      success: true,
      message: '배송을 수락했습니다.',
      deliveryId: deliveryRef.id,
    };
  } catch (error) {
    console.error('Error accepting request:', error);
    return { success: false, message: '수락에 실패했습니다.' };
  }
}

/**
 * Verify pickup (QR code + 4-digit code + photo)
 * Updates delivery status from 'accepted' to 'in_transit'
 */
export async function verifyPickup(data: PickupVerificationData): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', data.deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();

    if (delivery.status !== 'accepted') {
      return { success: false, message: '픽업 인증을 할 수 없는 상태입니다.' };
    }

    // Verify 4-digit code (would be generated when request is created)
    // For now, accept any 4-digit code
    if (data.verificationCode?.length !== 4) {
      return { success: false, message: '인증 코드가 올바르지 않습니다.' };
    }

    // Upload photo
    let photoUrl = '';
    if (data.photoUri) {
      try {
        photoUrl = await uploadPickupPhoto(data.deliveryId, data.photoUri);
      } catch (error: any) {
        console.error('Error uploading photo:', error);
        return { success: false, message: error.message || '사진 업로드에 실패했습니다.' };
      }
    }

    // Update delivery status
    await updateDoc(deliveryRef, {
      status: 'in_transit' as DeliveryStatus,
      'tracking.actualPickupTime': serverTimestamp(),
      pickupPhotos: [photoUrl],
      pickupVerificationCode: data.verificationCode,
      pickupLocation: data.location,
      'tracking.events': [
        ...delivery.tracking.events,
        {
          type: 'picked_up',
          timestamp: new Date(),
          description: '물품을 수령했습니다',
          actorId: data.gillerId,
          location: data.location,
        },
      ],
      'tracking.progress': 50,
      updatedAt: serverTimestamp(),
    });

    // Also update request status
    if (delivery.requestId) {
      const requestRef = doc(db, 'requests', delivery.requestId);
      await updateDoc(requestRef, {
        status: 'in_transit' as DeliveryStatus,
        pickedUpAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, message: '픽업이 완료되었습니다.' };
  } catch (error) {
    console.error('Error verifying pickup:', error);
    return { success: false, message: '픽업 인증에 실패했습니다.' };
  }
}

/**
 * Update giller location during delivery
 */
export async function updateGillerLocation(
  deliveryId: string,
  location: { latitude: number; longitude: number }
): Promise<void> {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);

    await updateDoc(deliveryRef, {
      'tracking.courierLocation': {
        location,
        timestamp: new Date(),
        accuracy: 10, // meters
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating location:', error);
  }
}

/**
 * Complete delivery (verify recipient + optional photo)
 * Updates delivery status from 'arrived' to 'completed'
 */
export async function completeDelivery(data: DeliveryCompletionData): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', data.deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();

    if (delivery.status !== 'arrived' && delivery.status !== 'in_transit') {
      return { success: false, message: '배송 완료를 할 수 없는 상태입니다.' };
    }

    // Verify recipient's 6-digit code
    if (data.verificationCode !== delivery.recipientInfo.verificationCode) {
      return { success: false, message: '인증 코드가 올바르지 않습니다.' };
    }

    // Upload delivery photo if provided
    let photoUrl = '';
    if (data.photoUri) {
      try {
        photoUrl = await uploadDeliveryPhoto(data.deliveryId, data.photoUri);
      } catch (error: any) {
        console.error('Error uploading photo:', error);
        // Continue without photo (optional)
      }
    }

    // Update delivery status
    await updateDoc(deliveryRef, {
      status: 'completed' as DeliveryStatus,
      'tracking.actualDeliveryTime': serverTimestamp(),
      deliveryPhotos: photoUrl ? [photoUrl] : [],
      deliveryLocation: data.location,
      completionNote: data.notes,
      completedAt: serverTimestamp(),
      'tracking.events': [
        ...delivery.tracking.events,
        {
          type: 'delivered',
          timestamp: new Date(),
          description: '배송이 완료되었습니다',
          actorId: data.gillerId,
          location: data.location,
        },
      ],
      'tracking.progress': 100,
      updatedAt: serverTimestamp(),
    });

    // Also update request status
    if (delivery.requestId) {
      const requestRef = doc(db, 'requests', delivery.requestId);
      await updateDoc(requestRef, {
        status: 'completed' as DeliveryStatus,
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, message: '배송이 완료되었습니다.' };
  } catch (error) {
    console.error('Error completing delivery:', error);
    return { success: false, message: '배송 완료에 실패했습니다.' };
  }
}

/**
 * Mark delivery as arrived at destination station
 */
export async function markAsArrived(deliveryId: string): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();

    if (delivery.status !== 'in_transit') {
      return { success: false, message: '도착 처리를 할 수 없는 상태입니다.' };
    }

    await updateDoc(deliveryRef, {
      status: 'arrived' as DeliveryStatus,
      'tracking.events': [
        ...delivery.tracking.events,
        {
          type: 'arrived',
          timestamp: new Date(),
          description: '목적지에 도착했습니다',
        },
      ],
      'tracking.progress': 80,
      updatedAt: serverTimestamp(),
    });

    return { success: true, message: '목적지에 도착했습니다.' };
  } catch (error) {
    console.error('Error marking as arrived:', error);
    return { success: false, message: '도착 처리에 실패했습니다.' };
  }
}

/**
 * Get delivery by ID
 */
export async function getDeliveryById(deliveryId: string): Promise<DeliveryRequest | null> {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return null;
    }

    return {
      deliveryId,
      ...deliveryDoc.data(),
    } as any;
  } catch (error) {
    console.error('Error fetching delivery:', error);
    return null;
  }
}

/**
 * Get delivery by request ID
 */
export async function getDeliveryByRequestId(requestId: string): Promise<any | null> {
  try {
    const q = query(
      collection(db, 'deliveries'),
      where('requestId', '==', requestId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      deliveryId: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    console.error('Error fetching delivery by request ID:', error);
    return null;
  }
}

/**
 * Get giller's active deliveries
 */
export async function getGillerDeliveries(gillerId: string, status?: DeliveryStatus): Promise<any[]> {
  try {
    let q = query(
      collection(db, 'deliveries'),
      where('gillerId', '==', gillerId)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    q = query(q, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    const deliveries: any[] = [];

    snapshot.forEach((docSnapshot) => {
      deliveries.push({
        deliveryId: docSnapshot.id,
        ...docSnapshot.data(),
      });
    });

    return deliveries;
  } catch (error) {
    console.error('Error fetching giller deliveries:', error);
    return [];
  }
}

/**
 * Get gller's active deliveries
 */
export async function getGllerDeliveries(gllerId: string, status?: DeliveryStatus): Promise<any[]> {
  try {
    let q = query(
      collection(db, 'deliveries'),
      where('gllerId', '==', gllerId)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    q = query(q, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    const deliveries: any[] = [];

    snapshot.forEach((docSnapshot) => {
      deliveries.push({
        deliveryId: docSnapshot.id,
        ...docSnapshot.data(),
      });
    });

    return deliveries;
  } catch (error) {
    console.error('Error fetching gller deliveries:', error);
    return [];
  }
}

/**
 * Mark delivery as dropped at locker
 * 길러가 사물함에 물품을 보관한 후 호출
 * @param deliveryId 배송 ID
 * @param gillerId 길러 ID
 * @param lockerId 사물함 ID
 * @param reservationId 예약 ID
 * @returns 성공 여부
 */
export async function markAsDroppedAtLocker(
  deliveryId: string,
  gillerId: string,
  lockerId: string,
  reservationId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();

    if (delivery.gillerId !== gillerId) {
      return { success: false, message: '권한이 없습니다.' };
    }

    // 배송 상태 업데이트
    await updateDoc(deliveryRef, {
      status: 'at_locker' as DeliveryStatus,
      lockerId,
      reservationId,
      'tracking.events': [
        ...delivery.tracking.events,
        {
          type: 'dropped_at_locker',
          timestamp: new Date(),
          description: '사물함에 물품을 보관했습니다',
          actorId: gillerId,
        },
      ],
      'tracking.progress': 60,
      updatedAt: serverTimestamp(),
    });

    // 요청 상태도 업데이트
    if (delivery.requestId) {
      const requestRef = doc(db, 'requests', delivery.requestId);
      await updateDoc(requestRef, {
        status: 'at_locker' as DeliveryStatus,
        lockerId,
        reservationId,
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, message: '사물함 인계가 완료되었습니다.' };
  } catch (error) {
    console.error('Error marking as dropped at locker:', error);
    return { success: false, message: '사물함 인계 처리에 실패했습니다.' };
  }
}
