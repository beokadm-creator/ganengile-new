/**
 * Rating Service Tests
 * 평가 시스템 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  submitRating,
  getUserRating,
  getUserReviews,
  getMatchRating,
  canRateMatch,
} from '../src/services/rating-service';
import { doc, getDoc, deleteDoc, getDocs, setDoc, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { RatingTag } from '../src/types/rating';

describe.skip('Rating Service - Skipped: Mock data conflicts', () => {
  const testUserId = 'test-user-rating-001';
  const testGillerId = 'test-giller-rating-001';
  const createdRatingIds: string[] = [];

  beforeEach(async () => {
    // Cleanup: Delete test ratings
    const snapshot = await getDocs(
      query(
        collection(db, 'ratings'),
        where('fromUserId', '==', testUserId)
      )
    );

    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);

    // Cleanup for giller
    const gillerSnapshot = await getDocs(
      query(
        collection(db, 'ratings'),
        where('toUserId', '==', testGillerId)
      )
    );

    const gillerDeletePromises = gillerSnapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(gillerDeletePromises);
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
        'test-match-submit-1',
        testUserId,
        testGillerId,
        5,
        [RatingTag.FRIENDLY, RatingTag.FAST],
        '훌륭한 서비스였습니다!',
        false
      );

      expect(ratingId).toBeDefined();
      expect(typeof ratingId).toBe('string');

      createdRatingIds.push(ratingId);

      const ratingDoc = await getDoc(doc(db, 'ratings', ratingId));
      expect(ratingDoc.exists).toBe(true);

      const ratingData = ratingDoc.data();
      expect(ratingData?.matchId).toBe('test-match-submit-1');
      expect(ratingData?.fromUserId).toBe(testUserId);
      expect(ratingData?.toUserId).toBe(testGillerId);
      expect(ratingData?.rating).toBe(5);
      expect(ratingData?.comment).toBe('훌륭한 서비스였습니다!');
      expect(ratingData?.tags).toContain(RatingTag.FRIENDLY);
      expect(ratingData?.isAnonymous).toBe(false);
    });

    test('should fail to submit duplicate rating for same match', async () => {
      const ratingId1 = await submitRating(
        'test-match-duplicate',
        testUserId,
        testGillerId,
        4,
        [],
        undefined,
        false
      );

      createdRatingIds.push(ratingId1);

      await expect(
        submitRating('test-match-duplicate', testUserId, testGillerId, 5, [], undefined, false)
      ).rejects.toThrow('Already rated this match');
    });

    test('should fail to submit rating out of range', async () => {
      await expect(
        submitRating('test-match-range-1', testUserId, testGillerId, 6, [], undefined, false)
      ).rejects.toThrow('Rating must be between 1 and 5');

      await expect(
        submitRating('test-match-range-2', testUserId, testGillerId, 0, [], undefined, false)
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    test('should submit rating without comment', async () => {
      const ratingId = await submitRating(
        'test-match-no-comment',
        testUserId,
        testGillerId,
        3,
        [],
        undefined,
        false
      );

      expect(ratingId).toBeDefined();

      createdRatingIds.push(ratingId);

      const ratingDoc = await getDoc(doc(db, 'ratings', ratingId));
      const ratingData = ratingDoc.data();
      expect(ratingData?.comment).toBe('');
    });

    test('should submit anonymous rating', async () => {
      const ratingId = await submitRating(
        'test-match-anonymous',
        testUserId,
        testGillerId,
        5,
        [RatingTag.TRUSTWORTHY],
        '익명 리뷰',
        true
      );

      expect(ratingId).toBeDefined();
      createdRatingIds.push(ratingId);

      const ratingDoc = await getDoc(doc(db, 'ratings', ratingId));
      const ratingData = ratingDoc.data();
      expect(ratingData?.isAnonymous).toBe(true);
    });
  });

  describe('getUserRating', () => {
    test('should calculate average rating correctly', async () => {
      const gillerId = 'test-giller-calc-001';

      // Create ratings
      const ratings = [
        { matchId: 'test-calc-001', rating: 5 },
        { matchId: 'test-calc-002', rating: 4 },
        { matchId: 'test-calc-003', rating: 5 },
        { matchId: 'test-calc-004', rating: 3 },
        { matchId: 'test-calc-005', rating: 5 },
      ];

      for (const r of ratings) {
        const ratingId = await submitRating(
          r.matchId,
          'rater-user',
          gillerId,
          r.rating,
          [],
          undefined,
          false
        );
        createdRatingIds.push(ratingId);
      }

      const { averageRating, totalRatings } = await getUserRating(gillerId);

      expect(averageRating).toBe(4.4);
      expect(totalRatings).toBe(5);
    });

    test('should return zero for user with no ratings', async () => {
      const { averageRating, totalRatings } = await getUserRating('user-with-no-ratings');

      expect(averageRating).toBe(0);
      expect(totalRatings).toBe(0);
    });
  });

  describe('getUserReviews', () => {
    test('should get user reviews sorted by date (newest first)', async () => {
      const reviewUserId = 'test-review-user-001';

      const ratingIds = await Promise.all([
        submitRating('match-a', 'user-a', reviewUserId, 5, [RatingTag.FRIENDLY], '좋아요', false),
        submitRating('match-b', 'user-b', reviewUserId, 4, [RatingTag.FAST], '괜찮아요', false),
        submitRating('match-c', 'user-c', reviewUserId, 5, [RatingTag.TRUSTWORTHY], undefined, false),
      ]);

      createdRatingIds.push(...ratingIds);

      const reviews = await getUserReviews(reviewUserId, 10);

      expect(Array.isArray(reviews)).toBe(true);
      expect(reviews.length).toBeGreaterThanOrEqual(3);
    });

    test('should limit results', async () => {
      const reviewUserId = 'test-review-user-002';

      const ratingIds = await Promise.all([
        submitRating('match-limit-1', 'user-a', reviewUserId, 5, [], '리뷰1', false),
        submitRating('match-limit-2', 'user-b', reviewUserId, 4, [], '리뷰2', false),
        submitRating('match-limit-3', 'user-c', reviewUserId, 5, [], '리뷰3', false),
      ]);

      createdRatingIds.push(...ratingIds);

      const reviews = await getUserReviews(reviewUserId, 2);

      expect(reviews.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getMatchRating', () => {
    test('should get rating for specific match', async () => {
      const ratingId = await submitRating(
        'test-match-specific',
        'rater-user',
        'rated-user',
        5,
        [RatingTag.FRIENDLY],
        '별점입니다',
        false
      );

      createdRatingIds.push(ratingId);

      const rating = await getMatchRating('test-match-specific', 'rater-user');

      expect(rating).toBeDefined();
      expect(rating?.matchId).toBe('test-match-specific');
    });
  });

  describe('canRateMatch', () => {
    test('should return true for unrated match', async () => {
      const canRate = await canRateMatch('unrated-match', 'rater-user');

      expect(canRate).toBe(true);
    });

    test('should return false for already rated match', async () => {
      const ratingId = await submitRating(
        'already-rated-match',
        'rater-user',
        'rated-user',
        5,
        [],
        undefined,
        false
      );

      createdRatingIds.push(ratingId);

      const canRate = await canRateMatch('already-rated-match', 'rater-user');

      expect(canRate).toBe(false);
    });
  });
});
