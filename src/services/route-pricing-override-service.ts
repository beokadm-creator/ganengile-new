import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  buildRoutePricingOverrideKey,
  normalizeRoutePricingOverride,
  type RoutePricingOverrideConfig,
} from '../../shared/route-pricing-override';

const CACHE_TTL = 60 * 1000;
const COLLECTION = 'config_route_pricing_overrides';

const cache = new Map<string, { data: RoutePricingOverrideConfig | null; expiresAt: number }>();

export async function getRoutePricingOverride(routeKey: string): Promise<RoutePricingOverrideConfig | null> {
  const trimmedRouteKey = routeKey.trim();
  if (!trimmedRouteKey) {
    return null;
  }

  const cached = cache.get(trimmedRouteKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const snap = await getDoc(doc(db, COLLECTION, trimmedRouteKey));
    const data = snap.exists() ? normalizeRoutePricingOverride(snap.data() as Partial<RoutePricingOverrideConfig>) : null;
    cache.set(trimmedRouteKey, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch (error) {
    console.error('[route-pricing-override] load failed:', error);
    return null;
  }
}

export async function getRoutePricingOverrideByStations(params: {
  pickupStationId: string;
  deliveryStationId: string;
  requestMode?: 'immediate' | 'reservation';
}): Promise<RoutePricingOverrideConfig | null> {
  if (!params.pickupStationId || !params.deliveryStationId) {
    return null;
  }

  return getRoutePricingOverride(
    buildRoutePricingOverrideKey(params.pickupStationId, params.deliveryStationId, params.requestMode)
  );
}

export function clearRoutePricingOverrideCache(routeKey?: string) {
  if (routeKey) {
    cache.delete(routeKey);
    return;
  }

  cache.clear();
}
