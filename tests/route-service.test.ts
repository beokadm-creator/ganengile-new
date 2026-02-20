/**
 * Route Service Tests
 * 경로(동선) 관리 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createRoute,
  updateRoute,
  deleteRoute,
  getUserRoutes,
  getRouteById,
  validateRoute,
} from '../src/services/route-service';
import { doc, getDoc, deleteDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';

describe('Route Service', () => {
  const testUserId = 'test-user-route-001';
  const createdRouteIds: string[] = [];

  beforeEach(async () => {
    // Cleanup: Delete test routes
    const snapshot = await getDocs(
      query(
        collection(db, 'routes'),
        where('userId', '==', testUserId)
      )
    );

    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  });

  afterEach(async () => {
    // Cleanup: Delete all test routes
    for (const routeId of createdRouteIds) {
      try {
        await deleteDoc(doc(db, 'routes', routeId));
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    }
    createdRouteIds.length = 0;
  });

  describe('createRoute', () => {
    test('should create a route successfully', async () => {
      const routeData = {
        userId: testUserId,
        startStation: {
          id: 'station-001',
          name: '서울역',
          line: '1호선',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        endStation: {
          id: 'station-002',
          name: '강남역',
          line: '2호선',
          latitude: 37.5172,
          longitude: 127.0473,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
      };

      const routeId = await createRoute(routeData);

      expect(routeId).toBeDefined();
      expect(typeof routeId).toBe('string');

      createdRouteIds.push(routeId);

      const routeDoc = await getDoc(doc(db, 'routes', routeId));
      expect(routeDoc.exists).toBe(true);

      const route = routeDoc.data();
      expect(route?.userId).toBe(testUserId);
      expect(route?.startStation.name).toBe('서울역');
      expect(route?.endStation.name).toBe('강남역');
    });
  });

  describe('getUserRoutes', () => {
    test('should get all routes for a user', async () => {
      // Create test routes
      const route1 = await createRoute({
        userId: testUserId,
        startStation: {
          id: 's1',
          name: '서울역',
          line: '1호선',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        endStation: {
          id: 's2',
          name: '강남역',
          line: '2호선',
          latitude: 37.5172,
          longitude: 127.0473,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
      });

      const route2 = await createRoute({
        userId: testUserId,
        startStation: {
          id: 's3',
          name: '역삼역',
          line: '2호선',
          latitude: 37.5006,
          longitude: 127.0364,
        },
        endStation: {
          id: 's4',
          name: '선릉역',
          line: '2호선',
          latitude: 37.5050,
          longitude: 127.0505,
        },
        departureTime: '09:00',
        daysOfWeek: [1, 3, 5],
        isActive: true,
      });

      createdRouteIds.push(route1, route2);

      const routes = await getUserRoutes(testUserId);

      expect(routes).toBeDefined();
      expect(routes.length).toBeGreaterThanOrEqual(2);
    });

    test('should return empty array for user with no routes', async () => {
      const routes = await getUserRoutes('user-with-no-routes');

      expect(routes).toEqual([]);
    });
  });

  describe('getRouteById', () => {
    test('should get route by ID', async () => {
      const routeId = await createRoute({
        userId: testUserId,
        startStation: {
          id: 's1',
          name: '서울역',
          line: '1호선',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        endStation: {
          id: 's2',
          name: '강남역',
          line: '2호선',
          latitude: 37.5172,
          longitude: 127.0473,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
      });

      createdRouteIds.push(routeId);

      const route = await getRouteById(routeId);

      expect(route).toBeDefined();
      expect(route?.id).toBe(routeId);
      expect(route?.startStation.name).toBe('서울역');
    });

    test('should return null for non-existent route', async () => {
      const route = await getRouteById('non-existent-route-id');

      expect(route).toBeNull();
    });
  });

  describe('updateRoute', () => {
    test('should update route successfully', async () => {
      const routeId = await createRoute({
        userId: testUserId,
        startStation: {
          id: 's1',
          name: '서울역',
          line: '1호선',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        endStation: {
          id: 's2',
          name: '강남역',
          line: '2호선',
          latitude: 37.5172,
          longitude: 127.0473,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
      });

      createdRouteIds.push(routeId);

      await updateRoute(routeId, {
        departureTime: '09:00',
        isActive: false,
      });

      const route = await getRouteById(routeId);

      expect(route?.departureTime).toBe('09:00');
      expect(route?.isActive).toBe(false);
    });

    test('should fail to update non-existent route', async () => {
      await expect(
        updateRoute('non-existent-route-id', { departureTime: '10:00' })
      ).rejects.toThrow();
    });
  });

  describe('deleteRoute', () => {
    test('should delete route successfully', async () => {
      const routeId = await createRoute({
        userId: testUserId,
        startStation: {
          id: 's1',
          name: '서울역',
          line: '1호선',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        endStation: {
          id: 's2',
          name: '강남역',
          line: '2호선',
          latitude: 37.5172,
          longitude: 127.0473,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
      });

      await deleteRoute(routeId);

      const route = await getRouteById(routeId);

      expect(route).toBeNull();
    });

    test('should fail to delete non-existent route', async () => {
      await expect(
        deleteRoute('non-existent-route-id')
      ).rejects.toThrow();
    });
  });

  describe('validateRoute', () => {
    test('should validate a valid route', async () => {
      const routeData = {
        userId: testUserId,
        startStation: {
          id: 's1',
          name: '서울역',
          line: '1호선',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        endStation: {
          id: 's2',
          name: '강남역',
          line: '2호선',
          latitude: 37.5172,
          longitude: 127.0473,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
      };

      const validation = validateRoute(routeData);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should invalidate route with invalid departure time', async () => {
      const routeData = {
        userId: testUserId,
        startStation: {
          id: 's1',
          name: '서울역',
          line: '1호선',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        endStation: {
          id: 's2',
          name: '강남역',
          line: '2호선',
          latitude: 37.5172,
          longitude: 127.0473,
        },
        departureTime: '25:00', // Invalid time
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
      };

      const validation = validateRoute(routeData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
