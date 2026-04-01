export type SharedPackageSize = 'small' | 'medium' | 'large' | 'xl' | 'extra_large';
export type SharedUrgency = 'normal' | 'fast' | 'urgent';

export interface SharedPricingParams {
  stationCount: number;
  weight?: number;
  packageSize?: SharedPackageSize;
  urgency?: SharedUrgency;
  publicFare?: number;
  manualAdjustment?: number;
}

export interface SharedDeliveryFeeBreakdown {
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  sizeFee: number;
  urgencySurcharge: number;
  publicFare: number;
  manualAdjustment: number;
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

export const SHARED_PRICING_POLICY = {
  BASE_FEE: 2000,
  MIN_FEE: 3000,
  MAX_FEE: 10000,
  PLATFORM_FEE_RATE: 0.1,
  VAT_RATE: 0.1,
  PG_FEE_RATE: 0.03,
  WITHHOLDING_TAX_RATE: 0.033,
  BASE_STATIONS: 5,
  BASE_DISTANCE_FEE: 600,
  FEE_PER_STATION: 120,
  BASE_WEIGHT: 1,
  MIN_WEIGHT_FEE: 100,
  FEE_PER_KG: 100,
  SIZE_FEES: {
    small: 0,
    medium: 400,
    large: 800,
    xl: 1500,
    extra_large: 1500,
  } satisfies Record<SharedPackageSize, number>,
  URGENCY_MULTIPLIERS: {
    normal: 0,
    fast: 0.1,
    urgent: 0.2,
  } satisfies Record<SharedUrgency, number>,
} as const;

export function calculateSharedDistanceFee(stationCount: number): number {
  if (stationCount <= SHARED_PRICING_POLICY.BASE_STATIONS) {
    return SHARED_PRICING_POLICY.BASE_DISTANCE_FEE;
  }

  return (
    SHARED_PRICING_POLICY.BASE_DISTANCE_FEE +
    (stationCount - SHARED_PRICING_POLICY.BASE_STATIONS) * SHARED_PRICING_POLICY.FEE_PER_STATION
  );
}

export function calculateSharedWeightFee(weight: number): number {
  if (weight <= SHARED_PRICING_POLICY.BASE_WEIGHT) {
    return SHARED_PRICING_POLICY.MIN_WEIGHT_FEE;
  }

  return Math.round(weight * SHARED_PRICING_POLICY.FEE_PER_KG);
}

export function calculateSharedSizeFee(packageSize: SharedPackageSize): number {
  return SHARED_PRICING_POLICY.SIZE_FEES[packageSize];
}

export function calculateSharedUrgencySurcharge(
  urgency: SharedUrgency,
  baseAndDistanceFee: number
): number {
  return Math.round(baseAndDistanceFee * SHARED_PRICING_POLICY.URGENCY_MULTIPLIERS[urgency]);
}

export function calculateSharedServiceFee(amount: number): number {
  return Math.round(amount * SHARED_PRICING_POLICY.PLATFORM_FEE_RATE);
}

export function calculateSharedBreakdown(totalFee: number) {
  const platformFee = Math.round(totalFee * SHARED_PRICING_POLICY.PLATFORM_FEE_RATE);
  const gillerFee = totalFee - platformFee;

  return {
    gillerFee,
    platformFee,
  };
}

export function calculateSharedDeliveryFee(
  params: SharedPricingParams
): SharedDeliveryFeeBreakdown {
  const stationCount = Math.max(2, Math.round(params.stationCount));
  const weight = Math.max(0.1, params.weight ?? 1);
  const packageSize = params.packageSize ?? 'small';
  const urgency = params.urgency ?? 'normal';
  const publicFare = Math.max(0, params.publicFare ?? 0);
  const manualAdjustment = params.manualAdjustment ?? 0;

  const baseFee = SHARED_PRICING_POLICY.BASE_FEE;
  const distanceFee = calculateSharedDistanceFee(stationCount);
  const weightFee = calculateSharedWeightFee(weight);
  const sizeFee = calculateSharedSizeFee(packageSize);
  const urgencySurcharge = calculateSharedUrgencySurcharge(urgency, baseFee + distanceFee);
  const feeBeforeService = baseFee + distanceFee + weightFee + sizeFee;
  const serviceFee = calculateSharedServiceFee(feeBeforeService);
  const subtotal =
    baseFee +
    distanceFee +
    weightFee +
    sizeFee +
    urgencySurcharge +
    publicFare +
    manualAdjustment +
    serviceFee;
  const vat = Math.round(subtotal * SHARED_PRICING_POLICY.VAT_RATE);

  let totalFee = subtotal + vat;
  totalFee = Math.max(SHARED_PRICING_POLICY.MIN_FEE, totalFee);
  totalFee = Math.min(SHARED_PRICING_POLICY.MAX_FEE, totalFee);

  return {
    baseFee,
    distanceFee,
    weightFee,
    sizeFee,
    urgencySurcharge,
    publicFare,
    manualAdjustment,
    serviceFee,
    subtotal,
    vat,
    totalFee,
    breakdown: calculateSharedBreakdown(totalFee),
  };
}

export function calculateSharedSettlementBreakdown(
  totalFare: number,
  gillerBonus: number = 0
): SharedSettlementBreakdown {
  const pgFee = Math.round(totalFare * SHARED_PRICING_POLICY.PG_FEE_RATE);
  const platformRevenue = totalFare - pgFee;
  const serviceFee = Math.round(platformRevenue * SHARED_PRICING_POLICY.PLATFORM_FEE_RATE);
  const gillerPreTaxEarnings = platformRevenue - serviceFee + gillerBonus;
  const withholdingTax = Math.round(
    gillerPreTaxEarnings * SHARED_PRICING_POLICY.WITHHOLDING_TAX_RATE
  );
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
