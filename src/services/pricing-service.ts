import {
  SHARED_PRICING_POLICY,
  calculateSharedBreakdown,
  calculateSharedDeliveryFee,
  calculateSharedDistanceFee,
  calculateSharedServiceFee,
  calculateSharedSizeFee,
  calculateSharedUrgencySurcharge,
  calculateSharedWeightFee,
  type SharedPricingContext,
  type SharedPricingPolicyConfig,
} from '../../shared/pricing-policy';

export type PackageSizeType = 'small' | 'medium' | 'large' | 'xl' | 'extra_large';

export interface Phase1PricingParams {
  stationCount: number;
  weight?: number;
  packageSize?: PackageSizeType;
  urgency?: 'normal' | 'fast' | 'urgent';
  publicFare?: number;
  manualAdjustment?: number;
  context?: SharedPricingContext;
}

export interface DeliveryFeeBreakdown {
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
  description: string;
}

export const PRICING_POLICY = {
  BASE_FEE: SHARED_PRICING_POLICY.baseFee,
  MIN_FEE: SHARED_PRICING_POLICY.minFee,
  MAX_FEE: SHARED_PRICING_POLICY.maxFee,
  PLATFORM_FEE_RATE: SHARED_PRICING_POLICY.platformFeeRate,
} as const;

const PRICING_CONFIG = {
  BASE_FEE: SHARED_PRICING_POLICY.baseFee,
  MIN_FEE: SHARED_PRICING_POLICY.minFee,
  MAX_FEE: SHARED_PRICING_POLICY.maxFee,
  PLATFORM_FEE_RATE: SHARED_PRICING_POLICY.platformFeeRate,
  VAT_RATE: SHARED_PRICING_POLICY.vatRate,
} as const;

export function calculatePhase1DeliveryFee(
  params: Phase1PricingParams,
  policy?: Partial<SharedPricingPolicyConfig>
): DeliveryFeeBreakdown {
  const stationCount = params.stationCount ?? 5;
  const packageSize = params.packageSize ?? 'small';
  const urgency = params.urgency ?? 'normal';

  const result = calculateSharedDeliveryFee({
    stationCount,
    weight: params.weight,
    packageSize,
    urgency,
    publicFare: params.publicFare,
    manualAdjustment: params.manualAdjustment,
    context: params.context,
  }, policy);

  return {
    baseFee: result.baseFee,
    distanceFee: result.distanceFee,
    weightFee: result.weightFee,
    sizeFee: result.sizeFee,
    urgencySurcharge: result.urgencySurcharge,
    publicFare: result.publicFare,
    manualAdjustment: result.manualAdjustment,
    dynamicAdjustment: result.dynamicAdjustment,
    serviceFee: result.serviceFee,
    subtotal: result.subtotal,
    vat: result.vat,
    totalFee: result.totalFee,
    breakdown: result.breakdown,
    description: generateDescription(stationCount, packageSize, urgency),
  };
}

export function calculateDistanceFee(
  stationCount: number,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  return calculateSharedDistanceFee(stationCount, policy);
}

export function calculateWeightFee(
  weight: number,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  return calculateSharedWeightFee(weight, policy);
}

export function calculateSizeFee(
  packageSize: PackageSizeType,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  return calculateSharedSizeFee(packageSize, policy);
}

export function calculateUrgencySurcharge(
  urgency: 'normal' | 'fast' | 'urgent',
  baseAndDistanceFee: number,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  return calculateSharedUrgencySurcharge(urgency, baseAndDistanceFee, policy);
}

export function calculateServiceFee(
  feeBeforeService: number,
  rate: number = SHARED_PRICING_POLICY.platformFeeRate,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  if (rate === SHARED_PRICING_POLICY.platformFeeRate) {
    return calculateSharedServiceFee(feeBeforeService, policy);
  }

  return Math.round(feeBeforeService * rate);
}

export function calculateBreakdown(
  totalFee: number,
  policy?: Partial<SharedPricingPolicyConfig>
): { gillerFee: number; platformFee: number } {
  return calculateSharedBreakdown(totalFee, policy);
}

function generateDescription(
  stationCount: number,
  packageSize: PackageSizeType,
  urgency: string
): string {
  const urgencyText = {
    normal: '2-3시간',
    fast: '1-2시간',
    urgent: '30분-1시간',
  } as const;

  const sizeText: Record<PackageSizeType, string> = {
    small: '소형',
    medium: '중형',
    large: '대형',
    xl: '특대형',
    extra_large: '특대형',
  };

  return `1단계 배송 (${stationCount}개역 구간, ${sizeText[packageSize]}, ${
    urgencyText[urgency as keyof typeof urgencyText] ?? '보통'
  })`;
}

export function estimateDeliveryFee(
  params: Phase1PricingParams,
  policy?: Partial<SharedPricingPolicyConfig>
): number {
  return calculatePhase1DeliveryFee(params, policy).totalFee;
}

export function calculateStraightLineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusMeters = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

export function estimateStationCountFromCoords(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const straightLineMeters = calculateStraightLineDistance(lat1, lng1, lat2, lng2);
  const estimatedRouteMeters = straightLineMeters * 1.3;
  const averageStationDistanceMeters = 1200;
  const estimatedStations = Math.round(estimatedRouteMeters / averageStationDistanceMeters);

  return Math.max(2, Math.min(50, estimatedStations));
}

export function isMaxFeeReached(
  params: Phase1PricingParams,
  policy?: Partial<SharedPricingPolicyConfig>
): boolean {
  const maxFee = policy?.maxFee ?? PRICING_CONFIG.MAX_FEE;
  return calculatePhase1DeliveryFee(params, policy).totalFee >= maxFee;
}
