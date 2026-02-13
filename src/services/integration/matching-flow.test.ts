/**
 * Matching Flow Integration Tests
 * End-to-end matching process: Request → Matching Engine → Gillers → Notification
 */

import {
  matchingService,
  processMatchingForRequest,
  findMatchesForRequest,
  acceptRequest,
  declineRequest,
} from '../../matching-service';
import { createTestData, generateId, mockFirestore } from './mocking-utils';

describe('Matching Flow Integration Tests', () => {
  beforeEach(() => {
    mockFirestore.clear();
    jest.clearAllMocks();
  });

  describe('Request Creation → Matching', () => {
    it('should successfully match gillers to a new request', async () => {
      // 1. Create test data
      const requesterId = generateId('user');
      const giller1Id = generateId('giller');
      const giller2Id = generateId('giller');

      // Seed users
      mockFirestore.seedData('users', [
        { id: requesterId, name: '요청자', role: 'gller' },
        { id: giller1Id, name: '기일러1', role: 'giller', rating: 4.5, completedDeliveries: 20 },
        { id: giller2Id, name: '기일러2', role: 'giller', rating: 4.0, completedDeliveries: 10 },
      ]);

      // Seed giller routes
      mockFirestore.seedData('routes', [
        {
          id: generateId('route'),
          userId: giller1Id,
          startStation: { name: '서울역', stationId: 'S001' },
          endStation: { name: '강남역', stationId: 'S002' },
          departureTime: '08:30',
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
        },
        {
          id: generateId('route'),
          userId: giller2Id,
          startStation: { name: '서울역', stationId: 'S001' },
          endStation: { name: '강남역', stationId: 'S002' },
          departureTime: '09:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
        },
      ]);

      // Create delivery request
      const requestId = generateId('request');
      const requestData = createTestData('request', {
        id: requestId,
        requesterId,
        pickupStation: { name: '서울역', stationId: 'S001' },
        deliveryStation: { name: '강남역', stationId: 'S002' },
      });
      mockFirestore.seedData('requests', [requestData]);

      // 2. Process matching
      const matchCount = await processMatchingForRequest(requestId);

      // 3. Verify results
      expect(matchCount).toBeGreaterThan(0);
      expect(matchCount).toBeLessThanOrEqual(3); // Top 3 matches

      // 4. Verify match documents created
      const matches = mockFirestore.getAll().get('matches') || [];
      expect(matches.length).toBe(matchCount);
    });

    it('should return zero matches when no compatible gillers exist', async () => {
      // Create request
      const requestId = generateId('request');
      const requestData = createTestData('request', {
        id: requestId,
        pickupStation: { name: '서울역', stationId: 'S001' },
        deliveryStation: { name: '강남역', stationId: 'S002' },
      });
      mockFirestore.seedData('requests', [requestData]);

      // No gillers seeded - should return 0 matches
      const matches = await findMatchesForRequest(requestId);

      expect(matches).toHaveLength(0);
    });

    it('should prioritize higher-rated gillers', async () => {
      const requestId = generateId('request');

      // Seed gillers with different ratings
      const highRatedGiller = createTestData('user', {
        id: generateId('giller'),
        name: '고평점',
        rating: 4.8,
        completedDeliveries: 50,
      });
      const lowRatedGiller = createTestData('user', {
        id: generateId('giller'),
        name: '저평점',
        rating: 3.5,
        completedDeliveries: 5,
      });

      mockFirestore.seedData('users', [highRatedGiller, lowRatedGiller]);
      mockFirestore.seedData('routes', [
        {
          id: generateId('route'),
          userId: highRatedGiller.id,
          startStation: { name: '서울역' },
          endStation: { name: '강남역' },
          isActive: true,
        },
        {
          id: generateId('route'),
          userId: lowRatedGiller.id,
          startStation: { name: '서울역' },
          endStation: { name: '강남역' },
          isActive: true,
        },
      ]);

      const requestData = createTestData('request', { id: requestId });
      mockFirestore.seedData('requests', [requestData]);

      const matches = await findMatchesForRequest(requestId, 2);

      // Higher rated giller should appear first
      expect(matches[0].rating).toBeGreaterThan(matches[1]?.rating || 0);
    });
  });

  describe('Match Acceptance Flow', () => {
    it('should successfully accept a match', async () => {
      const requestId = generateId('request');
      const gillerId = generateId('giller');

      // Create match
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
      expect(result.deliveryId).toBeDefined();
    });

    it('should fail to accept already matched request', async () => {
      const requestId = generateId('request');
      const gillerId = generateId('giller');

      const requestData = createTestData('request', {
        id: requestId,
        status: 'matched', // Already matched
      });
      mockFirestore.seedData('requests', [requestData]);

      const result = await acceptRequest(requestId, gillerId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('이미 매칭');
    });

    it('should create chat room on match acceptance', async () => {
      const requestId = generateId('request');
      const gillerId = generateId('giller');
      const requesterId = generateId('user');

      // Seed users
      mockFirestore.seedData('users', [
        { id: requesterId, name: '요청자' },
        { id: gillerId, name: '기일러' },
      ]);

      // Seed request
      const requestData = createTestData('request', {
        id: requestId,
        requesterId,
      });
      mockFirestore.seedData('requests', [requestData]);

      // Seed match
      const matchData = createTestData('match', {
        id: generateId('match'),
        requestId,
        gillerId,
      });
      mockFirestore.seedData('matches', [matchData]);

      // Accept match
      const result = await acceptRequest(requestId, gillerId);

      // Verify chat room created
      const chatRooms = mockFirestore.getAll().get('chatRooms') || [];
      expect(chatRooms.length).toBeGreaterThan(0);
    });
  });

  describe('Match Rejection Flow', () => {
    it('should successfully decline a match', async () => {
      const requestId = generateId('request');
      const gillerId = generateId('giller');

      const matchData = createTestData('match', {
        id: generateId('match'),
        requestId,
        gillerId,
        status: 'pending',
      });
      mockFirestore.seedData('matches', [matchData]);

      const result = await declineRequest(requestId, gillerId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('거절');
    });

    it('should allow finding another giller after rejection', async () => {
      const requestId = generateId('request');
      const giller1Id = generateId('giller');
      const giller2Id = generateId('giller');

      // Seed gillers and routes
      mockFirestore.seedData('users', [
        { id: giller1Id, name: '기일러1', rating: 4.0 },
        { id: giller2Id, name: '기일러2', rating: 4.5 },
      ]);
      mockFirestore.seedData('routes', [
        {
          id: generateId('route'),
          userId: giller1Id,
          startStation: { name: '서울역' },
          endStation: { name: '강남역' },
          isActive: true,
        },
        {
          id: generateId('route'),
          userId: giller2Id,
          startStation: { name: '서울역' },
          endStation: { name: '강남역' },
          isActive: true,
        },
      ]);

      const requestData = createTestData('request', { id: requestId });
      mockFirestore.seedData('requests', [requestData]);

      // First match
      let matches = await findMatchesForRequest(requestId);
      expect(matches.length).toBeGreaterThan(0);

      // Decline first giller
      await declineRequest(requestId, matches[0].gillerId);

      // Find new matches (should exclude declined giller)
      matches = await findMatchesForRequest(requestId);
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
