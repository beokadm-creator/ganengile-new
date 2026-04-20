/**
 * Matching Service – Type Definitions
 */

export type LooseStationInput = {
  stationId?: string;
  id?: string;
  stationName?: string;
  line?: string;
  lineName?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

export type LooseRouteInput = {
  userId?: string;
  startStation?: LooseStationInput;
  endStation?: LooseStationInput;
  departureTime?: string;
  daysOfWeek?: number[];
  isActive?: boolean;
};

export type LooseRequestStation = {
  stationName?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

export type RouteHeuristicRequest = {
  id?: string;
  pickupStation?: LooseRequestStation;
  deliveryStation?: LooseRequestStation;
};

export type RouteScoreRequest = {
  pickupStation?: { stationName?: string };
  deliveryStation?: { stationName?: string };
  preferredTime?: { departureTime?: string };
};

export type FilterStation = {
  stationName?: string;
  line?: string;
  region?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

export type FilterRequestBase = {
  pickupStation: FilterStation;
  deliveryStation: FilterStation;
  fee?: { totalFee?: number };
  matchScore?: { score?: number };
  metadata?: {
    distanceFromCurrent?: number;
    nearestStation?: string;
    estimatedTimeMinutes?: number;
    distanceRank?: number;
  };
  [key: string]: unknown;
};

export type BadgeCollections = {
  activity?: string[];
  quality?: string[];
  expertise?: string[];
  community?: string[];
};

export type NormalizedBadgeCollections = {
  activity: string[];
  quality: string[];
  expertise: string[];
  community: string[];
};

export type FirestoreUserDoc = {
  name?: string;
  rating?: number;
  profilePhoto?: string;
  profileImage?: string;
  badges?: BadgeCollections;
  stats?: {
    rating?: number;
    totalDeliveries?: number;
    completedDeliveries?: number;
    averageResponseTime?: number;
  };
  gillerInfo?: {
    totalDeliveries?: number;
    completedDeliveries?: number;
  };
  professionalLevel?: 'regular' | 'professional' | 'master';
  badgeBonus?: number;
};

export type FirestoreRouteDoc = {
  userId?: string;
  gillerName?: string;
  startStation?: { stationName?: string };
  endStation?: { stationName?: string };
  departureTime?: string;
  daysOfWeek?: number[];
  rating?: number;
  totalDeliveries?: number;
  completedDeliveries?: number;
};

export type FirestoreTimestampLike = {
  toDate?: () => Date;
};

export type FirestoreMatchingRequestDoc = {
  id?: string;
  requesterId?: string;
  beta1RequestStatus?: string;
  requestDraftId?: string | null;
  missionProgress?: {
    totalMissionCount?: number | null;
  } | null;
  pickupStation?: { stationName?: string };
  deliveryStation?: { stationName?: string };
  preferredTime?: {
    departureTime?: string;
    arrivalTime?: string;
  };
  deadline?: Date | FirestoreTimestampLike;
  packageInfo?: {
    size?: string;
    weight?: string | number;
  };
  fee?: {
    totalFee?: number;
  };
  status?: string;
};

export type FirestorePendingRequestDoc = FilterRequestBase & {
  requestId?: string;
  requesterId?: string;
  beta1RequestStatus?: string;
  requestDraftId?: string | null;
  missionProgress?: {
    totalMissionCount?: number | null;
  } | null;
  requesterName?: string;
  senderName?: string;
  matchedGillerId?: string;
  feeBreakdown?: { totalFee?: number };
};

export function isMissionBoardManagedRequest(
  request:
    | Pick<FirestoreMatchingRequestDoc, 'beta1RequestStatus' | 'requestDraftId' | 'missionProgress'>
    | Pick<FirestorePendingRequestDoc, 'beta1RequestStatus' | 'requestDraftId' | 'missionProgress'>
    | undefined
): boolean {
  if (!request) {
    return false;
  }

  if (typeof request.beta1RequestStatus === 'string' && request.beta1RequestStatus.length > 0) {
    return true;
  }

  if (typeof request.requestDraftId === 'string' && request.requestDraftId.length > 0) {
    return true;
  }

  const totalMissionCount = request.missionProgress?.totalMissionCount;
  return typeof totalMissionCount === 'number' && totalMissionCount > 0;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function normalizeStation<T extends FilterStation>(station: T | undefined): T | undefined {
  if (!station) return station;

  const lat = station.lat ?? station.latitude ?? station.location?.latitude ?? 0;
  const lng = station.lng ?? station.longitude ?? station.location?.longitude ?? 0;

  return {
    ...station,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
  };
}
