import { db, doc, getDoc, getDocs, query, where, collection } from './config-utils';
import type { Station } from './config-utils';
import {
  cache,
  convertDocument,
  asRecord,
  readString,
  readBoolean,
  readNumber,
  isRecord,
  isTimestampRecord,
  convertTimestampToDate,
  toFallbackDate,
  normalizeStationLines,
  normalizeStationLocation,
  deduplicateStations,
  mergeSupplementalStations,
  buildSupplementalFallbackStations,
  getFallbackStations,
} from './config-utils';

function convertStation(data: unknown, docId?: string): Station {
  const source = asRecord(data);
  const facilities = asRecord(source.facilities);
  const stationId = readString(source.stationId, readString(source.id, docId ?? ''));
  const stationName = readString(source.stationName, readString(source.name));

  return {
    stationId,
    stationName,
    stationNameEnglish: readString(source.stationNameEnglish, readString(source.nameEnglish)),
    lines: normalizeStationLines(source.lines),
    location: normalizeStationLocation(source.location, stationId, stationName),
    isTransferStation: readBoolean(source.isTransferStation),
    isExpressStop: readBoolean(source.isExpressStop),
    isTerminus: readBoolean(source.isTerminus),
    facilities: {
      hasElevator: readBoolean(facilities.hasElevator),
      hasEscalator: readBoolean(facilities.hasEscalator),
      wheelchairAccessible: readBoolean(facilities.wheelchairAccessible),
    },
    isActive: source.isActive !== false,
    region: readString(source.region, 'seoul'),
    priority: readNumber(source.priority, 999),
    kric: isRecord(source.kric)
      ? {
          stationCode: readString(source.kric.stationCode),
          lineCode: readString(source.kric.lineCode),
          railOprIsttCd: readString(source.kric.railOprIsttCd),
        }
      : undefined,
    fare: isRecord(source.fare)
      ? {
          stationCode: readString(source.fare.stationCode),
        }
      : undefined,
    createdAt: isTimestampRecord(source.createdAt) ? convertTimestampToDate(source.createdAt) : toFallbackDate(),
    updatedAt: isTimestampRecord(source.updatedAt) ? convertTimestampToDate(source.updatedAt) : toFallbackDate(),
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

    if (!docSnapshot.exists()) {
      const fallbackStations = buildSupplementalFallbackStations();
      const fallback = fallbackStations.find(s => s.stationId === stationId);
      if (fallback) {
        cache.set(cacheKey, fallback);
        return fallback;
      }
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
