/**
 * Config Service
 * Firebase Firestore Config Collections 관리 서비스
 */

import {
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
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

function convertDocument<T>(
  docSnapshot: QueryDocumentSnapshot,
  converter: (data: any) => T
): T {
  const data = docSnapshot.data();
  return converter(data);
}

// ==================== Station Config ====================

function convertStation(data: any): Station {
  return {
    stationId: data.stationId,
    stationName: data.stationName,
    stationNameEnglish: data.stationNameEnglish,
    lines: data.lines,
    location: data.location,
    isTransferStation: data.isTransferStation,
    isExpressStop: data.isExpressStop ?? false,
    isTerminus: data.isTerminus ?? false,
    facilities: data.facilities,
    isActive: data.isActive,
    region: data.region,
    priority: data.priority,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
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

    cache.set(cacheKey, stations);
    return stations;
  } catch (error) {
    console.error('Error fetching all stations:', error);
    throw error;
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

    cache.set(cacheKey, stations);
    return stations;
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

function convertTravelTime(data: any): TravelTime {
  return {
    travelTimeId: data.travelTimeId,
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

    cache.set(cacheKey, travelTimes);
    return travelTimes;
  } catch (error) {
    console.error('Error fetching all travel times:', error);
    throw error;
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

function convertExpressTrain(data: any): ExpressTrain {
  return {
    expressId: data.expressId,
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

    cache.set(cacheKey, expressTrains);
    return expressTrains;
  } catch (error) {
    console.error('Error fetching all express trains:', error);
    throw error;
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

function convertCongestionData(data: any): CongestionData {
  return {
    congestionId: data.congestionId,
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

    cache.set(cacheKey, congestionConfigs);
    return congestionConfigs;
  } catch (error) {
    console.error('Error fetching all congestion configs:', error);
    throw error;
  }
}

// ==================== Algorithm Params ====================

function convertAlgorithmParams(data: any): AlgorithmParams {
  return {
    paramId: data.paramId,
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
