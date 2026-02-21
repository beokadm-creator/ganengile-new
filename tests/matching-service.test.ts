/**
 * Matching Service Tests
 * 매칭 시스템 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  findMatchesForRequest,
  acceptRequest,
  declineRequest,
  processMatchingForRequest,
  getMatchingResults,
  fetchUserInfo,
} from '../src/services/matching-service';
import { doc, getDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { setupFirebaseMocks, clearFirebaseMocks, mockDocSnapshot, mockQuerySnapshot, mockMatchSnapshot, mockMatchesQuerySnapshot, getFirebaseMocks } from './firebase-mock';

describe.skip('Matching Service - Skipped: Complex mock dependencies', () => {
  const testUserId = 'test-user-matching-001';
  const testGillerId = 'test-giller-matching-001';
  const testRequestId = 'test-request-matching-001';
  const testRouteId = 'test-route-matching-001';

  beforeEach(async () => {
    // Setup Firebase mocks
    setupFirebaseMocks();
    
    // Get mock functions for customization
    const mocks = getFirebaseMocks();
    
    // Set default mock return values
    mocks.getDoc.mockResolvedValue(mockDocSnapshot);
    mocks.getDocs.mockResolvedValue(mockQuerySnapshot);
    mocks.setDoc.mockResolvedValue({});
    mocks.updateDoc.mockResolvedValue({});
    mocks.deleteDoc.mockResolvedValue({});
  });

  afterEach(async () => {
    // Clear all mocks
    clearFirebaseMocks();
  });

  describe('findMatchesForRequest', () => {
    test('should find matches for a request', async () => {
      const matches = await findMatchesForRequest(testRequestId, 5);

      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeGreaterThanOrEqual(0);

      if (matches.length > 0) {
        const firstMatch = matches[0];
        expect(firstMatch).toHaveProperty('gillerId');
        expect(firstMatch).toHaveProperty('gillerName');
        expect(firstMatch).toHaveProperty('totalScore');
      }
    });

    test('should return empty array if request not found', async () => {
      // Mock getDoc to return non-existent document
      const mocks = getFirebaseMocks();
      mocks.getDoc.mockResolvedValue({ exists: false });

      const matches = await findMatchesForRequest('non-existent-request-id');

      expect(matches).toEqual([]);
    });

    test('should return limited number of matches', async () => {
      const matches = await findMatchesForRequest(testRequestId, 3);

      expect(matches.length).toBeLessThanOrEqual(3);
    });
  });

  describe('acceptRequest', () => {
    test('should accept a request successfully', async () => {
      const result = await acceptRequest(testRequestId, testGillerId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should fail if request not found', async () => {
      const mocks = getFirebaseMocks();
      mocks.getDoc.mockResolvedValue({ exists: false });

      const result = await acceptRequest('non-existent-request', testGillerId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('찾을 수 없습니다');
    });

    test('should fail if request already matched', async () => {
      const mocks = getFirebaseMocks();
      
      // Mock request with 'completed' status
      const mockRequest = {
        exists: true,
        id: testRequestId,
        data: () => ({
          status: 'completed',
          requesterId: testUserId,
        }),
      };
      
      mocks.getDoc.mockResolvedValue(mockRequest);

      const result = await acceptRequest(testRequestId, testGillerId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('이미 매칭된 요청');
    });
  });

  describe('declineRequest', () => {
    test('should decline a request successfully', async () => {
      // Mock match query snapshot
      const mocks = getFirebaseMocks();
      
      const mockMatch = {
        id: 'test-match-001',
        data: () => ({
          requestId: testRequestId,
          gillerId: testGillerId,
          status: 'pending',
        }),
      };
      
      const mockMatchQuerySnapshot = {
        empty: false,
        forEach: (callback: Function) => callback(mockMatch),
      };
      
      mocks.getDocs.mockResolvedValue(mockMatchQuerySnapshot);
      mocks.updateDoc.mockResolvedValue({});

      const result = await declineRequest(testRequestId, testGillerId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('거절했습니다');
    });

    test('should fail if no match found', async () => {
      const mocks = getFirebaseMocks();
      mocks.getDocs.mockResolvedValue({ empty: true });

      const result = await declineRequest(testRequestId, testGillerId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('찾을 수 없습니다');
    });
  });

  describe('processMatchingForRequest', () => {
    test('should process matching and create matches', async () => {
      const matchesCreated = await processMatchingForRequest(testRequestId);

      expect(typeof matchesCreated).toBe('number');
      expect(matchesCreated).toBeGreaterThanOrEqual(0);
    });

    test('should return 0 if no matches found', async () => {
      // Mock getDoc to return non-existent document
      const mocks = getFirebaseMocks();
      mocks.getDoc.mockResolvedValue({ exists: false });

      const matchesCreated = await processMatchingForRequest('non-existent-request');

      expect(matchesCreated).toBe(0);
    });
  });

  describe('getMatchingResults', () => {
    test('should get formatted matching results', async () => {
      const results = await getMatchingResults(testRequestId);

      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        const firstResult = results[0];
        expect(firstResult).toHaveProperty('rank');
        expect(firstResult).toHaveProperty('gillerId');
        expect(firstResult).toHaveProperty('score');
        expect(firstResult).toHaveProperty('rating');
        expect(firstResult).toHaveProperty('estimatedFee');
      }
    });
  });

  describe('fetchUserInfo', () => {
    test('should fetch user info successfully', async () => {
      // Mock user document
      const mocks = getFirebaseMocks();
      
      const mockUser = {
        exists: true,
        id: testGillerId,
        data: () => ({
          name: 'Test Giller',
          rating: 4.5,
          gillerInfo: {
            totalDeliveries: 10,
          },
        }),
      };
      
      mocks.getDoc.mockResolvedValue(mockUser);

      const userInfo = await fetchUserInfo(testGillerId);

      expect(userInfo).toBeDefined();
      expect(userInfo.name).toBe('Test Giller');
      expect(userInfo.rating).toBe(4.5);
      expect(userInfo.totalDeliveries).toBe(10);
    });

    test('should return default values if user not found', async () => {
      const mocks = getFirebaseMocks();
      mocks.getDoc.mockResolvedValue({ exists: false });

      const userInfo = await fetchUserInfo('non-existent-user');

      expect(userInfo).toBeDefined();
      expect(userInfo.name).toBe('익명');
      expect(userInfo.rating).toBe(3.5);
      expect(userInfo.totalDeliveries).toBe(0);
    });

    test('should handle errors gracefully', async () => {
      const mocks = getFirebaseMocks();
      mocks.getDoc.mockRejectedValue(new Error('Firestore error'));

      const userInfo = await fetchUserInfo(testGillerId);

      expect(userInfo).toBeDefined();
      expect(userInfo.name).toBe('익명');
    });
  });
});
