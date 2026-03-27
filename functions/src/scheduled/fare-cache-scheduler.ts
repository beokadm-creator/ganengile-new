/**
 * Weekly Fare Cache Scheduler
 *
 * 목적:
 * - 실시간 운임 API 의존도를 낮추기 위해 Firestore(config_fares)에 운임을 주기적으로 적재
 * - 앱은 캐시 우선 조회로 안정적인 운임 표시
 */

import * as admin from 'firebase-admin';
import * as https from 'https';
import { defineString } from 'firebase-functions/params';

type FareApiItem = Record<string, any>;

interface SchedulerResult {
  processedRoutes: number;
  updatedRoutes: number;
  skippedRoutes: number;
  failedRoutes: number;
  missingMappingRoutes: number;
  sourceSummary?: {
    travelTimePairs: number;
    requestPairs: number;
    routePairs: number;
  };
}

type StationDoc = {
  stationName?: string;
  lines?: Array<{
    lineName?: string;
    lineNumber?: string | number;
    lineCode?: string;
  }>;
  fare?: { stationCode?: string };
  kric?: { stationCode?: string };
};

const DEFAULT_FARE_API_URL = 'https://apis.data.go.kr/B553766/fare';
const CACHE_DOC_COLLECTION = 'config_fares';
const STALE_DAYS_FOR_SKIP = 6; // 주간 배치 기준으로 6일 이내 갱신 데이터는 스킵
const SEOUL_FARE_API_URL_PARAM = defineString('SEOUL_FARE_API_URL', {
  default: DEFAULT_FARE_API_URL,
});
const SEOUL_FARE_SERVICE_KEY_PARAM = defineString('SEOUL_FARE_SERVICE_KEY', {
  default: '',
});

function getFareApiBaseUrl(): string {
  const paramValue = SEOUL_FARE_API_URL_PARAM.value();
  return (
    paramValue ||
    process.env.SEOUL_FARE_API_URL ||
    process.env.EXPO_PUBLIC_SEOUL_FARE_API_URL ||
    DEFAULT_FARE_API_URL
  ).replace(/\/$/, '');
}

function getFareServiceKey(): string {
  const paramValue = SEOUL_FARE_SERVICE_KEY_PARAM.value();
  return (
    paramValue ||
    process.env.SEOUL_FARE_SERVICE_KEY ||
    process.env.EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY ||
    ''
  ).trim();
}

function normalizeServiceKey(rawKey: string): string {
  if (!rawKey) return '';
  if (!rawKey.includes('%')) return rawKey;
  try {
    return decodeURIComponent(rawKey);
  } catch {
    return rawKey;
  }
}

function normalizeItems(payload: any): FareApiItem[] {
  const candidates =
    payload?.response?.body?.items?.item ||
    payload?.body?.items?.item ||
    payload?.getRltmFare?.row ||
    payload?.row ||
    payload?.items ||
    [];
  const items = Array.isArray(candidates) ? candidates : [candidates];
  return items.filter(Boolean);
}

function parseFareFromItems(items: FareApiItem[]): { fare?: number; raw?: FareApiItem } {
  if (!items.length) return {};
  const item = items[0];
  const fareCandidates = [
    item?.gnrlCardFare,
    item?.gnrlCashFare,
    item?.yungCardFare,
    item?.yungCashFare,
  ];
  const fare = fareCandidates
    .map((value) => (typeof value === 'string' ? parseInt(value, 10) : value))
    .find((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return { fare, raw: item };
}

function requestJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode ?? 0}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`JSON parse failed: ${String(error)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error('Timeout while calling fare API'));
    });
  });
}

function buildFareUrl(
  baseUrl: string,
  serviceKey: string,
  departureStationCode: string,
  arrivalStationCode: string
): string {
  const params = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    dataType: 'JSON',
    numOfRows: '1',
    pageNo: '1',
    dptreStnCd: departureStationCode,
    avrlStnCd: arrivalStationCode,
    selectFields: 'gnrlCardFare,gnrlCashFare,mvmnDstc,dptreStnCd,arvlStnCd',
  });
  return `${baseUrl}/getRltmFare?${params.toString()}`;
}

function getCacheDocId(fromCode: string, toCode: string): string {
  return `${fromCode}_${toCode}`;
}

function safeNameKey(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, ''));
}

function getNameCacheDocId(fromName: string, toName: string): string {
  return `nm_${safeNameKey(fromName)}_${safeNameKey(toName)}`;
}

function shouldSkipByUpdatedAt(updatedAt: admin.firestore.Timestamp | null | undefined): boolean {
  if (!updatedAt) return false;
  const ageMs = Date.now() - updatedAt.toMillis();
  return ageMs <= STALE_DAYS_FOR_SKIP * 24 * 60 * 60 * 1000;
}

export const fareCacheScheduler = async (): Promise<SchedulerResult> => {
  const serviceKey = getFareServiceKey();
  if (!serviceKey) {
    throw new Error('SEOUL_FARE_SERVICE_KEY is missing. Set function env before running scheduler.');
  }

  const db = admin.firestore();
  const baseUrl = getFareApiBaseUrl();

  const result: SchedulerResult = {
    processedRoutes: 0,
    updatedRoutes: 0,
    skippedRoutes: 0,
    failedRoutes: 0,
    missingMappingRoutes: 0,
    sourceSummary: {
      travelTimePairs: 0,
      requestPairs: 0,
      routePairs: 0,
    },
  };

  console.warn('🚇 [Fare Cache Scheduler] started');

  const [stationsSnapshot, travelTimesSnapshot] = await Promise.all([
    db.collection('config_stations').where('isActive', '==', true).get(),
    db.collection('config_travel_times').where('isActive', '==', true).get(),
  ]);

  const stationFareCodeMap = new Map<string, string>();
  const stationById = new Map<string, StationDoc>();
  const stationIdsByName = new Map<string, string[]>();
  const stationIdByNameLine = new Map<string, string>();

  const normalizeName = (value: string): string => value.replace(/\s+/g, '').trim();
  const normalizeLine = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text) return '';
    const numeric = text.replace(/[^\d]/g, '');
    if (numeric) return numeric;
    return text.replace(/\s+/g, '').toLowerCase();
  };

  const setStationNameIndex = (name: string, stationId: string): void => {
    const key = normalizeName(name);
    if (!key) return;
    const prev = stationIdsByName.get(key) || [];
    if (!prev.includes(stationId)) {
      prev.push(stationId);
      stationIdsByName.set(key, prev);
    }
  };

  const setStationLineIndex = (name: string, line: unknown, stationId: string): void => {
    const nameKey = normalizeName(name);
    const lineKey = normalizeLine(line);
    if (!nameKey || !lineKey) return;
    stationIdByNameLine.set(`${nameKey}::${lineKey}`, stationId);
  };

  stationsSnapshot.docs.forEach((docSnap) => {
    const station = docSnap.data() as StationDoc;
    stationById.set(docSnap.id, station);

    if (station.stationName) {
      setStationNameIndex(station.stationName, docSnap.id);
      const lines = Array.isArray(station.lines) ? station.lines : [];
      lines.forEach((line) => {
        setStationLineIndex(station.stationName || '', line?.lineNumber, docSnap.id);
        setStationLineIndex(station.stationName || '', line?.lineCode, docSnap.id);
        setStationLineIndex(station.stationName || '', line?.lineName, docSnap.id);
      });
    }

    const fareCode = station?.fare?.stationCode || station?.kric?.stationCode || '';
    if (fareCode) {
      stationFareCodeMap.set(docSnap.id, String(fareCode));
    }
  });

  const routePairs = new Map<string, { fromStationId: string; toStationId: string }>();
  const resolveStationId = (input: any): string | null => {
    if (!input) return null;

    if (typeof input === 'string') {
      const raw = input.trim();
      if (!raw) return null;
      if (stationById.has(raw)) return raw;
      const byName = stationIdsByName.get(normalizeName(raw));
      if (!byName || byName.length === 0) return null;
      if (byName.length === 1) return byName[0];
      return byName[0];
    }

    const candidateId = String(input.stationId || input.id || '').trim();
    if (candidateId && stationById.has(candidateId)) return candidateId;

    const stationName = String(input.stationName || input.name || '').trim();
    if (!stationName) return null;

    const lineCandidate =
      input.lineCode ||
      input.lineNumber ||
      input.lineId ||
      input.line ||
      input.lineName ||
      '';

    const byLineId = stationIdByNameLine.get(`${normalizeName(stationName)}::${normalizeLine(lineCandidate)}`);
    if (byLineId) return byLineId;

    const byName = stationIdsByName.get(normalizeName(stationName));
    if (!byName || byName.length === 0) return null;
    if (byName.length === 1) return byName[0];
    return byName[0];
  };

  const addRoutePair = (fromInput: any, toInput: any, source?: 'travel' | 'request' | 'route') => {
    const from = resolveStationId(fromInput) || '';
    const to = resolveStationId(toInput) || '';
    if (!from || !to || from === to) return;
    const routeKey = `${from}__${to}`;
    if (!routePairs.has(routeKey)) {
      routePairs.set(routeKey, { fromStationId: from, toStationId: to });
      if (source === 'travel' && result.sourceSummary) result.sourceSummary.travelTimePairs += 1;
      if (source === 'request' && result.sourceSummary) result.sourceSummary.requestPairs += 1;
      if (source === 'route' && result.sourceSummary) result.sourceSummary.routePairs += 1;
    }
  };

  travelTimesSnapshot.docs.forEach((docSnap) => {
    const item = docSnap.data() as any;
    addRoutePair(item?.fromStationId, item?.toStationId, 'travel');
  });

  // config_travel_times가 없는 운영 환경을 위해 최근 요청/경로에서 역쌍을 수집
  if (routePairs.size === 0) {
    const [requestsSnapshot, routesSnapshot] = await Promise.all([
      db.collection('requests').limit(5000).get(),
      db.collection('routes').where('isActive', '==', true).limit(2000).get(),
    ]);

    requestsSnapshot.docs.forEach((docSnap) => {
      const req = docSnap.data() as any;
      addRoutePair(req?.pickupStation, req?.deliveryStation, 'request');
      addRoutePair(req?.deliveryStation, req?.pickupStation, 'request');
    });

    routesSnapshot.docs.forEach((docSnap) => {
      const route = docSnap.data() as any;
      addRoutePair(route?.startStation, route?.endStation, 'route');
      addRoutePair(route?.endStation, route?.startStation, 'route');
    });
  }

  for (const route of routePairs.values()) {
    result.processedRoutes += 1;

    const fromCode = stationFareCodeMap.get(route.fromStationId);
    const toCode = stationFareCodeMap.get(route.toStationId);
    if (!fromCode || !toCode) {
      result.missingMappingRoutes += 1;
      continue;
    }

    const fareDocId = getCacheDocId(fromCode, toCode);
    try {
      const existingSnap = await db.collection(CACHE_DOC_COLLECTION).doc(fareDocId).get();
      if (existingSnap.exists) {
        const existing = existingSnap.data() as any;
        if (shouldSkipByUpdatedAt(existing?.updatedAt ?? null)) {
          result.skippedRoutes += 1;
          continue;
        }
      }

      const url = buildFareUrl(baseUrl, serviceKey, fromCode, toCode);
      const payload = await requestJson(url);
      const parsed = parseFareFromItems(normalizeItems(payload));

      if (!parsed.fare || parsed.fare <= 0) {
        result.failedRoutes += 1;
        continue;
      }

      const codeDocData = {
        departureStationCode: fromCode,
        arrivalStationCode: toCode,
        departureStationId: route.fromStationId,
        arrivalStationId: route.toStationId,
        fare: parsed.fare,
        raw: parsed.raw || null,
        source: 'weekly_batch',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection(CACHE_DOC_COLLECTION).doc(fareDocId).set(codeDocData, { merge: true });

      // Also save name-based key so getCachedFareByName() fallback can succeed
      const fromStation = stationById.get(route.fromStationId);
      const toStation = stationById.get(route.toStationId);
      if (fromStation?.stationName && toStation?.stationName) {
        const nameDocId = getNameCacheDocId(fromStation.stationName, toStation.stationName);
        await db.collection(CACHE_DOC_COLLECTION).doc(nameDocId).set({
          departureStationName: fromStation.stationName,
          arrivalStationName: toStation.stationName,
          departureStationCode: fromCode,
          arrivalStationCode: toCode,
          fare: parsed.fare,
          raw: parsed.raw || null,
          source: 'weekly_batch',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      result.updatedRoutes += 1;
    } catch (error) {
      result.failedRoutes += 1;
      console.error(
        `❌ [Fare Cache Scheduler] failed route ${route.fromStationId} -> ${route.toStationId}:`,
        error
      );
    }
  }

  console.warn('✅ [Fare Cache Scheduler] completed:', result);
  return result;
};
