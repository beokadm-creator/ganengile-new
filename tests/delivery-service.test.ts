/**
 * Delivery Service Tests
 * 현재 mock Firestore 계약 기준 smoke/회귀 테스트
 */

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import {
  completeDelivery,
  getDeliveryById,
  gillerAcceptRequest,
  updateGillerLocation,
  verifyPickup,
} from '../src/services/delivery-service';
import { db } from '../src/services/firebase';

jest.mock('../src/services/beta1-orchestration-service', () => ({
  persistActorSelectionDecision: jest.fn().mockResolvedValue(undefined),
  syncDeliveryToBeta1Execution: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/beta1-ai-service', () => ({
  planMissionExecutionWithAI: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/services/storage-service', () => ({
  uploadPickupPhoto: jest.fn().mockResolvedValue('https://example.com/pickup.jpg'),
  uploadDeliveryPhoto: jest.fn().mockResolvedValue('https://example.com/delivery.jpg'),
}));

describe('Delivery Service', () => {
  const testGillerId = 'test-giller-delivery-001';
  const testRequesterId = 'test-requester-delivery-001';
  const testRequestId = 'test-request-delivery-001';
  const createdDeliveryIds: string[] = [];

  beforeEach(async () => {
    global.__clearMockFirestore();

    await setDoc(doc(db, 'requests', testRequestId), {
      status: 'matched',
      requesterId: testRequesterId,
      gllerId: testRequesterId,
      pickupStation: { stationName: '강남역' },
      deliveryStation: { stationName: '서울역' },
      deliveryType: 'standard',
      packageInfo: {
        size: 'small',
        weightKg: 1,
        description: 'Test package',
      },
      fee: {
        totalFee: 5500,
        deliveryFee: 5000,
        vat: 500,
        publicFare: 0,
        breakdown: {
          gillerFee: 4950,
          platformFee: 550,
        },
      },
      recipientName: 'Test Recipient',
      recipientPhone: '010-1234-5678',
      verificationCode: '1234',
      recipientVerificationCode: '123456',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    for (const deliveryId of createdDeliveryIds) {
      try {
        await deleteDoc(doc(db, 'deliveries', deliveryId));
      } catch {
        // noop
      }
    }
    createdDeliveryIds.length = 0;

    try {
      await deleteDoc(doc(db, 'requests', testRequestId));
    } catch {
      // noop
    }
  });

  test('accepts a matched request and creates a delivery', async () => {
    const result = await gillerAcceptRequest(testRequestId, testGillerId);
    if (!result.success) throw new Error(JSON.stringify(result));
    
    expect(result.success).toBe(true);
    expect(result.deliveryId).toBeDefined();

    if (!result.deliveryId) {
      throw new Error('deliveryId should be created');
    }

    createdDeliveryIds.push(result.deliveryId);

    const deliveryDoc = await getDoc(doc(db, 'deliveries', result.deliveryId));
    expect(deliveryDoc.exists()).toBe(true);
    expect(deliveryDoc.data()).toEqual(
      expect.objectContaining({
        requestId: testRequestId,
        gillerId: testGillerId,
        status: 'accepted',
      })
    );

    const requestDoc = await getDoc(doc(db, 'requests', testRequestId));
    expect(requestDoc.data()).toEqual(
      expect.objectContaining({
        status: 'accepted',
        matchedGillerId: testGillerId,
        primaryDeliveryId: result.deliveryId,
      })
    );
  });

  test('updates courier location without throwing', async () => {
    const acceptResult = await gillerAcceptRequest(testRequestId, testGillerId);
    if (!acceptResult.deliveryId) {
      throw new Error('deliveryId should be created');
    }
    createdDeliveryIds.push(acceptResult.deliveryId);

    await expect(
      updateGillerLocation(acceptResult.deliveryId, {
        latitude: 37.5665,
        longitude: 126.978,
      })
    ).resolves.toBeUndefined();

    const deliveryDoc = await getDoc(doc(db, 'deliveries', acceptResult.deliveryId));
    expect(deliveryDoc.exists()).toBe(true);
    expect(deliveryDoc.data()).toEqual(
      expect.objectContaining({
        requestId: testRequestId,
        gillerId: testGillerId,
      })
    );
  });

  test('verifies pickup and moves accepted delivery to in_transit', async () => {
    const acceptResult = await gillerAcceptRequest(testRequestId, testGillerId);
    if (!acceptResult.deliveryId) {
      throw new Error('deliveryId should be created');
    }
    createdDeliveryIds.push(acceptResult.deliveryId);

    const verifyResult = await verifyPickup({
      deliveryId: acceptResult.deliveryId,
      gillerId: testGillerId,
      verificationCode: '1234',
      photoUri: 'file://pickup.jpg',
      location: {
        latitude: 37.5,
        longitude: 127.0,
      },
    });

    expect(verifyResult).toEqual({
      success: true,
      message: '픽업이 완료되었습니다.',
    });

    const deliveryDoc = await getDoc(doc(db, 'deliveries', acceptResult.deliveryId));
    expect(deliveryDoc.data()).toEqual(
      expect.objectContaining({
        status: 'in_transit',
        pickupVerificationCode: '1234',
      })
    );
  });

  test('completes delivery when code matches and the delivery is in transit', async () => {
    const deliveryRef = doc(db, 'deliveries', 'delivery-complete-001');
    createdDeliveryIds.push(deliveryRef.id);

    await setDoc(deliveryRef, {
      requestId: testRequestId,
      gillerId: testGillerId,
      status: 'in_transit',
      recipientInfo: {
        verificationCode: '123456',
      },
      tracking: {
        events: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await completeDelivery({
      deliveryId: deliveryRef.id,
      gillerId: testGillerId,
      verificationCode: '123456',
      photoUri: 'file://delivery.jpg',
      location: {
        latitude: 37.55,
        longitude: 126.99,
      },
    });

    expect(result.success).toBe(true);

    const deliveryDoc = await getDoc(deliveryRef);
    expect(deliveryDoc.data()).toEqual(
      expect.objectContaining({
        status: 'delivered',
      })
    );
  });

  test('returns null when delivery does not exist', async () => {
    await expect(getDeliveryById('non-existent-delivery')).resolves.toBeNull();
  });

  test('lists created deliveries through the mock query layer', async () => {
    const acceptResult = await gillerAcceptRequest(testRequestId, testGillerId);
    if (!acceptResult.deliveryId) {
      throw new Error('deliveryId should be created');
    }
    createdDeliveryIds.push(acceptResult.deliveryId);

    const snapshot = await getDocs(
      query(collection(db, 'deliveries'), where('gillerId', '==', testGillerId))
    );

    expect(snapshot.docs.length).toBeGreaterThanOrEqual(1);
  });
});
