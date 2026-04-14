import {
  DEFAULT_SHARED_PRICING_POLICY,
  normalizeSharedPricingPolicy,
  type SharedPackageSize,
  type SharedPricingPolicyConfig,
  type SharedUrgency,
  type SharedWeatherCondition,
} from './pricing-config';

export type { SharedPackageSize, SharedPricingPolicyConfig, SharedUrgency, SharedWeatherCondition };
export { DEFAULT_SHARED_PRICING_POLICY };

export interface SharedPricingContext {
  weather?: SharedWeatherCondition;
  isPeakTime?: boolean;
  isProfessionalPeak?: boolean;
  nearbyGillerCount?: number;
  requestedHour?: number;
}

export interface SharedPricingParams {
  stationCount: number;
  weight?: number;
  packageSize?: SharedPackageSize;
  urgency?: SharedUrgency;
  publicFare?: number;
  manualAdjustment?: number;
  context?: SharedPricingContext;
}

export interface SharedDeliveryFeeBreakdown {
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  sizeFee: number;
  urgencySurcharge: number;
  publicFare: number;
  manualAdjustment: number;
  dynamicAdjustment: number;
  serviceFee: number;
  subtotal: number;
  vat: number;
  totalFee: number;
  breakdown: {
    gillerFee: number;
    platformFee: number;
  };
}

export interface SharedSettlementBreakdown {
  totalFare: number;
  pgFee: number;
  platformRevenue: number;
  serviceFee: number;
  gillerPreTaxEarnings: number;
  withholdingTax: number;
  gillerNetEarnings: number;
  platformNetEarnings: number;
}

export const SHARED_PRICING_POLICY = DEFAULT_SHARED_PRICING_POLICY;

function resolvePolicy(policy?: Partial<SharedPricingPolicyConfig>): SharedPricingPolicyConfig {
  return normalizeSharedPricingPolicy(policy);
}

export function calculateSharedDistanceFee(
  stationCount: number,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  const resolved = resolvePolicy(policy);
  if (stationCount <= resolved.baseStations) {
    return resolved.baseDistanceFee;
  }

  return resolved.baseDistanceFee + (stationCount - resolved.baseStations) * resolved.feePerStation;
}

export function calculateB2BAddressFee(
  distanceMeters: number,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  const resolved = resolvePolicy(policy);
  const adjustments = resolved.quoteAdjustments;
  
  if (!adjustments?.b2bBaseDistanceMeters || !adjustments?.b2bBaseFee) {
    return adjustments?.addressPickupFee ?? 900; // Fallback
  }

  // 제한 거리 초과 시 거절 (또는 최대 요금 부과)
  if (distanceMeters > (adjustments.b2bMaxDistanceMeters ?? 5000)) {
    throw new Error('배달 가능 거리를 초과했습니다.');
  }

  // 1km 이내는 기본 요금
  if (distanceMeters <= adjustments.b2bBaseDistanceMeters) {
    return adjustments.b2bBaseFee;
  }

  // 초과 거리 요금 계산
  const extraDistance = distanceMeters - adjustments.b2bBaseDistanceMeters;
  const extraSegments = Math.ceil(extraDistance / 100);
  const extraFee = extraSegments * (adjustments.b2bExtraFeePer100m ?? 100);

  return adjustments.b2bBaseFee + extraFee;
}

export function calculateSharedWeightFee(
  weight: number,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  const resolved = resolvePolicy(policy);
  if (weight <= resolved.baseWeight) {
    return resolved.minWeightFee;
  }

  return Math.round(weight * resolved.feePerKg);
}

export function calculateSharedSizeFee(
  packageSize: SharedPackageSize,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  return resolvePolicy(policy).sizeFees[packageSize];
}

export function calculateSharedUrgencySurcharge(
  urgency: SharedUrgency,
  baseAndDistanceFee: number,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  const resolved = resolvePolicy(policy);
  return Math.round(baseAndDistanceFee * resolved.urgencyMultipliers[urgency]);
}

export function calculateSharedDynamicAdjustment(
  baseAmount: number,
  context?: SharedPricingContext,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  if (!context) {
    return 0;
  }

  const resolved = resolvePolicy(policy);
  let adjustment = 0;

  if (context.weather === 'rain') {
    adjustment += Math.round(baseAmount * resolved.dynamicRules.rainMultiplier);
  } else if (context.weather === 'snow') {
    adjustment += Math.round(baseAmount * resolved.dynamicRules.snowMultiplier);
  }

  if (context.isPeakTime) {
    adjustment += Math.round(baseAmount * resolved.dynamicRules.peakTimeMultiplier);
  }

  if (context.isProfessionalPeak) {
    adjustment += Math.round(baseAmount * resolved.dynamicRules.professionalPeakMultiplier);
  }

  if (typeof context.nearbyGillerCount === 'number') {
    if (context.nearbyGillerCount <= resolved.dynamicRules.lowSupplyThreshold) {
      adjustment += Math.round(baseAmount * resolved.dynamicRules.lowSupplyMultiplier);
    } else if (context.nearbyGillerCount >= resolved.dynamicRules.highSupplyThreshold) {
      adjustment += Math.round(baseAmount * resolved.dynamicRules.highSupplyDiscountMultiplier);
    }
  }

  if (typeof context.requestedHour === 'number') {
    for (const rule of resolved.timeRules) {
      if (!rule.enabled) continue;

      const inRange =
        rule.startHour <= rule.endHour
          ? context.requestedHour >= rule.startHour && context.requestedHour <= rule.endHour
          : context.requestedHour >= rule.startHour || context.requestedHour <= rule.endHour;

      if (!inRange) continue;

      adjustment += Math.round(baseAmount * (rule.multiplier - 1));
      adjustment += rule.fixedAdjustment;
    }
  }

  return adjustment;
}

export function calculateSharedServiceFee(
  amount: number,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  const resolved = resolvePolicy(policy);
  return Math.round(amount * resolved.platformFeeRate);
}

export function calculateSharedBreakdown(
  totalFee: number,
  policy?: Partial<SharedPricingPolicyConfig>
) {
  const resolved = resolvePolicy(policy);
  const platformFee = Math.round(totalFee * resolved.platformFeeRate);
  const gillerFee = totalFee - platformFee;

  return {
    gillerFee,
    platformFee,
  };
}

export function calculateSharedDeliveryFee(
  params: SharedPricingParams,
  policy?: Partial<SharedPricingPolicyConfig>
): SharedDeliveryFeeBreakdown {
  const resolved = resolvePolicy(policy);
  const stationCount = Math.max(2, Math.round(params.stationCount));
  const weight = Math.max(0.1, params.weight ?? 1);
  const packageSize = params.packageSize ?? 'small';
  const urgency = params.urgency ?? 'normal';
  const publicFare = Math.max(0, params.publicFare ?? 0);
  const manualAdjustment = params.manualAdjustment ?? 0;

  const baseFee = resolved.baseFee;
  const distanceFee = calculateSharedDistanceFee(stationCount, resolved);
  const weightFee = calculateSharedWeightFee(weight, resolved);
  const sizeFee = calculateSharedSizeFee(packageSize, resolved);
  const urgencySurcharge = calculateSharedUrgencySurcharge(urgency, baseFee + distanceFee, resolved);
  let dynamicAdjustment = calculateSharedDynamicAdjustment(
    baseFee + distanceFee + weightFee + sizeFee + urgencySurcharge,
    params.context,
    resolved
  );
  
  let feeBeforeService =
    baseFee + distanceFee + weightFee + sizeFee + urgencySurcharge + publicFare + manualAdjustment + dynamicAdjustment;
  let serviceFee = calculateSharedServiceFee(feeBeforeService, resolved);
  let subtotal = feeBeforeService + serviceFee;
  let vat = Math.round(subtotal * resolved.vatRate);
  let totalFee = subtotal + vat;

  // 비정상 동적 할증 감지 (Alerting purpose)
  const baseDeliveryFee = baseFee + distanceFee;
  if (baseDeliveryFee > 0 && Math.abs(dynamicAdjustment) / baseDeliveryFee > 0.5) {
    // console.warn(`[Anomaly Detection] dynamicAdjustment is excessively high compared to baseDeliveryFee: ${dynamicAdjustment} / ${baseDeliveryFee}`);
  }

  // 최소/최대 요금 보정 시 하위 항목들의 합계가 깨지지 않도록 역산하여 dynamicAdjustment에 차액을 반영
  if (totalFee < resolved.minFee || totalFee > resolved.maxFee) {
    const targetTotalFee = Math.max(resolved.minFee, Math.min(resolved.maxFee, totalFee));
    
    console.warn(`[Min/Max Fee Clipping Alert] Calculated totalFee ${totalFee} is being clamped to ${targetTotalFee} (min: ${resolved.minFee}, max: ${resolved.maxFee}). Adjusting dynamicAdjustment.`);
    
    // totalFee = feeBeforeService * (1 + platformFeeRate) * (1 + vatRate)
    // 따라서 targetFeeBeforeService를 역산
    const targetFeeBeforeService = Math.round(targetTotalFee / ((1 + resolved.platformFeeRate) * (1 + resolved.vatRate)));
    
    // 차액을 dynamicAdjustment에 추가
    dynamicAdjustment += (targetFeeBeforeService - feeBeforeService);
    
    // 다시 정방향 계산하여 반올림 오차를 최소화
    feeBeforeService = baseFee + distanceFee + weightFee + sizeFee + urgencySurcharge + publicFare + manualAdjustment + dynamicAdjustment;
    serviceFee = calculateSharedServiceFee(feeBeforeService, resolved);
    subtotal = feeBeforeService + serviceFee;
    vat = Math.round(subtotal * resolved.vatRate);
    totalFee = subtotal + vat;

    // 만약 정방향 계산 후에도 1~2원 오차가 있다면, 부가세나 서비스수수료에서 직접 가감하여 최종액을 강제 일치시킴
    const diff = targetTotalFee - totalFee;
    if (diff !== 0) {
      vat += diff;
      totalFee = targetTotalFee;
    }
  }

  return {
    baseFee,
    distanceFee,
    weightFee,
    sizeFee,
    urgencySurcharge,
    publicFare,
    manualAdjustment,
    dynamicAdjustment,
    serviceFee,
    subtotal,
    vat,
    totalFee,
    breakdown: calculateSharedBreakdown(totalFee, resolved),
  };
}

export function calculateSharedSettlementBreakdown(
  totalFare: number,
  gillerBonus: number = 0,
  policy?: Partial<SharedPricingPolicyConfig>
): SharedSettlementBreakdown {
  const resolved = resolvePolicy(policy);
  const pgFee = Math.round(totalFare * resolved.pgFeeRate);
  const platformRevenue = totalFare - pgFee;
  const serviceFee = Math.round(platformRevenue * resolved.platformFeeRate);
  const gillerPreTaxEarnings = platformRevenue - serviceFee + gillerBonus;
  const withholdingTax = Math.round(gillerPreTaxEarnings * resolved.withholdingTaxRate);
  const gillerNetEarnings = gillerPreTaxEarnings - withholdingTax;
  const platformNetEarnings = serviceFee;

  return {
    totalFare,
    pgFee,
    platformRevenue,
    serviceFee,
    gillerPreTaxEarnings,
    withholdingTax,
    gillerNetEarnings,
    platformNetEarnings,
  };
}

export function estimateStationCountFromTravelTimeMinutes(travelTimeMinutes: number): number {
  return Math.max(2, Math.round(travelTimeMinutes / 2.5));
}

export function estimateStationCountFromDistanceKm(distanceKm: number): number {
  return Math.max(2, Math.round(distanceKm * 1.8));
}
