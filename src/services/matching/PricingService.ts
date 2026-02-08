/**
 * Pricing Service (P1 Part 2)
 * 요금 정책: 기본 요금, 환승 보너스, 지하척 요금 계산
 */

import { PricingResult, PricingOptions, PricingType, UrgencyLevel } from '../../types/matching';
import { GillerType } from '../../types/user';

/**
 * 요금 정책 상수 (서울 지하철 기준)
 */
const PRICING_CONSTANTS = {
  // 기본 요금
  BASE_FARE: 1400,        // 1구간 (0~10km)
  SECOND_FARE: 1600,       // 2구간 (10~30km)
  THIRD_FARE: 1800,        // 3구간 (30km~)

  // 환승 보너스
  TRANSFER_BONUS: 500,     // 환승 시 추가 보너스
  TRANSFER_DISCOUNT: 500,  // 환승 할인

  // 급행 열차 추가 요금
  EXPRESS_SURCHARGE: 500,

  // 러시아워 할증
  RUSH_HOUR_SURCHARGE_RATE: 0.15, // 15% 할증

  // 긴급도 할증
  URGENCY_SURCHARGE_RATES: {
    [UrgencyLevel.NORMAL]: 0,      // 0%
    [UrgencyLevel.URGENT]: 0.10,   // 10%
    [UrgencyLevel.VERY_URGENT]: 0.20, // 20%
  },

  // 전문 길러 보너스
  PROFESSIONAL_BONUS_RATE: 0.15, // 15%
  MASTER_BONUS_RATE: 0.25,       // 25%

  // 거리 기반 요금 (km당)
  PER_KM_RATE: 100,

  // 서비스 수수료
  SERVICE_FEE_RATE: 0.15, // 15%
};

/**
 * 러시아워 시간대 (출퇴근 시간대)
 * 아침: 07:00-09:00, 저녁: 18:00-20:00
 */
const RUSH_HOUR_MORNING = { start: 7, end: 9 };   // 07:00-09:00
const RUSH_HOUR_EVENING = { start: 18, end: 20 }; // 18:00-20:00

/**
 * 요금 계산 서비스
 */
export class PricingService {
  /**
   * 요금 계산
   *
   * @param options 요금 계산 옵션
   * @returns 요금 계산 결과
   */
  static calculatePricing(options: PricingOptions): PricingResult {
    console.log('💰 Pricing calculation started:', options);

    // 1. 기본 요금 계산
    let baseFare = this.calculateBaseFare(options);

    // 2. 추가 요금 계산
    const breakdown: PricingResult['breakdown'] = [];

    // 급행 열차 추가 요금 (현재 로직에서는 별도 계산 없음)
    // 추후 급행 열차 정보가 있을 때 추가

    // 러시아워 할증
    if (options.isRushHour) {
      const rushHourSurcharge = Math.round(baseFare * PRICING_CONSTANTS.RUSH_HOUR_SURCHARGE_RATE);
      breakdown.push({
        type: PricingType.BASE, // 러시아워는 기본 요금의 추가 요금으로 처리
        amount: rushHourSurcharge,
        description: '러시아워 할증 (07:00-09:00, 18:00-20:00)',
      });
      baseFare += rushHourSurcharge;
    }

    // 긴급도 할증
    const urgencyLevel = options.urgency || UrgencyLevel.NORMAL;
    const urgencyRate = PRICING_CONSTANTS.URGENCY_SURCHARGE_RATES[urgencyLevel];
    if (urgencyRate > 0) {
      const urgencySurcharge = Math.round(baseFare * urgencyRate);
      breakdown.push({
        type: PricingType.EXPRESS, // 긴급도는 급행 요금 타입 재사용
        amount: urgencySurcharge,
        description: `긴급도 할증 (${urgencyLevel === UrgencyLevel.URGENT ? '긴급' : '매우 긴급'})`,
      });
      baseFare += urgencySurcharge;
    }

    // 3. 할인/보너스 계산
    const discounts: PricingResult['discounts'] = [];

    // 환승 할인
    if (options.isTransferRoute) {
      discounts.push({
        type: 'transfer_bonus',
        amount: -PRICING_CONSTANTS.TRANSFER_DISCOUNT,
        description: '환승 할인',
      });
    }

    // 전문 길러 보너스
    let gillerBonus = 0;
    if (options.gillerLevel === 'professional') {
      gillerBonus = Math.round(baseFare * PRICING_CONSTANTS.PROFESSIONAL_BONUS_RATE);
      discounts.push({
        type: 'professional_bonus',
        amount: gillerBonus,
        description: '전문 길러 보너스 (15%)',
      });
    } else if (options.gillerLevel === 'master') {
      gillerBonus = Math.round(baseFare * PRICING_CONSTANTS.MASTER_BONUS_RATE);
      discounts.push({
        type: 'professional_bonus',
        amount: gillerBonus,
        description: '마스터 길러 보너스 (25%)',
      });
    }

    // 4. 최종 요금 계산
    const totalFare = Math.max(
      1000, // 최소 요금
      baseFare + discounts.reduce((sum, d) => sum + d.amount, 0)
    );

    // 5. 길러 수익 계산
    const serviceFee = Math.round(totalFare * PRICING_CONSTANTS.SERVICE_FEE_RATE);
    const gillerBaseEarnings = totalFare - serviceFee;
    const gillerTotalEarnings = gillerBaseEarnings + gillerBonus;

    const result: PricingResult = {
      baseFare: PRICING_CONSTANTS.BASE_FARE,
      breakdown,
      discounts,
      totalFare,
      gillerEarnings: {
        base: gillerBaseEarnings,
        bonus: gillerBonus,
        total: gillerTotalEarnings,
      },
      calculatedAt: new Date(),
    };

    console.log('✅ Pricing calculation completed:', result);
    return result;
  }

  /**
   * 환승 경로 요금 계산
   *
   * @param baseFare 기본 요금
   * @param transferCount 환승 횟수
   * @returns 요금 계산 결과
   */
  static calculateTransferPricing(
    baseFare: number,
    transferCount: number
  ): PricingResult {
    console.log('💰 Transfer pricing calculation started:', { baseFare, transferCount });

    const breakdown: PricingResult['breakdown'] = [];
    const discounts: PricingResult['discounts'] = [];

    // 환승 할인
    discounts.push({
      type: 'transfer_bonus',
      amount: -PRICING_CONSTANTS.TRANSFER_DISCOUNT,
      description: '환승 할인',
    });

    // 환승 보너스 (환승 횟수에 따른 추가 보너스)
    const transferBonus = transferCount * PRICING_CONSTANTS.TRANSFER_BONUS;
    discounts.push({
      type: 'transfer_bonus',
      amount: transferBonus,
      description: `환승 보너스 (${transferCount}회)`,
    });

    // 최종 요금
    const totalFare = Math.max(
      1000,
      baseFare + discounts.reduce((sum, d) => sum + d.amount, 0)
    );

    // 길러 수익
    const serviceFee = Math.round(totalFare * PRICING_CONSTANTS.SERVICE_FEE_RATE);
    const gillerBaseEarnings = totalFare - serviceFee;

    const result: PricingResult = {
      baseFare,
      breakdown,
      discounts,
      totalFare,
      gillerEarnings: {
        base: gillerBaseEarnings,
        bonus: transferBonus,
        total: gillerBaseEarnings + transferBonus,
      },
      calculatedAt: new Date(),
    };

    console.log('✅ Transfer pricing calculation completed:', result);
    return result;
  }

  /**
   * 러시아워 시간대 확인
   *
   * @param date 확인할 날짜/시간
   * @returns 러시아워 여부 (07:00-09:00, 18:00-20:00)
   */
  static isRushHour(date: Date = new Date()): boolean {
    const hour = date.getHours();
    const isMorningRush = hour >= RUSH_HOUR_MORNING.start && hour < RUSH_HOUR_MORNING.end;
    const isEveningRush = hour >= RUSH_HOUR_EVENING.start && hour < RUSH_HOUR_EVENING.end;
    return isMorningRush || isEveningRush;
  }

  /**
   * 기본 요금 계산
   *
   * @param options 요금 계산 옵션
   * @returns 기본 요금
   */
  private static calculateBaseFare(options: PricingOptions): number {
    // 거리 기반 요금 계산
    if (options.distance) {
      return this.calculateDistanceBasedFare(options.distance);
    }

    // 이동 시간 기반 요금 계산 (기본값)
    if (options.travelTime) {
      return this.calculateTimeBasedFare(options.travelTime);
    }

    // 기본 요금 반환
    return PRICING_CONSTANTS.BASE_FARE;
  }

  /**
   * 거리 기반 요금 계산
   *
   * @param distance 거리 (km)
   * @returns 기본 요금
   */
  private static calculateDistanceBasedFare(distance: number): number {
    if (distance <= 10) {
      return PRICING_CONSTANTS.BASE_FARE;
    } else if (distance <= 30) {
      return PRICING_CONSTANTS.SECOND_FARE;
    } else {
      return PRICING_CONSTANTS.THIRD_FARE;
    }
  }

  /**
   * 시간 기반 요금 계산
   *
   * @param travelTime 이동 시간 (분)
   * @returns 기본 요금
   */
  private static calculateTimeBasedFare(travelTime: number): number {
    // 이동 시간이 30분 이하면 1구간, 60분 이하면 2구간, 그 외 3구간
    if (travelTime <= 30) {
      return PRICING_CONSTANTS.BASE_FARE;
    } else if (travelTime <= 60) {
      return PRICING_CONSTANTS.SECOND_FARE;
    } else {
      return PRICING_CONSTANTS.THIRD_FARE;
    }
  }

  /**
   * 길러 등급별 요금 보너스율 조회
   *
   * @param gillerLevel 길러 등급
   * @returns 보너스율
   */
  static getGillerBonusRate(gillerLevel: GillerType): number {
    switch (gillerLevel) {
      case GillerType.PROFESSIONAL:
        return PRICING_CONSTANTS.PROFESSIONAL_BONUS_RATE;
      case GillerType.MASTER:
        return PRICING_CONSTANTS.MASTER_BONUS_RATE;
      default:
        return 0;
    }
  }

  /**
   * 최소 요금 확인
   *
   * @param fare 계산된 요금
   * @returns 최소 요금 적용된 요금
   */
  static applyMinimumFare(fare: number): number {
    return Math.max(1000, fare);
  }

  /**
   * 서비스 수수료 계산
   *
   * @param fare 배송비
   * @returns 서비스 수수료
   */
  static calculateServiceFee(fare: number): number {
    return Math.round(fare * PRICING_CONSTANTS.SERVICE_FEE_RATE);
  }

  /**
   * 길러 수익 계산
   *
   * @param fare 배송비
   * @param gillerLevel 길러 등급
   * @returns 길러 수익
   */
  static calculateGillerEarnings(fare: number, gillerLevel: GillerType): {
    base: number;
    bonus: number;
    total: number;
  } {
    const serviceFee = this.calculateServiceFee(fare);
    const baseEarnings = fare - serviceFee;
    const bonusRate = this.getGillerBonusRate(gillerLevel);
    const bonus = Math.round(baseEarnings * bonusRate);

    return {
      base: baseEarnings,
      bonus,
      total: baseEarnings + bonus,
    };
  }
}
