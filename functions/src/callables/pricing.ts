import * as functions from 'firebase-functions';
import { db, requireCallableAuth } from '../shared-admin';
import { getFunctionsPricingPolicyConfig } from '../pricing-policy-config';
import {
  calculateSharedDeliveryFee,
  calculateSharedSettlementBreakdown,
  estimateStationCountFromDistanceKm,
  estimateStationCountFromTravelTimeMinutes,
} from '../../../shared/pricing-policy';
import type {
  CalculateDeliveryPricingData,
  CalculateDeliveryPricingResult,
  PricingBreakdown,
  PricingDiscount,
} from '../types';

interface BadgeStats {
  completedDeliveries?: number;
  recent30DaysDeliveries?: number;
  rating?: number;
  recentPenalties?: number;
  accountAgeDays?: number;
}

interface BadgeCollections {
  activity?: string[];
  quality?: string[];
  expertise?: string[];
  community?: string[];
}

interface BadgeBenefits {
  totalBadges?: number;
  currentTier?: string;
  profileFrame?: string;
}

interface BadgeUserDoc {
  stats?: BadgeStats;
  badges?: BadgeCollections;
  badgeBenefits?: BadgeBenefits;
  role?: string;
  gillerProfile?: {
    type?: string;
    promotion?: {
      status?: string;
    };
    benefits?: {
      rateBonus?: number;
    };
  };
}

interface CalculateDeliveryRateData {
  baseRate?: number;
  gillerId?: string;
}

/**
 * HTTP Function: Calculate delivery rate with bonus
 */
export const calculateDeliveryRate = functions.https.onCall(async (data: CalculateDeliveryRateData, context): Promise<{ rate: number; bonus: number; total: number }> => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { baseRate, gillerId } = data;

  if (typeof baseRate !== 'number' || !gillerId) {
    throw new functions.https.HttpsError('invalid-argument', 'baseRate and gillerId are required');
  }

  try {
    const userDoc = await db.collection('users').doc(gillerId).get();

    if (!userDoc.exists) {
      return { rate: baseRate, bonus: 0, total: baseRate };
    }

    const user = userDoc.data() as BadgeUserDoc | undefined;
    const rateBonus = user?.gillerProfile?.benefits?.rateBonus ?? 0;

    const bonusAmount = baseRate * rateBonus;
    const totalRate = baseRate + bonusAmount;

    return {
      rate: baseRate,
      bonus: bonusAmount,
      total: totalRate,
    };
  } catch (error) {
    console.error('??Error calculating rate:', error);
    throw new functions.https.HttpsError('internal', 'Error calculating rate');
  }
});

// ==================== Pricing Functions ====================

/**
 * Pricing Constants (Updated with actual costs)
 */
/**
 * HTTP Function: Calculate delivery pricing *
 * Calculates delivery pricing based on distance, time, and other factors
 */
export const calculateDeliveryPricing = functions.https.onCall(
  async (data: CalculateDeliveryPricingData, context): Promise<CalculateDeliveryPricingResult> => {
    requireCallableAuth(context, 'calculateDeliveryPricing');

    const {
      distance,
      travelTime,
      isRushHour = false,
      urgency = 'normal',
      isTransferRoute = false,
      transferCount = 0,
      gillerLevel = 'regular',
      weather = 'clear',
      nearbyGillerCount,
      isProfessionalPeak = false,
    } = data;

    console.warn('Pricing calculation requested:', data);

    try {
      const pricingPolicy = await getFunctionsPricingPolicyConfig();
      const estimatedStationCount =
        typeof distance === 'number' && distance > 0
          ? estimateStationCountFromDistanceKm(distance)
          : estimateStationCountFromTravelTimeMinutes(typeof travelTime === 'number' ? travelTime : 15);

      const sharedFee = calculateSharedDeliveryFee({
        stationCount: estimatedStationCount,
        urgency: urgency ?? 'normal',
        context: {
          weather,
          isPeakTime: isRushHour,
          nearbyGillerCount,
          isProfessionalPeak,
        },
      }, pricingPolicy);

      const breakdown: PricingBreakdown[] = [
        {
          type: 'base',
          amount: sharedFee.baseFee,
          description: `기본 요금 (${estimatedStationCount}개 역 기준)`,
        },
        {
          type: 'base',
          amount: sharedFee.distanceFee,
          description: '거리/역수 가산',
        },
      ];

      if (sharedFee.weightFee > 0) {
        breakdown.push({
          type: 'base',
          amount: sharedFee.weightFee,
          description: '기본 무게 반영',
        });
      }

      if (sharedFee.urgencySurcharge > 0) {
        breakdown.push({
          type: 'express',
          amount: sharedFee.urgencySurcharge,
          description: `긴급도 가산 (${urgency === 'urgent' ? '긴급' : '빠른 요청'})`,
        });
      }

      if (isRushHour) {
        breakdown.push({
          type: 'express',
          amount: 0,
          description: '러시아워 여부는 현재 ETA 판단에만 반영합니다.',
        });
      }

      const discounts: PricingDiscount[] = [];
      if (isTransferRoute) {
        discounts.push({
          type: 'transfer_bonus',
          amount: -(pricingPolicy.incentiveRules.transferDiscount ?? 500),
          description: '환승 구간 할인',
        });

        const transferBonus = transferCount * (pricingPolicy.incentiveRules.transferBonusPerHop ?? 500);
        if (transferBonus > 0) {
          discounts.push({
            type: 'transfer_bonus',
            amount: transferBonus,
            description: `환승 협조 보너스 (${transferCount}회)`,
          });
        }
      }

      let totalFare = sharedFee.totalFee + discounts.reduce((sum, item) => sum + item.amount, 0);
      totalFare = Math.max(pricingPolicy.minFee, totalFare);
      totalFare = Math.min(pricingPolicy.maxFee, totalFare);

      const baseSettlement = calculateSharedSettlementBreakdown(totalFare, 0, pricingPolicy);

      let gillerBonus = 0;
      if (gillerLevel === 'professional') {
        gillerBonus = Math.round(
          baseSettlement.platformRevenue * (pricingPolicy.incentiveRules.professionalBonusRate ?? 0.25)
        );
        discounts.push({
          type: 'professional_bonus',
          amount: gillerBonus,
          description: '전문 길러 보너스',
        });
      } else if (gillerLevel === 'master') {
        gillerBonus = Math.round(
          baseSettlement.platformRevenue * (pricingPolicy.incentiveRules.masterBonusRate ?? 0.35)
        );
        discounts.push({
          type: 'master_bonus',
          amount: gillerBonus,
          description: '마스터 길러 보너스',
        });
      }

      const finalPricing = calculateSharedSettlementBreakdown(totalFare, gillerBonus, pricingPolicy);

      const result: CalculateDeliveryPricingResult = {
        baseFare: sharedFee.baseFee,
        breakdown,
        discounts,
        totalFare: finalPricing.totalFare,
        gillerEarnings: {
          base: finalPricing.gillerPreTaxEarnings - gillerBonus,
          bonus: gillerBonus,
          preTax: finalPricing.gillerPreTaxEarnings,
          tax: finalPricing.withholdingTax,
          net: finalPricing.gillerNetEarnings,
        },
        platformEarnings: {
          gross: finalPricing.serviceFee,
          net: finalPricing.platformNetEarnings,
        },
        pgFee: finalPricing.pgFee,
        calculatedAt: new Date(),
      };

      console.warn('Pricing calculation completed:', result);
      return result;
    } catch (error) {
      console.error('Error in calculateDeliveryPricing:', error);
      throw new functions.https.HttpsError('internal', 'Error calculating delivery pricing');
    }
  }
);
