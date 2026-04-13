import type { PricingQuote, QuoteType } from '../types/beta1';
import { calculatePhase1DeliveryFee, estimateStationCountFromCoords, type PackageSizeType } from './pricing-service';
import { type LegacyStationInfo as StationInfo } from '../utils/request-draft-adapters';
import type { SharedPricingPolicyConfig } from '../../shared/pricing-policy';
import type { RoutePricingOverrideConfig } from '../../shared/route-pricing-override';
import type { SharedPackageSize } from '../../shared/pricing-config';
import type { Beta1AIQuoteResponse } from './beta1-ai-service';
import type { RequestPricingContext } from '../types/request';

export interface Beta1RequestCreateInput {
  requesterUserId: string;
  requestMode?: 'immediate' | 'reservation';
  sourceRequestId?: string;
  originType?: 'station' | 'address';
  destinationType?: 'station' | 'address';
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  pickupRoadAddress?: string;
  pickupDetailAddress?: string;
  deliveryRoadAddress?: string;
  deliveryDetailAddress?: string;
  selectedPhotoIds?: string[];
  packageItemName?: string;
  packageCategory?: string;
  packageDescription: string;
  packageSize: SharedPackageSize;
  weightKg: number;
  itemValue?: number;
  recipientName: string;
  recipientPhone: string;
  pickupLocationDetail?: string;
  storageLocation?: string;
  lockerId?: string;
  actualLockerFee?: number;
  specialInstructions?: string;
  urgency?: 'normal' | 'fast' | 'urgent';
  selectedQuoteType: QuoteType;
  directParticipationMode: 'none' | 'requester_to_station' | 'locker_assisted';
  preferredPickupTime?: string;
  preferredArrivalTime?: string;
  aiAnalysisOverride?: {
    provider: string;
    model: string;
    confidence: number;
    fallbackUsed?: boolean;
    result: {
      itemName?: string;
      category?: string;
      description?: string;
      estimatedValue?: number;
      estimatedWeightKg?: number;
      estimatedSize?: SharedPackageSize;
      riskFlags: string[];
      handlingNotes: string[];
    };
  };
  aiQuoteOverride?: Beta1AIQuoteResponse;
  pricingPolicyVersion?: string;
  pricingContextOverride?: Partial<RequestPricingContext>;
  selectedCouponId?: string;
}

export interface Beta1QuoteCard {
  quoteType: QuoteType;
  label: string;
  headline: string;
  etaLabel: string;
  priceLabel: string;
  recommendationReason: string;
  includesLocker: boolean;
  includesAddressPickup: boolean;
  includesAddressDropoff: boolean;
  pricing: PricingQuote['finalPricing'];
}

type QuotePricingOverrides = Partial<
  Pick<
    PricingQuote['finalPricing'],
    | 'baseFee'
    | 'distanceFee'
    | 'weightFee'
    | 'sizeFee'
    | 'urgencySurcharge'
    | 'publicFare'
    | 'lockerFee'
    | 'addressPickupFee'
    | 'addressDropoffFee'
    | 'serviceFee'
    | 'vat'
  >
>;

type SupportedPackageSize = Exclude<PackageSizeType, 'extra_large'>;

function sanitizeUserFacingCopy(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const disallowedSignals = [
    '사진이 제공되지 않았으나',
    '추정하고 처리',
    '추정',
    '판단',
    'actor',
    '백그라운드',
    '수하자 정보가 입력되지 않았음',
    '소형 전자기기',
    '긴급 서류',
  ];

  if (disallowedSignals.some((signal) => normalized.includes(signal))) {
    return '입력한 요청 정보를 기준으로 현재 조건에 맞는 진행 방식을 안내합니다.';
  }

  return normalized;
}

function toEtaLabel(minutes: number, fallback: string): string {
  return Number.isFinite(minutes) && minutes > 0 ? `약 ${Math.round(minutes)}분` : fallback;
}

export function normalizePackageSize(packageSize: PackageSizeType): SupportedPackageSize {
  return packageSize === 'extra_large' ? 'xl' : packageSize;
}

function buildQuotePricing(
  base: ReturnType<typeof calculatePhase1DeliveryFee>,
  input: Beta1RequestCreateInput,
  overrides: QuotePricingOverrides = {}
): PricingQuote['finalPricing'] {
  const pricing: PricingQuote['finalPricing'] = {
    publicPrice: 0,
    depositAmount: input.itemValue ? Math.round(input.itemValue) : 0,
    baseFee: overrides.baseFee ?? base.baseFee,
    distanceFee: overrides.distanceFee ?? base.distanceFee,
    weightFee: overrides.weightFee ?? base.weightFee,
    sizeFee: overrides.sizeFee ?? base.sizeFee,
    urgencySurcharge: overrides.urgencySurcharge ?? base.urgencySurcharge,
    publicFare: overrides.publicFare ?? base.publicFare,
    lockerFee: overrides.lockerFee ?? 0,
    addressPickupFee: overrides.addressPickupFee ?? 0,
    addressDropoffFee: overrides.addressDropoffFee ?? 0,
    serviceFee: overrides.serviceFee ?? base.serviceFee,
    vat: overrides.vat ?? base.vat,
  };

  pricing.publicPrice =
    pricing.baseFee +
    pricing.distanceFee +
    pricing.weightFee +
    pricing.sizeFee +
    pricing.urgencySurcharge +
    pricing.publicFare +
    pricing.lockerFee +
    pricing.addressPickupFee +
    pricing.addressDropoffFee +
    pricing.serviceFee +
    pricing.vat;

  return pricing;
}

function hasUsableCoords(station: StationInfo) {
  return (
    Number.isFinite(station.lat) &&
    Number.isFinite(station.lng) &&
    station.lat !== 0 &&
    station.lng !== 0
  );
}

function resolveEstimatedStationCount(input: Beta1RequestCreateInput) {
  if (hasUsableCoords(input.pickupStation) && hasUsableCoords(input.deliveryStation)) {
    return estimateStationCountFromCoords(
      input.pickupStation.lat,
      input.pickupStation.lng,
      input.deliveryStation.lat,
      input.deliveryStation.lng
    );
  }

  return 5;
}

function resolveRequestedHour(input: Beta1RequestCreateInput): number {
  const value = input.preferredPickupTime?.trim();
  if (!value || value === 'now' || value === '지금 바로') {
    return new Date().getHours();
  }

  const matched = value.match(/(\d{1,2}):(\d{2})/);
  if (!matched) {
    return new Date().getHours();
  }

  const hour = Number(matched[1]);
  return Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : new Date().getHours();
}

export function buildBeta1BasePricing(
  input: Beta1RequestCreateInput,
  pricingPolicy?: Partial<SharedPricingPolicyConfig>
): PricingQuote['finalPricing'] {
  const requestedHour = input.pricingContextOverride?.requestedHour ?? resolveRequestedHour(input);
  const base = calculatePhase1DeliveryFee(
    {
      stationCount: resolveEstimatedStationCount(input),
      weight: input.weightKg,
      packageSize: normalizePackageSize(input.packageSize),
      urgency: input.urgency ?? 'normal',
      context: {
        requestedHour,
        weather: input.pricingContextOverride?.weather,
        isPeakTime:
          input.pricingContextOverride?.isPeakTime ??
          (input.requestMode === 'reservation' ? false : undefined),
        isProfessionalPeak: input.pricingContextOverride?.isProfessionalPeak,
        nearbyGillerCount: input.pricingContextOverride?.nearbyGillerCount ?? undefined,
      },
    },
    pricingPolicy
  );

  return {
    publicPrice: base.totalFee,
    depositAmount: input.itemValue ? Math.round(input.itemValue) : 0,
    baseFee: base.baseFee,
    distanceFee: base.distanceFee,
    weightFee: base.weightFee,
    sizeFee: base.sizeFee,
    urgencySurcharge: base.urgencySurcharge,
    publicFare: base.publicFare,
    lockerFee: 0,
    addressPickupFee: 0,
    addressDropoffFee: 0,
    serviceFee: base.serviceFee,
    vat: base.vat,
  };
}

export function applyAIQuoteResponseToCards(
  baseCards: Beta1QuoteCard[],
  aiQuoteResponse: Beta1AIQuoteResponse
): {
  quoteCards: Beta1QuoteCard[];
  recommendedQuoteType: Beta1QuoteCard['quoteType'];
} {
  const suggestions = new Map(aiQuoteResponse.quotes.map((quote) => [quote.quoteType, quote]));

  const quoteCards = baseCards.map((card) => {
    const suggestion = suggestions.get(card.quoteType);
    if (!suggestion) {
      return card;
    }

    return {
      ...card,
      label: suggestion.speedLabel || card.label,
      headline: sanitizeUserFacingCopy(suggestion.headline || card.headline),
      etaLabel: toEtaLabel(suggestion.etaMinutes, card.etaLabel),
      priceLabel: `${suggestion.pricing.publicPrice.toLocaleString()}원`,
      recommendationReason: sanitizeUserFacingCopy(
        suggestion.recommendationReason || card.recommendationReason
      ),
      includesLocker: suggestion.includesLocker,
      includesAddressPickup: suggestion.includesAddressPickup,
      includesAddressDropoff: suggestion.includesAddressDropoff,
      pricing: suggestion.pricing,
    };
  });

  const recommendedQuoteType =
    quoteCards.find((card) => card.quoteType === aiQuoteResponse.recommendedQuoteType)?.quoteType ??
    quoteCards.find((card) => card.quoteType === 'balanced')?.quoteType ??
    quoteCards[0]?.quoteType ??
    'balanced';

  return { quoteCards, recommendedQuoteType };
}

export function buildBeta1QuoteCards(
  input: Beta1RequestCreateInput,
  pricingPolicy?: Partial<SharedPricingPolicyConfig>,
  routeOverride?: RoutePricingOverrideConfig | null
): Beta1QuoteCard[] {
  const resolvedPolicy = pricingPolicy;
  const reservationMode = input.requestMode === 'reservation';
  const originType = input.originType ?? 'station';
  const destinationType = input.destinationType ?? 'station';
  const hasAddressPickup = originType === 'address';
  const hasAddressDropoff = destinationType === 'address';
  const addressPickupFee = hasAddressPickup ? (resolvedPolicy?.quoteAdjustments?.addressPickupFee ?? 900) : 0;
  const addressDropoffFee = hasAddressDropoff ? (resolvedPolicy?.quoteAdjustments?.addressDropoffFee ?? 800) : 0;
  const stationCount = resolveEstimatedStationCount(input);
  const requestedHour = input.pricingContextOverride?.requestedHour ?? resolveRequestedHour(input);
  const base = calculatePhase1DeliveryFee({
    stationCount,
    weight: input.weightKg,
    packageSize: normalizePackageSize(input.packageSize),
    urgency: input.urgency ?? 'normal',
    context: {
      requestedHour,
      weather: input.pricingContextOverride?.weather,
      isPeakTime: input.pricingContextOverride?.isPeakTime ?? (reservationMode ? false : undefined),
      isProfessionalPeak: input.pricingContextOverride?.isProfessionalPeak,
      nearbyGillerCount: input.pricingContextOverride?.nearbyGillerCount ?? undefined,
    },
  }, pricingPolicy);

  const fastestPricing = buildQuotePricing(base, input, {
    urgencySurcharge: reservationMode
      ? base.urgencySurcharge + (resolvedPolicy?.quoteAdjustments?.fastestReservationSurcharge ?? 900)
      : base.urgencySurcharge + (resolvedPolicy?.quoteAdjustments?.fastestImmediateSurcharge ?? 2500),
    addressPickupFee,
    addressDropoffFee,
  });

  const balancedPricing = buildQuotePricing(base, input, {
    urgencySurcharge: reservationMode
      ? Math.max(0, base.urgencySurcharge + (resolvedPolicy?.quoteAdjustments?.balancedReservationUrgencyOffset ?? -200))
      : base.urgencySurcharge,
    lockerFee:
      input.directParticipationMode === 'locker_assisted'
        ? (input.actualLockerFee ?? resolvedPolicy?.quoteAdjustments?.balancedLockerAssistedFee ?? 1000)
        : 0,
    addressPickupFee,
    addressDropoffFee,
  });

  const lowestPricePricing = buildQuotePricing(base, input, {
    distanceFee: Math.max(0, base.distanceFee - (resolvedPolicy?.quoteAdjustments?.lowestPriceDistanceDiscount ?? 300)),
    urgencySurcharge: Math.max(
      0,
      base.urgencySurcharge -
        (reservationMode
          ? (resolvedPolicy?.quoteAdjustments?.lowestPriceReservationUrgencyDiscount ?? 600)
          : (resolvedPolicy?.quoteAdjustments?.lowestPriceImmediateUrgencyDiscount ?? 200))
    ),
    lockerFee: input.actualLockerFee ?? resolvedPolicy?.quoteAdjustments?.lowestPriceLockerFee ?? 700,
    addressPickupFee: Math.round(addressPickupFee * (resolvedPolicy?.quoteAdjustments?.lowestPriceAddressPickupDiscountRate ?? 0.6)),
    addressDropoffFee: Math.round(addressDropoffFee * (resolvedPolicy?.quoteAdjustments?.lowestPriceAddressDropoffDiscountRate ?? 0.6)),
    serviceFee: Math.max(0, base.serviceFee - (resolvedPolicy?.quoteAdjustments?.lowestPriceServiceFeeDiscount ?? 150)),
  });
  lowestPricePricing.publicPrice = Math.max(
    resolvedPolicy?.quoteAdjustments?.lowestPriceMinPublicPrice ?? 3000,
    lowestPricePricing.publicPrice
  );

  const lockerIncludedPricing = buildQuotePricing(base, input, {
    lockerFee:
      (input.actualLockerFee ?? resolvedPolicy?.quoteAdjustments?.lockerIncludedBaseFee ?? 1200) +
      (reservationMode
        ? (resolvedPolicy?.quoteAdjustments?.lockerIncludedReservationExtraFee ?? 200)
        : (resolvedPolicy?.quoteAdjustments?.lockerIncludedImmediateExtraFee ?? 500)),
    addressPickupFee: Math.round(addressPickupFee * (resolvedPolicy?.quoteAdjustments?.lockerIncludedAddressPickupDiscountRate ?? 0.7)),
    addressDropoffFee: Math.round(addressDropoffFee * (resolvedPolicy?.quoteAdjustments?.lockerIncludedAddressDropoffDiscountRate ?? 0.7)),
  });

  const applyRouteOverride = (pricing: PricingQuote['finalPricing']): PricingQuote['finalPricing'] => {
    if (!routeOverride?.enabled) {
      return pricing;
    }

    const nextPublicPrice = Math.max(
      0,
      Math.round(pricing.publicPrice * routeOverride.multiplier) + routeOverride.fixedAdjustment
    );

    return {
      ...pricing,
      publicPrice: nextPublicPrice,
    };
  };

  return [
    {
      quoteType: 'fastest',
      label: reservationMode ? '예약 우선 배정' : '가장 빠르게',
      headline: reservationMode ? '원하는 시간에 맞춰 빠르게 연결을 준비합니다.' : '가장 빠른 진행을 우선으로 안내합니다.',
      etaLabel: reservationMode ? '예약 시간 우선 배정' : '약 70분',
      priceLabel: `${fastestPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: sanitizeUserFacingCopy(
        reservationMode
          ? '예약 시간에 맞춰 빠른 연결이 필요할 때 적합합니다.'
          : '도착 시간을 우선할 때 선택하기 좋은 옵션입니다.'
      ),
      includesLocker: false,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: applyRouteOverride(fastestPricing),
    },
    {
      quoteType: 'balanced',
      label: reservationMode ? '예약 균형형' : '추천 균형형',
      headline: reservationMode ? '시간 약속과 편의의 균형을 맞춘 옵션입니다.' : '속도와 비용의 균형이 좋은 옵션입니다.',
      etaLabel: reservationMode ? '예약 시간대 맞춤 배정' : hasAddressPickup || hasAddressDropoff ? '약 105분' : '약 95분',
      priceLabel: `${balancedPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: sanitizeUserFacingCopy(
        reservationMode
          ? '무리하지 않고 안정적으로 예약을 진행하고 싶을 때 적합합니다.'
          : '대부분의 배송 요청에 무난하게 잘 맞는 기본 추천 옵션입니다.'
      ),
      includesLocker: input.directParticipationMode === 'locker_assisted',
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: applyRouteOverride(balancedPricing),
    },
    {
      quoteType: 'lowest_price',
      label: '가장 저렴하게',
      headline: reservationMode ? '비용을 아끼는 방향으로 예약을 진행합니다.' : '비용 부담을 줄이는 데 초점을 맞춘 옵션입니다.',
      etaLabel: reservationMode ? '여유 시간대 중심 배정' : hasAddressPickup || hasAddressDropoff ? '약 130분' : '약 120분',
      priceLabel: `${lowestPricePricing.publicPrice.toLocaleString()}원`,
      recommendationReason: sanitizeUserFacingCopy(
        reservationMode
          ? '시간 여유가 있다면 비용을 가장 아끼기 좋은 선택입니다.'
          : '조금 더 여유 있게 진행해도 괜찮다면 비용 절감에 유리합니다.'
      ),
      includesLocker: true,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: applyRouteOverride(lowestPricePricing),
    },
    {
      quoteType: 'locker_included',
      label: reservationMode ? '예약 거점형' : '사물함 우선',
      headline: reservationMode ? '거점 중심으로 예약을 더 편하게 진행합니다.' : '사물함 활용이 편한 요청에 잘 맞는 옵션입니다.',
      etaLabel: reservationMode ? '거점 기준 예약 배정' : hasAddressPickup || hasAddressDropoff ? '약 110분' : '약 100분',
      priceLabel: `${lockerIncludedPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: sanitizeUserFacingCopy(
        reservationMode
          ? '사물함이나 거점 활용을 선호할 때 편하게 선택할 수 있습니다.'
          : '비대면 인계나 거점 이용이 편한 상황에서 적합합니다.'
      ),
      includesLocker: true,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: applyRouteOverride(lockerIncludedPricing),
    },
  ];
}
