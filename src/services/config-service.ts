/**
 * Config Service
 * Firebase Firestore Config Collections 관리 서비스
 */

import {
  DocumentSnapshot,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
} from 'firebase/firestore';
import { db } from './firebase';
import { MAJOR_STATIONS, type Station as LocalStation } from '../data/subway-stations';
import { TRAVEL_TIME_MATRIX } from '../data/travel-times';
import { EXPRESS_TRAIN_SCHEDULES } from '../data/express-trains';
import { CONGESTION_DATA as LOCAL_CONGESTION_DATA } from '../data/congestion';
import type {
  Station,
  TravelTime,
  ExpressTrain,
  CongestionData,
  AlgorithmParams,
  RouteResult,
  DetourInfo,
} from '../types/config';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface PolicyConfig {
  policyId: string;
  title: string;
  content: string[];
  effectiveDate: string;
  isActive: boolean;
  priority?: number;
  version?: string;
  category?: string;
  summary?: string;
  required?: boolean;
  targetFlow?: string;
}

export interface RecipientContactPrivacyConfig {
  safeNumberEnabled: boolean;
  providerName: string;
  policyTitle: string;
  policyEffectiveDate: string;
  thirdPartyConsentRequired: boolean;
  guidance: string;
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

const cache = new ConfigCache();

function convertTimestampToDate(timestamp: { seconds: number; nanoseconds?: number }): Date {
  return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
}

function toFallbackDate(): Date {
  return new Date('2026-01-01T00:00:00.000Z');
}

function readCoordinateValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function hasValidStationCoordinates(latitude: number | null, longitude: number | null): boolean {
  if (latitude == null || longitude == null) {
    return false;
  }

  if (latitude === 0 || longitude === 0) {
    return false;
  }

  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function convertDocument<T>(
  docSnapshot: DocumentSnapshot,
  converter: (data: any, docId: string) => T
): T {
  const data = docSnapshot.data();
  const docId = docSnapshot.id;
  if (!data) {
    throw new Error(`Missing document data for ${docId}`);
  }
  return converter(data, docId);
}

function convertLocalStation(station: LocalStation): Station {
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

function normalizeStationLines(lines: unknown): Station['lines'] {
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
        lineId: lineId || lineName,
        lineName: lineName || lineId,
        lineCode: typeof source.lineCode === 'string' ? source.lineCode : lineId || lineName,
        lineColor: typeof source.lineColor === 'string' ? source.lineColor : '#000000',
        lineType:
          source.lineType === 'express' || source.lineType === 'special' || source.lineType === 'general'
            ? source.lineType
            : 'general',
      };
    })
    .filter((line): line is Station['lines'][number] => line !== null);
}

function resolveFallbackStation(stationId: string, stationName: string): LocalStation | null {
  return (
    MAJOR_STATIONS.find((station) => station.stationId === stationId) ??
    MAJOR_STATIONS.find((station) => station.stationName === stationName) ??
    null
  );
}

function normalizeStationLocation(
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

function mergeStationLists(target: Station['lines'], source: Station['lines']): Station['lines'] {
  const merged = new Map<string, Station['lines'][number]>();

  for (const line of [...target, ...source]) {
    const key = line.lineId || line.lineName;
    if (!key) {
      continue;
    }

    if (!merged.has(key)) {
      merged.set(key, line);
    }
  }

  return Array.from(merged.values());
}

function deduplicateStations(stations: Station[]): Station[] {
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
      isExpressStop: primary.isExpressStop || secondary.isExpressStop,
      isTerminus: primary.isTerminus || secondary.isTerminus,
      priority: Math.min(primary.priority ?? 999, secondary.priority ?? 999),
      region: primary.region || secondary.region,
      kric: primary.kric ?? secondary.kric,
      fare: primary.fare ?? secondary.fare,
      updatedAt: primary.updatedAt > secondary.updatedAt ? primary.updatedAt : secondary.updatedAt,
      createdAt: primary.createdAt < secondary.createdAt ? primary.createdAt : secondary.createdAt,
    });
  }

  return Array.from(stationMap.values());
}

function buildSupplementalFallbackStations(): Station[] {
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
      priority: 100,
      createdAt: toFallbackDate(),
      updatedAt: toFallbackDate(),
    },
  ];
}

function getFallbackStations(): Station[] {
  const baseStations = MAJOR_STATIONS.map(convertLocalStation);
  return mergeSupplementalStations(baseStations);
}

function mergeSupplementalStations(stations: Station[]): Station[] {
  const existingStationIds = new Set(stations.map((station) => station.stationId));
  const supplementalStations = buildSupplementalFallbackStations().filter(
    (station) => !existingStationIds.has(station.stationId)
  );

  return [...stations, ...supplementalStations];
}

function getFallbackTravelTimes(): TravelTime[] {
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

function getFallbackExpressTrains(): ExpressTrain[] {
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

function getFallbackCongestionConfigs(): CongestionData[] {
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

// ==================== Station Config ====================

function convertStation(data: any, docId?: string): Station {
  const stationId = data.stationId || data.id || docId || '';
  const stationName = data.stationName || data.name || '';

  return {
    stationId,
    stationName,
    stationNameEnglish: data.stationNameEnglish || data.nameEnglish || '',
    lines: normalizeStationLines(data.lines),
    location: normalizeStationLocation(data.location, stationId, stationName),
    isTransferStation: Boolean(data.isTransferStation),
    isExpressStop: data.isExpressStop ?? false,
    isTerminus: data.isTerminus ?? false,
    facilities: {
      hasElevator: Boolean(data.facilities?.hasElevator),
      hasEscalator: Boolean(data.facilities?.hasEscalator),
      wheelchairAccessible: Boolean(data.facilities?.wheelchairAccessible),
    },
    isActive: data.isActive !== false,
    region: data.region || 'seoul',
    priority: typeof data.priority === 'number' ? data.priority : 999,
    kric: data.kric,
    fare: data.fare,
    createdAt: data.createdAt ? convertTimestampToDate(data.createdAt) : toFallbackDate(),
    updatedAt: data.updatedAt ? convertTimestampToDate(data.updatedAt) : toFallbackDate(),
  };
}

export async function getStationConfig(stationId: string): Promise<Station | null> {
  const cacheKey = `station:${stationId}`;
  const cached = cache.get<Station>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const docRef = doc(db, 'config_stations', stationId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists) {
      return null;
    }

    const station = convertDocument(docSnapshot, convertStation);
    cache.set(cacheKey, station);
    return station;
  } catch (error) {
    console.error(`Error fetching station config for ${stationId}:`, error);
    throw error;
  }
}

export async function getAllStations(): Promise<Station[]> {
  const cacheKey = 'stations:all';
  const cached = cache.get<Station[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_stations'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const stations: Station[] = [];

    snapshot.forEach((docSnapshot) => {
      stations.push(convertDocument(docSnapshot, convertStation));
    });

    const finalStations =
      stations.length > 0
        ? deduplicateStations(mergeSupplementalStations(stations))
        : deduplicateStations(getFallbackStations());
    cache.set(cacheKey, finalStations);
    return finalStations;
  } catch (error) {
    console.error('Error fetching all stations, using fallback dataset:', error);
    const fallbackStations = deduplicateStations(getFallbackStations());
    cache.set(cacheKey, fallbackStations);
    return fallbackStations;
  }
}

export async function getStationsByRegion(region: string): Promise<Station[]> {
  const cacheKey = `stations:region:${region}`;
  const cached = cache.get<Station[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_stations'),
      where('isActive', '==', true),
      where('region', '==', region)
    );

    const snapshot = await getDocs(q);
    const stations: Station[] = [];

    snapshot.forEach((docSnapshot) => {
      stations.push(convertDocument(docSnapshot, convertStation));
    });

    const finalStations = deduplicateStations(mergeSupplementalStations(stations));
    cache.set(cacheKey, finalStations);
    return finalStations;
  } catch (error) {
    console.error(`Error fetching stations for region ${region}:`, error);
    throw error;
  }
}

export async function getStationsByLine(lineId: string): Promise<Station[]> {
  const cacheKey = `stations:line:${lineId}`;
  const cached = cache.get<Station[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const allStations = await getAllStations();
    const filteredStations = allStations.filter((station) =>
      station.lines.some((line) => line.lineId === lineId)
    );

    cache.set(cacheKey, filteredStations);
    return filteredStations;
  } catch (error) {
    console.error(`Error fetching stations for line ${lineId}:`, error);
    throw error;
  }
}

// ==================== Travel Time Config ====================

function convertTravelTime(data: any, docId?: string): TravelTime {
  return {
    travelTimeId: data.travelTimeId || docId || '',
    fromStationId: data.fromStationId,
    toStationId: data.toStationId,
    fromStationName: data.fromStationName,
    toStationName: data.toStationName,
    normalTime: data.normalTime,
    expressTime: data.expressTime,
    transferCount: data.transferCount,
    transferStations: data.transferStations,
    hasExpress: data.hasExpress,
    walkingDistance: data.walkingDistance,
    distance: data.distance,
    lineIds: data.lineIds,
    reliability: data.reliability,
    lastVerified: convertTimestampToDate(data.lastVerified),
    isActive: data.isActive,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
  };
}

export async function getTravelTimeConfig(
  fromStationId: string,
  toStationId: string
): Promise<TravelTime | null> {
  const cacheKey = `travelTime:${fromStationId}-${toStationId}`;
  const cached = cache.get<TravelTime>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_travel_times'),
      where('fromStationId', '==', fromStationId),
      where('toStationId', '==', toStationId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const travelTime = convertDocument(snapshot.docs[0], convertTravelTime);
    cache.set(cacheKey, travelTime);
    return travelTime;
  } catch (error) {
    console.error(`Error fetching travel time config for ${fromStationId}-${toStationId}:`, error);
    throw error;
  }
}

export async function getAllTravelTimes(): Promise<TravelTime[]> {
  const cacheKey = 'travelTimes:all';
  const cached = cache.get<TravelTime[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_travel_times'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const travelTimes: TravelTime[] = [];

    snapshot.forEach((docSnapshot) => {
      travelTimes.push(convertDocument(docSnapshot, convertTravelTime));
    });

    const finalTravelTimes = travelTimes.length > 0 ? travelTimes : getFallbackTravelTimes();
    cache.set(cacheKey, finalTravelTimes);
    return finalTravelTimes;
  } catch (error) {
    console.error('Error fetching all travel times, using fallback dataset:', error);
    const fallbackTravelTimes = getFallbackTravelTimes();
    cache.set(cacheKey, fallbackTravelTimes);
    return fallbackTravelTimes;
  }
}

export async function getTravelTimesFromStation(stationId: string): Promise<TravelTime[]> {
  const cacheKey = `travelTimes:from:${stationId}`;
  const cached = cache.get<TravelTime[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_travel_times'),
      where('fromStationId', '==', stationId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const travelTimes: TravelTime[] = [];

    snapshot.forEach((docSnapshot) => {
      travelTimes.push(convertDocument(docSnapshot, convertTravelTime));
    });

    cache.set(cacheKey, travelTimes);
    return travelTimes;
  } catch (error) {
    console.error(`Error fetching travel times from station ${stationId}:`, error);
    throw error;
  }
}

// ==================== Express Train Config ====================

function convertExpressTrain(data: any, docId?: string): ExpressTrain {
  return {
    expressId: data.expressId || docId || '',
    lineId: data.lineId,
    lineName: data.lineName,
    type: data.type,
    typeName: data.typeName,
    operatingDays: data.operatingDays,
    firstTrain: data.firstTrain,
    lastTrain: data.lastTrain,
    rushHourMorningInterval: data.rushHourMorningInterval,
    rushHourEveningInterval: data.rushHourEveningInterval,
    daytimeInterval: data.daytimeInterval,
    nightInterval: data.nightInterval,
    stops: data.stops,
    avgSpeed: data.avgSpeed,
    timeSavings: data.timeSavings,
    isActive: data.isActive,
    seasonStart: data.seasonStart ? convertTimestampToDate(data.seasonStart) : undefined,
    seasonEnd: data.seasonEnd ? convertTimestampToDate(data.seasonEnd) : undefined,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
  };
}

export async function getExpressTrainConfig(expressId: string): Promise<ExpressTrain | null> {
  const cacheKey = `expressTrain:${expressId}`;
  const cached = cache.get<ExpressTrain>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const docRef = doc(db, 'config_express_trains', expressId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists) {
      return null;
    }

    const expressTrain = convertDocument(docSnapshot, convertExpressTrain);
    cache.set(cacheKey, expressTrain);
    return expressTrain;
  } catch (error) {
    console.error(`Error fetching express train config for ${expressId}:`, error);
    throw error;
  }
}

export async function getAllExpressTrains(): Promise<ExpressTrain[]> {
  const cacheKey = 'expressTrains:all';
  const cached = cache.get<ExpressTrain[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_express_trains'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const expressTrains: ExpressTrain[] = [];

    snapshot.forEach((docSnapshot) => {
      expressTrains.push(convertDocument(docSnapshot, convertExpressTrain));
    });

    const finalExpressTrains = expressTrains.length > 0 ? expressTrains : getFallbackExpressTrains();
    cache.set(cacheKey, finalExpressTrains);
    return finalExpressTrains;
  } catch (error) {
    console.error('Error fetching all express trains, using fallback dataset:', error);
    const fallbackExpressTrains = getFallbackExpressTrains();
    cache.set(cacheKey, fallbackExpressTrains);
    return fallbackExpressTrains;
  }
}

export async function getExpressTrainsByLine(lineId: string): Promise<ExpressTrain[]> {
  const cacheKey = `expressTrains:line:${lineId}`;
  const cached = cache.get<ExpressTrain[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_express_trains'),
      where('lineId', '==', lineId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const expressTrains: ExpressTrain[] = [];

    snapshot.forEach((docSnapshot) => {
      expressTrains.push(convertDocument(docSnapshot, convertExpressTrain));
    });

    cache.set(cacheKey, expressTrains);
    return expressTrains;
  } catch (error) {
    console.error(`Error fetching express trains for line ${lineId}:`, error);
    throw error;
  }
}

// ==================== Congestion Config ====================

function convertCongestionData(data: any, docId?: string): CongestionData {
  return {
    congestionId: data.congestionId || docId || '',
    lineId: data.lineId,
    lineName: data.lineName,
    timeSlots: data.timeSlots,
    sections: data.sections,
    dataSource: data.dataSource,
    lastUpdated: convertTimestampToDate(data.lastUpdated),
    isValid: data.isValid,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
  };
}

export async function getCongestionConfig(lineId: string): Promise<CongestionData | null> {
  const cacheKey = `congestion:${lineId}`;
  const cached = cache.get<CongestionData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_congestion'),
      where('lineId', '==', lineId),
      where('isValid', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const congestion = convertDocument(snapshot.docs[0], convertCongestionData);
    cache.set(cacheKey, congestion);
    return congestion;
  } catch (error) {
    console.error(`Error fetching congestion config for line ${lineId}:`, error);
    throw error;
  }
}

export async function getAllCongestionConfigs(): Promise<CongestionData[]> {
  const cacheKey = 'congestion:all';
  const cached = cache.get<CongestionData[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_congestion'),
      where('isValid', '==', true)
    );

    const snapshot = await getDocs(q);
    const congestionConfigs: CongestionData[] = [];

    snapshot.forEach((docSnapshot) => {
      congestionConfigs.push(convertDocument(docSnapshot, convertCongestionData));
    });

    const finalCongestionConfigs = congestionConfigs.length > 0 ? congestionConfigs : getFallbackCongestionConfigs();
    cache.set(cacheKey, finalCongestionConfigs);
    return finalCongestionConfigs;
  } catch (error) {
    console.error('Error fetching all congestion configs, using fallback dataset:', error);
    const fallbackCongestionConfigs = getFallbackCongestionConfigs();
    cache.set(cacheKey, fallbackCongestionConfigs);
    return fallbackCongestionConfigs;
  }
}

// ==================== Algorithm Params ====================

function convertAlgorithmParams(data: any, docId?: string): AlgorithmParams {
  return {
    paramId: data.paramId || docId || '',
    version: data.version,
    weights: data.weights,
    timeEfficiency: data.timeEfficiency,
    routeConvenience: data.routeConvenience,
    gillerReliability: data.gillerReliability,
    scoring: data.scoring,
    limits: data.limits,
    priorities: data.priorities,
    features: data.features,
    isActive: data.isActive,
    description: data.description,
    createdBy: data.createdBy,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
  };
}

export async function getAlgorithmParams(paramId: string = 'matching-weights-v1'): Promise<AlgorithmParams | null> {
  const cacheKey = `algorithmParams:${paramId}`;
  const cached = cache.get<AlgorithmParams>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const docRef = doc(db, 'config_algorithm_params', paramId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists) {
      return null;
    }

    const params = convertDocument(docSnapshot, convertAlgorithmParams);
    cache.set(cacheKey, params);
    return params;
  } catch (error) {
    console.error(`Error fetching algorithm params for ${paramId}:`, error);
    throw error;
  }
}

export async function getActiveAlgorithmParams(): Promise<AlgorithmParams | null> {
  const cacheKey = 'algorithmParams:active';
  const cached = cache.get<AlgorithmParams>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_algorithm_params'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const params = convertDocument(snapshot.docs[0], convertAlgorithmParams);
    cache.set(cacheKey, params);
    return params;
  } catch (error) {
    console.error('Error fetching active algorithm params:', error);
    throw error;
  }
}

// ==================== Route Utility Functions ====================

export async function findFastestRoute(
  fromStationId: string,
  toStationId: string,
  preferExpress: boolean = true
): Promise<RouteResult | null> {
  const travelTime = await getTravelTimeConfig(fromStationId, toStationId);

  if (!travelTime) {
    return null;
  }

  return {
    fromStationId: travelTime.fromStationId,
    toStationId: travelTime.toStationId,
    normalTime: travelTime.normalTime,
    expressTime: preferExpress ? travelTime.expressTime : undefined,
    transferCount: travelTime.transferCount,
    hasExpress: travelTime.hasExpress && preferExpress,
    walkingDistance: travelTime.walkingDistance,
    lineIds: travelTime.lineIds,
  };
}

export async function calculateDetourTime(
  originalFromStationId: string,
  originalToStationId: string,
  detourFromStationId: string,
  detourToStationId: string
): Promise<DetourInfo | null> {
  const [originalRoute, detourRoute] = await Promise.all([
    getTravelTimeConfig(originalFromStationId, originalToStationId),
    getTravelTimeConfig(detourFromStationId, detourToStationId),
  ]);

  if (!originalRoute || !detourRoute) {
    return null;
  }

  const originalTime = originalRoute.normalTime;
  const detourTime = detourRoute.normalTime;
  const extraTime = Math.max(0, detourTime - originalTime);
  const extraDistance = Math.max(0, detourRoute.distance - originalRoute.distance);

  const params = await getActiveAlgorithmParams();
  const maxDetourTime = params?.scoring.travelTime.acceptableMargin || 300;

  return {
    originalTime,
    detourTime,
    extraTime,
    extraDistance,
    isAcceptable: extraTime <= maxDetourTime,
  };
}

export async function isAcceptableRoute(
  fromStationId: string,
  toStationId: string,
  maxExtraTime?: number
): Promise<boolean> {
  const params = await getActiveAlgorithmParams();
  const travelTime = await getTravelTimeConfig(fromStationId, toStationId);

  if (!travelTime) {
    return false;
  }

  const maxTime = maxExtraTime ?? params?.scoring.travelTime.acceptableMargin ?? 300;

  return travelTime.normalTime <= maxTime;
}

// ==================== Cache Management ====================

export function clearConfigCache(): void {
  cache.clear();
}

export function clearStationCache(stationId?: string): void {
  if (stationId) {
    cache.clearPattern(`^station:${stationId}$`);
    cache.clearPattern(`^travelTime:.*:${stationId}$`);
    cache.clearPattern(`^travelTime:${stationId}:.*$`);
  } else {
    cache.clearPattern('^station:');
    cache.clearPattern('^stations:');
  }
}

export function clearTravelTimeCache(): void {
  cache.clearPattern('^travelTime');
}

export function clearExpressTrainCache(): void {
  cache.clearPattern('^expressTrain');
}

export function clearCongestionCache(): void {
  cache.clearPattern('^congestion');
}

export function clearAlgorithmParamsCache(): void {
  cache.clearPattern('^algorithmParams');
}

// ==================== Policy Config ====================

function convertPolicyConfig(data: any, docId?: string): PolicyConfig {
  return {
    policyId: data.policyId || docId || '',
    title: data.title || '정책',
    content: Array.isArray(data.content) ? data.content : [],
    effectiveDate: data.effectiveDate || '',
    isActive: data.isActive !== false,
    priority: typeof data.priority === 'number' ? data.priority : 999,
    version: typeof data.version === 'string' ? data.version : undefined,
    category: typeof data.category === 'string' ? data.category : undefined,
    summary: typeof data.summary === 'string' ? data.summary : undefined,
    required: typeof data.required === 'boolean' ? data.required : undefined,
    targetFlow: typeof data.targetFlow === 'string' ? data.targetFlow : undefined,
  };
}

function comparePolicyOrder(a: PolicyConfig, b: PolicyConfig): number {
  const dateA = Date.parse(a.effectiveDate || '');
  const dateB = Date.parse(b.effectiveDate || '');
  const hasDateA = Number.isFinite(dateA);
  const hasDateB = Number.isFinite(dateB);

  if (hasDateA && hasDateB && dateA !== dateB) {
    return dateB - dateA;
  }

  if (hasDateA !== hasDateB) {
    return hasDateA ? -1 : 1;
  }

  return (a.priority || 999) - (b.priority || 999);
}

export async function getPolicyConfigs(): Promise<PolicyConfig[]> {
  const cacheKey = 'policies:all';
  const cached = cache.get<PolicyConfig[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_policies'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const policies: PolicyConfig[] = [];

    snapshot.forEach((docSnapshot) => {
      policies.push(convertDocument(docSnapshot, convertPolicyConfig));
    });

    policies.sort(comparePolicyOrder);
    cache.set(cacheKey, policies);
    return policies;
  } catch (error) {
    console.error('Error fetching policy configs:', error);
    throw error;
  }
}

export async function getPolicyHistoryConfigs(): Promise<PolicyConfig[]> {
  const cacheKey = 'policies:history';
  const cached = cache.get<PolicyConfig[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const snapshot = await getDocs(collection(db, 'config_policies'));
    const policies = snapshot.docs.map((docSnapshot) =>
      convertDocument(docSnapshot, convertPolicyConfig)
    );

    policies.sort(comparePolicyOrder);
    cache.set(cacheKey, policies);
    return policies;
  } catch (error) {
    console.error('Error fetching policy history configs:', error);
    throw error;
  }
}

export async function getRecipientContactPrivacyConfig(): Promise<RecipientContactPrivacyConfig> {
  const cacheKey = 'config:recipient-contact-privacy';
  const cached = cache.get<RecipientContactPrivacyConfig>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const configSnapshot = await getDoc(doc(db, 'config_operational', 'recipient_contact_privacy'));
    const data = configSnapshot.data() as Record<string, unknown> | undefined;

    const resolved: RecipientContactPrivacyConfig = {
      safeNumberEnabled: data?.safeNumberEnabled === true,
      providerName:
        typeof data?.providerName === 'string' && data.providerName.trim().length > 0
          ? data.providerName
          : '관리자 설정 대기',
      policyTitle:
        typeof data?.policyTitle === 'string' && data.policyTitle.trim().length > 0
          ? data.policyTitle
          : '수령인 연락처 보호 정책',
      policyEffectiveDate:
        typeof data?.policyEffectiveDate === 'string' && data.policyEffectiveDate.trim().length > 0
          ? data.policyEffectiveDate
          : '',
      thirdPartyConsentRequired: data?.thirdPartyConsentRequired !== false,
      guidance:
        typeof data?.guidance === 'string' && data.guidance.trim().length > 0
          ? data.guidance
          : '수령인 연락처는 관리자 정책에 따라 안심번호로 전환되어 전달되며, 제3자 정보 제공 동의가 함께 기록됩니다.',
    };

    cache.set(cacheKey, resolved);
    return resolved;
  } catch (error) {
    console.warn('Using fallback recipient contact privacy config:', error);
    const fallback: RecipientContactPrivacyConfig = {
      safeNumberEnabled: false,
      providerName: '관리자 설정 대기',
      policyTitle: '수령인 연락처 보호 정책',
      policyEffectiveDate: '',
      thirdPartyConsentRequired: true,
      guidance:
        '수령인 연락처는 관리자 정책에 따라 안심번호로 전환되어 전달되며, 제3자 정보 제공 동의가 함께 기록됩니다.',
    };
    cache.set(cacheKey, fallback);
    return fallback;
  }
}
