import type { PackageWeight } from '../types/request';

const DEFAULT_WEIGHT_BY_BUCKET: Record<PackageWeight, number> = {
  light: 1,
  medium: 3,
  extra: 7,
};

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.round(value * 10) / 10;
}

export function resolveWeightKg(weight: unknown, weightKg?: unknown): number | undefined {
  const normalizedWeightKg = normalizeNumber(weightKg);
  if (normalizedWeightKg !== undefined) {
    return normalizedWeightKg;
  }

  const numericWeight = normalizeNumber(weight);
  if (numericWeight !== undefined) {
    return numericWeight;
  }

  if (weight === 'light' || weight === 'medium' || weight === 'extra') {
    return DEFAULT_WEIGHT_BY_BUCKET[weight];
  }

  return undefined;
}

function formatKg(kg: number): string {
  return Number.isInteger(kg) ? `${kg}kg` : `${kg.toFixed(1)}kg`;
}

export function formatWeightDisplay(weight: unknown, weightKg?: unknown): string {
  const resolvedKg = resolveWeightKg(weight, weightKg);
  if (resolvedKg !== undefined) {
    return formatKg(resolvedKg);
  }
  return '-';
}
