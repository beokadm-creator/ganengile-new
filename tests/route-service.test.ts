/**
 * Route Service Tests
 * 동선 관리 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createRoute,
  getRoutes,
  getRouteById,
  updateRoute,
  deleteRoute,
  validateRoute,
  checkRouteOverlap,
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

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  });

  afterEach(async () => {
    // Cleanup: Delete all test routes
    for (const routeId of createdRouteIds) {
      try {
        await deleteRoute(routeId, testUserId);
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    }
    createdRouteIds.length = 0;
  });

  describe('createRoute', () => {
    test('should create a route successfully', async () => {
      const routeData = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        urgency: 'normal',
      };

      const routeId = await createRoute(
        testUserId,
        routeData.startStation,
        routeData.endStation,
        routeData.departureTime,
        routeData.daysOfWeek
      );

      expect(routeId).toBeDefined();
      expect(typeof routeId).toBe('string');

      createdRouteIds.push(routeId);

      const routeDoc = await getDoc(doc(db, 'routes', routeId));
      expect(routeDoc.exists).toBe(true);

      const route = routeDoc.data();
      expect(route?.userId).toBe(testUserId);
      expect(route?.startStation.stationName).toBe('강남역');
      expect(route?.endStation.stationName).toBe('서울역');
      expect(route?.departureTime).toBe('08:30');
    });

    test('should fail to create route with invalid data', async () => {
      const invalidRouteData = {
        startStation: {},
        endStation: {},
        departureTime: '',
        daysOfWeek: [],
      };

      await expect(
        createRoute(testUserId, invalidRouteData)
      ).rejects.toThrow();
    });
  });

  describe('getRoutes', () => {
    test('should get all routes for a user', async () => {
      // Create multiple routes
      const route1Data = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        urgency: 'normal',
      };

      const route2Data = {
        ...route1Data,
        startStation: {
          ...route1Data.startStation,
          stationId: 'station-003',
          stationName: '역삼역',
        },
        departureTime: '18:30',
      };

      const routeId1 = await createRoute(
        testUserId,
        route1Data.startStation,
        route1Data.endStation,
        route1Data.departureTime,
        route1Data.daysOfWeek
      );
      const routeId2 = await createRoute(
        testUserId,
        route2Data.startStation,
        route2Data.endStation,
        route2Data.departureTime,
        route2Data.daysOfWeek
      );

      createdRouteIds.push(routeId1, routeId2);

      // Get routes
      const routes = await getRoutes(testUserId);

      expect(routes.length).toBeGreaterThanOrEqual(2);
      expect(routes.every(r => r.userId === testUserId)).toBe(true);
    });
  });

  describe('getRouteById', () => {
    test('should get route by ID', async () => {
      // Create a route first
      const routeData = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        urgency: 'normal',
      };

      const routeId = await createRoute(
        testUserId,
        routeData.startStation,
        routeData.endStation,
        routeData.departureTime,
        routeData.daysOfWeek
      );
      createdRouteIds.push(routeId);

      // Get route by ID
      const route = await getRouteById(routeId, testUserId);

      expect(route).toBeDefined();
      expect(route?.routeId).toBe(routeId);
      expect(route?.startStation.stationName).toBe('강남역');
    });

    test('should return null for non-existent route', async () => {
      const route = await getRouteById('non-existent-route-id', testUserId);

      expect(route).toBeNull();
    });
  });

  describe('updateRoute', () => {
    test('should update route successfully', async () => {
      // Create a route first
      const routeData = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        urgency: 'normal',
      };

      const routeId = await createRoute(
        testUserId,
        routeData.startStation,
        routeData.endStation,
        routeData.departureTime,
        routeData.daysOfWeek
      );
      createdRouteIds.push(routeId);

      // Update route
      const updates = {
        departureTime: '09:00',
        urgency: 'high',
      };

      await expect(updateRoute(routeId, testUserId, updates)).resolves.not.toThrow();

      const route = await getRouteById(routeId, testUserId);
      expect(route?.departureTime).toBe(updates.departureTime);
      expect(route?.urgency).toBe(updates.urgency);
    });
  });

  describe('deleteRoute', () => {
    test('should delete route successfully', async () => {
      // Create a route first
      const routeData = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        urgency: 'normal',
      };

      const routeId = await createRoute(
        testUserId,
        routeData.startStation,
        routeData.endStation,
        routeData.departureTime,
        routeData.daysOfWeek
      );
      createdRouteIds.push(routeId);

      // Delete route
      await expect(deleteRoute(routeId, testUserId)).resolves.not.toThrow();

      const route = await getRouteById(routeId, testUserId);
      expect(route).toBeNull();
    });
  });

  describe('validateRoute', () => {
    test('should validate a valid route', async () => {
      const routeData = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        urgency: 'normal',
      };

      const validation = await validateRoute(routeData);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should invalidate route with invalid departure time', async () => {
      const invalidRouteData = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '25:00', // Invalid time
        daysOfWeek: [1, 2, 3, 4, 5],
        urgency: 'normal',
      };

      const validation = await validateRoute(invalidRouteData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('checkRouteOverlap', () => {
    test('should detect overlapping routes', async () => {
      // Create first route
      const route1Data = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5],
        urgency: 'normal',
      };

      const routeId1 = await createRoute(
        testUserId,
        route1Data.startStation,
        route1Data.endStation,
        route1Data.departureTime,
        route1Data.daysOfWeek
      );
      createdRouteIds.push(routeId1);

      // Check overlap with similar route
      const route2Data = {
        ...route1Data,
        departureTime: '08:45', // Overlaps with route1
      };

      const overlaps = await checkRouteOverlap(testUserId, route2Data);

      expect(overlaps.hasOverlap).toBe(true);
      expect(overlaps.overlappingRoutes.length).toBeGreaterThan(0);
    });

    test('should not detect non-overlapping routes', async () => {
      // Create first route
      const route1Data = {
        startStation: {
          stationId: 'station-001',
          stationName: '강남역',
          line: '2',
          latitude: 37.5665,
          longitude: 126.9780,
        },
        endStation: {
          stationId: 'station-002',
          stationName: '서울역',
          line: '1',
          latitude: 37.5547,
          longitude: 126.9707,
        },
        departureTime: '08:30',
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
        urgency: 'normal',
      };

      const routeId1 = await createRoute(
        testUserId,
        route1Data.startStation,
        route1Data.endStation,
        route1Data.departureTime,
        route1Data.daysOfWeek
      );
      createdRouteIds.push(routeId1);

      // Check overlap with different day route
      const route2Data = {
        ...route1Data,
        departureTime: '08:30',
        daysOfWeek: [6, 7], // Weekend
      };

      const overlaps = await checkRouteOverlap(testUserId, route2Data);

      expect(overlaps.hasOverlap).toBe(false);
      expect(overlaps.overlappingRoutes).toEqual([]);
    });
  });
});
