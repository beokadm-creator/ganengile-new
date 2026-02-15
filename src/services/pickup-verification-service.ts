/**
 * Pickup Verification Service
 * 픽업 인증 데이터 관리
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase-service';
import type { LocationData } from './location-service';

export interface PickupVerificationData {
  deliveryId: string;
  verificationMethod: 'qr' | 'photo';
  verificationCode?: string;
  photoUri?: string;
  locationData?: LocationData;
  verifiedAt: Date;
}

export class PickupVerificationService {
  private readonly VERIFICATIONS_COLLECTION = 'pickup_verifications';
  private readonly DELIVERIES_COLLECTION = 'deliveries';

  /**
   * 픽업 인증 저장
   */
  async savePickupVerification(data: PickupVerificationData): Promise<boolean> {
    try {
      // 1. 인증 데이터 저장
      const verificationData = {
        deliveryId: data.deliveryId,
        verificationMethod: data.verificationMethod,
        verificationCode: data.verificationCode || null,
        photoUri: data.photoUri || null,
        locationData: data.locationData || null,
        verifiedAt: serverTimestamp(),
      };

      await addDoc(collection(db, this.VERIFICATIONS_COLLECTION), verificationData);

      // 2. 배송 상태 업데이트
      const deliveryRef = doc(db, this.DELIVERIES_COLLECTION, data.deliveryId);
      const deliveryDoc = await getDoc(deliveryRef);

      if (deliveryDoc.exists()) {
        await updateDoc(deliveryRef, {
          status: 'picked_up',
          pickupVerifiedAt: serverTimestamp(),
          pickupVerificationMethod: data.verificationMethod,
          pickupLocation: data.locationData || null,
          pickupPhoto: data.photoUri || null,
        });
      }

      return true;
    } catch (error) {
      console.error('Error saving pickup verification:', error);
      return false;
    }
  }

  /**
   * 픽업 인증 조회
   */
  async getPickupVerification(deliveryId: string): Promise<PickupVerificationData | null> {
    try {
      const q = query(
        collection(db, this.VERIFICATIONS_COLLECTION),
        where('deliveryId', '==', deliveryId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        deliveryId: data.deliveryId,
        verificationMethod: data.verificationMethod,
        verificationCode: data.verificationCode,
        photoUri: data.photoUri,
        locationData: data.locationData,
        verifiedAt: data.verifiedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting pickup verification:', error);
      return null;
    }
  }
}

// Singleton instance
export const pickupVerificationService = new PickupVerificationService();
