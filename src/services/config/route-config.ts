import { db, doc, getDoc, getDocs, query, where, collection } from './config-utils';
import type { TravelTime, ExpressTrain, RouteResult, DetourInfo } from './config-utils';
import {
  cache,
  convertDocument,
  asRecord,
  readString,
  readNumber,
  readBoolean,
  readStringArray,
  readNumberMap,
  isTimestampRecord,
  convertTimestampToDate,
  toFallbackDate,
  getFallbackTravelTimes,
  getFallbackExpressTrains,
} from './config-utils';
import { getActiveAlgorithmParams } from './algorithm-config';

function convertTravelTime(data: unknown, docId?: string): TravelTime {
  const source = asRecord(data);
  return {
    travelTimeId: readString(source.travelTimeId, docId ?? ''),
    fromStationId: readString(source.fromStationId),
    toStationId: readString(source.toStationId),
    fromStationName: readString(source.fromStationName),
    toStationName: readString(source.toStationName),
    normalTime: readNumber(source.normalTime),
    expressTime: typeof source.expressTime === 'number' ? source.expressTime : undefined,
    transferCount: readNumber(source.transferCount),
    transferStations: readStringArray(source.transferStations),
    hasExpress: readBoolean(source.hasExpress),
    walkingDistance: readNumber(source.walkingDistance),
    distance: readNumber(source.distance),
    lineIds: readStringArray(source.lineIds),
    reliability: readNumber(source.reliability),
    lastVerified: isTimestampRecord(source.lastVerified) ? convertTimestampToDate(source.lastVerified) : toFallbackDate(),
    isActive: readBoolean(source.isActive, true),
    createdAt: isTimestampRecord(source.createdAt) ? convertTimestampToDate(source.createdAt) : toFallbackDate(),
    updatedAt: isTimestampRecord(source.updatedAt) ? convertTimestampToDate(source.updatedAt) : toFallbackDate(),
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

function convertExpressTrain(data: unknown, docId?: string): ExpressTrain {
  const source = asRecord(data);
  return {
    expressId: readString(source.expressId, docId ?? ''),
    lineId: readString(source.lineId),
    lineName: readString(source.lineName),
    type: (readString(source.type) as ExpressTrain['type']) || 'express',
    typeName: readString(source.typeName),
    operatingDays: Array.isArray(source.operatingDays)
      ? source.operatingDays.filter((day): day is number => typeof day === 'number')
      : [],
    firstTrain: readString(source.firstTrain),
    lastTrain: readString(source.lastTrain),
    rushHourMorningInterval: readNumber(source.rushHourMorningInterval),
    rushHourEveningInterval: readNumber(source.rushHourEveningInterval),
    daytimeInterval: readNumber(source.daytimeInterval),
    nightInterval: readNumber(source.nightInterval),
    stops: readStringArray(source.stops),
    avgSpeed: readNumber(source.avgSpeed),
    timeSavings: readNumberMap(source.timeSavings),
    isActive: readBoolean(source.isActive, true),
    seasonStart: isTimestampRecord(source.seasonStart) ? convertTimestampToDate(source.seasonStart) : undefined,
    seasonEnd: isTimestampRecord(source.seasonEnd) ? convertTimestampToDate(source.seasonEnd) : undefined,
    createdAt: isTimestampRecord(source.createdAt) ? convertTimestampToDate(source.createdAt) : toFallbackDate(),
    updatedAt: isTimestampRecord(source.updatedAt) ? convertTimestampToDate(source.updatedAt) : toFallbackDate(),
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

    if (!docSnapshot.exists()) {
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
  const maxDetourTime = params?.scoring.travelTime.acceptableMargin ?? 300;

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

export function clearTravelTimeCache(): void {
  cache.clearPattern('^travelTime');
}

export function clearExpressTrainCache(): void {
  cache.clearPattern('^expressTrain');
}
