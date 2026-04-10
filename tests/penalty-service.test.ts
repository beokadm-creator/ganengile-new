/**
 * Penalty Service Tests
 * 현재 공개 API 기준 smoke 회귀 테스트
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { createPenaltyService } from '../src/services/penalty-service';
import { PenaltySeverity, PenaltyType } from '../src/types/penalty';

describe('Penalty Service', () => {
  const userId = 'test-user-penalty-001';

  beforeEach(() => {
    global.__clearMockFirestore();
  });

  test('applies late arrival penalty with the matched rule', async () => {
    const service = createPenaltyService(userId);

    const penalty = await service.applyLateArrivalPenalty(20, 'request-late-001');

    expect(penalty.userId).toBe(userId);
    expect(penalty.type).toBe(PenaltyType.LATE_ARRIVAL);
    expect(penalty.severity).toBe(PenaltySeverity.MILD);
    expect(penalty.lateMinutes).toBe(20);
    expect(penalty.fine).toBe(1000);
  });

  test('applies no-show penalty and tracks incremental no-show count', async () => {
    const service = createPenaltyService(userId);

    const firstPenalty = await service.applyNoShowPenalty('request-noshow-001');
    const secondPenalty = await service.applyNoShowPenalty('request-noshow-002');

    expect(firstPenalty.type).toBe(PenaltyType.NO_SHOW);
    expect(firstPenalty.noShowCount).toBe(1);
    expect(secondPenalty.noShowCount).toBe(2);
    expect(secondPenalty.suspensionDays).toBe(60);
  });

  test('applies cancellation penalty based on pickup timing', async () => {
    const service = createPenaltyService(userId);

    const penalty = await service.applyCancellationPenalty(true, 'request-cancel-001');

    expect(penalty.type).toBe(PenaltyType.CANCELLATION);
    expect(penalty.cancelledAtPickup).toBe(true);
    expect(penalty.severity).toBe(PenaltySeverity.MILD);
    expect(penalty.fine).toBe(3000);
  });

  test('summarizes recent penalties and warnings for the user', async () => {
    const service = createPenaltyService(userId);

    await service.applyLateArrivalPenalty(35, 'request-summary-001');
    await service.applyNoShowPenalty('request-summary-002');

    const summary = await service.getPenaltySummary();

    expect(summary.userId).toBe(userId);
    expect(summary.totalPenalties).toBeGreaterThanOrEqual(2);
    expect(summary.totalFines).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.recentPenalties)).toBe(true);
    expect(Array.isArray(summary.warnings)).toBe(true);
  });

  test('returns an empty summary for a user with no recent penalties', async () => {
    const service = createPenaltyService('clean-user');

    const summary = await service.getPenaltySummary();

    expect(summary).toEqual({
      userId: 'clean-user',
      totalPenalties: 0,
      totalFines: 0,
      totalSuspensionDays: 0,
      isSuspended: false,
      suspensionEndsAt: undefined,
      warnings: [],
      recentPenalties: [],
    });
  });
});
