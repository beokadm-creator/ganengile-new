/**
 * Fare Service
 * 서울교통공사 실시간 운임 정보 조회
 */

type FareResponseItem = Record<string, any>;

export interface FareResult {
  fare?: number;
  raw?: FareResponseItem;
}

const FARE_API_URL =
  process.env.EXPO_PUBLIC_SEOUL_FARE_API_URL ||
  'http://openapi.seoul.go.kr:8088';
const FARE_SERVICE_KEY = process.env.EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY || '';
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

function extractFare(items: FareResponseItem[]): FareResult | null {
  if (!items || items.length === 0) return null;

  const item = items[0];
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

  try {
    const base = FARE_API_URL.replace(/\/$/, '');
    const isDataGoKr = base.includes('apis.data.go.kr');
    let finalUrl = '';
    if (isDataGoKr) {
      const params = new URLSearchParams({
        serviceKey: getEncodedServiceKey(FARE_SERVICE_KEY),
        dataType: 'JSON',
        dptreStnCd: departureStationCode,
        avrlStnCd: arrivalStationCode,
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
      return extractFare(list);
    } catch {
      // XML fallback (very small parsing)
      const match = text.match(/<gnrlCardFare>(\d+)<\/gnrlCardFare>/);
      const fareValue = match ? parseInt(match[1], 10) : undefined;
      if (fareValue) {
        return { fare: fareValue, raw: { gnrlCardFare: fareValue } };
      }
      return null;
    }
  } catch (error) {
    console.error('Fare API fetch failed:', error);
    return null;
  }
}
