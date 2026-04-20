export function snapshotExists(snapshot: { exists?: boolean | (() => boolean) }): boolean {
  if (typeof snapshot.exists === 'function') {
    return snapshot.exists();
  }

  return snapshot.exists === true;
}

export function normalizeStationName(name?: string): string {
  return (name ?? '').replace(/\s+/g, '').replace(/\?/g, '').toLowerCase();
}

export function namesLooselyEqual(a?: string, b?: string): boolean {
  const na = normalizeStationName(a);
  const nb = normalizeStationName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function normalizeBadges(badges?: {
  activity?: string[];
  quality?: string[];
  expertise?: string[];
  community?: string[];
}): {
  activity: string[];
  quality: string[];
  expertise: string[];
  community: string[];
} {
  return {
    activity: badges?.activity ?? [],
    quality: badges?.quality ?? [],
    expertise: badges?.expertise ?? [],
    community: badges?.community ?? [],
  };
}
