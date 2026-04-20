import {
  DocumentSnapshot,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
} from 'firebase/firestore';
import { db } from '../firebase';
import { MAJOR_STATIONS, type Station as LocalStation } from '../../data/subway-stations';
import { TRAVEL_TIME_MATRIX } from '../../data/travel-times';
import { EXPRESS_TRAIN_SCHEDULES } from '../../data/express-trains';
import { CONGESTION_DATA as LOCAL_CONGESTION_DATA } from '../../data/congestion';
import type {
  Station,
  TravelTime,
  ExpressTrain,
  CongestionData,
  AlgorithmParams,
  RouteResult,
  DetourInfo,
} from '../../types/config';

// ==================== Cache ====================

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class ConfigCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new ConfigCache();

// ==================== Firestore Imports (re-exported for domain modules) ====================

export {
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
};

export { db };

export type { DocumentSnapshot };

// ==================== Data Imports (re-exported for domain modules) ====================

export { MAJOR_STATIONS };
export type { LocalStation };
export { TRAVEL_TIME_MATRIX };
export { EXPRESS_TRAIN_SCHEDULES };
export { LOCAL_CONGESTION_DATA };
export type {
  Station,
  TravelTime,
  ExpressTrain,
  CongestionData,
  AlgorithmParams,
  RouteResult,
  DetourInfo,
};

// ==================== Type Helpers ====================

export function isPermissionDeniedError(error: unknown): boolean {
  if (typeof error !== 'object' || error == null) {
    return false;
  }

  const errorCode = (error as { code?: unknown }).code;
  const code = 'code' in error ? (typeof errorCode === 'string' || typeof errorCode === 'number' ? String(errorCode) : '') : '';
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

export function readString(value: unknown, fallback: string = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function readNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function readBoolean(value: unknown, fallback: boolean = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function readNumberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, number>>((result, [key, entry]) => {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      result[key] = entry;
    }
    return result;
  }, {});
}

export function isTimestampRecord(value: unknown): value is { seconds: number; nanoseconds?: number } {
  return typeof value === 'object' && value != null && typeof (value as { seconds?: unknown }).seconds === 'number';
}

export function convertTimestampToDate(timestamp: { seconds: number; nanoseconds?: number }): Date {
  return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds ?? 0) / 1000000);
}

export function toFallbackDate(): Date {
  return new Date('2026-01-01T00:00:00.000Z');
}

export function readCoordinateValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function hasValidStationCoordinates(latitude: number | null, longitude: number | null): boolean {
  if (latitude == null || longitude == null) {
    return false;
  }

  if (latitude === 0 || longitude === 0) {
    return false;
  }

  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function convertDocument<T>(
  docSnapshot: DocumentSnapshot,
  converter: (data: unknown, docId: string) => T
): T {
  const data = docSnapshot.data();
  const docId = docSnapshot.id;
  if (!data) {
    throw new Error(`Missing document data for ${docId}`);
  }
  return converter(data, docId);
}

export function readDate(value: unknown, fallback: Date = toFallbackDate()): Date {
  return isTimestampRecord(value) ? convertTimestampToDate(value) : fallback;
}

export function readNumberRecord<T extends string>(value: unknown, keys: readonly T[]): Record<T, number> {
  const source = asRecord(value);
  return keys.reduce<Record<T, number>>((result, key) => {
    result[key] = readNumber(source[key]);
    return result;
  }, {} as Record<T, number>);
}

// ==================== Station Normalizers ====================

export function convertLocalStation(station: LocalStation): Station {
  return {
    stationId: station.stationId,
    stationName: station.stationName,
    stationNameEnglish: station.stationNameEnglish,
    lines: station.lines,
    location: station.location,
    isTransferStation: station.isTransferStation,
    isExpressStop: station.isExpressStop,
    isTerminus: station.isTerminus,
    facilities: {
      hasElevator: station.facilities.hasElevator,
      hasEscalator: station.facilities.hasEscalator,
      wheelchairAccessible: station.facilities.wheelchairAccessible,
    },
    isActive: true,
    region: station.region ?? 'seoul',
    priority: station.priority ?? 100,
    createdAt: toFallbackDate(),
    updatedAt: toFallbackDate(),
  };
}

export function normalizeStationLines(lines: unknown): Station['lines'] {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines
    .map((line) => {
      if (typeof line !== 'object' || line == null) {
        return null;
      }

      const source = line as Record<string, unknown>;
      const lineId = typeof source.lineId === 'string' ? source.lineId : '';
      const lineName = typeof source.lineName === 'string' ? source.lineName : lineId;

      if (!lineId && !lineName) {
        return null;
      }

      return {
        lineId: lineId ?? lineName,
        lineName: lineName ?? lineId,
        lineCode: typeof source.lineCode === 'string' ? source.lineCode : lineId ?? lineName,
        lineColor: typeof source.lineColor === 'string' ? source.lineColor : '#000000',
        lineType:
          source.lineType === 'express' || source.lineType === 'special' || source.lineType === 'general'
            ? source.lineType
            : 'general',
      };
    })
    .filter((line): line is Station['lines'][number] => line !== null);
}

export function resolveFallbackStation(stationId: string, stationName: string): LocalStation | null {
  return (
    MAJOR_STATIONS.find((station) => station.stationId === stationId) ??
    MAJOR_STATIONS.find((station) => station.stationName === stationName) ??
    null
  );
}

export function normalizeStationLocation(
  location: unknown,
  stationId: string,
  stationName: string
): Station['location'] {
  const source = typeof location === 'object' && location != null ? (location as Record<string, unknown>) : {};
  const latitude = readCoordinateValue(source.latitude) ?? readCoordinateValue(source.lat);
  const longitude = readCoordinateValue(source.longitude) ?? readCoordinateValue(source.lng);

  if (hasValidStationCoordinates(latitude, longitude)) {
    return {
      latitude: latitude!,
      longitude: longitude!,
    };
  }

  const fallbackStation = resolveFallbackStation(stationId, stationName);
  if (fallbackStation) {
    return {
      latitude: fallbackStation.location.latitude,
      longitude: fallbackStation.location.longitude,
    };
  }

  return {
    latitude: 0,
    longitude: 0,
  };
}

export function mergeStationLists(target: Station['lines'], source: Station['lines']): Station['lines'] {
  const merged = new Map<string, Station['lines'][number]>();

  for (const line of [...target, ...source]) {
    const key = line.lineId ?? line.lineName;
    if (!key) {
      continue;
    }

    if (!merged.has(key)) {
      merged.set(key, line);
    }
  }

  return Array.from(merged.values());
}

export function deduplicateStations(stations: Station[]): Station[] {
  const stationMap = new Map<string, Station>();

  for (const station of stations) {
    const existing = stationMap.get(station.stationName);

    if (!existing) {
      stationMap.set(station.stationName, station);
      continue;
    }

    const existingHasCoords = hasValidStationCoordinates(
      existing.location.latitude,
      existing.location.longitude
    );
    const nextHasCoords = hasValidStationCoordinates(
      station.location.latitude,
      station.location.longitude
    );

    const primary = !existingHasCoords && nextHasCoords ? station : existing;
    const secondary = primary === existing ? station : existing;

    stationMap.set(station.stationName, {
      ...primary,
      lines: mergeStationLists(primary.lines, secondary.lines),
      isTransferStation:
        primary.isTransferStation ||
        secondary.isTransferStation ||
        mergeStationLists(primary.lines, secondary.lines).length > 1,
      isExpressStop: primary.isExpressStop ?? secondary.isExpressStop,
      isTerminus: primary.isTerminus ?? secondary.isTerminus,
      priority: Math.min(primary.priority ?? 999, secondary.priority ?? 999),
      region: primary.region ?? secondary.region,
      kric: primary.kric ?? secondary.kric,
      fare: primary.fare ?? secondary.fare,
      updatedAt: primary.updatedAt > secondary.updatedAt ? primary.updatedAt : secondary.updatedAt,
      createdAt: primary.createdAt < secondary.createdAt ? primary.createdAt : secondary.createdAt,
    });
  }

  return Array.from(stationMap.values());
}

// ==================== Fallback Builders ====================

export function buildSupplementalFallbackStations(): Station[] {
  return [
    {
      stationId: '818',
      stationName: '문정역',
      stationNameEnglish: 'Munjeong',
      lines: [
        {
          lineId: '8',
          lineName: '8호선',
          lineCode: '818',
          lineColor: '#EC5C37',
          lineType: 'general',
        },
      ],
      location: {
        latitude: 37.486,
        longitude: 127.1225,
      },
      isTransferStation: false,
      isExpressStop: false,
      isTerminus: false,
      facilities: {
        hasElevator: true,
        hasEscalator: true,
        wheelchairAccessible: true,
      },
      isActive: true,
      region: 'seoul',
      kric: { lineCode: '8', stationCode: '818' },
      priority: 100,
      createdAt: toFallbackDate(),
      updatedAt: toFallbackDate(),
    },
  ];
}

export function getFallbackStations(): Station[] {
  const baseStations = MAJOR_STATIONS.map(convertLocalStation);
  return mergeSupplementalStations(baseStations);
}

export function mergeSupplementalStations(stations: Station[]): Station[] {
  const existingStationIds = new Set(stations.map((station) => station.stationId));
  const supplementalStations = buildSupplementalFallbackStations().filter(
    (station) => !existingStationIds.has(station.stationId)
  );

  return [...stations, ...supplementalStations];
}

export function getFallbackTravelTimes(): TravelTime[] {
  return Object.entries(TRAVEL_TIME_MATRIX).map(([routeId, info]) => {
    const [fromStationId, toStationId] = routeId.split('-');
    const fromStation = MAJOR_STATIONS.find((station) => station.stationId === fromStationId);
    const toStation = MAJOR_STATIONS.find((station) => station.stationId === toStationId);

    return {
      travelTimeId: routeId,
      fromStationId,
      toStationId,
      fromStationName: fromStation?.stationName ?? fromStationId,
      toStationName: toStation?.stationName ?? toStationId,
      normalTime: info.normalTime,
      expressTime: info.expressTime,
      transferCount: info.transferCount,
      transferStations: info.transferStations,
      hasExpress: info.hasExpress,
      walkingDistance: info.walkingDistance,
      distance: info.walkingDistance,
      lineIds: Array.from(new Set([...(fromStation?.lines.map((line) => line.lineId) ?? []), ...(toStation?.lines.map((line) => line.lineId) ?? [])])),
      reliability: 7,
      lastVerified: toFallbackDate(),
      isActive: true,
      createdAt: toFallbackDate(),
      updatedAt: toFallbackDate(),
    };
  });
}

export function getFallbackExpressTrains(): ExpressTrain[] {
  return EXPRESS_TRAIN_SCHEDULES.map((schedule, index) => ({
    expressId: `${schedule.lineId}-${schedule.type}-${index + 1}`,
    lineId: schedule.lineId,
    lineName: schedule.lineName ?? schedule.lineId,
    type: schedule.type,
    typeName: schedule.typeName,
    operatingDays: schedule.operatingDays,
    firstTrain: schedule.firstTrain,
    lastTrain: schedule.lastTrain,
    rushHourMorningInterval: schedule.intervals.rushHourMorning,
    rushHourEveningInterval: schedule.intervals.rushHourEvening,
    daytimeInterval: schedule.intervals.daytime,
    nightInterval: schedule.intervals.night,
    stops: schedule.stops,
    avgSpeed: 42,
    timeSavings: schedule.timeSavings,
    isActive: true,
    createdAt: toFallbackDate(),
    updatedAt: toFallbackDate(),
  }));
}

export function getFallbackCongestionConfigs(): CongestionData[] {
  return LOCAL_CONGESTION_DATA.map((item, index) => ({
    congestionId: `${item.lineId}-${index + 1}`,
    lineId: item.lineId,
    lineName: item.lineName,
    timeSlots: item.timeSlots,
    sections: item.sections,
    dataSource: item.dataSource ?? 'local_fallback',
    lastUpdated: toFallbackDate(),
    isValid: true,
    createdAt: toFallbackDate(),
    updatedAt: toFallbackDate(),
  }));
}

// ==================== Congestion Normalizers ====================

export function normalizeCongestionTimeSlots(value: unknown): CongestionData['timeSlots'] {
  return readNumberRecord(value, [
    'earlyMorning',
    'rushHourMorning',
    'morning',
    'lunch',
    'afternoon',
    'rushHourEvening',
    'evening',
  ] as const);
}

export function normalizeCongestionSections(value: unknown): CongestionData['sections'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => {
      const source = asRecord(section);
      const stationId = readString(source.stationId);
      const stationName = readString(source.stationName);

      if (!stationId && !stationName) {
        return null;
      }

      return {
        stationId,
        stationName,
        congestionLevel: readNumber(source.congestionLevel),
      };
    })
    .filter((section): section is CongestionData['sections'][number] => section != null);
}

// ==================== Algorithm Normalizers ====================

export function normalizeAlgorithmWeights(value: unknown): AlgorithmParams['weights'] {
  return readNumberRecord(value, ['timeEfficiency', 'routeConvenience', 'gillerReliability'] as const);
}

export function normalizeTimeEfficiency(value: unknown): AlgorithmParams['timeEfficiency'] {
  return readNumberRecord(value, ['travelTime', 'waitingTime', 'scheduleMatch'] as const);
}

export function normalizeRouteConvenience(value: unknown): AlgorithmParams['routeConvenience'] {
  return readNumberRecord(value, ['transferPenalty', 'congestion', 'walkingDistance'] as const);
}

export function normalizeGillerReliability(value: unknown): AlgorithmParams['gillerReliability'] {
  return readNumberRecord(value, ['rating', 'responseTime'] as const);
}

export function normalizeScoring(value: unknown): AlgorithmParams['scoring'] {
  const source = asRecord(value);

  return {
    travelTime: readNumberRecord(source.travelTime, [
      'excellentMargin',
      'goodMargin',
      'acceptableMargin',
      'tightMargin',
      'impossibleMargin',
    ] as const),
    waitingTime: readNumberRecord(source.waitingTime, ['maxWaitTime', 'pointsPer5Minutes'] as const),
    transfer: readNumberRecord(source.transfer, ['penaltyPerTransfer', 'maxScore'] as const),
    congestion: readNumberRecord(source.congestion, ['rushHourPenalty', 'maxScore'] as const),
    walkingDistance: readNumberRecord(source.walkingDistance, ['penaltyPer100m', 'maxScore'] as const),
    rating: readNumberRecord(source.rating, ['minRating', 'maxRating', 'maxScore'] as const),
    responseTime: readNumberRecord(source.responseTime, ['excellent', 'good', 'fair', 'poor'] as const),
  };
}

export function normalizeLimits(value: unknown): AlgorithmParams['limits'] {
  return readNumberRecord(value, ['maxMatchesPerRequest', 'matchTimeoutMinutes', 'maxRetryCount', 'minScore'] as const);
}

export function normalizePriorities(value: unknown): AlgorithmParams['priorities'] {
  return readNumberRecord(value, ['proGillerMultiplier', 'premiumBusinessMultiplier', 'newGillerPenalty'] as const);
}

export function normalizeFeatures(value: unknown): AlgorithmParams['features'] {
  const source = asRecord(value);
  return {
    enableExpressBonus: readBoolean(source.enableExpressBonus),
    enableCongestionPenalty: readBoolean(source.enableCongestionPenalty),
    enableRushHourPenalty: readBoolean(source.enableRushHourPenalty),
    enableTransferPenalty: readBoolean(source.enableTransferPenalty),
    enableProGillerPriority: readBoolean(source.enableProGillerPriority),
  };
}
