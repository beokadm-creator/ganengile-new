export type RoutePricingOverrideConfig = {
  routeKey: string;
  pickupStationId: string;
  deliveryStationId: string;
  requestMode: 'immediate' | 'reservation';
  enabled: boolean;
  fixedAdjustment: number;
  multiplier: number;
  minCompletedCount: number;
  notes: string;
};

export const DEFAULT_ROUTE_PRICING_OVERRIDE: RoutePricingOverrideConfig = {
  routeKey: '',
  pickupStationId: '',
  deliveryStationId: '',
  requestMode: 'immediate',
  enabled: true,
  fixedAdjustment: 0,
  multiplier: 1,
  minCompletedCount: 3,
  notes: '',
};

export function buildRoutePricingOverrideKey(
  pickupStationId: string,
  deliveryStationId: string,
  requestMode?: 'immediate' | 'reservation'
): string {
  const mode = requestMode === 'reservation' ? 'reservation' : 'immediate';
  return `${pickupStationId}_${deliveryStationId}_${mode}`;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeRoutePricingOverride(
  input?: Partial<RoutePricingOverrideConfig> | null
): RoutePricingOverrideConfig {
  const source = input ?? {};
  const pickupStationId = asString(source.pickupStationId).trim();
  const deliveryStationId = asString(source.deliveryStationId).trim();
  const requestMode = source.requestMode === 'reservation' ? 'reservation' : 'immediate';
  const routeKey = asString(source.routeKey).trim() || (
    pickupStationId && deliveryStationId
      ? buildRoutePricingOverrideKey(pickupStationId, deliveryStationId, requestMode)
      : ''
  );

  return {
    routeKey,
    pickupStationId,
    deliveryStationId,
    requestMode,
    enabled: asBoolean(source.enabled, true),
    fixedAdjustment: Math.round(asNumber(source.fixedAdjustment, 0)),
    multiplier: Math.max(0.5, Math.min(3, asNumber(source.multiplier, 1))),
    minCompletedCount: Math.max(1, Math.round(asNumber(source.minCompletedCount, 3))),
    notes: asString(source.notes).trim(),
  };
}
