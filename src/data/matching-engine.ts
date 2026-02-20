/**
 * Matching Engine - 길러 매칭 알고리즘
 */

export interface Match {
  gillerId: string;
  score: number;
  reason: string;
}

export interface GillerRoute {
  gillerId: string;
  gillerName?: string;
  routeId?: string;
  departureStation: string;
  arrivalStation: string;
  dayOfWeek?: string[];
  daysOfWeek?: number[];
  departureTime: string;
  rating?: number;
  totalDeliveries?: number;
  completedDeliveries?: number;
  badgeBonus?: number; // 0.05 to 0.20 (5% to 20%)
  priorityBoost?: number; // 0 to 20
}

export interface DeliveryRequest {
  id: string;
  pickupStation: string;
  deliveryStation: string;
  dayOfWeek: string;
  time: string;
}

/**
 * 요청에 맞는 길러 찾기
 */
export function matchGillersToRequest(
  request: DeliveryRequest,
  gillerRoutes: GillerRoute[]
): Match[] {
  const matches: Match[] = [];

  for (const route of gillerRoutes) {
    // 기본 매칭 로직
    let score = 50;

    // 역 일치 확인
    if (route.departureStation === request.pickupStation &&
        route.arrivalStation === request.deliveryStation) {
      score += 30;
    }

    // 요일 일치 확인 (daysOfWeek 배열 사용)
    if (route.daysOfWeek && route.daysOfWeek.length > 0) {
      const today = new Date().getDay();
      const dayOfWeek = today === 0 ? 7 : today; // Convert to 1-7 (Mon-Sun)
      if (route.daysOfWeek.includes(dayOfWeek)) {
        score += 10;
      }
    } else if (route.dayOfWeek && route.dayOfWeek.includes(request.dayOfWeek)) {
      score += 10;
    }

    // 시간 근접 확인
    const routeHour = parseInt(route.departureTime.split(':')[0]);
    const requestHour = parseInt(request.time.split(':')[0]);
    if (Math.abs(routeHour - requestHour) <= 1) {
      score += 10;
    }

    // 배지 우선순위 부스트 적용
    if (route.priorityBoost && route.priorityBoost > 0) {
      score += route.priorityBoost;
    }

    matches.push({
      gillerId: route.gillerId,
      score,
      reason: score >= 70 ? '높은 매칭 점수' : '기본 매칭',
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * 상위 N개 매칭 반환
 */
export function getTopMatches(
  matches: Match[],
  limit: number = 10
): Match[] {
  return matches.slice(0, limit);
}
