/**
 * Route Service Unit Tests
 */

import {
  createRoute,
  validateRoute,
  updateRoute,
  deleteRoute,
} from '../../services/route-service';

// Mock Firestore
jest.mock('../../services/firebase', () => ({
  db: {
    collection: jest.fn(),
    doc: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

describe('Route Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRoute', () => {
    it('유효한 경로를 통과시켜야 한다', () => {
      // Given
      const validRoute = {
        startStation: { stationId: '1', stationName: '서울역' },
        endStation: { stationId: '2', stationName: '강남역' },
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime: '08:00',
      };

      // When
      const result = validateRoute(validRoute);

      // Then
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('출발역과 도착역이 같으면 거부해야 한다', () => {
      // Given
      const invalidRoute = {
        startStation: { stationId: '1', stationName: '서울역' },
        endStation: { stationId: '1', stationName: '서울역' },
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime: '08:00',
      };

      // When
      const result = validateRoute(invalidRoute);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('출발역과 도착역이 같습니다.');
    });

    it('요일이 선택되지 않으면 거부해야 한다', () => {
      // Given
      const invalidRoute = {
        startStation: { stationId: '1', stationName: '서울역' },
        endStation: { stationId: '2', stationName: '강남역' },
        daysOfWeek: [],
        departureTime: '08:00',
      };

      // When
      const result = validateRoute(invalidRoute);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('최소 하루 이상 선택해야 합니다.');
    });

    it('시간이 형식에 맞지 않으면 거부해야 한다', () => {
      // Given
      const invalidRoute = {
        startStation: { stationId: '1', stationName: '서울역' },
        endStation: { stationId: '2', stationName: '강남역' },
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime: '25:00', // Invalid time
      };

      // When
      const result = validateRoute(invalidRoute);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('시간 형식'))).toBe(true);
    });
  });

  describe('createRoute', () => {
    it('경로를 생성해야 한다', async () => {
      // Given
      const routeData = {
        userId: 'test-user-id',
        startStation: { stationId: '1', stationName: '서울역' },
        endStation: { stationId: '2', stationName: '강남역' },
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime: '08:00',
      };

      const mockDocRef = {
        set: jest.fn().mockReturnThis(),
        id: 'route-1',
      };

      // When
      const result = await createRoute(routeData);

      // Then
      expect(result).toBeDefined();
      expect(result.id).toBe('route-1');
    });

    it('유효하지 않은 경로면 에러를 반환해야 한다', async () => {
      // Given
      const invalidRoute = {
        userId: 'test-user-id',
        startStation: { stationId: '1', stationName: '서울역' },
        endStation: { stationId: '1', stationName: '서울역' }, // Same station
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime: '08:00',
      };

      // When & Then
      await expect(createRoute(invalidRoute)).rejects.toThrow('경로가 유효하지 않습니다.');
    });
  });

  describe('updateRoute', () => {
    it('경로를 업데이트해야 한다', async () => {
      // Given
      const routeId = 'route-1';
      const updates = {
        departureTime: '09:00',
      };

      const mockDocRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      // When
      await updateRoute(routeId, updates);

      // Then
      expect(mockDocRef.update).toHaveBeenCalledWith({
        ...updates,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('deleteRoute', () => {
    it('경로를 삭제해야 한다', async () => {
      // Given
      const routeId = 'route-1';
      const mockDocRef = {
        delete: jest.fn().mockResolvedValue(undefined),
      };

      // When
      await deleteRoute(routeId);

      // Then
      expect(mockDocRef.delete).toHaveBeenCalled();
    });
  });
});
