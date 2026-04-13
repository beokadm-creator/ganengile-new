import {
  collection,
  doc,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getTravelTimeConfig } from '../config-service';
import { calculatePhase1DeliveryFee, type Phase1PricingParams, type PackageSizeType } from '../pricing-service';
import { getPricingPolicyConfig } from '../pricing-policy-config-service';
import { getRoutePricingOverride } from '../route-pricing-override-service';
import { getRequestById } from './request-repository';
import { notifyGillers } from './request-event-service';
import { RequestStatus } from '../../types/request';
import type { CreateRequestData, RequestPricingContext, StationInfo } from '../../types/request';
import type { SharedPackageSize } from '../../../shared/pricing-config';

export type FeeSnapshot = {
  totalFee?: number;
  breakdown?: {
    gillerFee?: number;
    platformFee?: number;
  };
  [key: string]: unknown;
};

export type RoutePriceInsight = {
  averageFee: number;
  minFee: number;
  maxFee: number;
  sampleCount: number;
  recommendedFee: number;
  routeKey: string;
  averageDynamicAdjustment: number;
  contextSummary: string;
  recommendationReason: string;
  policyVersion: string | null;
  routeOverride: {
    enabled: boolean;
    fixedAdjustment: number;
    multiplier: number;
    minCompletedCount: number;
    applied: boolean;
  } | null;
};

function buildRouteKey(pickupStationId: string, deliveryStationId: string, requestMode?: string): string {
  const mode = requestMode === 'reservation' ? 'reservation' : 'immediate';
  return `${pickupStationId}_${deliveryStationId}_${mode}`;
}

function resolveUrgencyBucket(urgency?: CreateRequestData['urgency']): RequestPricingContext['urgencyBucket'] {
  if (urgency === 'high') return 'urgent';
  if (urgency === 'medium') return 'fast';
  return 'normal';
}

function inferRequestedHour(requestData: CreateRequestData): number {
  const departureTime = requestData.preferredTime?.departureTime;
  if (typeof departureTime === 'string') {
    const [hourText] = departureTime.split(':');
    const hour = Number(hourText);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      return hour;
    }
  }
  return new Date().getHours();
}

function isPeakHour(hour: number): boolean {
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
}

export function buildRequestPricingContext(requestData: CreateRequestData): RequestPricingContext {
  const requestMode = requestData.requestMode === 'reservation' ? 'reservation' : 'immediate';
  const requestedHour = inferRequestedHour(requestData);

  return {
    requestMode,
    weather: requestData.pricingContext?.weather ?? 'clear',
    isPeakTime: requestData.pricingContext?.isPeakTime ?? isPeakHour(requestedHour),
    isProfessionalPeak: requestData.pricingContext?.isProfessionalPeak ?? false,
    nearbyGillerCount: requestData.pricingContext?.nearbyGillerCount ?? null,
    requestedHour,
    urgencyBucket: requestData.pricingContext?.urgencyBucket ?? resolveUrgencyBucket(requestData.urgency),
  };
}

function summarizeInsightContext(input: {
  requestMode?: 'immediate' | 'reservation';
  peakSamples: number;
  immediateSamples: number;
  reservationSamples: number;
  sampleCount: number;
  averageDynamicAdjustment: number;
  currentWeather?: 'clear' | 'rain' | 'snow';
  nearbyGillerCount?: number | null;
  isProfessionalPeak?: boolean;
}): { contextSummary: string; recommendationReason: string } {
  const modeLabel = input.requestMode === 'reservation' ? '예약 요청' : '즉시 요청';
  const dominantMode = input.immediateSamples >= input.reservationSamples ? '즉시 요청 비중이 높고' : '예약 요청 비중이 높고';
  const peakShare = input.sampleCount > 0 ? input.peakSamples / input.sampleCount : 0;

  const contextSummary = input.averageDynamicAdjustment > 0
    ? `${modeLabel} 기준 최근 완료 이력에서 환경 가산이 반영된 구간입니다.`
    : `${modeLabel} 기준 최근 완료 이력을 바탕으로 계산했습니다.`;

  let recommendationReason = `${dominantMode} 최근 완료 요금 흐름을 기준으로 추천 금액을 만들었습니다.`;

  if (peakShare >= 0.4) {
    recommendationReason = `피크 시간대 완료 비중이 높아 ${dominantMode} 추천 금액을 조금 보수적으로 잡았습니다.`;
  } else if (input.averageDynamicAdjustment < 0) {
    recommendationReason = `공급이 넉넉했던 완료 이력이 많아 ${dominantMode} 추천 금액을 완만하게 유지했습니다.`;
  }

  if (input.currentWeather === 'snow') {
    recommendationReason = '눈 오는 상황까지 반영해 추천 금액을 조금 더 높게 잡았습니다.';
  } else if (input.currentWeather === 'rain') {
    recommendationReason = '비 오는 상황을 반영해 추천 금액을 소폭 높게 잡았습니다.';
  } else if (typeof input.nearbyGillerCount === 'number' && input.nearbyGillerCount <= 3) {
    recommendationReason = '주변 길러 수가 적은 편이라 응답 가능성을 높이도록 추천 금액을 조정했습니다.';
  } else if (input.isProfessionalPeak) {
    recommendationReason = '전문 길러 피크 시간대를 반영해 추천 금액을 보수적으로 잡았습니다.';
  }

  return { contextSummary, recommendationReason };
}

function calculateInsightRecommendation(input: {
  averageFee: number;
  requestMode?: 'immediate' | 'reservation';
  peakSamples: number;
  immediateSamples: number;
  reservationSamples: number;
  sampleCount: number;
  currentWeather?: 'clear' | 'rain' | 'snow';
  nearbyGillerCount?: number | null;
  isProfessionalPeak?: boolean;
  pricingPolicy: Awaited<ReturnType<typeof getPricingPolicyConfig>>;
  routeOverride?: {
    enabled: boolean;
    fixedAdjustment: number;
    multiplier: number;
    minCompletedCount: number;
  } | null;
  fallbackFee?: number;
}): number {
  const { pricingPolicy } = input;
  const MIN_RELIABLE_SAMPLES = 5;
  const baseAverage = (input.sampleCount < MIN_RELIABLE_SAMPLES && input.fallbackFee) 
    ? input.fallbackFee 
    : input.averageFee;

  let multiplier = pricingPolicy.recommendationMultiplier;

  if (input.sampleCount > 0 && input.peakSamples / input.sampleCount >= 0.4) {
    multiplier += pricingPolicy.recommendationRules.peakTimeMultiplier;
  }
  if (input.isProfessionalPeak) {
    multiplier += pricingPolicy.recommendationRules.professionalPeakMultiplier;
  }
  if (input.currentWeather === 'rain') {
    multiplier += pricingPolicy.recommendationRules.rainMultiplier;
  } else if (input.currentWeather === 'snow') {
    multiplier += pricingPolicy.recommendationRules.snowMultiplier;
  }
  if (typeof input.nearbyGillerCount === 'number') {
    if (input.nearbyGillerCount <= pricingPolicy.dynamicRules.lowSupplyThreshold) {
      multiplier += pricingPolicy.recommendationRules.lowSupplyMultiplier;
    } else if (input.nearbyGillerCount >= pricingPolicy.dynamicRules.highSupplyThreshold) {
      multiplier += pricingPolicy.recommendationRules.highSupplyDiscountMultiplier;
    }
  }
  if (input.requestMode === 'reservation') {
    multiplier += pricingPolicy.recommendationRules.reservationDiscountMultiplier;
  }

  multiplier = Math.max(
    pricingPolicy.recommendationRules.minRecommendationMultiplier ?? 0.5,
    Math.min(pricingPolicy.recommendationRules.maxRecommendationMultiplier, multiplier)
  );
  let recommendedFee = Math.max(
    pricingPolicy.minFee ?? 0,
    Math.ceil((baseAverage * multiplier) / pricingPolicy.bidStep) * pricingPolicy.bidStep
  );

  if (input.routeOverride?.enabled && input.sampleCount >= input.routeOverride.minCompletedCount) {
    recommendedFee = Math.ceil(
      ((recommendedFee * input.routeOverride.multiplier) + input.routeOverride.fixedAdjustment) / pricingPolicy.bidStep
    ) * pricingPolicy.bidStep;
  }

  return recommendedFee;
}

export async function calculateDeliveryFee(
  pickupStation: StationInfo,
  deliveryStation: StationInfo,
  packageSize: SharedPackageSize,
  weight: number,
  urgencySurcharge: number = 0,
  manualAdjustment: number = 0
): Promise<{
  baseFee: number;
  distanceFee: number;
  sizeFee: number;
  weightFee: number;
  urgencySurcharge: number;
  dynamicAdjustment?: number;
  manualAdjustment: number;
  serviceFee: number;
  subtotal: number;
  vat: number;
  totalFee: number;
  estimatedTime: number;
  breakdown?:{ gillerFee: number; platformFee: number; };
}> {
  try{
    const pricingPolicy = await getPricingPolicyConfig();
    const travelTimeData = await getTravelTimeConfig(
      pickupStation.stationId,
      deliveryStation.stationId
    ).catch(e => {
      console.warn('Failed to get travel time config, falling back to distance based estimation:', e);
      return null;
    });

    let stationCount: number;
    let travelTimeMinutes: number;

    if (travelTimeData && typeof travelTimeData.normalTime === 'number') {
      travelTimeMinutes = Math.round(travelTimeData.normalTime / 60);
      stationCount = Math.max(2, Math.round(travelTimeMinutes / 2.5));
    } else {
      const R = 6371; 
      const dLat = (deliveryStation.lat - pickupStation.lat) * (Math.PI / 180);
      const dLon = (deliveryStation.lng - pickupStation.lng) * (Math.PI / 180);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(pickupStation.lat * (Math.PI / 180)) * Math.cos(deliveryStation.lat * (Math.PI / 180)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distanceKm = R * c;
      
      stationCount = Math.max(2, Math.round(distanceKm * 1.8));
      travelTimeMinutes = Math.round(stationCount * 2.5);
    }

    let urgencyValue: 'normal' | 'fast' | 'urgent' = 'normal';
    if (urgencySurcharge > 0) {
      urgencyValue = urgencySurcharge > 5000 ? 'urgent' : 'fast';
    }

    const pricingParams: Phase1PricingParams = {
      stationCount,
      weight,
      packageSize: packageSize as PackageSizeType,
      urgency: urgencyValue,
      manualAdjustment,
    };

    const feeResult = calculatePhase1DeliveryFee(pricingParams, pricingPolicy);

    return {
      ...feeResult,
      estimatedTime: travelTimeMinutes,
    };
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    throw new Error('배송 요금을 산출할 수 없습니다. 길찾기 API 장애 또는 정책 로딩에 실패했습니다.');
  }
}

export async function increaseRequestBid(
  requestId: string,
  requesterId: string,
  amount: number = 500
): Promise<{ success: boolean; newFee?: number; message?: string }> {
  try {
    const request = await getRequestById(requestId);
    if (!request) return { success: false, message: '요청을 찾을 수 없습니다.' };
    if (request.requesterId !== requesterId) return { success: false, message: '요청자만 금액을 변경할 수 있습니다.' };
    if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.MATCHED) {
      return { success: false, message: '현재 상태에서는 금액을 변경할 수 없습니다.' };
    }

    const currentFee = request.fee?.totalFee ?? request.initialNegotiationFee ?? request.feeBreakdown?.totalFee ?? 3000;
    const pricingPolicy = await getPricingPolicyConfig();
    const nextFee = Math.min(pricingPolicy.maxFee, currentFee + amount);

    const feeSnapshot = (request.fee ?? request.feeBreakdown ?? {}) as FeeSnapshot;
    const nextFeeSnapshot = {
      ...feeSnapshot,
      totalFee: nextFee,
      breakdown: feeSnapshot.breakdown ?? {
        gillerFee: Math.round(nextFee * 0.9),
        platformFee: nextFee - Math.round(nextFee * 0.9),
      },
    };

    await updateDoc(doc(db, 'requests', requestId), {
      initialNegotiationFee: nextFee,
      fee: nextFeeSnapshot,
      feeBreakdown: nextFeeSnapshot,
      bidUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    void notifyGillers(requestId);

    return { success: true, newFee: nextFee };
  } catch (error) {
    console.error('Error increasing request bid:', error);
    return { success: false, message: '금액 상향에 실패했습니다.' };
  }
}

export async function getRoutePriceInsight(params: {
  pickupStationId: string;
  deliveryStationId: string;
  requestMode?: 'immediate' | 'reservation';
  pricingContext?: Partial<RequestPricingContext>;
}): Promise<RoutePriceInsight | null> {
  try {
    const pricingPolicy = await getPricingPolicyConfig();
    const routeKey = buildRouteKey(params.pickupStationId, params.deliveryStationId, params.requestMode);
    const snapshot = await getDocs(
      query(collection(db, 'request_pricing_history'), where('routeKey', '==', routeKey), limit(30))
    );

    const fees = snapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data() as any;
        const feeCandidate = typeof data.finalFee === 'number' ? data.finalFee : data.totalFee;
        if (typeof feeCandidate !== 'number' || feeCandidate <= 0) return null;

        return {
          fee: feeCandidate,
          dynamicAdjustment: typeof data.dynamicAdjustment === 'number' ? data.dynamicAdjustment : 0,
          isPeakTime: Boolean(data.pricingContext?.isPeakTime),
          requestMode: data.pricingContext?.requestMode === 'reservation' ? 'reservation' : 'immediate',
          policyVersion: typeof data.policyVersion === 'string' ? data.policyVersion : null,
        };
      })
      .filter((item): item is any => item !== null);

    if (fees.length === 0) return null;

    const total = fees.reduce((sum, item) => sum + item.fee, 0);
    const averageFee = Math.round(total / fees.length);
    const minFee = Math.min(...fees.map((item) => item.fee));
    const maxFee = Math.max(...fees.map((item) => item.fee));
    const averageDynamicAdjustment = Math.round(fees.reduce((sum, item) => sum + item.dynamicAdjustment, 0) / fees.length);
    const peakSamples = fees.filter((item) => item.isPeakTime).length;
    const immediateSamples = fees.filter((item) => item.requestMode === 'immediate').length;
    const reservationSamples = fees.length - immediateSamples;
    const routeOverride = await getRoutePricingOverride(routeKey);
    const recommendedFee = calculateInsightRecommendation({
      averageFee, requestMode: params.requestMode, peakSamples, immediateSamples,
      reservationSamples, sampleCount: fees.length, currentWeather: params.pricingContext?.weather,
      nearbyGillerCount: params.pricingContext?.nearbyGillerCount, isProfessionalPeak: params.pricingContext?.isProfessionalPeak,
      pricingPolicy, routeOverride,
    });
    const latestPolicyVersion = fees.find((item) => item.policyVersion)?.policyVersion ?? null;
    const { contextSummary, recommendationReason } = summarizeInsightContext({
      requestMode: params.requestMode, peakSamples, immediateSamples, reservationSamples,
      sampleCount: fees.length, averageDynamicAdjustment, currentWeather: params.pricingContext?.weather,
      nearbyGillerCount: params.pricingContext?.nearbyGillerCount, isProfessionalPeak: params.pricingContext?.isProfessionalPeak,
    });

    return {
      averageFee, minFee, maxFee, sampleCount: fees.length, recommendedFee, routeKey,
      averageDynamicAdjustment, contextSummary, recommendationReason, policyVersion: latestPolicyVersion,
      routeOverride: routeOverride ? {
        enabled: routeOverride.enabled, fixedAdjustment: routeOverride.fixedAdjustment,
        multiplier: routeOverride.multiplier, minCompletedCount: routeOverride.minCompletedCount,
        applied: routeOverride.enabled && fees.length >= routeOverride.minCompletedCount,
      } : null,
    };
  } catch (error) {
    console.error('Error fetching route price insight:', error);
    return null;
  }
}
