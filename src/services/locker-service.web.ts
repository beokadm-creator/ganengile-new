// Web platform implementation with full KRIC fetch support
export * from './locker-service';

// Force inclusion of fetch-based functions by providing web implementation
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Locker,
  LockerAvailability,
  LockerOperator,
  LockerReservation,
  LockerSize,
  LockerStatus,
  LockerType,
} from '../types/locker';
import { getStationConfig } from './config-service';

const LOCKERS_COLLECTION = 'lockers';
const RESERVATIONS_COLLECTION = 'locker_reservations';
const KRIC_LOCKER_API_URL = 'https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker';
const KRIC_SERVICE_KEY = '$2a$10$FFLcKck5QPIznLD7KVsF9.8SrXglQowjj5w8P4FY0bTGwH5G.EZim';
const KRIC_RAIL_OPR_ISTT_CD = 'S1';

type UnknownRecord = Record<string, unknown>;

type ExternalLockerPayload = UnknownRecord & {
  response?: {
    body?: {
      items?: {
        item?: unknown;
      };
    };
  };
  body?: {
    items?: {
      item?: unknown;
    };
  } | unknown[];
  items?: unknown;
  item?: unknown;
  stationLocker?: unknown;
};

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

function readString(record: UnknownRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function readNumber(record: UnknownRecord, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toDate(value: Timestamp | Date | string | number | undefined): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

function normalizeLockerSize(value?: string): LockerSize {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('소')) return LockerSize.SMALL;
  if (normalized.includes('대')) return LockerSize.LARGE;
  if (normalized.includes('중')) return LockerSize.MEDIUM;
  if (normalized.includes('small')) return LockerSize.SMALL;
  if (normalized.includes('large')) return LockerSize.LARGE;
  return LockerSize.MEDIUM;
}

function normalizeLockerStatus(value?: string): LockerStatus {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('occupied') || normalized.includes('busy') || normalized.includes('in_use')) {
    return LockerStatus.OCCUPIED;
  }
  if (normalized.includes('maintenance') ?? normalized.includes('broken')) {
    return LockerStatus.MAINTENANCE;
  }
  return LockerStatus.AVAILABLE;
}

function normalizeOperator(value?: string): LockerOperator {
  if (!value) return LockerOperator.SEOUL_METRO;
  const normalized = value.toLowerCase();
  if (normalized === 'k1') return LockerOperator.KORAIL;
  if (['i1', 'd1', 'b1', 'g1'].includes(normalized)) return LockerOperator.LOCAL_GOV;
  if (normalized === 's1') return LockerOperator.SEOUL_METRO;
  switch (normalized) {
    case LockerOperator.KORAIL:
    case LockerOperator.LOCAL_GOV:
    case LockerOperator.CU:
    case LockerOperator.GS25:
    case LockerOperator.LOCKER_BOX:
      return normalized as LockerOperator;
    default:
      return LockerOperator.SEOUL_METRO;
  }
}

function buildAvailability(total: number, occupied: number, available: number): LockerAvailability {
  return {
    total: total > 0 ? total : Math.max(available + occupied, 1),
    occupied: occupied >= 0 ? occupied : 0,
    available: available >= 0 ? available : 0,
  };
}

async function fetchKricLockers(stationId?: string): Promise<Locker[]> {
  if (!stationId) {
    return [];
  }

  try {
    const stationConfig = (await getStationConfig(stationId)) as {
      stationName?: string;
      kric?: {
        lineCode?: string;
        stationCode?: string;
        railOprIsttCd?: string;
      };
      lines?: Array<{ lineCode?: string }>;
      location?: {
        latitude?: number;
        longitude?: number;
      };
    } | null;
    
    const lineCode = stationConfig?.kric?.lineCode ?? stationConfig?.lines?.[0]?.lineCode ?? '';
    const stationCode = stationConfig?.kric?.stationCode ?? stationId;
    const railCode = stationConfig?.kric?.railOprIsttCd ?? KRIC_RAIL_OPR_ISTT_CD;

    if (!lineCode || !stationCode) {
      return [];
    }

    const queryString = `?serviceKey=${KRIC_SERVICE_KEY}&format=json&railOprIsttCd=${railCode}&lnCd=${lineCode}&stinCd=${stationCode}`;
    const fullUrl = KRIC_LOCKER_API_URL + queryString;

    const response = await fetch(fullUrl);
    if (!response.ok) {
      return [];
    }

    const text = await response.text();
    let payload: ExternalLockerPayload;
    try {
      payload = JSON.parse(text) as ExternalLockerPayload;
    } catch {
      return [];
    }

    const body = (payload as UnknownRecord).body;
    const rawItems =
      payload.response?.body?.items?.item ??
      (typeof payload.body === 'object' && payload.body !== null && !Array.isArray(payload.body) && 'items' in payload.body
        ? (payload.body as { items?: { item?: unknown } }).items?.item
        : undefined) ??
      (Array.isArray(body) ? body : undefined) ??
      payload.items ??
      payload.item ??
      payload.stationLocker ??
      [];

    const stationName = stationConfig?.stationName ?? '';
    const lat = stationConfig?.location?.latitude;
    const lng = stationConfig?.location?.longitude;

    return toArray(rawItems)
      .map((item, index) => {
        const record = asRecord(item);
        const facilityCount = readNumber(record, 'faclNum') ?? 1;
        const baseFare = readNumber(record, 'utlFare') ?? 0;
        const line = readString(record, 'lnCd');
        const floorNum = readNumber(record, 'stinFlor') ?? 1;
        const isUnderground = readString(record, 'grndDvNm') === '지하';
        const operatorCode = readString(record, 'railOprIsttCd');

        return {
          lockerId: `${stationCode}-${index + 1}`,
          type: LockerType.PUBLIC,
          operator: normalizeOperator(operatorCode),
          location: {
            stationId: stationCode,
            stationName,
            line: line ? `${line}호선` : '',
            floor: isUnderground ? -floorNum : floorNum,
            section: readString(record, 'dtlLoc') ?? `보관함 ${index + 1}`,
            latitude: lat,
            longitude: lng,
            address: '',
            contactPhone: readString(record, 'telNo'),
            nearby: false,
          },
          size: normalizeLockerSize(readString(record, 'szNm')),
          pricing: {
            base: baseFare,
            baseDuration: 240,
            extension: 0,
          },
          availability: buildAvailability(facilityCount, 0, facilityCount),
          status: LockerStatus.AVAILABLE,
          qrCode: '',
          accessMethod: 'qr',
          isSubway: true,
        } satisfies Locker;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function fetchKricLockersForStations(stationIds: string[]): Promise<Locker[]> {
  const MAX_STATIONS = 15;
  const limitedIds = stationIds.slice(0, MAX_STATIONS);

  const results = await Promise.all(
    limitedIds.map(async (stationId) => {
      try {
        return await fetchKricLockers(stationId);
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}

async function fetchExternalLockers(stationId?: string): Promise<Locker[]> {
  const kricLockers = await fetchKricLockers(stationId);
  if (kricLockers.length > 0) {
    return kricLockers;
  }
  return [];
}
