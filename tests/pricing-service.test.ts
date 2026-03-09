/**
 * Pricing Service Tests (Phase 1)
 * 1단계 배송비 계산 로직 테스트
 */

import {
  calculatePhase1DeliveryFee,
  calculateDistanceFee,
  calculateWeightFee,
  calculateSizeFee,
  calculateUrgencySurcharge,
  calculateServiceFee,
  calculateBreakdown,
  estimateDeliveryFee,
} from '../src/services/pricing-service';
import { PackageSize } from '../src/types/delivery';

describe('Pricing Service - Phase 1', () => {
  describe('calculatePhase1DeliveryFee', () => {
    test('기본 배송비 계산 (소형, 1kg, 보통, 5개역)', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 5,
        weight: 1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      expect(result.baseFee).toBe(3500);
      expect(result.distanceFee).toBe(600);
      expect(result.weightFee).toBe(100);
      expect(result.sizeFee).toBe(0);
      expect(result.urgencySurcharge).toBe(0);
      expect(result.totalFee).toBeGreaterThanOrEqual(3000);
      expect(result.totalFee).toBeLessThanOrEqual(8000);
      expect(result.breakdown.gillerFee).toBeGreaterThan(0);
      expect(result.breakdown.platformFee).toBeGreaterThan(0);
    });

    test('최소 배송비 검증 (3,000원)', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 2,
        weight: 0.5,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      expect(result.totalFee).toBeGreaterThanOrEqual(3000);
    });

    test('최대 배송비 검증 (8,000원)', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 30,
        weight: 20,
        packageSize: PackageSize.EXTRA_LARGE,
        urgency: 'urgent',
      });

      expect(result.totalFee).toBeLessThanOrEqual(8000);
    });

    test('거리 수수료 계산 (역 개수 기반)', () => {
      const test1 = calculatePhase1DeliveryFee({ stationCount: 5 });
      const test2 = calculatePhase1DeliveryFee({ stationCount: 10 });
      const test3 = calculatePhase1DeliveryFee({ stationCount: 15 });

      expect(test2.distanceFee).toBeGreaterThan(test1.distanceFee);
      expect(test3.distanceFee).toBeGreaterThan(test2.distanceFee);
    });

    test('긴급도 surcharge 비교', () => {
      const normal = calculatePhase1DeliveryFee({
        stationCount: 5,
        urgency: 'normal',
      });
      const fast = calculatePhase1DeliveryFee({
        stationCount: 5,
        urgency: 'fast',
      });
      const urgent = calculatePhase1DeliveryFee({
        stationCount: 5,
        urgency: 'urgent',
      });

      expect(fast.totalFee).toBeGreaterThan(normal.totalFee);
      expect(urgent.totalFee).toBeGreaterThan(fast.totalFee);
    });

    test('사이즈별 추가 요금', () => {
      const small = calculatePhase1DeliveryFee({
        stationCount: 5,
        packageSize: PackageSize.SMALL,
      });
      const medium = calculatePhase1DeliveryFee({
        stationCount: 5,
        packageSize: PackageSize.MEDIUM,
      });
      const large = calculatePhase1DeliveryFee({
        stationCount: 5,
        packageSize: PackageSize.LARGE,
      });
      const xlarge = calculatePhase1DeliveryFee({
        stationCount: 5,
        packageSize: PackageSize.EXTRA_LARGE,
      });

      expect(medium.sizeFee).toBe(400);
      expect(large.sizeFee).toBe(800);
      expect(xlarge.sizeFee).toBe(1500);
      expect(small.sizeFee).toBe(0);
    });

    test('길러/플랫폼 비용 분배 합계 검증', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 5,
        weight: 1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      const breakdownSum = result.breakdown.gillerFee + result.breakdown.platformFee;
      expect(breakdownSum).toBe(result.totalFee);
    });

    test('길러 비중 85%, 플랫폼 비중 15%', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 5,
        weight: 1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      const gillerRatio = result.breakdown.gillerFee / result.totalFee;
      const platformRatio = result.breakdown.platformFee / result.totalFee;

      expect(gillerRatio).toBeCloseTo(0.85, 2);
      expect(platformRatio).toBeCloseTo(0.15, 2);
    });

    test('부가세 (VAT 10%) 계산', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 5,
        weight: 1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      const expectedVat = Math.round(result.subtotal * 0.1);
      expect(result.vat).toBe(expectedVat);
    });
  });

  describe('calculateDistanceFee', () => {
    test('기본 구간 (5개역 이하): 600원', () => {
      expect(calculateDistanceFee(2)).toBe(600);
      expect(calculateDistanceFee(5)).toBe(600);
    });

    test('추가 구간 (6개역 이상): 600원 + (역 개수 - 5) × 120원', () => {
      expect(calculateDistanceFee(6)).toBe(600 + 1 * 120);
      expect(calculateDistanceFee(10)).toBe(600 + 5 * 120);
      expect(calculateDistanceFee(15)).toBe(600 + 10 * 120);
    });
  });

  describe('calculateWeightFee', () => {
    test('기본 무게 (1kg 이하): 100원', () => {
      expect(calculateWeightFee(0.5)).toBe(100);
      expect(calculateWeightFee(1)).toBe(100);
    });

    test('추가 무게 (1kg 초과): 무게 × 100원', () => {
      expect(calculateWeightFee(2)).toBe(200);
      expect(calculateWeightFee(5)).toBe(500);
      expect(calculateWeightFee(10)).toBe(1000);
    });
  });

  describe('calculateSizeFee', () => {
    test('사이즈별 요금', () => {
      expect(calculateSizeFee(PackageSize.SMALL)).toBe(0);
      expect(calculateSizeFee(PackageSize.MEDIUM)).toBe(400);
      expect(calculateSizeFee(PackageSize.LARGE)).toBe(800);
      expect(calculateSizeFee(PackageSize.EXTRA_LARGE)).toBe(1500);
    });
  });

  describe('calculateUrgencySurcharge', () => {
    test('긴급도별 surcharge', () => {
      const baseFee = 3500 + 600;

      expect(calculateUrgencySurcharge('normal', baseFee)).toBe(0);
      expect(calculateUrgencySurcharge('fast', baseFee)).toBe(Math.round(baseFee * 0.1));
      expect(calculateUrgencySurcharge('urgent', baseFee)).toBe(Math.round(baseFee * 0.2));
    });
  });

  describe('calculateServiceFee', () => {
    test('서비스 수수료 15%', () => {
      expect(calculateServiceFee(1000, 0.15)).toBe(150);
      expect(calculateServiceFee(5000, 0.15)).toBe(750);
      expect(calculateServiceFee(10000, 0.15)).toBe(1500);
    });
  });

  describe('calculateBreakdown', () => {
    test('길러 85%, 플랫폼 15%', () => {
      const totalFee = 5000;
      const breakdown = calculateBreakdown(totalFee);

      expect(breakdown.platformFee).toBe(Math.round(totalFee * 0.15));
      expect(breakdown.gillerFee).toBe(totalFee - breakdown.platformFee);
    });
  });

  describe('estimateDeliveryFee', () => {
    test('총 배송비만 반환', () => {
      const totalFee = estimateDeliveryFee({
        stationCount: 5,
        weight: 1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      expect(typeof totalFee).toBe('number');
      expect(totalFee).toBeGreaterThan(0);
    });
  });

  describe('경계값 테스트', () => {
    test('최소 역 개수 (2개)', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 2,
        weight: 1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      expect(result.totalFee).toBeGreaterThanOrEqual(3000);
    });

    test('최대 역 개수 (30개)', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 30,
        weight: 1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      expect(result.totalFee).toBeLessThanOrEqual(8000);
    });

    test('최소 무게 (0.1kg)', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 5,
        weight: 0.1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      expect(result.totalFee).toBeGreaterThanOrEqual(3000);
    });
  });

  describe('복합 조건 테스트', () => {
    test('대형 + 긴급 + 먼 거리', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 20,
        weight: 10,
        packageSize: PackageSize.EXTRA_LARGE,
        urgency: 'urgent',
      });

      expect(result.totalFee).toBeLessThanOrEqual(8000);
      expect(result.sizeFee).toBe(1500);
      expect(result.urgencySurcharge).toBeGreaterThan(0);
    });

    test('소형 + 보통 + 가까운 거리', () => {
      const result = calculatePhase1DeliveryFee({
        stationCount: 3,
        weight: 1,
        packageSize: PackageSize.SMALL,
        urgency: 'normal',
      });

      expect(result.totalFee).toBeGreaterThanOrEqual(3000);
      expect(result.sizeFee).toBe(0);
      expect(result.urgencySurcharge).toBe(0);
    });
  });
});
