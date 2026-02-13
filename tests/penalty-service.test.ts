/**
 * Penalty Service Tests
 * 페널티 시스템 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  applyPenalty,
  getPenalties,
  getUserPenaltyScore,
  checkPenaltyStatus,
  clearPenalty,
  calculateDelayPenalty,
  calculateNoShowPenalty,
} from '../src/services/penalty-service';
import { doc, getDoc, deleteDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { PenaltyType, PenaltyStatus } from '../src/types/penalty';

describe('Penalty Service', () => {
  const testUserId = 'test-user-penalty-001';
  const testGillerId = 'test-giller-penalty-001';
  const createdPenaltyIds: string[] = [];

  beforeEach(async () => {
    // Cleanup: Delete test penalties
    const snapshot = await getDocs(
      query(
        collection(db, 'penalties'),
        where('userId', '==', testUserId)
      )
    );

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  });

  afterEach(async () => {
    // Cleanup: Delete all test penalties
    for (const penaltyId of createdPenaltyIds) {
      try {
        await deleteDoc(doc(db, 'penalties', penaltyId));
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    }
    createdPenaltyIds.length = 0;
  });

  describe('applyPenalty', () => {
    test('should apply a delay penalty successfully', async () => {
      const penaltyId = await applyPenalty(
        testUserId,
        PenaltyType.DELAY,
        {
          delayMinutes: 20,
          matchId: 'test-match-001',
          ratingDeduction: 0.5,
          amount: 1000,
        }
      );

      expect(penaltyId).toBeDefined();
      expect(typeof penaltyId).toBe('string');

      createdPenaltyIds.push(penaltyId);

      const penaltyDoc = await getDoc(doc(db, 'penalties', penaltyId));
      expect(penaltyDoc.exists()).toBe(true);

      const penalty = penaltyDoc.data();
      expect(penalty?.userId).toBe(testUserId);
      expect(penalty?.type).toBe(PenaltyType.DELAY);
      expect(penalty?.status).toBe(PenaltyStatus.ACTIVE);
      expect(penalty?.delayMinutes).toBe(20);
      expect(penalty?.ratingDeduction).toBe(0.5);
      expect(penalty?.amount).toBe(1000);
    });

    test('should apply a no-show penalty successfully', async () => {
      const penaltyId = await applyPenalty(
        testUserId,
        PenaltyType.NO_SHOW,
        {
          matchId: 'test-match-002',
          ratingDeduction: 2.0,
          suspensionDays: 30,
        }
      );

      expect(penaltyId).toBeDefined();
      createdPenaltyIds.push(penaltyId);

      const penaltyDoc = await getDoc(doc(db, 'penalties', penaltyId));
      const penalty = penaltyDoc.data();

      expect(penalty?.type).toBe(PenaltyType.NO_SHOW);
      expect(penalty?.ratingDeduction).toBe(2.0);
      expect(penalty?.suspensionDays).toBe(30);
    });
  });

  describe('getPenalties', () => {
    test('should get all penalties for a user', async () => {
      // Create multiple penalties
      const penalty1Id = await applyPenalty(
        testUserId,
        PenaltyType.DELAY,
        { delayMinutes: 10, matchId: 'test-match-001', ratingDeduction: 0 }
      );

      const penalty2Id = await applyPenalty(
        testUserId,
        PenaltyType.CANCELLATION,
        {
          matchId: 'test-match-002',
          ratingDeduction: 0.5,
          cancellationFee: 3000,
        }
      );

      createdPenaltyIds.push(penalty1Id, penalty2Id);

      // Get penalties
      const penalties = await getPenalties(testUserId);

      expect(penalties.length).toBeGreaterThanOrEqual(2);
      expect(penalties.every(p => p.userId === testUserId)).toBe(true);
    });

    test('should filter penalties by status', async () => {
      // Create penalties with different statuses
      const penalty1Id = await applyPenalty(
        testUserId,
        PenaltyType.DELAY,
        { delayMinutes: 10, matchId: 'test-match-001', ratingDeduction: 0 }
      );

      const penalty2Id = await applyPenalty(
        testUserId,
        PenaltyType.WARNING,
        { reason: 'Test warning', matchId: 'test-match-002' }
      );

      createdPenaltyIds.push(penalty1Id, penalty2Id);

      // Get active penalties only
      const activePenalties = await getPenalties(testUserId, PenaltyStatus.ACTIVE);

      expect(activePenalties.length).toBeGreaterThanOrEqual(2);
      expect(activePenalties.every(p => p.status === PenaltyStatus.ACTIVE)).toBe(true);
    });
  });

  describe('getUserPenaltyScore', () => {
    test('should calculate penalty score correctly', async () => {
      // Create multiple penalties
      const penalty1Id = await applyPenalty(
        testUserId,
        PenaltyType.DELAY,
        {
          delayMinutes: 20,
          matchId: 'test-match-001',
          ratingDeduction: 0.5,
          amount: 1000,
        }
      );

      const penalty2Id = await applyPenalty(
        testUserId,
        PenaltyType.NO_SHOW,
        {
          matchId: 'test-match-002',
          ratingDeduction: 2.0,
          suspensionDays: 30,
        }
      );

      createdPenaltyIds.push(penalty1Id, penalty2Id);

      // Get penalty score
      const score = await getUserPenaltyScore(testUserId);

      expect(score).toBeDefined();
      expect(score.totalPenalties).toBeGreaterThanOrEqual(2);
      expect(score.totalRatingDeduction).toBeGreaterThan(0);
      expect(score.totalSuspensionDays).toBeGreaterThan(0);
      expect(score.currentSuspension).toBeDefined();
    });

    test('should return zero score for user with no penalties', async () => {
      const score = await getUserPenaltyScore('user-with-no-penalties');

      expect(score.totalPenalties).toBe(0);
      expect(score.totalRatingDeduction).toBe(0);
      expect(score.totalSuspensionDays).toBe(0);
    });
  });

  describe('checkPenaltyStatus', () => {
    test('should check if user is currently suspended', async () => {
      // Apply no-show penalty with suspension
      const penaltyId = await applyPenalty(
        testUserId,
        PenaltyType.NO_SHOW,
        {
          matchId: 'test-match-001',
          ratingDeduction: 2.0,
          suspensionDays: 30,
        }
      );

      createdPenaltyIds.push(penaltyId);

      // Check penalty status
      const status = await checkPenaltyStatus(testUserId);

      expect(status.isSuspended).toBe(true);
      expect(status.suspensionEndDate).toBeDefined();
      expect(status.activePenalties).toBeGreaterThanOrEqual(1);
    });

    test('should return not suspended for user with no active suspensions', async () => {
      const status = await checkPenaltyStatus('user-with-no-suspension');

      expect(status.isSuspended).toBe(false);
      expect(status.suspensionEndDate).toBeNull();
    });
  });

  describe('clearPenalty', () => {
    test('should clear a penalty successfully', async () => {
      // Create a penalty
      const penaltyId = await applyPenalty(
        testUserId,
        PenaltyType.DELAY,
        {
          delayMinutes: 10,
          matchId: 'test-match-001',
          ratingDeduction: 0,
        }
      );

      createdPenaltyIds.push(penaltyId);

      // Clear the penalty
      await expect(clearPenalty(penaltyId, 'Admin clearance')).resolves.not.toThrow();

      const penaltyDoc = await getDoc(doc(db, 'penalties', penaltyId));
      const penalty = penaltyDoc.data();

      expect(penalty?.status).toBe(PenaltyStatus.CLEARED);
      expect(penalty?.clearedAt).toBeDefined();
      expect(penalty?.clearedBy).toBe('Admin clearance');
    });
  });

  describe('calculateDelayPenalty', () => {
    test('should calculate delay penalty correctly', async () => {
      // 5-15 minutes: warning
      const penalty1 = calculateDelayPenalty(10);
      expect(penalty1.ratingDeduction).toBe(0);
      expect(penalty1.amount).toBe(0);
      expect(penalty1.suspensionDays).toBe(0);

      // 15-30 minutes: -0.5 rating + 1,000 KRW
      const penalty2 = calculateDelayPenalty(20);
      expect(penalty2.ratingDeduction).toBe(0.5);
      expect(penalty2.amount).toBe(1000);
      expect(penalty2.suspensionDays).toBe(0);

      // 30+ minutes: -1.0 rating + 7 days suspension
      const penalty3 = calculateDelayPenalty(35);
      expect(penalty3.ratingDeduction).toBe(1.0);
      expect(penalty3.amount).toBe(0);
      expect(penalty3.suspensionDays).toBe(7);
    });
  });

  describe('calculateNoShowPenalty', () => {
    test('should calculate no-show penalty correctly', async () => {
      // First offense: -2.0 rating + 30 days suspension
      const penalty1 = calculateNoShowPenalty(1);
      expect(penalty1.ratingDeduction).toBe(2.0);
      expect(penalty1.suspensionDays).toBe(30);

      // Second offense: -2.0 rating + 60 days suspension
      const penalty2 = calculateNoShowPenalty(2);
      expect(penalty2.ratingDeduction).toBe(2.0);
      expect(penalty2.suspensionDays).toBe(60);

      // Third offense: Permanent suspension
      const penalty3 = calculateNoShowPenalty(3);
      expect(penalty3.ratingDeduction).toBe(2.0);
      expect(penalty3.suspensionDays).toBe(-1); // -1 means permanent
      expect(penalty3.isPermanent).toBe(true);
    });
  });
});
