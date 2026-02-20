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
} from '../route-service';
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
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
    jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined);
    jest.spyOn(AsyncStorage, 'removeItem').mockResolvedValue(undefined);
  });

  describe('createRoute', () => {
    const mockRouteParams = {
      userId: 'user123',
      startStation: {
        stationId: 'S001',
        stationName: '서울역',
        name: '서울역',
        lines: ['1호선', '4호선'],
        location: { lat: 37.5547, lng: 126.9707 },
      },
      endStation: {
        stationId: 'S002',
        stationName: '강남역',
        name: '강남역',
        lines: ['2호선'],
        location: { lat: 37.5172, lng: 127.0473 },
      },
      departureTime: '08:30',
      daysOfWeek: [1, 2, 3, 4, 5],
      gillerName: '테스터',
    };

    it('should create route successfully', async () => {
      const mockDocRef = { id: 'route123' };
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      const result = await createRoute(mockRouteParams);

      expect(result.success).toBe(true);
      expect(result.data?.routeId).toBe('route123');
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

      const result = await createRoute(invalidParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('출발역과 도착역이 같습니다');
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

      const result = await createRoute(mockRouteParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('이미 등록된 동선');
    });
  });

  describe('updateRoute', () => {
    const mockUpdateParams = {
      routeId: 'route123',
      userId: 'user123',
      startStation: {
        stationId: 'S001',
        stationName: '서울역',
        name: '서울역',
      },
      endStation: {
        stationId: 'S002',
        stationName: '강남역',
        name: '강남역',
      },
      departureTime: '09:00',
      daysOfWeek: [1, 2, 3],
    };

    it('should update route successfully', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          userId: 'user123',
          isActive: true,
        }),
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await updateRoute(mockUpdateParams);

      expect(result.success).toBe(true);
      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors', async () => {
      const invalidParams = {
        ...mockUpdateParams,
        daysOfWeek: [],
      };

      const result = await updateRoute(invalidParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('요일을 선택해야 합니다');
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should handle route not found', async () => {
      const mockDoc = {
        exists: false,
        data: () => null,
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await updateRoute(mockUpdateParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('동선을 찾을 수 없습니다');
    });
  });

  describe('deleteRoute', () => {
    it('should delete route successfully', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          userId: 'user123',
          isActive: true,
        }),
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await deleteRoute('route123', 'user123');

      expect(result.success).toBe(true);
      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('should handle route not found', async () => {
      const mockDoc = {
        exists: false,
        data: () => null,
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await deleteRoute('route123', 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('동선을 찾을 수 없습니다');
    });

    it('should handle unauthorized deletion', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          userId: 'user456', // Different user
          isActive: true,
        }),
        id: 'route123',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await deleteRoute('route123', 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('권한이 없습니다');
    });
  });

  describe('getUserRoutes', () => {
    it('should return user routes', async () => {
      const mockRoutes = [
        {
          id: 'route1',
          data: () => ({
            userId: 'user123',
            startStation: { name: '서울역' },
            endStation: { name: '강남역' },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3, 4, 5],
            isActive: true,
            createdAt: { seconds: 1234567890 },
          }),
        },
      ];

      const mockQuerySnapshot = {
        docs: mockRoutes,
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      const result = await getUserRoutes('user123');

      expect(result.success).toBe(true);
      expect(result.data?.routes).toHaveLength(1);
      expect(result.data?.routes[0].startStation.name).toBe('서울역');
    });

    it('should use cache for subsequent calls', async () => {
      const mockRoutes = [
        {
          id: 'route1',
          data: () => ({
            userId: 'user123',
            isActive: true,
          }),
        },
      ];

      const mockQuerySnapshot = {
        docs: mockRoutes,
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
        stationId: 'S001',
        stationName: '서울역',
      },
      endStation: {
        stationId: 'S002',
        stationName: '강남역',
      },
      departureTime: '08:30',
      daysOfWeek: [1, 2, 3, 4, 5],
    };

    it('should validate correct route', async () => {
      const result = await validateRoute(mockValidRoute);

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

      const result = await validateRoute(invalidRoute);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('출발역과 도착역이 같습니다');
    });

    it('should detect invalid time range', async () => {
      const invalidRoute = {
        ...mockValidRoute,
        departureTime: '25:00', // Invalid time
      };

      const result = await validateRoute(invalidRoute);

      expect(result.isValid).toBe(false);
    });

    it('should detect missing days', async () => {
      const invalidRoute = {
        ...mockValidRoute,
        daysOfWeek: [],
      };

      const result = await validateRoute(invalidRoute);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('요일을 최소 1일 이상 선택해야 합니다');
    });
  });

  describe('clearRoutesCache', () => {
    it('should clear AsyncStorage cache', async () => {
      await clearRoutesCache('user123');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('cached_routes_user123');
    });
  });
});
