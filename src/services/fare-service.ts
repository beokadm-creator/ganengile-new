/**
 * Fare Service
 * 서울교통공사 실시간 운임 정보 조회
 */

import {
  Timestamp,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

type FareResponseItem = Record<string, any>;

export interface FareResult {
  fare?: number;
  raw?: FareResponseItem;
}

const FARE_API_URL =
  process.env.EXPO_PUBLIC_SEOUL_FARE_API_URL ||
  'http://openapi.seoul.go.kr:8088';
const FARE_SERVICE_KEY = process.env.EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY || '';
const STRICT_CACHE_ONLY = process.env.EXPO_PUBLIC_SEOUL_FARE_CACHE_ONLY !== 'false';
const CACHE_MAX_AGE_DAYS = 7;
const DEFAULT_SELECT_FIELDS = [
  'gnrlCardFare',
  'gnrlCashFare',
  'yungCardFare',
  'yungCashFare',
  'childCardFare',
  'childCashFare',
].join(',');

function normalizeItems(payload: any): FareResponseItem[] {
  const candidates =
    payload?.getRltmFare?.row ||
    payload?.getRltmFare ||
    payload?.response?.body?.items?.item ||
    payload?.body?.items?.item ||
    payload?.row ||
    payload?.items ||
    [];
  const items = Array.isArray(candidates) ? candidates : [candidates];
  return items.filter(Boolean);
}

function getEncodedServiceKey(key: string): string {
  if (!key) return '';
  return key.includes('%') ? key : encodeURIComponent(key);
}

function extractFare(
  items: FareResponseItem[],
  departureStationCode?: string,
  arrivalStationCode?: string
): FareResult | null {
  if (!items || items.length === 0) return null;

  const exactMatch = items.find(
    (it) =>
      String(it?.dptreStnCd || '') === String(departureStationCode || '') &&
      String(it?.arvlStnCd || '') === String(arrivalStationCode || '')
  );
  const item = exactMatch || items[0];
  const candidates = [
    item?.gnrlCardFare,
    item?.gnrlCashFare,
    item?.yungCardFare,
    item?.yungCashFare,
    item?.fare,
  ];

  const fareValue = candidates
    .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
    .find((v) => typeof v === 'number' && !Number.isNaN(v) && v > 0);

  return { fare: fareValue, raw: item };
}

function getFareDocId(departureStationCode: string, arrivalStationCode: string): string {
  return `${departureStationCode}_${arrivalStationCode}`;
}

function isCacheFresh(updatedAt: Date | Timestamp | undefined): boolean {
  if (!updatedAt) return false;
  const date = updatedAt instanceof Timestamp ? updatedAt.toDate() : updatedAt;
  const ageMs = Date.now() - date.getTime();
  return ageMs <= CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

async function getCachedFare(
  departureStationCode: string,
  arrivalStationCode: string
): Promise<FareResult | null> {
  try {
    let staleCandidate: { fare: number; raw?: FareResponseItem; updatedAtMs: number } | null = null;

    const directRef = doc(db, 'config_fares', getFareDocId(departureStationCode, arrivalStationCode));
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      const data = directSnap.data() as any;
      if (isCacheFresh(data.updatedAt) && typeof data.fare === 'number' && data.fare > 0) {
        return { fare: data.fare, raw: data.raw };
      }
      if (typeof data.fare === 'number' && data.fare > 0) {
        const updatedAtMs = data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;
        staleCandidate = { fare: data.fare, raw: data.raw, updatedAtMs };
      }
    }

    // 운임은 대체로 대칭이므로 역방향 캐시도 fallback으로 사용
    const reverseRef = doc(db, 'config_fares', getFareDocId(arrivalStationCode, departureStationCode));
    const reverseSnap = await getDoc(reverseRef);
    if (reverseSnap.exists()) {
      const data = reverseSnap.data() as any;
      if (isCacheFresh(data.updatedAt) && typeof data.fare === 'number' && data.fare > 0) {
        return { fare: data.fare, raw: data.raw };
      }
      if (typeof data.fare === 'number' && data.fare > 0) {
        const updatedAtMs = data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;
        if (!staleCandidate || updatedAtMs > staleCandidate.updatedAtMs) {
          staleCandidate = { fare: data.fare, raw: data.raw, updatedAtMs };
        }
      }
    }

    if (staleCandidate) {
      return { fare: staleCandidate.fare, raw: staleCandidate.raw };
    }
  } catch (error) {
    console.warn('Fare cache read failed:', error);
  }
  return null;
}

async function upsertFareCache(
  departureStationCode: string,
  arrivalStationCode: string,
  fareResult: FareResult
): Promise<void> {
  try {
    if (!fareResult?.fare || fareResult.fare <= 0) return;
    const ref = doc(db, 'config_fares', getFareDocId(departureStationCode, arrivalStationCode));
    await setDoc(ref, {
      departureStationCode,
      arrivalStationCode,
      fare: fareResult.fare,
      raw: fareResult.raw || null,
      source: 'realtime_api',
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn('Fare cache write failed:', error);
  }
}

export async function getRealtimeFare(
  departureStationCode: string,
  arrivalStationCode: string
): Promise<FareResult | null> {
  if (!FARE_SERVICE_KEY) {
    return null;
  }
  if (!departureStationCode || !arrivalStationCode) {
    return null;
  }

  const cached = await getCachedFare(departureStationCode, arrivalStationCode);
  if (cached) return cached;
  if (STRICT_CACHE_ONLY) return null;

  try {
    const base = FARE_API_URL.replace(/\/$/, '');
    const isDataGoKr = base.includes('apis.data.go.kr');
    let finalUrl = '';
    if (isDataGoKr) {
      const params = new URLSearchParams({
        serviceKey: getEncodedServiceKey(FARE_SERVICE_KEY),
        dataType: 'JSON',
        dptreStnCd: departureStationCode,
        arvlStnCd: arrivalStationCode,
        selectFields: DEFAULT_SELECT_FIELDS,
      });
      finalUrl = `${base}/getRltmFare?${params.toString()}`;
    } else {
      // 서울시 OpenAPI 포맷: /{KEY}/{TYPE}/{SERVICE}/{START}/{END}/{dptre}/{dptreNm}/{arvl}/{arvlNm}/{selectFields}
      const type = 'json';
      const startIndex = 1;
      const endIndex = 5;
      const service = 'getRltmFare';
      const empty = encodeURIComponent(' ');
      const selectFields = encodeURIComponent(DEFAULT_SELECT_FIELDS);
      finalUrl = `${base}/${FARE_SERVICE_KEY}/${type}/${service}/${startIndex}/${endIndex}/${departureStationCode}/${empty}/${arrivalStationCode}/${empty}/${selectFields}`;
    }

    const res = await fetch(finalUrl);
    if (!res.ok) {
      return null;
    }
    const text = await res.text();

    try {
      const data = JSON.parse(text);
      const list = normalizeItems(data);
      const fareResult = extractFare(list, departureStationCode, arrivalStationCode);
      if (fareResult?.fare) {
        void upsertFareCache(departureStationCode, arrivalStationCode, fareResult);
      }
      return fareResult;
    } catch {
      // XML fallback (very small parsing)
      const match = text.match(/<gnrlCardFare>(\d+)<\/gnrlCardFare>/);
      const fareValue = match ? parseInt(match[1], 10) : undefined;
      if (fareValue) {
        const fareResult = { fare: fareValue, raw: { gnrlCardFare: fareValue } };
        void upsertFareCache(departureStationCode, arrivalStationCode, fareResult);
        return fareResult;
      }
      return null;
    }
  } catch (error) {
    console.error('Fare API fetch failed:', error);
    return null;
  }
}
