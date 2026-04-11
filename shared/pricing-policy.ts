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
  const dynamicAdjustment = calculateSharedDynamicAdjustment(
    baseFee + distanceFee + weightFee + sizeFee + urgencySurcharge,
    params.context,
    resolved
  );
  const feeBeforeService =
    baseFee + distanceFee + weightFee + sizeFee + urgencySurcharge + publicFare + manualAdjustment + dynamicAdjustment;
  const serviceFee = calculateSharedServiceFee(feeBeforeService, resolved);
  const subtotal = feeBeforeService + serviceFee;
  const vat = Math.round(subtotal * resolved.vatRate);

  let totalFee = subtotal + vat;
  totalFee = Math.max(resolved.minFee, totalFee);
  totalFee = Math.min(resolved.maxFee, totalFee);

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
