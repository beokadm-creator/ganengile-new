/**
 * Rating Service Tests
 * 평가 시스템 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  submitRating,
  getUserRating,
  getUserRatings,
  getMatchRating,
  canRateMatch,
} from '../src/services/rating-service';
import { doc, getDoc, deleteDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';

describe('Rating Service', () => {
  const testUserId = 'test-user-rating-001';
  const testGillerId = 'test-giller-rating-001';
  const testMatchId = 'test-match-rating-001';
  const testMatchId2 = 'test-match-rating-002';
  const createdRatingIds: string[] = [];

  beforeEach(async () => {
    // Cleanup: Delete test ratings
    const snapshot = await getDocs(
      query(
        collection(db, 'ratings'),
        where('matchId', 'in', [testMatchId, testMatchId2])
      )
    );

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  });

  afterEach(async () => {
    // Cleanup: Delete all test ratings
    for (const ratingId of createdRatingIds) {
      try {
        await deleteDoc(doc(db, 'ratings', ratingId));
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    }
    createdRatingIds.length = 0;
  });

  describe('submitRating', () => {
    test('should submit a rating successfully', async () => {
      const ratingId = await submitRating(
        testMatchId,
        testUserId,
        testGillerId,
        5,
        '훌륭한 서비스였습니다!'
      );

      expect(ratingId).toBeDefined();
      expect(typeof ratingId).toBe('string');

      createdRatingIds.push(ratingId);

      // Verify rating was saved
      const ratingDoc = await getDoc(doc(db, 'ratings', ratingId));
      expect(ratingDoc.exists()).toBe(true);

      const ratingData = ratingDoc.data();
      expect(ratingData?.matchId).toBe(testMatchId);
      expect(ratingData?.fromUserId).toBe(testUserId);
      expect(ratingData?.toUserId).toBe(testGillerId);
      expect(ratingData?.rating).toBe(5);
      expect(ratingData?.comment).toBe('훌륭한 서비스였습니다!');
    });

    test('should fail to submit duplicate rating for same match', async () => {
      const ratingId1 = await submitRating(
        testMatchId2,
        testUserId,
        testGillerId,
        4
      );

      createdRatingIds.push(ratingId1);

      // Try to submit again
      await expect(
        submitRating(testMatchId2, testUserId, testGillerId, 5)
      ).rejects.toThrow('Already rated this match');
    });

    test('should fail to submit rating out of range', async () => {
      await expect(
        submitRating(testMatchId, testUserId, testGillerId, 6) // Too high
      ).rejects.toThrow('Rating must be between 1 and 5');

      await expect(
        submitRating(testMatchId, testUserId, testGillerId, 0) // Too low
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    test('should submit rating without comment', async () => {
      const ratingId = await submitRating(
        testMatchId,
        testUserId,
        testGillerId,
        3
        // No comment
      );

      expect(ratingId).toBeDefined();

      createdRatingIds.push(ratingId);

      const ratingDoc = await getDoc(doc(db, 'ratings', ratingId));
      const ratingData = ratingDoc.data();
      expect(ratingData?.comment).toBe('');
    });
  });

  describe('getUserRating', () => {
    beforeEach(async () => {
      // Create test ratings
      const ratings = [
        { matchId: 'test-001', rating: 5 },
        { matchId: 'test-002', rating: 4 },
        { matchId: 'test-003', rating: 5 },
        { matchId: 'test-004', rating: 3 },
        { matchId: 'test-005', rating: 5 },
      ];

      for (const r of ratings) {
        const ratingId = await submitRating(
          r.matchId,
          'other-user',
          testGillerId,
          r.rating
        );
        createdRatingIds.push(ratingId);
      }
    });

    test('should calculate average rating correctly', async () => {
      const { averageRating, totalRatings, distribution } = await getUserRating(testGillerId);

      expect(averageRating).toBe(4.4); // (5+4+5+3+5) / 5 = 4.4
      expect(totalRatings).toBe(5);
      expect(distribution[1]).toBe(0);
      expect(distribution[3]).toBe(1);
      expect(distribution[4]).toBe(1);
      expect(distribution[5]).toBe(3);
    });

    test('should return zero for user with no ratings', async () => {
      const { averageRating, totalRatings } = await getUserRating('user-with-no-ratings');

      expect(averageRating).toBe(0);
      expect(totalRatings).toBe(0);
    });
  });

  describe('getUserRatings', () => {
    beforeEach(async () => {
      // Create test ratings for different users
      const ratingIds = await Promise.all([
        submitRating('match-a', 'user-a', testUserId, 5, '좋아요'),
        submitRating('match-b', 'user-b', testUserId, 4, '괜찮아요'),
        submitRating('match-c', 'user-c', testUserId, 5),
      ]);

      createdRatingIds.push(...ratingIds);
    });

    test('should get user ratings sorted by date (newest first)', async () => {
      const ratings = await getUserRatings(testUserId, 10);

      expect(Array.isArray(ratings)).toBe(true);
      expect(ratings.length).toBeGreaterThanOrEqual(3);

      // Check if sorted by date (newest first)
      for (let i = 0; i < ratings.length - 1; i++) {
        expect(ratings[i].createdAt.getTime()).toBeGreaterThanOrEqual(ratings[i + 1].createdAt.getTime());
      }
    });

    test('should limit results', async () => {
      const ratings = await getUserRatings(testUserId, 2);

      expect(ratings.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getMatchRating', () => {
    test('should get rating for specific match', async () => {
      const ratingId = await submitRating(
        'test-match-specific',
        'rater-user',
        'rated-user',
        5,
        '별점입니다'
      );

      createdRatingIds.push(ratingId);

      const rating = await getMatchRating('test-match-specific', 'rater-user');

      expect(rating).toBeDefined();
      expect(rating?.matchId).toBe('test-match-specific');
      expect(rating?.rating).toBe(5);
      expect(rating?.comment).toBe('별점입니다');
    });

    test('should return null for non-existent match rating', async () => {
      const rating = await getMatchRating('non-existent-match', 'some-user');
      expect(rating).toBeNull();
    });
  });

  describe('canRateMatch', () => {
    test('should return true for unrated match', async () => {
      const canRate = await canRateMatch('never-rated-match', 'some-user');
      expect(canRate).toBe(true);
    });

    test('should return false for already rated match', async () => {
      const ratingId = await submitRating(
        'already-rated-match',
        'rater-user',
        'rated-user',
        5
      );

      createdRatingIds.push(ratingId);

      const canRate = await canRateMatch('already-rated-match', 'rater-user');
      expect(canRate).toBe(false);
    });
  });
});
