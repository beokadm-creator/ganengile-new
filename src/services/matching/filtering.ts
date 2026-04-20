import { locationService, type LocationData } from '../location-service';
import type {
  RouteMatchScore,
  LocationFilteredRequest,
  RouteFilteredRequest,
  MatchingFilterOptions,
} from '../../types/matching-extended';
import type { Route } from '../../types/route';
import type { FilterRequestBase, FilterStation, RouteScoreRequest } from './types';

export function calculateRouteMatchScore(
  request: RouteScoreRequest,
  route: Route
): RouteMatchScore {
  let score = 0;

  const normalizeStationName = (name: string) =>
    (name ?? '').replace(/\?/g, '').trim().toLowerCase();

  const stationNamesMatch = (name1: string, name2: string): boolean => {
    const n1 = normalizeStationName(name1);
    const n2 = normalizeStationName(name2);
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  };

  const details = {
    pickupStationScore: 0,
    deliveryStationScore: 0,
    dayOfWeekScore: 0,
    timeScore: 0,
    directionBonus: 0,
  };

  const pickupMatch = stationNamesMatch(
    route.startStation?.stationName ?? '',
    request.pickupStation?.stationName ?? ''
  );
  if (pickupMatch) {
    details.pickupStationScore = 30;
    score += 30;
  }

  const deliveryMatch = stationNamesMatch(
    route.endStation?.stationName ?? '',
    request.deliveryStation?.stationName ?? ''
  );
  if (deliveryMatch) {
    details.deliveryStationScore = 30;
    score += 30;
  }

  const today = new Date().getDay();
  const dayOfWeek = today === 0 ? 7 : today;
  const dayMatch = route.daysOfWeek.includes(dayOfWeek);
  if (dayMatch) {
    details.dayOfWeekScore = 10;
    score += 10;
  }

  const requestTime = request.preferredTime?.departureTime ?? '08:00';
  const [requestHour, requestMinute] = requestTime.split(':').map(Number);
  const [routeHour, routeMinute] = (route.departureTime ?? '08:00').split(':').map(Number);

  const requestMinutes = requestHour * 60 + requestMinute;
  const routeMinutes = routeHour * 60 + routeMinute;
  const timeDiff = Math.abs(requestMinutes - routeMinutes);

  let timeMatch = 0;
  if (timeDiff <= 30) {
    timeMatch = Math.round(15 * (1 - timeDiff / 30));
    details.timeScore = timeMatch;
    score += timeMatch;
  }

  let routeDirection: 'exact' | 'partial' | 'reverse' = 'partial';
  if (pickupMatch && deliveryMatch) {
    routeDirection = 'exact';
    details.directionBonus = 15;
    score += 15;
  } else if (pickupMatch ?? deliveryMatch) {
    routeDirection = 'partial';
    details.directionBonus = 5;
    score += 5;
  } else {
    routeDirection = 'reverse';
    score -= 10;
  }

  return {
    score: Math.max(0, Math.min(score, 100)),
    pickupMatch,
    deliveryMatch,
    timeMatch,
    dayMatch,
    routeDirection,
    matchedRouteId: route.routeId,
    matchedRoute: route,
    details,
  };
}

export function filterRequestsByLocation(
  requests: FilterRequestBase[],
  currentLocation: LocationData,
  radiusKm: number = 30
): LocationFilteredRequest[] {
  try {
    const getLat = (station: FilterStation): number => station.lat ?? station.latitude ?? 0;
    const getLng = (station: FilterStation): number => station.lng ?? station.longitude ?? 0;

    const radiusMeters = radiusKm * 1000;
    const filteredRequests: LocationFilteredRequest[] = [];

    for (const request of requests) {
      const pickupDist = locationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        getLat(request.pickupStation),
        getLng(request.pickupStation)
      );

      const deliveryDist = locationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        getLat(request.deliveryStation),
        getLng(request.deliveryStation)
      );

      const minDistance = Math.min(pickupDist, deliveryDist);

      if (minDistance <= radiusMeters) {
        const nearestStation = pickupDist < deliveryDist
          ? request.pickupStation.stationName
          : request.deliveryStation.stationName;

        const estimatedTimeMinutes = Math.round(minDistance / 1000 / 40 * 60);

        filteredRequests.push({
          ...request,
          metadata: {
            distanceFromCurrent: Math.round(minDistance),
            nearestStation,
            estimatedTimeMinutes,
          },
        } as LocationFilteredRequest);
      }
    }

    filteredRequests.sort((a, b) =>
      a.metadata.distanceFromCurrent - b.metadata.distanceFromCurrent
    );

    filteredRequests.forEach((req, index) => {
      req.metadata.distanceRank = index + 1;
    });

    return filteredRequests;
  } catch (error) {
    console.error('Error filtering requests by location:', error);
    return [];
  }
}

export function applyMatchingFilters<T extends LocationFilteredRequest | RouteFilteredRequest>(
  requests: T[],
  filters: MatchingFilterOptions
): T[] {
  let filtered = [...requests];

  if (filters.lineFilter && !filters.lineFilter.showAllLines && filters.lineFilter.selectedLines.length > 0) {
    filtered = filtered.filter((request) => {
      const pickupLine = request.pickupStation.line;
      const deliveryLine = request.deliveryStation.line;
      return filters.lineFilter!.selectedLines.some(line =>
        (pickupLine?.includes(line) ?? false) || (deliveryLine?.includes(line) ?? false)
      );
    });
  }

  if (filters.regionFilter && !filters.regionFilter.showAllRegions && filters.regionFilter.selectedRegions.length > 0) {
    filtered = filtered.filter((request) => {
      const pickupRegion = (request.pickupStation as FilterStation).region;
      const deliveryRegion = (request.deliveryStation as FilterStation).region;
      return filters.regionFilter!.selectedRegions.includes(pickupRegion ?? deliveryRegion ?? '');
    });
  }

  if (filters.minMatchScore) {
    filtered = filtered.filter((request) => {
      if (!('matchScore' in request)) return true;
      return (request.matchScore?.score ?? 0) >= filters.minMatchScore!;
    });
  }

  if (filters.maxDistance) {
    filtered = filtered.filter((request) => {
      if (!('metadata' in request)) return true;
      return (request.metadata?.distanceFromCurrent ?? Number.MAX_SAFE_INTEGER) <= filters.maxDistance!;
    });
  }

  if (filters.minFee) {
    filtered = filtered.filter((request) =>
      request.fee?.totalFee >= filters.minFee!
    );
  }

  if (filters.maxFee) {
    filtered = filtered.filter((request) =>
      request.fee?.totalFee <= filters.maxFee!
    );
  }

  return filtered;
}
