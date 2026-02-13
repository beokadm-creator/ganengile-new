/**
 * Delivery Service Tests
 * 배송 진행 관리 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  startDelivery,
  updateDeliveryLocation,
  verifyPickup,
  verifyDelivery,
  completeDelivery,
  getDeliveryStatus,
} from '../src/services/delivery-service';
import { doc, getDoc, deleteDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { DeliveryStatus } from '../src/types/delivery';

describe('Delivery Service', () => {
  const testMatchId = 'test-match-delivery-001';
  const testGillerId = 'test-giller-delivery-001';
  const testRequestId = 'test-request-delivery-001';
  const createdDeliveryIds: string[] = [];

  beforeEach(async () => {
    // Cleanup: Delete test deliveries
    const snapshot = await getDocs(
      query(
        collection(db, 'deliveries'),
        where('matchId', '==', testMatchId)
      )
    );

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  });

  afterEach(async () => {
    // Cleanup: Delete all test deliveries
    for (const deliveryId of createdDeliveryIds) {
      try {
        await deleteDoc(doc(db, 'deliveries', deliveryId));
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    }
    createdDeliveryIds.length = 0;
  });

  describe('startDelivery', () => {
    test('should start a delivery successfully', async () => {
      const deliveryId = await startDelivery(
        testMatchId,
        testGillerId,
        {
          pickupStation: 'gangnam',
          deliveryStation: 'seoul',
          estimatedTime: 25,
        }
      );

      expect(deliveryId).toBeDefined();
      expect(typeof deliveryId).toBe('string');

      createdDeliveryIds.push(deliveryId);

      const deliveryDoc = await getDoc(doc(db, 'deliveries', deliveryId));
      expect(deliveryDoc.exists()).toBe(true);

      const deliveryData = deliveryDoc.data();
      expect(deliveryData?.matchId).toBe(testMatchId);
      expect(deliveryData?.gillerId).toBe(testGillerId);
      expect(deliveryData?.status).toBe(DeliveryStatus.PENDING);
    });

    test('should fail to start delivery with invalid match ID', async () => {
      await expect(
        startDelivery('', testGillerId, {})
      ).rejects.toThrow();
    });
  });

  describe('updateDeliveryLocation', () => {
    test('should update delivery location successfully', async () => {
      // First start a delivery
      const deliveryId = await startDelivery(
        testMatchId,
        testGillerId,
        {
          pickupStation: 'gangnam',
          deliveryStation: 'seoul',
          estimatedTime: 25,
        }
      );

      createdDeliveryIds.push(deliveryId);

      // Update location
      const location = {
        latitude: 37.5665,
        longitude: 126.9780,
        station: 'gangnam',
        timestamp: new Date(),
      };

      await expect(updateDeliveryLocation(deliveryId, location)).resolves.not.toThrow();

      const deliveryDoc = await getDoc(doc(db, 'deliveries', deliveryId));
      const deliveryData = deliveryDoc.data();

      expect(deliveryData?.currentLocation).toEqual(location);
    });
  });

  describe('verifyPickup', () => {
    test('should verify pickup successfully', async () => {
      // First start a delivery
      const deliveryId = await startDelivery(
        testMatchId,
        testGillerId,
        {
          pickupStation: 'gangnam',
          deliveryStation: 'seoul',
          estimatedTime: 25,
        }
      );

      createdDeliveryIds.push(deliveryId);

      // Verify pickup with QR code
      await expect(verifyPickup(deliveryId, {
        method: 'qr_code',
        code: 'test-qr-code-123',
        photoUrl: 'https://example.com/photo.jpg',
      })).resolves.not.toThrow();

      const deliveryDoc = await getDoc(doc(db, 'deliveries', deliveryId));
      const deliveryData = deliveryDoc.data();

      expect(deliveryData?.status).toBe(DeliveryStatus.IN_TRANSIT);
      expect(deliveryData?.pickupVerifiedAt).toBeDefined();
    });
  });

  describe('verifyDelivery', () => {
    test('should verify delivery successfully', async () => {
      // First start a delivery and verify pickup
      const deliveryId = await startDelivery(
        testMatchId,
        testGillerId,
        {
          pickupStation: 'gangnam',
          deliveryStation: 'seoul',
          estimatedTime: 25,
        }
      );

      createdDeliveryIds.push(deliveryId);

      await verifyPickup(deliveryId, {
        method: 'qr_code',
        code: 'test-qr-code-123',
        photoUrl: 'https://example.com/pickup.jpg',
      });

      // Verify delivery
      await expect(verifyDelivery(deliveryId, {
        method: 'qr_code',
        code: 'test-qr-code-456',
        photoUrl: 'https://example.com/delivery.jpg',
      })).resolves.not.toThrow();

      const deliveryDoc = await getDoc(doc(db, 'deliveries', deliveryId));
      const deliveryData = deliveryDoc.data();

      expect(deliveryData?.status).toBe(DeliveryStatus.DELIVERED);
      expect(deliveryData?.deliveryVerifiedAt).toBeDefined();
    });
  });

  describe('completeDelivery', () => {
    test('should complete delivery successfully', async () => {
      // Start and verify delivery
      const deliveryId = await startDelivery(
        testMatchId,
        testGillerId,
        {
          pickupStation: 'gangnam',
          deliveryStation: 'seoul',
          estimatedTime: 25,
        }
      );

      createdDeliveryIds.push(deliveryId);

      await verifyPickup(deliveryId, {
        method: 'qr_code',
        code: 'test-qr-code-123',
        photoUrl: 'https://example.com/pickup.jpg',
      });

      await verifyDelivery(deliveryId, {
        method: 'qr_code',
        code: 'test-qr-code-456',
        photoUrl: 'https://example.com/delivery.jpg',
      });

      // Complete delivery
      await expect(completeDelivery(deliveryId, {
        actualTime: 23,
        notes: 'Smooth delivery',
      })).resolves.not.toThrow();

      const deliveryDoc = await getDoc(doc(db, 'deliveries', deliveryId));
      const deliveryData = deliveryDoc.data();

      expect(deliveryData?.status).toBe(DeliveryStatus.COMPLETED);
      expect(deliveryData?.completedAt).toBeDefined();
      expect(deliveryData?.actualTime).toBe(23);
    });
  });

  describe('getDeliveryStatus', () => {
    test('should get delivery status', async () => {
      // Start a delivery
      const deliveryId = await startDelivery(
        testMatchId,
        testGillerId,
        {
          pickupStation: 'gangnam',
          deliveryStation: 'seoul',
          estimatedTime: 25,
        }
      );

      createdDeliveryIds.push(deliveryId);

      // Get status
      const status = await getDeliveryStatus(deliveryId);

      expect(status).toBeDefined();
      expect(status?.deliveryId).toBe(deliveryId);
      expect(status?.status).toBe(DeliveryStatus.PENDING);
    });

    test('should return null for non-existent delivery', async () => {
      const status = await getDeliveryStatus('non-existent-delivery-id');

      expect(status).toBeNull();
    });
  });
});
