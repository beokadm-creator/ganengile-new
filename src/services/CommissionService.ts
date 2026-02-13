/**
 * Commission Service (P4)
 * 수수료 계산 서비스
 */

import {
  CommissionCalculationOptions,
  CommissionCalculationResult,
} from '../types/payment';
import { GillerType } from '../types/user';
import { UrgencyLevel } from '../types/matching';

const COMMISSION_CONSTANTS = {
  BASE_RATE: 0.05,
  MINIMUM_COMMISSION: 500,
  GILLER_GRADE_BONUS_RATES: {
    [GillerType.REGULAR]: 0,
    [GillerType.PROFESSIONAL]: 0.01,
    [GillerType.MASTER]: 0.02,
  },
  URGENCY_SURCHARGE_RATES: {
    [UrgencyLevel.NORMAL]: 0,
    [UrgencyLevel.URGENT]: 0.20,
    [UrgencyLevel.VERY_URGENT]: 0.50,
  },
  TAX_RATE: 0.033,
};

export class CommissionService {
  static calculateCommission(
    options: CommissionCalculationOptions
  ): CommissionCalculationResult {
    const { amount, gillerGrade, urgencyLevel } = options;

    const baseCommission = Math.round(amount * COMMISSION_CONSTANTS.BASE_RATE);

    const gradeBonusRate = COMMISSION_CONSTANTS.GILLER_GRADE_BONUS_RATES[gillerGrade];
    const gradeBonus = Math.round(amount * gradeBonusRate);

    const urgencySurchargeRate = COMMISSION_CONSTANTS.URGENCY_SURCHARGE_RATES[urgencyLevel];
    const urgencySurcharge = Math.round(amount * urgencySurchargeRate);

    let totalCommission = baseCommission + gradeBonus + urgencySurcharge;
    let appliedMinimum = false;

    if (totalCommission < COMMISSION_CONSTANTS.MINIMUM_COMMISSION) {
      totalCommission = COMMISSION_CONSTANTS.MINIMUM_COMMISSION;
      appliedMinimum = true;
    }

    const gillerEarnings = amount - totalCommission;

    return {
      baseCommission,
      gradeBonus,
      urgencySurcharge,
      totalCommission,
      gillerEarnings,
      appliedMinimum,
      calculatedAt: new Date(),
    };
  }

  static getBaseRate(): number {
    return COMMISSION_CONSTANTS.BASE_RATE;
  }

  static getMinimumCommission(): number {
    return COMMISSION_CONSTANTS.MINIMUM_COMMISSION;
  }

  static getGradeBonusRate(gillerGrade: GillerType): number {
    return COMMISSION_CONSTANTS.GILLER_GRADE_BONUS_RATES[gillerGrade];
  }

  static getUrgencySurchargeRate(urgencyLevel: UrgencyLevel): number {
    return COMMISSION_CONSTANTS.URGENCY_SURCHARGE_RATES[urgencyLevel];
  }

  static calculateTax(amount: number): number {
    return Math.round(amount * COMMISSION_CONSTANTS.TAX_RATE);
  }

  static calculateNetSettlement(
    totalPayment: number,
    platformFee: number
  ): { earnings: number; tax: number; netAmount: number } {
    const earnings = totalPayment - platformFee;
    const tax = this.calculateTax(earnings);
    const netAmount = earnings - tax;

    return {
      earnings,
      tax,
      netAmount,
    };
  }
}
