export interface SharedMatch {
  gillerId: string;
  score: number;
  reason: string;
}

export interface SharedGillerRoute {
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
  badgeBonus?: number;
  priorityBoost?: number;
}

export interface SharedDeliveryRequest {
  id: string;
  pickupStation: string;
  deliveryStation: string;
  dayOfWeek: string;
  time: string;
}

export function matchGillersToRequest(
  request: SharedDeliveryRequest,
  gillerRoutes: SharedGillerRoute[]
): SharedMatch[] {
  const matches: SharedMatch[] = [];

  for (const route of gillerRoutes) {
    let score = 50;

    if (
      route.departureStation === request.pickupStation &&
      route.arrivalStation === request.deliveryStation
    ) {
      score += 30;
    }

    if (route.daysOfWeek && route.daysOfWeek.length > 0) {
      const today = new Date().getDay();
      const dayOfWeek = today === 0 ? 7 : today;
      if (route.daysOfWeek.includes(dayOfWeek)) {
        score += 10;
      }
    } else if (route.dayOfWeek?.includes(request.dayOfWeek)) {
      score += 10;
    }

    const routeHour = parseInt(route.departureTime.split(':')[0] ?? '0', 10);
    const requestHour = parseInt(request.time.split(':')[0] ?? '0', 10);
    if (Math.abs(routeHour - requestHour) <= 1) {
      score += 10;
    }

    if (route.priorityBoost && route.priorityBoost > 0) {
      score += route.priorityBoost;
    }

    matches.push({
      gillerId: route.gillerId,
      score,
      reason: score >= 70 ? 'high_confidence_match' : 'baseline_match',
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function getTopMatches(matches: SharedMatch[], limit = 10): SharedMatch[] {
  return matches.slice(0, limit);
}
