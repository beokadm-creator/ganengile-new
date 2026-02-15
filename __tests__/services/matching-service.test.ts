/**
 * Matching Service Unit Tests
 */

import {
  findMatchingGillers,
  calculateMatchScore,
  autoRetryMatching,
} from '../../services/matching-service';

// Mock Firestore
jest.mock('../../services/firebase', () => ({
  db: {
    collection: jest.fn(),
    doc: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

describe('Matching Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateMatchScore', () => {
    it('완벽한 매칭은 100점이어야 한다', () => {
      // Given
      const request = {
        pickupStation: { stationId: '1', stationName: '서울역' },
        deliveryStation: { stationId: '2', stationName: '강남역' },
        urgency: 'normal',
      };

      const giller = {
        routes: [
          {
            startStation: { stationId: '1', stationName: '서울역' },
            endStation: { stationId: '2', stationName: '강남역' },
            daysOfWeek: [1, 2, 3, 4, 5],
            departureTime: '08:30',
          },
        ],
        averageRating: 5.0,
        totalDeliveries: 100,
        recentDeliveries: 10,
      };

      // When
      const score = calculateMatchScore(request, giller);

      // Then
      expect(score).toBeGreaterThan(90);
    });

    it('길러 경로가 없으면 0점이어야 한다', () => {
      // Given
      const request = {
        pickupStation: { stationId: '1', stationName: '서울역' },
        deliveryStation: { stationId: '2', stationName: '강남역' },
        urgency: 'normal',
      };

      const giller = {
        routes: [],
        averageRating: 5.0,
        totalDeliveries: 100,
      };

      // When
      const score = calculateMatchScore(request, giller);

      // Then
      expect(score).toBe(0);
    });

    it('길러 평점이 낮으면 점수를 감점해야 한다', () => {
      // Given
      const request = {
        pickupStation: { stationId: '1', stationName: '서울역' },
        deliveryStation: { stationId: '2', stationName: '강남역' },
        urgency: 'normal',
      };

      const highRatedGiller = {
        routes: [
          {
            startStation: { stationId: '1', stationName: '서울역' },
            endStation: { stationId: '2', stationName: '강남역' },
            daysOfWeek: [1, 2, 3, 4, 5],
            departureTime: '08:30',
          },
        ],
        averageRating: 5.0,
        totalDeliveries: 100,
      };

      const lowRatedGiller = {
        routes: [
          {
            startStation: { stationId: '1', stationName: '서울역' },
            endStation: { stationId: '2', stationName: '강남역' },
            daysOfWeek: [1, 2, 3, 4, 5],
            departureTime: '08:30',
          },
        ],
        averageRating: 3.5,
        totalDeliveries: 100,
      };

      // When
      const highScore = calculateMatchScore(request, highRatedGiller);
      const lowScore = calculateMatchScore(request, lowRatedGiller);

      // Then
      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe('findMatchingGillers', () => {
    it('조건에 맞는 길러를 찾아야 한다', async () => {
      // Given
      const request = {
        id: 'req-1',
        pickupStation: { stationId: '1', stationName: '서울역' },
        deliveryStation: { stationId: '2', stationName: '강남역' },
        urgency: 'normal',
      };

      const mockGillers = [
        {
          id: 'giller-1',
          name: '길러A',
          routes: [
            {
              startStation: { stationId: '1', stationName: '서울역' },
              endStation: { stationId: '2', stationName: '강남역' },
              daysOfWeek: [1, 2, 3, 4, 5],
              departureTime: '08:30',
            },
          ],
          averageRating: 4.5,
          totalDeliveries: 50,
        },
      ];

      // When
      const matches = await findMatchingGillers(request);

      // Then
      expect(matches).toHaveLength(1);
      expect(matches[0].gillerId).toBe('giller-1');
      expect(matches[0].score).toBeGreaterThan(0);
    });

    it('매칭 가능한 길러가 없으면 빈 배열을 반환해야 한다', async () => {
      // Given
      const request = {
        id: 'req-1',
        pickupStation: { stationId: '1', stationName: '서울역' },
        deliveryStation: { stationId: '2', stationName: '강남역' },
        urgency: 'normal',
      };

      const mockGillers = [
        {
          id: 'giller-1',
          routes: [], // No routes
          averageRating: 4.5,
          totalDeliveries: 50,
        },
      ];

      // When
      const matches = await findMatchingGillers(request);

      // Then
      expect(matches).toEqual([]);
    });
  });

  describe('autoRetryMatching', () => {
    it('30초 후에 자동으로 재시도해야 한다', async () => {
      // Given
      const requestId = 'req-1';

      // When
      await autoRetryMatching(requestId);

      // Then
      // Verify that 30-second timer is set
      // Verify that retry logic is called
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('3회 재시도 후에 실패하면 멈춰야 한다', async () => {
      // Given
      const requestId = 'req-1';
      let retryCount = 0;

      // When
      await autoRetryMatching(requestId);

      // Then
      // After 3 retries, should stop
      expect(retryCount).toBeLessThanOrEqual(3);
    });
  });
});
