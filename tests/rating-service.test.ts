/**
 * Rating Service Tests
 * 현재 공개 API 기준 smoke 회귀 테스트
 */

import { beforeEach, describe, expect, test } from '@jest/globals';

jest.mock('../src/services/notification-service', () => ({
  notifyDeliveryEvent: jest.fn().mockResolvedValue(undefined),
}));

import {
  canRateMatch,
  getMatchRating,
  getUserRating,
  getUserReviews,
  submitRating,
} from '../src/services/rating-service';
import { RatingTag } from '../src/types/rating';

describe('Rating Service', () => {
  const fromUserId = 'test-user-rating-001';
  const toUserId = 'test-giller-rating-001';

  beforeEach(() => {
    global.__clearMockFirestore();
  });

  test('submits a rating and loads it back by match', async () => {
    const ratingId = await submitRating(
      'match-rating-001',
      fromUserId,
      toUserId,
      5,
      [RatingTag.FRIENDLY, RatingTag.FAST],
      '훌륭한 서비스였습니다!',
      false
    );

    expect(typeof ratingId).toBe('string');

    const rating = await getMatchRating('match-rating-001', fromUserId);

    expect(rating).toEqual(
      expect.objectContaining({
        ratingId,
        matchId: 'match-rating-001',
        fromUserId,
        toUserId,
        rating: 5,
        comment: '훌륭한 서비스였습니다!',
        isAnonymous: false,
      })
    );
  });

  test('rejects duplicate ratings for the same match', async () => {
    await submitRating('match-duplicate-001', fromUserId, toUserId, 4, [], undefined, false);

    await expect(
      submitRating('match-duplicate-001', fromUserId, toUserId, 5, [], undefined, false)
    ).rejects.toThrow('Already rated this match');
  });

  test('calculates average rating summary', async () => {
    await submitRating('match-summary-001', 'user-a', toUserId, 5, [], undefined, false);
    await submitRating('match-summary-002', 'user-b', toUserId, 4, [], undefined, false);
    await submitRating('match-summary-003', 'user-c', toUserId, 3, [], undefined, false);

    const summary = await getUserRating(toUserId);

    expect(summary.averageRating).toBe(4);
    expect(summary.totalRatings).toBe(3);
    expect(summary.distribution[5]).toBe(1);
    expect(summary.distribution[4]).toBe(1);
    expect(summary.distribution[3]).toBe(1);
  });

  test('returns reviews for a rated user', async () => {
    await submitRating('match-review-001', 'user-a', toUserId, 5, [RatingTag.FRIENDLY], '좋아요', false);
    await submitRating('match-review-002', 'user-b', toUserId, 4, [RatingTag.TRUSTWORTHY], '', true);

    const reviews = await getUserReviews(toUserId, 10);

    expect(reviews.length).toBeGreaterThanOrEqual(2);
    expect(reviews[0]).toEqual(
      expect.objectContaining({
        rating: expect.any(Number),
        fromUser: expect.objectContaining({
          userId: expect.any(String),
          name: expect.any(String),
        }),
      })
    );
  });

  test('checks if a user can still rate a match', async () => {
    expect(await canRateMatch('match-can-rate-001', fromUserId)).toBe(true);

    await submitRating('match-can-rate-001', fromUserId, toUserId, 5, [], undefined, false);

    expect(await canRateMatch('match-can-rate-001', fromUserId)).toBe(false);
  });
});
