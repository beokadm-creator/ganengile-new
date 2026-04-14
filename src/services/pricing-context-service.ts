import { fetchActiveGillerRoutes, fetchGillerStats } from './matching-service';
import type { RequestPricingContext, RequestPricingWeather } from '../types/request';

const WEATHER_CACHE_TTL = 10 * 60 * 1000;

type WeatherCacheEntry = {
  weather: RequestPricingWeather;
  expiresAt: number;
};

const weatherCache = new Map<string, WeatherCacheEntry>();

function normalizeStationName(name?: string): string {
  return (name ?? '').replace(/\s+/g, '').replace(/\?/g, '').toLowerCase();
}

function namesLooselyEqual(left?: string, right?: string): boolean {
  const a = normalizeStationName(left);
  const b = normalizeStationName(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function inferRequestedHour(value?: string): number {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed === 'now' || trimmed === '지금 바로') {
    return new Date().getHours();
  }

  const matched = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (!matched) {
    return new Date().getHours();
  }

  const hour = Number(matched[1]);
  return Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : new Date().getHours();
}

function isPeakHour(hour: number): boolean {
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
}

function resolveUrgencyBucket(urgency?: 'normal' | 'fast' | 'urgent'): RequestPricingContext['urgencyBucket'] {
  if (urgency === 'urgent') return 'urgent';
  if (urgency === 'fast') return 'fast';
  return 'normal';
}

async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<RequestPricingWeather> {
  const key = `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const cached = weatherCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.weather;
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'weather_code');
    url.searchParams.set('timezone', 'Asia/Seoul');

    const response = await fetch(url.toString());
    const payload = (await response.json()) as {
      current?: {
        weather_code?: number;
      };
    };

    const code = Number(payload.current?.weather_code ?? 0);
    const weather =
      [71, 73, 75, 77, 85, 86].includes(code)
        ? 'snow'
        : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
          ? 'rain'
          : 'clear';

    weatherCache.set(key, {
      weather,
      expiresAt: Date.now() + WEATHER_CACHE_TTL,
    });

    return weather;
  } catch (error) {
    console.error('[pricing-context-service] weather fallback to clear', error);
    return 'clear';
  }
}

async function inferSupplyContext(input: {
  pickupStationName: string;
  deliveryStationName: string;
  requestedHour: number;
}) {
  const routes = await fetchActiveGillerRoutes();
  const today = new Date().getDay();
  const dayOfWeek = today === 0 ? 7 : today;

  const activeToday = routes.filter((route) => route.daysOfWeek.includes(dayOfWeek));
  const exactCandidates = activeToday.filter(
    (route) =>
      namesLooselyEqual(route.startStation.stationName, input.pickupStationName) &&
      namesLooselyEqual(route.endStation.stationName, input.deliveryStationName)
  );
  const partialCandidates = activeToday.filter(
    (route) =>
      namesLooselyEqual(route.startStation.stationName, input.pickupStationName) ||
      namesLooselyEqual(route.endStation.stationName, input.deliveryStationName)
  );

  const candidatePool = exactCandidates.length > 0 ? exactCandidates : partialCandidates;
  const uniqueGillerIds = Array.from(new Set(candidatePool.map((route) => route.gillerId))).slice(0, 10);

  const stats = await Promise.all(uniqueGillerIds.map((gillerId) => fetchGillerStats(gillerId)));
  const professionalCount = stats.filter(
    (item) => item.professionalLevel === 'professional' || item.professionalLevel === 'master'
  ).length;

  const nearbyGillerCount = uniqueGillerIds.length;
  const isPeakTime = isPeakHour(input.requestedHour);
  const isProfessionalPeak =
    isPeakTime &&
    nearbyGillerCount > 0 &&
    professionalCount <= Math.max(1, Math.floor(nearbyGillerCount / 3));

  return {
    nearbyGillerCount,
    isPeakTime,
    isProfessionalPeak,
  };
}

export async function resolvePricingContextForRequest(input: {
  pickupStationName: string;
  deliveryStationName: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  preferredPickupTime?: string;
  requestMode?: 'immediate' | 'reservation';
  urgency?: 'normal' | 'fast' | 'urgent';
}): Promise<RequestPricingContext> {
  const requestedHour = inferRequestedHour(input.preferredPickupTime);
  const midpointLat =
    typeof input.pickupLat === 'number' && typeof input.deliveryLat === 'number'
      ? (input.pickupLat + input.deliveryLat) / 2
      : input.pickupLat ?? input.deliveryLat ?? 37.5665;
  const midpointLng =
    typeof input.pickupLng === 'number' && typeof input.deliveryLng === 'number'
      ? (input.pickupLng + input.deliveryLng) / 2
      : input.pickupLng ?? input.deliveryLng ?? 126.978;

  const [weather, supply] = await Promise.all([
    fetchWeather(midpointLat, midpointLng),
    inferSupplyContext({
      pickupStationName: input.pickupStationName,
      deliveryStationName: input.deliveryStationName,
      requestedHour,
    }),
  ]);

  return {
    requestMode: input.requestMode === 'reservation' ? 'reservation' : 'immediate',
    weather,
    isPeakTime: supply.isPeakTime,
    isProfessionalPeak: supply.isProfessionalPeak,
    nearbyGillerCount: supply.nearbyGillerCount,
    requestedHour,
    urgencyBucket: resolveUrgencyBucket(input.urgency),
  };
}
