import type { PricingQuote, QuoteType } from '../types/beta1';
import { calculatePhase1DeliveryFee, estimateStationCountFromCoords, type PackageSizeType } from './pricing-service';
import { type LegacyStationInfo as StationInfo } from '../utils/request-draft-adapters';

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
  packageSize: PackageSizeType;
  weightKg: number;
  itemValue?: number;
  recipientName: string;
  recipientPhone: string;
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
      estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
      riskFlags: string[];
      handlingNotes: string[];
    };
  };
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

export function buildBeta1QuoteCards(input: Beta1RequestCreateInput): Beta1QuoteCard[] {
  const reservationMode = input.requestMode === 'reservation';
  const originType = input.originType ?? 'station';
  const destinationType = input.destinationType ?? 'station';
  const hasAddressPickup = originType === 'address';
  const hasAddressDropoff = destinationType === 'address';
  const addressPickupFee = hasAddressPickup ? 900 : 0;
  const addressDropoffFee = hasAddressDropoff ? 800 : 0;
  const stationCount = resolveEstimatedStationCount(input);
  const base = calculatePhase1DeliveryFee({
    stationCount,
    weight: input.weightKg,
    packageSize: normalizePackageSize(input.packageSize),
    urgency: input.urgency ?? 'normal',
  });

  const fastestPricing = buildQuotePricing(base, input, {
    urgencySurcharge: reservationMode ? base.urgencySurcharge + 900 : base.urgencySurcharge + 2500,
    addressPickupFee,
    addressDropoffFee,
  });

  const balancedPricing = buildQuotePricing(base, input, {
    urgencySurcharge: reservationMode ? Math.max(0, base.urgencySurcharge - 200) : base.urgencySurcharge,
    lockerFee: input.directParticipationMode === 'locker_assisted' ? 1000 : 0,
    addressPickupFee,
    addressDropoffFee,
  });

  const lowestPricePricing = buildQuotePricing(base, input, {
    distanceFee: Math.max(0, base.distanceFee - 300),
    urgencySurcharge: Math.max(0, base.urgencySurcharge - (reservationMode ? 600 : 200)),
    lockerFee: 700,
    addressPickupFee: Math.round(addressPickupFee * 0.6),
    addressDropoffFee: Math.round(addressDropoffFee * 0.6),
    serviceFee: Math.max(0, base.serviceFee - 150),
  });
  lowestPricePricing.publicPrice = Math.max(3000, lowestPricePricing.publicPrice);

  const lockerIncludedPricing = buildQuotePricing(base, input, {
    lockerFee: 1200 + (reservationMode ? 200 : 500),
    addressPickupFee: Math.round(addressPickupFee * 0.7),
    addressDropoffFee: Math.round(addressDropoffFee * 0.7),
  });

  return [
    {
      quoteType: 'fastest',
      label: reservationMode ? '예약 우선 배정' : '가장 빠르게',
      headline: reservationMode ? '예약 요청이지만 빠른 배정 가능성을 열어둡니다.' : '지금 바로 미션을 열어 가장 빠른 연결을 노립니다.',
      etaLabel: reservationMode ? '예약 시간 우선 배정' : '약 70분',
      priceLabel: `${fastestPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: reservationMode
        ? '예약 시간대와 주소/역 혼합 조건을 함께 고려해 빠른 actor를 먼저 검토합니다.'
        : '시간 제약과 주소/역 혼합 동선을 함께 반영해 가장 빠른 연결을 노립니다.',
      includesLocker: false,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: fastestPricing,
    },
    {
      quoteType: 'balanced',
      label: reservationMode ? '예약 균형형' : '추천 균형형',
      headline: reservationMode ? '동선 안정성과 시간대 적합성을 함께 맞춥니다.' : '미션 속도와 리스크를 균형 있게 맞춥니다.',
      etaLabel: reservationMode ? '예약 시간대 맞춤 배정' : hasAddressPickup || hasAddressDropoff ? '약 105분' : '약 95분',
      priceLabel: `${balancedPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: reservationMode
        ? '예약 요청에서는 시간대 합의와 주소/역 인계 안정성이 더 중요합니다.'
        : '주소 픽업이나 주소 도착이 포함돼도 가장 안정적인 균형을 제공합니다.',
      includesLocker: input.directParticipationMode === 'locker_assisted',
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: balancedPricing,
    },
    {
      quoteType: 'lowest_price',
      label: '가장 저렴하게',
      headline: reservationMode ? '여유 시간대와 직접 참여를 활용해 비용을 낮춥니다.' : '사용자 직접 참여와 사물함 경유를 우선 적용합니다.',
      etaLabel: reservationMode ? '여유 시간대 중심 배정' : hasAddressPickup || hasAddressDropoff ? '약 130분' : '약 120분',
      priceLabel: `${lowestPricePricing.publicPrice.toLocaleString()}원`,
      recommendationReason: reservationMode
        ? '급하지 않을수록 주소/역 혼합 요청도 예약 전환으로 비용 절감 효과가 커집니다.'
        : '직접 참여와 거점 활용으로 주소 구간 비용을 최대한 낮춥니다.',
      includesLocker: true,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: lowestPricePricing,
    },
    {
      quoteType: 'locker_included',
      label: reservationMode ? '예약 거점형' : '사물함 우선',
      headline: reservationMode ? '사물함과 거점 중심으로 예약 실패 리스크를 줄입니다.' : '사물함과 거점 연계를 우선 적용해 매칭 리스크를 낮춥니다.',
      etaLabel: reservationMode ? '거점 기준 예약 배정' : hasAddressPickup || hasAddressDropoff ? '약 110분' : '약 100분',
      priceLabel: `${lockerIncludedPricing.publicPrice.toLocaleString()}원`,
      recommendationReason: reservationMode
        ? '예약형에서는 거점 연계가 주소/역 혼합 요청의 시간 약속 유지에 유리합니다.'
        : '사물함과 거점 연계로 주소 인계 실패율을 낮춥니다.',
      includesLocker: true,
      includesAddressPickup: hasAddressPickup,
      includesAddressDropoff: hasAddressDropoff,
      pricing: lockerIncludedPricing,
    },
  ];
}
