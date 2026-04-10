/**
 * Route Service Unit Tests
 */

import {
  createRoute,
  updateRoute,
  deleteRoute,
  getUserRoutes,
  validateRoute,
  clearRoutesCache,
  clearRouteCache,
} from './route-service';
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  collection,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';

// Mock Firebase and AsyncStorage
jest.mock('firebase/firestore');
jest.mock('./firebase');
jest.mock('@react-native-async-storage/async-storage');

describe('RouteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearRouteCache();
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
    jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined);
    jest.spyOn(AsyncStorage, 'removeItem').mockResolvedValue(undefined);
  });

  describe('createRoute', () => {
    const mockRouteParams = {
      userId: 'user123',
      startStation: {
        id: 'S001',
        stationId: 'S001',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      },
      endStation: {
        id: 'S002',
        stationId: 'S002',
        stationName: '강남역',
        line: '2호선',
        lineCode: '200',
        lat: 37.5172,
        lng: 127.0473,
      },
      departureTime: '08:30',
      daysOfWeek: [1, 2, 3, 4, 5],
    };

    it('should create route successfully', async () => {
      const mockDocRef = { id: 'route123' };
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      const result = await createRoute(mockRouteParams);

      expect(result.routeId).toBe('route123');
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors', async () => {
      const invalidParams = {
        ...mockRouteParams,
        startStation: {
          ...mockRouteParams.startStation,
          stationId: 'S001',
        },
        endStation: {
          ...mockRouteParams.endStation,
          stationId: 'S001', // Same as start
        },
      };

      await expect(createRoute(invalidParams)).rejects.toThrow('출발역과 도착역이 같습니다');
      expect(addDoc).not.toHaveBeenCalled();
    });

    it('should handle duplicate routes', async () => {
      const mockQuerySnapshot = {
        docs: [
          {
            id: 'route456',
            data: () => ({
              userId: 'user123',
              daysOfWeek: [1, 2, 3, 4, 5],
              isActive: true,
            }),
          },
        ],
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      await expect(createRoute(mockRouteParams)).resolves.toBeDefined();
    });
  });

  describe('updateRoute', () => {
    const mockUpdateParams = {
      startStation: {
        id: 'S001',
        stationId: 'S001',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      },
      endStation: {
        id: 'S002',
        stationId: 'S002',
        stationName: '강남역',
        line: '2호선',
        lineCode: '200',
        lat: 37.5172,
        lng: 127.0473,
      },
      departureTime: '09:00',
      daysOfWeek: [1, 2, 3],
    };

    it('should update route successfully', async () => {
      const mockDoc = {
        exists: () => true,
        data: () => ({
          userId: 'user123',
          startStation: mockUpdateParams.startStation,
          endStation: mockUpdateParams.endStation,
          departureTime: '08:30',
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
          createdAt: { seconds: 1234567890, nanoseconds: 0 },
          updatedAt: { seconds: 1234567890, nanoseconds: 0 },
        }),
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await updateRoute('route123', 'user123', mockUpdateParams);

      expect(result?.routeId).toBe('route123');
      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors', async () => {
      const invalidParams = {
        ...mockUpdateParams,
        daysOfWeek: [],
      };

      await expect(updateRoute('route123', 'user123', invalidParams)).rejects.toThrow('운영 요일이 올바르지 않습니다');
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should handle route not found', async () => {
      const mockDoc = {
        exists: () => false,
        data: () => null,
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await updateRoute('route123', 'user123', mockUpdateParams);
      expect(result).toBeNull();
    });
  });

  describe('deleteRoute', () => {
    it('should delete route successfully', async () => {
      const mockDoc = {
        exists: () => true,
        data: () => ({
          userId: 'user123',
          startStation: {
            id: 'S001', stationId: 'S001', stationName: '서울역', line: '1호선', lineCode: '100', lat: 1, lng: 1,
          },
          endStation: {
            id: 'S002', stationId: 'S002', stationName: '강남역', line: '2호선', lineCode: '200', lat: 2, lng: 2,
          },
          departureTime: '08:30',
          daysOfWeek: [1, 2, 3],
          isActive: true,
          createdAt: { seconds: 1234567890, nanoseconds: 0 },
          updatedAt: { seconds: 1234567890, nanoseconds: 0 },
        }),
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await deleteRoute('route123', 'user123');

      expect(result).toBe(true);
      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('should handle route not found', async () => {
      const mockDoc = {
        exists: () => false,
        data: () => null,
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await deleteRoute('route123', 'user123');
      expect(result).toBe(false);
    });

    it('should handle unauthorized deletion', async () => {
      const mockDoc = {
        exists: () => true,
        data: () => ({
          userId: 'user456', // Different user
          startStation: {
            id: 'S001', stationId: 'S001', stationName: '서울역', line: '1호선', lineCode: '100', lat: 1, lng: 1,
          },
          endStation: {
            id: 'S002', stationId: 'S002', stationName: '강남역', line: '2호선', lineCode: '200', lat: 2, lng: 2,
          },
          departureTime: '08:30',
          daysOfWeek: [1, 2, 3],
          isActive: true,
          createdAt: { seconds: 1234567890, nanoseconds: 0 },
          updatedAt: { seconds: 1234567890, nanoseconds: 0 },
        }),
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await deleteRoute('route123', 'user123');
      expect(result).toBe(false);
    });
  });

  describe('getUserRoutes', () => {
    it('should return user routes', async () => {
      const mockRoutes = [
        {
          id: 'route1',
          data: () => ({
            userId: 'user123',
            startStation: { stationId: 'S001', stationName: '서울역', line: '1호선', lineCode: '100', lat: 1, lng: 1 },
            endStation: { stationId: 'S002', stationName: '강남역', line: '2호선', lineCode: '200', lat: 2, lng: 2 },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3, 4, 5],
            isActive: true,
            createdAt: { seconds: 1234567890, nanoseconds: 0 },
            updatedAt: { seconds: 1234567890, nanoseconds: 0 },
          }),
        },
      ];

      const mockQuerySnapshot = {
        docs: mockRoutes,
        forEach: (callback: (route: (typeof mockRoutes)[number]) => void) => mockRoutes.forEach(callback),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      const result = await getUserRoutes('user123');

      expect(result).toHaveLength(1);
      expect(result[0].startStation.stationName).toBe('서울역');
    });

    it('should use cache for subsequent calls', async () => {
      const mockRoutes = [
        {
          id: 'route1',
          data: () => ({
            userId: 'user123',
            startStation: { stationId: 'S001', stationName: '서울역', line: '1호선', lineCode: '100', lat: 1, lng: 1 },
            endStation: { stationId: 'S002', stationName: '강남역', line: '2호선', lineCode: '200', lat: 2, lng: 2 },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3],
            isActive: true,
            createdAt: { seconds: 1234567890, nanoseconds: 0 },
            updatedAt: { seconds: 1234567890, nanoseconds: 0 },
          }),
        },
      ];

      const mockQuerySnapshot = {
        docs: mockRoutes,
        forEach: (callback: (route: (typeof mockRoutes)[number]) => void) => mockRoutes.forEach(callback),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      // First call
      await getUserRoutes('user123');
      // Second call (should use cache)
      await getUserRoutes('user123');

      expect(getDocs).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateRoute', () => {
    const mockValidRoute = {
      startStation: {
        id: 'S001',
        stationId: 'S001',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      },
      endStation: {
        id: 'S002',
        stationId: 'S002',
        stationName: '강남역',
        line: '2호선',
        lineCode: '200',
        lat: 37.5172,
        lng: 127.0473,
      },
      departureTime: '08:30',
      daysOfWeek: [1, 2, 3, 4, 5],
    };

    it('should validate correct route', async () => {
      const result = await validateRoute(
        mockValidRoute.startStation,
        mockValidRoute.endStation,
        mockValidRoute.departureTime,
        mockValidRoute.daysOfWeek
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect same start and end station', async () => {
      const invalidRoute = {
        ...mockValidRoute,
        endStation: {
          ...mockValidRoute.endStation,
          stationId: 'S001',
        },
      };

      const result = await validateRoute(
        invalidRoute.startStation,
        invalidRoute.endStation,
        invalidRoute.departureTime,
        invalidRoute.daysOfWeek
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('출발역과 도착역이 같습니다');
    });

    it('should detect invalid time range', async () => {
      const invalidRoute = {
        ...mockValidRoute,
        departureTime: '25:00', // Invalid time
      };

      const result = await validateRoute(
        invalidRoute.startStation,
        invalidRoute.endStation,
        invalidRoute.departureTime,
        invalidRoute.daysOfWeek
      );

      expect(result.isValid).toBe(false);
    });

    it('should detect missing days', async () => {
      const invalidRoute = {
        ...mockValidRoute,
        daysOfWeek: [],
      };

      const result = await validateRoute(
        invalidRoute.startStation,
        invalidRoute.endStation,
        invalidRoute.departureTime,
        invalidRoute.daysOfWeek
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('최소 1개 이상의 요일');
    });
  });

  describe('clearRoutesCache', () => {
    it('should clear AsyncStorage cache', async () => {
      await clearRoutesCache('user123');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('cached_routes_user123');
    });
  });
});
