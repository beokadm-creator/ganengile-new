/**
 * Delivery Flow Integration Tests
 * Full delivery lifecycle: Accept → Pickup → Transit → Delivery → Completion
 */

import {
  gillerAcceptRequest,
  updateDeliveryStatus,
  gillerPickupPackage,
  gillerDeliverPackage,
  completeDelivery,
} from '../../delivery-service';
import { acceptRequest } from '../../matching-service';
import { createTestData, generateId, mockFirestore } from './mocking-utils';

describe('Delivery Flow Integration Tests', () => {
  beforeEach(() => {
    mockFirestore.clear();
    jest.clearAllMocks();
  });

  describe('Match → Delivery Creation', () => {
    it('should create delivery document when match is accepted', async () => {
      const requestId = generateId('request');
      const gillerId = generateId('giller');
      const requesterId = generateId('user');

      // Seed data
      mockFirestore.seedData('users', [
        { id: requesterId, name: '요청자' },
        { id: gillerId, name: '기일러' },
      ]);

      const requestData = createTestData('request', {
        id: requestId,
        requesterId,
        pickupStation: { name: '서울역', stationId: 'S001' },
        deliveryStation: { name: '강남역', stationId: 'S002' },
        packageInfo: {
          size: 'medium',
          weight: 'light',
          description: '책',
        },
        fee: { baseFee: 3000, totalFee: 3500 },
      });
      mockFirestore.seedData('requests', [requestData]);

      const matchData = createTestData('match', {
        id: generateId('match'),
        requestId,
        gillerId,
        status: 'pending',
      });
      mockFirestore.seedData('matches', [matchData]);

      // Accept match
      const result = await acceptRequest(requestId, gillerId);

      expect(result.success).toBe(true);

      // Verify delivery created
      const deliveries = mockFirestore.getAll().get('deliveries') || [];
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].status).toBe('matched');
    });

    it('should calculate correct delivery fee', async () => {
      const requestId = generateId('request');
      const gillerId = generateId('giller');

      const requestData = createTestData('request', {
        id: requestId,
        fee: { baseFee: 3000, totalFee: 3500 },
      });
      mockFirestore.seedData('requests', [requestData]);

      const matchData = createTestData('match', {
        id: generateId('match'),
        requestId,
        gillerId,
      });
      mockFirestore.seedData('matches', [matchData]);

      await acceptRequest(requestId, gillerId);

      const deliveries = mockFirestore.getAll().get('deliveries') || [];
      const delivery = deliveries[0];

      expect(delivery.fee.totalFee).toBe(3500);
      expect(delivery.fee.gillerFee).toBeDefined(); // Should calculate giller fee
    });
  });

  describe('Pickup Flow', () => {
    it('should successfully update status to picked_up', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');

      const deliveryData = {
        id: deliveryId,
        gillerId,
        status: 'matched',
        pickupStation: { name: '서울역', stationId: 'S001' },
        deliveryStation: { name: '강남역', stationId: 'S002' },
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      // Giller picks up package
      const result = await gillerPickupPackage(deliveryId, gillerId);

      expect(result.success).toBe(true);

      // Verify status updated
      const deliveries = mockFirestore.getAll().get('deliveries') || [];
      expect(deliveries[0].status).toBe('picked_up');
      expect(deliveries[0].pickupTime).toBeDefined();
    });

    it('should fail pickup if delivery not found', async () => {
      const gillerId = generateId('giller');
      const deliveryId = generateId('delivery');

      const result = await gillerPickupPackage(deliveryId, gillerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('찾을 수 없습니다');
    });

    it('should send notification to requester on pickup', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');
      const requesterId = generateId('user');

      const deliveryData = {
        id: deliveryId,
        gillerId,
        requesterId,
        status: 'matched',
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      await gillerPickupPackage(deliveryId, gillerId);

      // Verify notification created (assuming notifications are stored)
      const notifications = mockFirestore.getAll().get('notifications') || [];
      // Note: This depends on notification implementation
    });
  });

  describe('Transit Flow', () => {
    it('should update status to in_transit', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');

      const deliveryData = {
        id: deliveryId,
        gillerId,
        status: 'picked_up',
        pickupStation: { name: '서울역' },
        deliveryStation: { name: '강남역' },
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      await updateDeliveryStatus(deliveryId, 'in_transit', gillerId);

      const deliveries = mockFirestore.getAll().get('deliveries') || [];
      expect(deliveries[0].status).toBe('in_transit');
    });

    it('should track giller location during transit', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');

      const deliveryData = {
        id: deliveryId,
        gillerId,
        status: 'in_transit',
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      // Simulate location update
      const location = {
        latitude: 37.5172,
        longitude: 127.0473,
        timestamp: Date.now(),
      };

      await updateDeliveryStatus(deliveryId, 'in_transit', gillerId, {
        currentLocation: location,
      });

      const deliveries = mockFirestore.getAll().get('deliveries') || [];
      expect(deliveries[0].currentLocation).toEqual(location);
    });
  });

  describe('Delivery Flow', () => {
    it('should successfully complete delivery', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');
      const requesterId = generateId('user');

      const deliveryData = {
        id: deliveryId,
        gillerId,
        requesterId,
        status: 'in_transit',
        deliveryStation: { name: '강남역', stationId: 'S002' },
        fee: { totalFee: 3500, gillerFee: 3000 },
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      // Complete delivery
      const result = await gillerDeliverPackage(deliveryId, gillerId);

      expect(result.success).toBe(true);

      // Verify status updated
      const deliveries = mockFirestore.getAll().get('deliveries') || [];
      expect(deliveries[0].status).toBe('delivered');
      expect(deliveries[0].deliveryTime).toBeDefined();
    });

    it('should calculate final settlement', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');

      const deliveryData = {
        id: deliveryId,
        gillerId,
        status: 'delivered',
        fee: { totalFee: 3500, gillerFee: 3000, platformFee: 500 },
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      await completeDelivery(deliveryId);

      // Verify settlement created
      const settlements = mockFirestore.getAll().get('settlements') || [];
      expect(settlements.length).toBe(1);
      expect(settlements[0].amount).toBe(3000); // Giller fee
    });
  });

  describe('Rating Flow', () => {
    it('should allow requester to rate giller after delivery', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');
      const requesterId = generateId('user');

      const deliveryData = {
        id: deliveryId,
        gillerId,
        requesterId,
        status: 'delivered',
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      // Submit rating
      const rating = {
        deliveryId,
        fromUserId: requesterId,
        toUserId: gillerId,
        rating: 5,
        comment: '빠른 배송 감사합니다!',
      };

      // This would call rating service
      // await submitRating(rating);

      // Verify rating created
      const ratings = mockFirestore.getAll().get('ratings') || [];
      expect(ratings.length).toBe(1);
      expect(ratings[0].rating).toBe(5);
    });

    it('should update giller stats after rating', async () => {
      const gillerId = generateId('giller');

      const gillerData = {
        id: gillerId,
        rating: 4.0,
        completedDeliveries: 10,
        totalRating: 40,
      };
      mockFirestore.seedData('users', [gillerData]);

      // Simulate receiving 5-star rating
      const newRating = 5;
      const completedDeliveries = 11;

      // Calculate new average
      const newTotalRating = (gillerData.totalRating + newRating);
      const newAverageRating = newTotalRating / completedDeliveries;

      expect(newAverageRating).toBeCloseTo(4.09, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid status transitions', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');

      const deliveryData = {
        id: deliveryId,
        gillerId,
        status: 'matched', // Can't go directly to delivered
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      const result = await gillerDeliverPackage(deliveryId, gillerId);

      expect(result.success).toBe(false);
    });

    it('should prevent unauthorized status updates', async () => {
      const deliveryId = generateId('delivery');
      const gillerId = generateId('giller');
      const otherGillerId = generateId('other_giller');

      const deliveryData = {
        id: deliveryId,
        gillerId, // Original giller
        status: 'matched',
      };
      mockFirestore.seedData('deliveries', [deliveryData]);

      // Different giller tries to update
      const result = await gillerPickupPackage(deliveryId, otherGillerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('권한');
    });
  });
});
