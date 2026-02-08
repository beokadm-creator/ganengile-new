/**
 * Matching Engine
 * Calculate matching scores between delivery requests and gillers (couriers)
 */

import {
  getStationByName,
  type Station,
} from './subway-stations';
import {
  getTravelTime,
} from './travel-times';

export interface GillerRoute {
  gillerId: string;
  gillerName: string;
  startStation: Station;
  endStation: Station;
  departureTime: string; // HH:mm format
  daysOfWeek: number[]; // [1,2,3,4,5] for weekdays
  rating: number; // 1-5
  totalDeliveries: number; // 총 배송 건수
  completedDeliveries: number; // 완료된 배송 건수
}

export interface DeliveryRequest {
  requestId: string;
  pickupStationName: string;
  deliveryStationName: string;
  pickupStartTime: string;
  pickupEndTime: string;
  deliveryDeadline: string;
  preferredDays: number[];
  packageSize: 'small' | 'medium' | 'large';
  packageWeight: number;
}

interface RouteBreakdown {
  pickupMatch: number;
  deliveryMatch: number;
  travelTime: number;
  hasExpress: boolean;
  transferCount: number;
  congestion: 'low' | 'medium' | 'high';
}

interface TimeBreakdown {
  departureTimeMatch: number;
  scheduleFlexibility: number;
}

export interface MatchingResult {
  gillerId: string;
  gillerName: string;

  // Overall score (0-100)
  totalScore: number;

  // Detailed scores (New Weights)
  routeMatchScore: number; // 0-50 (경로 일치도 50%)
  timeMatchScore: number; // 0-30 (시간 일치도 30%)
  ratingScore: number; // 0-15 (평점 15%)
  completionRateScore: number; // 0-5 (완료율 5%)

  // Breakdown
  scores: {
    // Route Match (50 points)
    pickupMatchScore: number; // 0-25 (픽업 위치 일치)
    deliveryMatchScore: number; // 0-25 (배송 위치 일치)

    // Time Match (30 points)
    departureTimeMatchScore: number; // 0-20 (출발 시간 일치)
    scheduleFlexibilityScore: number; // 0-10 (스케줄 유연성)

    // Rating (15 points)
    ratingRawScore: number; // 0-15 (평점 1-5 변환)

    // Completion Rate (5 points)
    completionRateRawScore: number; // 0-5 (완료율)
  };

  // Route details
  routeDetails: {
    travelTime: number;
    isExpressAvailable: boolean;
    transferCount: number;
    congestionLevel?: 'low' | 'medium' | 'high';
  };

  // Why this match is good/bad
  reasons: string[];
}

/**
 * Calculate matching score between a giller and a delivery request
 * New weights: Route 50%, Time 30%, Rating 15%, Completion 5%
 */
export function calculateMatchingScore(
  gillerRoute: GillerRoute,
  request: DeliveryRequest
): MatchingResult {
  const pickupStation = getStationByName(request.pickupStationName);
  const deliveryStation = getStationByName(request.deliveryStationName);

  if (!pickupStation || !deliveryStation) {
    throw new Error('Station not found');
  }

  // 1. Route Match Score (50%) - 경로 일치도
  const { score: routeMatchScore, breakdown: routeBreakdown } = calculateRouteMatchScore(
    gillerRoute,
    pickupStation,
    deliveryStation
  );

  // 2. Time Match Score (30%) - 시간 일치도
  const { score: timeMatchScore, breakdown: timeBreakdown } = calculateTimeMatchScore(
    gillerRoute,
    request
  );

  // 3. Rating Score (15%) - 평점
  const ratingScore = calculateRatingScore(gillerRoute.rating);

  // 4. Completion Rate Score (5%) - 완료율
  const completionRateScore = calculateCompletionRateScore(
    gillerRoute.totalDeliveries,
    gillerRoute.completedDeliveries
  );

  // 5. Total Score
  const totalScore = routeMatchScore + timeMatchScore + ratingScore + completionRateScore;

  // 6. Generate reasons
  const reasons = generateMatchingReasonsV2(
    gillerRoute,
    request,
    routeMatchScore,
    timeMatchScore,
    ratingScore,
    completionRateScore
  );

  return {
    gillerId: gillerRoute.gillerId,
    gillerName: gillerRoute.gillerName,
    totalScore: Math.round(totalScore),
    routeMatchScore: Math.round(routeMatchScore),
    timeMatchScore: Math.round(timeMatchScore),
    ratingScore: Math.round(ratingScore),
    completionRateScore: Math.round(completionRateScore),
    scores: {
      pickupMatchScore: Math.round(routeBreakdown.pickupMatch),
      deliveryMatchScore: Math.round(routeBreakdown.deliveryMatch),
      departureTimeMatchScore: Math.round(timeBreakdown.departureTimeMatch),
      scheduleFlexibilityScore: Math.round(timeBreakdown.scheduleFlexibility),
      ratingRawScore: Math.round(ratingScore),
      completionRateRawScore: Math.round(completionRateScore),
    },
    routeDetails: {
      travelTime: routeBreakdown.travelTime,
      isExpressAvailable: routeBreakdown.hasExpress,
      transferCount: routeBreakdown.transferCount,
      congestionLevel: routeBreakdown.congestion,
    },
    reasons,
  };
}

/**
 * Calculate Route Match Score (50 points max)
 * 경로 일치도: 픽업/배송 위치가 길러 경로와 얼마나 잘 일치하는지
 */
function calculateRouteMatchScore(
  gillerRoute: GillerRoute,
  pickupStation: Station,
  deliveryStation: Station
): { score: number; breakdown: RouteBreakdown } {
  // 픽업 위치 일치 점수 (0-25)
  // 길러 경로상에 픽업 역이 있는지 확인
  const pickupMatch = calculateStationOnRouteScore(
    gillerRoute.startStation,
    gillerRoute.endStation,
    pickupStation
  );

  // 배송 위치 일치 점수 (0-25)
  const deliveryMatch = calculateStationOnRouteScore(
    gillerRoute.startStation,
    gillerRoute.endStation,
    deliveryStation
  );

  // 경로 정보 가져오기
  const pickupTravelTime = getTravelTime(
    gillerRoute.startStation.stationId,
    pickupStation.stationId
  );
  const deliveryTravelTime = getTravelTime(
    pickupStation.stationId,
    deliveryStation.stationId
  );

  const travelTime = (pickupTravelTime?.normalTime ?? 0) + (deliveryTravelTime?.normalTime ?? 0);
  const hasExpress = pickupTravelTime?.hasExpress ?? deliveryTravelTime?.hasExpress ?? false;
  const transferCount = (pickupTravelTime?.transferCount ?? 0) + (deliveryTravelTime?.transferCount ?? 0);

  // 혼잡도 계산
  const congestion = getCongestionLevel(gillerRoute.departureTime);

  return {
    score: pickupMatch + deliveryMatch,
    breakdown: {
      pickupMatch,
      deliveryMatch,
      travelTime,
      hasExpress,
      transferCount,
      congestion,
    },
  };
}

/**
 * Calculate Time Match Score (30 points max)
 * 시간 일치도: 출발 시간과 스케줄 일치 여부
 */
function calculateTimeMatchScore(
  gillerRoute: GillerRoute,
  request: DeliveryRequest
): { score: number; breakdown: TimeBreakdown } {
  // 출발 시간 일치 점수 (0-20)
  const [gillerHour, gillerMinute] = gillerRoute.departureTime.split(':').map(Number);
  const [pickupStartHour, pickupStartMinute] = request.pickupStartTime.split(':').map(Number);

  const gillerMinutes = gillerHour * 60 + gillerMinute;
  const pickupStartMinutes = pickupStartHour * 60 + pickupStartMinute;

  // 시간 차이 (분)
  const timeDiff = Math.abs(gillerMinutes - pickupStartMinutes);

  // 0분 차이: 20점, 30분 이상 차이: 0점
  const departureTimeMatch = Math.max(0, 20 - (timeDiff / 3));

  // 스케줄 유연성 점수 (0-10)
  // 길러가 운영하는 요일과 요청의 선호 요일 일치
  const dayMatchCount = request.preferredDays.filter(day =>
    gillerRoute.daysOfWeek.includes(day)
  ).length;
  const scheduleFlexibility = (dayMatchCount / request.preferredDays.length) * 10;

  return {
    score: departureTimeMatch + scheduleFlexibility,
    breakdown: {
      departureTimeMatch,
      scheduleFlexibility,
    },
  };
}

/**
 * Calculate Rating Score (15 points max)
 * 평점 점수: 1.0 ~ 5.0 → 0 ~ 15점
 */
function calculateRatingScore(rating: number): number {
  // 평점 1.0 → 0점, 5.0 → 15점
  return ((rating - 1.0) / 4.0) * 15;
}

/**
 * Calculate Completion Rate Score (5 points max)
 * 완료율 점수: 0% ~ 100% → 0 ~ 5점
 */
function calculateCompletionRateScore(
  totalDeliveries: number,
  completedDeliveries: number
): number {
  if (totalDeliveries === 0) return 2.5; // 기본 점수

  const completionRate = completedDeliveries / totalDeliveries;
  return completionRate * 5;
}

/**
 * Check if a station is on the giller's route
 */
function calculateStationOnRouteScore(
  startStation: Station,
  endStation: Station,
  targetStation: Station
): number {
  // 동일 역: 25점
  if (targetStation.stationId === startStation.stationId ||
      targetStation.stationId === endStation.stationId) {
    return 25;
  }

  // 같은 호선에 있는지 확인
  const targetLines = targetStation.lines.map(l => l.lineId);
  const startLines = startStation.lines.map(l => l.lineId);
  const endLines = endStation.lines.map(l => l.lineId);

  // 출발-도착 호선과 타겟 호선이 겹치면 20점
  const hasCommonLine = targetLines.some(l => startLines.includes(l) || endLines.includes(l));
  if (hasCommonLine) return 20;

  // 환승 1회이면 15점
  return 15;
}

/**
 * Get congestion level based on time
 */
function getCongestionLevel(departureTime: string): 'low' | 'medium' | 'high' {
  const [hour, _] = departureTime.split(':').map(Number);

  // 출퇴근 시간대: 7-9시, 17-19시
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    return 'high';
  }
  // 주간: 9-17시
  if (hour >= 9 && hour <= 17) {
    return 'medium';
  }
  return 'low';
}

/**
 * Generate human-readable reasons for the match (New Version)
 */
function generateMatchingReasonsV2(
  gillerRoute: GillerRoute,
  request: DeliveryRequest,
  routeMatchScore: number,
  timeMatchScore: number,
  ratingScore: number,
  completionRateScore: number
): string[] {
  const reasons: string[] = [];

  // Route Match Reasons (경로 일치)
  if (routeMatchScore >= 40) {
    reasons.push('🛤️ 경로 완벽 일치');
  } else if (routeMatchScore >= 30) {
    reasons.push('🛤️ 경로 적합도 높음');
  } else if (routeMatchScore >= 20) {
    reasons.push('🛤️ 경로 적합도 보통');
  }

  // Time Match Reasons (시간 일치)
  if (timeMatchScore >= 25) {
    reasons.push('⏰ 시간 완벽 일치');
  } else if (timeMatchScore >= 20) {
    reasons.push('⏰ 시간 적합도 높음');
  } else if (timeMatchScore < 15) {
    reasons.push('⚠️ 시간 일치도 낮음');
  }

  // Rating Reasons (평점)
  if (ratingScore >= 12) {
    reasons.push('⭐ 최고 평점');
  } else if (ratingScore >= 9) {
    reasons.push('⭐ 높은 평점');
  }

  // Completion Rate Reasons (완료율)
  if (completionRateScore >= 4) {
    reasons.push('✅ 높은 완료율');
  } else if (completionRateScore < 3) {
    reasons.push('⚠️ 완료율 확인 필요');
  }

  return reasons;
}

/**
 * Match multiple gillers to a single request
 * Returns sorted by score (highest first)
 */
export function matchGillersToRequest(
  gillers: GillerRoute[],
  request: DeliveryRequest
): MatchingResult[] {
  const results: MatchingResult[] = [];

  for (const giller of gillers) {
    try {
      const result = calculateMatchingScore(giller, request);
      results.push(result);
    } catch (error) {
      // Skip gillers that can't be matched (e.g., station not found)
      console.error(`Failed to match giller ${giller.gillerId}:`, error);
      continue;
    }
  }

  // Sort by total score (descending)
  return results.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Get top N matches
 */
export function getTopMatches(
  gillers: GillerRoute[],
  request: DeliveryRequest,
  topN: number = 5
): MatchingResult[] {
  const matches = matchGillersToRequest(gillers, request);
  return matches.slice(0, topN);
}
