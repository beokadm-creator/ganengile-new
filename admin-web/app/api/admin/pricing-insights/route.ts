import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import {
  DEFAULT_SHARED_PRICING_POLICY,
  normalizeSharedPricingPolicy,
  type SharedPricingPolicyConfig,
} from '../../../../../shared/pricing-config';

type HistoryRow = {
  routeKey?: string;
  requestMode?: 'immediate' | 'reservation';
  totalFee?: number;
  dynamicAdjustment?: number;
  policyVersion?: string | null;
  pricingContext?: {
    weather?: 'clear' | 'rain' | 'snow';
    isPeakTime?: boolean;
    isProfessionalPeak?: boolean;
    nearbyGillerCount?: number | null;
  };
  pickupStationName?: string | null;
  deliveryStationName?: string | null;
};

type RouteAggregate = {
  routeKey: string;
  label: string;
  sampleCount: number;
  averageFee: number;
  averageDynamicAdjustment: number;
  peakShare: number;
  lowSupplyShare: number;
  immediateShare: number;
  latestPolicyVersion: string | null;
};

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

   
  const [historySnap, policySnap] = await Promise.all([
    db.collection('request_pricing_history').orderBy('completedAt', 'desc').limit(200).get(),
    db.collection('config_pricing').doc('default').get(),
  ]);

  const pricingPolicy = normalizeSharedPricingPolicy(
    policySnap.exists
      ? (policySnap.data() as Partial<SharedPricingPolicyConfig>)
      : DEFAULT_SHARED_PRICING_POLICY
  );

  const rows = historySnap.docs.map((doc: any) => doc.data() as HistoryRow);
  const completedCount = rows.length;
  const feeValues = rows
    .map((row: any) => toNumber(row.totalFee))
    .filter((value: any): value is number => value !== null && value > 0);
  const averageFee =
    feeValues.length > 0
      ? Math.round(feeValues.reduce((sum: any, value: any) => sum + value, 0) / feeValues.length)
      : 0;
  const averageDynamicAdjustment =
    completedCount > 0
      ? Math.round(
          rows.reduce((sum: any, row: any) => sum + (toNumber(row.dynamicAdjustment) ?? 0), 0) / completedCount
        )
      : 0;

  const peakCount = rows.filter((row: any) => row.pricingContext?.isPeakTime === true).length;
  const lowSupplyCount = rows.filter((row: any) => {
    const nearby = row.pricingContext?.nearbyGillerCount;
    return typeof nearby === 'number' && nearby <= pricingPolicy.dynamicRules.lowSupplyThreshold;
  }).length;
  const rainSnowCount = rows.filter((row: any) => row.pricingContext?.weather === 'rain' || row.pricingContext?.weather === 'snow').length;
  const immediateCount = rows.filter((row: any) => row.requestMode !== 'reservation').length;

  const routeMap = new Map<string, RouteAggregate & { totalFeeSum: number; dynamicSum: number; peakCount: number; lowSupplyCount: number; immediateCount: number }>();

  for (const row of rows) {
    if (!row.routeKey) continue;
    const fee = toNumber(row.totalFee);
    if (fee == null || fee <= 0) continue;

    const existing = routeMap.get(row.routeKey);
    const isPeak = row.pricingContext?.isPeakTime === true;
    const nearby = row.pricingContext?.nearbyGillerCount;
    const isLowSupply = typeof nearby === 'number' && nearby <= pricingPolicy.dynamicRules.lowSupplyThreshold;
    const isImmediate = row.requestMode !== 'reservation';
    const label = `${row.pickupStationName ?? '출발'} -> ${row.deliveryStationName ?? '도착'}`;

    if (existing) {
      existing.sampleCount += 1;
      existing.totalFeeSum += fee;
      existing.dynamicSum += toNumber(row.dynamicAdjustment) ?? 0;
      existing.peakCount += isPeak ? 1 : 0;
      existing.lowSupplyCount += isLowSupply ? 1 : 0;
      existing.immediateCount += isImmediate ? 1 : 0;
      if (row.policyVersion) {
        existing.latestPolicyVersion = row.policyVersion;
      }
      continue;
    }

    routeMap.set(row.routeKey, {
      routeKey: row.routeKey,
      label,
      sampleCount: 1,
      averageFee: 0,
      averageDynamicAdjustment: 0,
      peakShare: 0,
      lowSupplyShare: 0,
      immediateShare: 0,
      latestPolicyVersion: row.policyVersion ?? null,
      totalFeeSum: fee,
      dynamicSum: toNumber(row.dynamicAdjustment) ?? 0,
      peakCount: isPeak ? 1 : 0,
      lowSupplyCount: isLowSupply ? 1 : 0,
      immediateCount: isImmediate ? 1 : 0,
    });
  }

  const routes = Array.from(routeMap.values())
    .map((route) => ({
      routeKey: route.routeKey,
      label: route.label,
      sampleCount: route.sampleCount,
      averageFee: Math.round(route.totalFeeSum / route.sampleCount),
      averageDynamicAdjustment: Math.round(route.dynamicSum / route.sampleCount),
      peakShare: Math.round((route.peakCount / route.sampleCount) * 100),
      lowSupplyShare: Math.round((route.lowSupplyCount / route.sampleCount) * 100),
      immediateShare: Math.round((route.immediateCount / route.sampleCount) * 100),
      latestPolicyVersion: route.latestPolicyVersion,
    }))
    .sort((a, b) => b.sampleCount - a.sampleCount)
    .slice(0, 12);

  return NextResponse.json({
    summary: {
      completedCount,
      averageFee,
      averageDynamicAdjustment,
      peakShare: completedCount > 0 ? Math.round((peakCount / completedCount) * 100) : 0,
      lowSupplyShare: completedCount > 0 ? Math.round((lowSupplyCount / completedCount) * 100) : 0,
      weatherImpactShare: completedCount > 0 ? Math.round((rainSnowCount / completedCount) * 100) : 0,
      immediateShare: completedCount > 0 ? Math.round((immediateCount / completedCount) * 100) : 0,
      activePolicyVersion: pricingPolicy.version,
      recommendationMultiplier: pricingPolicy.recommendationMultiplier,
      recommendationRules: pricingPolicy.recommendationRules,
    },
    routes,
  });
}
