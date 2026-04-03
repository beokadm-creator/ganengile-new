import { getNaverDirectionsProxyUrl } from '../config/map-config';

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type NaverRouteResult = {
  option: string;
  summary: {
    distanceMeters: number;
    durationMs: number;
    tollFare: number;
    taxiFare: number;
    fuelPrice: number;
  };
  coordinates: RouteCoordinate[];
};

interface DirectionsProxyPayload {
  ok?: boolean;
  route?: NaverRouteResult;
  message?: string;
}

function toPointQuery(point: RouteCoordinate): string {
  return `${point.longitude},${point.latitude}`;
}

export async function getDrivingRoute(args: {
  start: RouteCoordinate;
  goal: RouteCoordinate;
  option?: 'trafast' | 'tracomfort' | 'traoptimal' | 'traavoidtoll';
}): Promise<NaverRouteResult | null> {
  const proxyUrl = getNaverDirectionsProxyUrl();
  if (!proxyUrl) {
    return null;
  }

  const requestUrl = new URL(proxyUrl);
  requestUrl.searchParams.set('start', toPointQuery(args.start));
  requestUrl.searchParams.set('goal', toPointQuery(args.goal));
  requestUrl.searchParams.set('option', args.option ?? 'trafast');

  const response = await fetch(requestUrl.toString());
  const payload = (await response.json().catch(() => ({}))) as DirectionsProxyPayload;

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }

    throw new Error(payload.message || '경로 좌표를 불러오지 못했습니다.');
  }

  if (!payload.ok || !payload.route) {
    return null;
  }

  return payload.route;
}

export function formatRouteDistance(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return '-';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

export function formatRouteDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '-';
  }

  const totalMinutes = Math.max(1, Math.round(durationMs / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes}분`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

