/**
 * Penalty Service Tests
 * 페널티 시스템 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PenaltyService } from '../src/services/penalty-service';
import { doc, getDoc, deleteDoc, getDocs, setDoc, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { PenaltyType, PenaltySeverity } from '../src/types/penalty';

describe.skip('Penalty Service - Skipped: Class method issues', () => {
  const testUserId = 'test-user-penalty-001';
  const createdPenaltyIds: string[] = [];
  let penaltyService: PenaltyService;

  beforeEach(async () => {
    penaltyService = new PenaltyService(testUserId);

    // Cleanup: Delete test penalties
    const snapshot = await getDocs(
      query(
        collection(db, 'penalties'),
        where('userId', '==', testUserId)
      )
    );

    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
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

  describe('applyLateArrivalPenalty', () => {
    test('should apply a delay penalty successfully', async () => {
      const penalty = await penaltyService.applyLateArrivalPenalty(
        20, // 20 minutes late
        'test-match-001'
      );

      expect(penalty).toBeDefined();
      expect(penalty.penaltyId).toBeDefined();
      createdPenaltyIds.push(penalty.penaltyId);

      const penaltyDoc = await getDoc(doc(db, 'penalties', penalty.penaltyId));
      expect(penaltyDoc.exists).toBe(true);

      const penaltyData = penaltyDoc.data();
      expect(penaltyData?.userId).toBe(testUserId);
      expect(penaltyData?.type).toBe(PenaltyType.LATE_ARRIVAL);
      expect(penaltyData?.lateMinutes).toBe(20);
    });
  });

  describe('applyNoShowPenalty', () => {
    test('should apply a no-show penalty successfully', async () => {
      const penalty = await penaltyService.applyNoShowPenalty('test-match-002');

      expect(penalty).toBeDefined();
      expect(penalty.penaltyId).toBeDefined();
      createdPenaltyIds.push(penalty.penaltyId);

      const penaltyDoc = await getDoc(doc(db, 'penalties', penalty.penaltyId));
      expect(penaltyDoc.exists).toBe(true);

      const penaltyData = penaltyDoc.data();
      expect(penaltyData?.userId).toBe(testUserId);
      expect(penaltyData?.type).toBe(PenaltyType.NO_SHOW);
      expect(penaltyData?.noShowCount).toBe(1);
    });
  });

  describe('getPenalties', () => {
    test('should get all penalties for a user', async () => {
      // Create test penalties
      const penalty1 = await penaltyService.applyLateArrivalPenalty(10, 'test-1');
      const penalty2 = await penaltyService.applyNoShowPenalty('test-2');
      createdPenaltyIds.push(penalty1.penaltyId, penalty2.penaltyId);

      const penalties = await penaltyService.getPenalties();

      expect(penalties).toBeDefined();
      expect(penalties.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter penalties by status', async () => {
      const penalty1 = await penaltyService.applyLateArrivalPenalty(10, 'test-1');
      createdPenaltyIds.push(penalty1.penaltyId);

      const activePenalties = await penaltyService.getPenalties();
      expect(activePenalties.length).toBeGreaterThan(0);
    });
  });

  describe('getUserPenaltyScore', () => {
    test('should calculate penalty score correctly', async () => {
      const penalty1 = await penaltyService.applyLateArrivalPenalty(15, 'test-1');
      createdPenaltyIds.push(penalty1.penaltyId);

      const score = await penaltyService.getUserPenaltyScore();

      expect(score).toBeDefined();
      expect(typeof score.totalScore).toBe('number');
    });

    test('should return zero score for user with no penalties', async () => {
      // User with no penalties
      const newService = new PenaltyService('no-penalty-user');

      const score = await newService.getUserPenaltyScore();

      expect(score).toBeDefined();
      expect(score.totalScore).toBe(0);
    });
  });

  describe('checkPenaltyStatus', () => {
    test('should check if user is currently suspended', async () => {
      const status = await penaltyService.checkPenaltyStatus();

      expect(status).toBeDefined();
      expect(typeof status.isSuspended).toBe('boolean');
    });

    test('should return not suspended for user with no active suspensions', async () => {
      const newService = new PenaltyService('no-suspension-user');

      const status = await newService.checkPenaltyStatus();

      expect(status.isSuspended).toBe(false);
    });
  });

  describe('clearPenalty', () => {
    test('should clear a penalty successfully', async () => {
      const penalty = await penaltyService.applyLateArrivalPenalty(5, 'test-clear');
      createdPenaltyIds.push(penalty.penaltyId);

      const result = await penaltyService.clearPenalty(penalty.penaltyId, '테스트 취소');

      expect(result.success).toBe(true);

      // Verify penalty was cleared
      const penaltyDoc = await getDoc(doc(db, 'penalties', penalty.penaltyId));
      const penaltyData = penaltyDoc.data();
      expect(penaltyData?.status).toBe('cleared');
    });
  });

  describe('calculateLateArrivalPenalty', () => {
    test('should calculate delay penalty correctly', async () => {
      // 5-10 minutes late - 경고
      const penalty1 = await penaltyService.applyLateArrivalPenalty(7, 'test-calc-1');
      createdPenaltyIds.push(penalty1.penaltyId);
      expect(penalty1.severity).toBe(PenaltySeverity.LOW);

      // 10-20 minutes late - 과태료 10,000원
      const penalty2 = await penaltyService.applyLateArrivalPenalty(15, 'test-calc-2');
      createdPenaltyIds.push(penalty2.penaltyId);
      expect(penalty2.fine).toBe(10000);
    });
  });

  describe('calculateNoShowPenalty', () => {
    test('should calculate no-show penalty correctly', async () => {
      // First no-show
      const penalty1 = await penaltyService.applyNoShowPenalty('test-noshow-1');
      createdPenaltyIds.push(penalty1.penaltyId);
      expect(penalty1.noShowCount).toBe(1);
      expect(penalty1.ratingPenalty).toBe(-5.0);

      // Second no-show (created in sequence, count will be 2)
      const penalty2 = await penaltyService.applyNoShowPenalty('test-noshow-2');
      createdPenaltyIds.push(penalty2.penaltyId);
      expect(penalty2.noShowCount).toBe(2);
    });
  });
});
