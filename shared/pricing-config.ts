export type SharedPackageSize = 'small' | 'medium' | 'large' | 'xl' | 'extra_large';
export type SharedUrgency = 'normal' | 'fast' | 'urgent';
export type SharedWeatherCondition = 'clear' | 'rain' | 'snow';

export interface SharedPricingDynamicRules {
  rainMultiplier: number;
  snowMultiplier: number;
  peakTimeMultiplier: number;
  professionalPeakMultiplier: number;
  lowSupplyThreshold: number;
  lowSupplyMultiplier: number;
  highSupplyThreshold: number;
  highSupplyDiscountMultiplier: number;
}

export interface SharedPricingIncentiveRules {
  transferBonusPerHop: number;
  transferDiscount: number;
  professionalBonusRate: number;
  masterBonusRate: number;
}

export interface SharedPricingQuoteAdjustments {
  addressPickupFee: number;
  addressDropoffFee: number;
  fastestReservationSurcharge: number;
  fastestImmediateSurcharge: number;
  balancedLockerAssistedFee: number;
  lowestPriceDistanceDiscount: number;
  lowestPriceReservationUrgencyDiscount: number;
  lowestPriceImmediateUrgencyDiscount: number;
  lowestPriceLockerFee: number;
  lowestPriceAddressPickupDiscountRate: number;
  lowestPriceAddressDropoffDiscountRate: number;
  lowestPriceServiceFeeDiscount: number;
  lowestPriceMinPublicPrice: number;
  lockerIncludedBaseFee: number;
  lockerIncludedReservationExtraFee: number;
  lockerIncludedImmediateExtraFee: number;
  lockerIncludedAddressPickupDiscountRate: number;
  lockerIncludedAddressDropoffDiscountRate: number;
  balancedReservationUrgencyOffset: number;

  b2bBaseDistanceMeters?: number;
  b2bBaseFee?: number;
  b2bMaxDistanceMeters?: number;
  b2bExtraFeePer100m?: number;
}

export interface SharedPricingRecommendationRules {
  peakTimeMultiplier: number;
  professionalPeakMultiplier: number;
  rainMultiplier: number;
  snowMultiplier: number;
  lowSupplyMultiplier: number;
  highSupplyDiscountMultiplier: number;
  reservationDiscountMultiplier: number;
  minRecommendationMultiplier: number;
  maxRecommendationMultiplier: number;
}

export interface SharedPricingTimeRule {
  label: string;
  enabled: boolean;
  startHour: number;
  endHour: number;
  fixedAdjustment: number;
  multiplier: number;
}

export interface SharedPricingPolicyConfig {
  version: string;
  baseFee: number;
  minFee: number;
  maxFee: number;
  platformFeeRate: number;
  vatRate: number;
  pgFeeRate: number;
  withholdingTaxRate: number;
  baseStations: number;
  baseDistanceFee: number;
  feePerStation: number;
  baseWeight: number;
  minWeightFee: number;
  feePerKg: number;
  sizeFees: Record<SharedPackageSize, number>;
  urgencyMultipliers: Record<SharedUrgency, number>;
  dynamicRules: SharedPricingDynamicRules;
  incentiveRules: SharedPricingIncentiveRules;
  quoteAdjustments: SharedPricingQuoteAdjustments;
  recommendationRules: SharedPricingRecommendationRules;
  timeRules: SharedPricingTimeRule[];
  bidStep: number;
  minimumWithdrawalAmount: number;
  recommendationMultiplier: number;
  notes: string;
}

export const DEFAULT_SHARED_PRICING_POLICY: SharedPricingPolicyConfig = {
  version: 'pricing-policy-v1',
  baseFee: 2000,
  minFee: 3000,
  maxFee: 10000,
  platformFeeRate: 0.1,
  vatRate: 0.1,
  pgFeeRate: 0.03,
  withholdingTaxRate: 0.033,
  baseStations: 5,
  baseDistanceFee: 600,
  feePerStation: 120,
  baseWeight: 1,
  minWeightFee: 100,
  feePerKg: 100,
  sizeFees: {
    small: 0,
    medium: 400,
    large: 800,
    xl: 1500,
    extra_large: 1500,
  },
  urgencyMultipliers: {
    normal: 0,
    fast: 0.1,
    urgent: 0.2,
  },
  dynamicRules: {
    rainMultiplier: 0.08,
    snowMultiplier: 0.18,
    peakTimeMultiplier: 0.12,
    professionalPeakMultiplier: 0.1,
    lowSupplyThreshold: 3,
    lowSupplyMultiplier: 0.12,
    highSupplyThreshold: 8,
    highSupplyDiscountMultiplier: -0.05,
  },
  incentiveRules: {
    transferBonusPerHop: 500,
    transferDiscount: 500,
    professionalBonusRate: 0.25,
    masterBonusRate: 0.35,
  },
  quoteAdjustments: {
    addressPickupFee: 900, // Legacy fallback
    addressDropoffFee: 800, // Legacy fallback
    // B2B Dynamic Pricing Configuration
    b2bBaseDistanceMeters: 1000, // 1km 기본 거리
    b2bBaseFee: 1500, // 기본 거리 내 배달 대행료 (예: 1500원)
    b2bExtraFeePer100m: 100, // 100m 초과 시 추가 요금 (예: 100원)
    b2bMaxDistanceMeters: 5000, // 최대 지원 거리 (5km)

    fastestReservationSurcharge: 900,
    fastestImmediateSurcharge: 2500,
    balancedLockerAssistedFee: 1000,
    lowestPriceDistanceDiscount: 300,
    lowestPriceReservationUrgencyDiscount: 600,
    lowestPriceImmediateUrgencyDiscount: 200,
    lowestPriceLockerFee: 700,
    lowestPriceAddressPickupDiscountRate: 0.6,
    lowestPriceAddressDropoffDiscountRate: 0.6,
    lowestPriceServiceFeeDiscount: 150,
    lowestPriceMinPublicPrice: 3000,
    lockerIncludedBaseFee: 1200,
    lockerIncludedReservationExtraFee: 200,
    lockerIncludedImmediateExtraFee: 500,
    lockerIncludedAddressPickupDiscountRate: 0.7,
    lockerIncludedAddressDropoffDiscountRate: 0.7,
    balancedReservationUrgencyOffset: -200,
  },
  recommendationRules: {
    peakTimeMultiplier: 0.06,
    professionalPeakMultiplier: 0.04,
    rainMultiplier: 0.03,
    snowMultiplier: 0.07,
    lowSupplyMultiplier: 0.08,
    highSupplyDiscountMultiplier: -0.04,
    reservationDiscountMultiplier: -0.02,
    minRecommendationMultiplier: 0.5,
    maxRecommendationMultiplier: 1.35,
  },
  timeRules: [
    {
      label: '출근 피크',
      enabled: true,
      startHour: 7,
      endHour: 9,
      fixedAdjustment: 500,
      multiplier: 1,
    },
    {
      label: '퇴근 피크',
      enabled: true,
      startHour: 18,
      endHour: 20,
      fixedAdjustment: 700,
      multiplier: 1,
    },
  ],
  bidStep: 1000,
  minimumWithdrawalAmount: 10000,
  recommendationMultiplier: 1.05,
  notes: '운영 기준 가격 정책',
};

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampRate(value: unknown, fallback: number): number {
  const num = toNumber(value, fallback);
  return Math.max(-1, Math.min(1, num));
}

export function normalizeSharedPricingPolicy(
  input?: Partial<SharedPricingPolicyConfig> | null
): SharedPricingPolicyConfig {
  const source = input ?? {};
  const dynamicRules: Partial<SharedPricingDynamicRules> = source.dynamicRules ?? {};

  return {
    version: typeof source.version === 'string' && source.version.trim() ? source.version : DEFAULT_SHARED_PRICING_POLICY.version,
    baseFee: Math.max(0, Math.round(toNumber(source.baseFee, DEFAULT_SHARED_PRICING_POLICY.baseFee))),
    minFee: Math.max(0, Math.round(toNumber(source.minFee, DEFAULT_SHARED_PRICING_POLICY.minFee))),
    maxFee: Math.max(0, Math.round(toNumber(source.maxFee, DEFAULT_SHARED_PRICING_POLICY.maxFee))),
    platformFeeRate: clampRate(source.platformFeeRate, DEFAULT_SHARED_PRICING_POLICY.platformFeeRate),
    vatRate: clampRate(source.vatRate, DEFAULT_SHARED_PRICING_POLICY.vatRate),
    pgFeeRate: clampRate(source.pgFeeRate, DEFAULT_SHARED_PRICING_POLICY.pgFeeRate),
    withholdingTaxRate: clampRate(source.withholdingTaxRate, DEFAULT_SHARED_PRICING_POLICY.withholdingTaxRate),
    baseStations: Math.max(1, Math.round(toNumber(source.baseStations, DEFAULT_SHARED_PRICING_POLICY.baseStations))),
    baseDistanceFee: Math.max(0, Math.round(toNumber(source.baseDistanceFee, DEFAULT_SHARED_PRICING_POLICY.baseDistanceFee))),
    feePerStation: Math.max(0, Math.round(toNumber(source.feePerStation, DEFAULT_SHARED_PRICING_POLICY.feePerStation))),
    baseWeight: Math.max(0.1, toNumber(source.baseWeight, DEFAULT_SHARED_PRICING_POLICY.baseWeight)),
    minWeightFee: Math.max(0, Math.round(toNumber(source.minWeightFee, DEFAULT_SHARED_PRICING_POLICY.minWeightFee))),
    feePerKg: Math.max(0, Math.round(toNumber(source.feePerKg, DEFAULT_SHARED_PRICING_POLICY.feePerKg))),
    sizeFees: {
      small: Math.max(0, Math.round(toNumber(source.sizeFees?.small, DEFAULT_SHARED_PRICING_POLICY.sizeFees.small))),
      medium: Math.max(0, Math.round(toNumber(source.sizeFees?.medium, DEFAULT_SHARED_PRICING_POLICY.sizeFees.medium))),
      large: Math.max(0, Math.round(toNumber(source.sizeFees?.large, DEFAULT_SHARED_PRICING_POLICY.sizeFees.large))),
      xl: Math.max(0, Math.round(toNumber(source.sizeFees?.xl, DEFAULT_SHARED_PRICING_POLICY.sizeFees.xl))),
      extra_large: Math.max(0, Math.round(toNumber(source.sizeFees?.extra_large, DEFAULT_SHARED_PRICING_POLICY.sizeFees.extra_large))),
    },
    urgencyMultipliers: {
      normal: clampRate(source.urgencyMultipliers?.normal, DEFAULT_SHARED_PRICING_POLICY.urgencyMultipliers.normal),
      fast: clampRate(source.urgencyMultipliers?.fast, DEFAULT_SHARED_PRICING_POLICY.urgencyMultipliers.fast),
      urgent: clampRate(source.urgencyMultipliers?.urgent, DEFAULT_SHARED_PRICING_POLICY.urgencyMultipliers.urgent),
    },
    dynamicRules: {
      rainMultiplier: clampRate(dynamicRules.rainMultiplier, DEFAULT_SHARED_PRICING_POLICY.dynamicRules.rainMultiplier),
      snowMultiplier: clampRate(dynamicRules.snowMultiplier, DEFAULT_SHARED_PRICING_POLICY.dynamicRules.snowMultiplier),
      peakTimeMultiplier: clampRate(dynamicRules.peakTimeMultiplier, DEFAULT_SHARED_PRICING_POLICY.dynamicRules.peakTimeMultiplier),
      professionalPeakMultiplier: clampRate(dynamicRules.professionalPeakMultiplier, DEFAULT_SHARED_PRICING_POLICY.dynamicRules.professionalPeakMultiplier),
      lowSupplyThreshold: Math.max(0, Math.round(toNumber(dynamicRules.lowSupplyThreshold, DEFAULT_SHARED_PRICING_POLICY.dynamicRules.lowSupplyThreshold))),
      lowSupplyMultiplier: clampRate(dynamicRules.lowSupplyMultiplier, DEFAULT_SHARED_PRICING_POLICY.dynamicRules.lowSupplyMultiplier),
      highSupplyThreshold: Math.max(0, Math.round(toNumber(dynamicRules.highSupplyThreshold, DEFAULT_SHARED_PRICING_POLICY.dynamicRules.highSupplyThreshold))),
      highSupplyDiscountMultiplier: clampRate(dynamicRules.highSupplyDiscountMultiplier, DEFAULT_SHARED_PRICING_POLICY.dynamicRules.highSupplyDiscountMultiplier),
    },
    incentiveRules: {
      transferBonusPerHop: Math.max(0, Math.round(toNumber(source.incentiveRules?.transferBonusPerHop, DEFAULT_SHARED_PRICING_POLICY.incentiveRules.transferBonusPerHop))),
      transferDiscount: Math.max(0, Math.round(toNumber(source.incentiveRules?.transferDiscount, DEFAULT_SHARED_PRICING_POLICY.incentiveRules.transferDiscount))),
      professionalBonusRate: clampRate(source.incentiveRules?.professionalBonusRate, DEFAULT_SHARED_PRICING_POLICY.incentiveRules.professionalBonusRate),
      masterBonusRate: clampRate(source.incentiveRules?.masterBonusRate, DEFAULT_SHARED_PRICING_POLICY.incentiveRules.masterBonusRate),
    },
    quoteAdjustments: {
      addressPickupFee: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.addressPickupFee, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.addressPickupFee))),
      addressDropoffFee: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.addressDropoffFee, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.addressDropoffFee))),
      fastestReservationSurcharge: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.fastestReservationSurcharge, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.fastestReservationSurcharge))),
      fastestImmediateSurcharge: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.fastestImmediateSurcharge, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.fastestImmediateSurcharge))),
      balancedLockerAssistedFee: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.balancedLockerAssistedFee, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.balancedLockerAssistedFee))),
      lowestPriceDistanceDiscount: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lowestPriceDistanceDiscount, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lowestPriceDistanceDiscount))),
      lowestPriceReservationUrgencyDiscount: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lowestPriceReservationUrgencyDiscount, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lowestPriceReservationUrgencyDiscount))),
      lowestPriceImmediateUrgencyDiscount: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lowestPriceImmediateUrgencyDiscount, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lowestPriceImmediateUrgencyDiscount))),
      lowestPriceLockerFee: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lowestPriceLockerFee, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lowestPriceLockerFee))),
      lowestPriceAddressPickupDiscountRate: clampRate(source.quoteAdjustments?.lowestPriceAddressPickupDiscountRate, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lowestPriceAddressPickupDiscountRate),
      lowestPriceAddressDropoffDiscountRate: clampRate(source.quoteAdjustments?.lowestPriceAddressDropoffDiscountRate, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lowestPriceAddressDropoffDiscountRate),
      lowestPriceServiceFeeDiscount: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lowestPriceServiceFeeDiscount, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lowestPriceServiceFeeDiscount))),
      lowestPriceMinPublicPrice: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lowestPriceMinPublicPrice, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lowestPriceMinPublicPrice))),
      lockerIncludedBaseFee: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lockerIncludedBaseFee, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lockerIncludedBaseFee))),
      lockerIncludedReservationExtraFee: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lockerIncludedReservationExtraFee, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lockerIncludedReservationExtraFee))),
      lockerIncludedImmediateExtraFee: Math.max(0, Math.round(toNumber(source.quoteAdjustments?.lockerIncludedImmediateExtraFee, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lockerIncludedImmediateExtraFee))),
      lockerIncludedAddressPickupDiscountRate: clampRate(source.quoteAdjustments?.lockerIncludedAddressPickupDiscountRate, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lockerIncludedAddressPickupDiscountRate),
      lockerIncludedAddressDropoffDiscountRate: clampRate(source.quoteAdjustments?.lockerIncludedAddressDropoffDiscountRate, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.lockerIncludedAddressDropoffDiscountRate),
      balancedReservationUrgencyOffset: Math.round(toNumber(source.quoteAdjustments?.balancedReservationUrgencyOffset, DEFAULT_SHARED_PRICING_POLICY.quoteAdjustments.balancedReservationUrgencyOffset)),
    },
    recommendationRules: {
      peakTimeMultiplier: clampRate(source.recommendationRules?.peakTimeMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.peakTimeMultiplier),
      professionalPeakMultiplier: clampRate(source.recommendationRules?.professionalPeakMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.professionalPeakMultiplier),
      rainMultiplier: clampRate(source.recommendationRules?.rainMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.rainMultiplier),
      snowMultiplier: clampRate(source.recommendationRules?.snowMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.snowMultiplier),
      lowSupplyMultiplier: clampRate(source.recommendationRules?.lowSupplyMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.lowSupplyMultiplier),
      highSupplyDiscountMultiplier: clampRate(source.recommendationRules?.highSupplyDiscountMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.highSupplyDiscountMultiplier),
      reservationDiscountMultiplier: clampRate(source.recommendationRules?.reservationDiscountMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.reservationDiscountMultiplier),
      minRecommendationMultiplier: Math.max(0.1, toNumber(source.recommendationRules?.minRecommendationMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.minRecommendationMultiplier)),
      maxRecommendationMultiplier: Math.max(1, toNumber(source.recommendationRules?.maxRecommendationMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationRules.maxRecommendationMultiplier)),
    },
    timeRules: Array.isArray(source.timeRules) && source.timeRules.length > 0
      ? source.timeRules.slice(0, 12).map((rule, index) => ({
          label:
            typeof rule?.label === 'string' && rule.label.trim()
              ? rule.label.trim()
              : `시간 규칙 ${index + 1}`,
          enabled: typeof rule?.enabled === 'boolean' ? rule.enabled : true,
          startHour: Math.max(0, Math.min(23, Math.round(toNumber(rule?.startHour, 9)))),
          endHour: Math.max(0, Math.min(23, Math.round(toNumber(rule?.endHour, 18)))),
          fixedAdjustment: Math.round(toNumber(rule?.fixedAdjustment, 0)),
          multiplier: Math.max(0.5, Math.min(3, toNumber(rule?.multiplier, 1))),
        }))
      : DEFAULT_SHARED_PRICING_POLICY.timeRules,
    bidStep: Math.max(500, Math.round(toNumber(source.bidStep, DEFAULT_SHARED_PRICING_POLICY.bidStep))),
    minimumWithdrawalAmount: Math.max(0, Math.round(toNumber(source.minimumWithdrawalAmount, DEFAULT_SHARED_PRICING_POLICY.minimumWithdrawalAmount))),
    recommendationMultiplier: Math.max(1, toNumber(source.recommendationMultiplier, DEFAULT_SHARED_PRICING_POLICY.recommendationMultiplier)),
    notes: typeof source.notes === 'string' ? source.notes : DEFAULT_SHARED_PRICING_POLICY.notes,
  };
}
