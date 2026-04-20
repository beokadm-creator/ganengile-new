import * as functions from 'firebase-functions';
import * as https from 'https';
import { defineString, defineSecret } from 'firebase-functions/params';

// ---------------------------------------------------------------------------
// Naver Map / Juso API secrets & params
// ---------------------------------------------------------------------------

const NAVER_MAP_CLIENT_ID_SECRET = defineSecret('NAVER_MAP_CLIENT_ID');
const NAVER_MAP_CLIENT_SECRET_SECRET = defineSecret('NAVER_MAP_CLIENT_SECRET');
const JUSO_API_KEY_PARAM = defineString('JUSO_API_KEY', { default: '' });

// ---------------------------------------------------------------------------
// Shared pure helpers (duplicated from index.ts — each CF instance is isolated)
// ---------------------------------------------------------------------------

function readFirstQueryValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return '';
}

function readPositiveInteger(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getFirstNonEmptyString(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';
}

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per IP + endpoint key)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  ip: string,
  key: string,
  maxRequests: number,
  windowSeconds: number
): boolean {
  const now = Date.now();
  const limitKey = `${ip}:${key}`;
  const record = rateLimitMap.get(limitKey);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(limitKey, { count: 1, resetTime: now + windowSeconds * 1000 });
    return false; // under limit
  }

  if (record.count >= maxRequests) {
    return true; // over limit
  }

  record.count++;
  return false; // under limit
}

function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  return req.ip || (typeof req.headers?.['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : 'unknown');
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

function buildNaverStaticMapUrl(query: {
  center: string;
  level: string;
  width: string;
  height: string;
  scale: string;
  markers?: string;
  path?: string;
}): string {
  const params = new URLSearchParams({
    center: query.center,
    level: query.level,
    w: query.width,
    h: query.height,
    scale: query.scale,
  });

  if (query.markers) {
    params.set('markers', query.markers);
  }

  if (query.path) {
    params.set('path', query.path);
  }

  return `https://maps.apigw.ntruss.com/map-static/v2/raster?${params.toString()}`;
}

function buildNaverGeocodeUrl(query: { address: string }): string {
  const params = new URLSearchParams({
    query: query.address,
  });

  return `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?${params.toString()}`;
}

function buildNaverReverseGeocodeUrl(query: { coords: string }): string {
  const params = new URLSearchParams({
    coords: query.coords,
    output: 'json',
  });

  return `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?${params.toString()}`;
}

function buildNaverDirectionsUrl(query: {
  start: string;
  goal: string;
  option?: string;
}): string {
  const params = new URLSearchParams({
    start: query.start,
    goal: query.goal,
    option: query.option ?? 'trafast',
  });

  return `https://maps.apigw.ntruss.com/map-direction/v1/driving?${params.toString()}`;
}

function buildJusoSearchUrl(query: {
  confmKey: string;
  keyword: string;
  currentPage: string;
  countPerPage: string;
}): string {
  const params = new URLSearchParams({
    confmKey: query.confmKey,
    keyword: query.keyword,
    currentPage: query.currentPage,
    countPerPage: query.countPerPage,
    resultType: 'json',
  });

  return `https://business.juso.go.kr/addrlink/addrLinkApi.do?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function fetchBinary(url: string, headers: Record<string, string>): Promise<{ statusCode: number; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        headers,
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 500,
            contentType: response.headers['content-type'] ?? 'image/png',
            body: Buffer.concat(chunks),
          });
        });
      }
    );

    request.on('error', reject);
    request.end();
  });
}

function fetchJson(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: options?.method ?? 'GET',
        headers: options?.headers,
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve(raw ? JSON.parse(raw) : {});
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }
    );

    request.on('error', reject);
    if (options?.body) {
      request.write(options.body);
    }
    request.end();
  });
}

// ---------------------------------------------------------------------------
// Cloud Functions
// ---------------------------------------------------------------------------

/**
 * HTTP: Naver static map proxy
 * Keeps the secret key on the server side while the app/web can request a rendered image.
 */
export const naverStaticMapProxy = functions
  .runWith({ secrets: [NAVER_MAP_CLIENT_ID_SECRET, NAVER_MAP_CLIENT_SECRET_SECRET] })
  .https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'naverStaticMapProxy', 10, 60)) {
    console.warn(`[rate-limit] naverStaticMapProxy blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    let clientId = '';
    let clientSecret = '';
    try {
      clientId = NAVER_MAP_CLIENT_ID_SECRET.value() || process.env.NAVER_MAP_CLIENT_ID || '';
      clientSecret = NAVER_MAP_CLIENT_SECRET_SECRET.value() || process.env.NAVER_MAP_CLIENT_SECRET || '';
    } catch (e) {
      console.warn('Failed to read Naver Map secrets, falling back to process.env', e);
      clientId = process.env.NAVER_MAP_CLIENT_ID || '';
      clientSecret = process.env.NAVER_MAP_CLIENT_SECRET || '';
    }

    if (!clientId || !clientSecret) {
      res.status(503).json({ ok: false, message: 'naver map credentials are not configured' });
      return;
    }

    const center = readFirstQueryValue(req.query.center);
    if (!center) {
      res.status(400).json({ ok: false, message: 'center is required' });
      return;
    }

    const level = String(readPositiveInteger(readFirstQueryValue(req.query.level), 14, 1, 18));
    const width = String(readPositiveInteger(readFirstQueryValue(req.query.w), 640, 64, 1280));
    const height = String(readPositiveInteger(readFirstQueryValue(req.query.h), 320, 64, 1280));
    const scale = String(readPositiveInteger(readFirstQueryValue(req.query.scale), 2, 1, 2));
    const markers = readFirstQueryValue(req.query.markers);
    const path = readFirstQueryValue(req.query.path);

    const naverUrl = buildNaverStaticMapUrl({
      center,
      level,
      width,
      height,
      scale,
      markers: markers ?? undefined,
      path: path ?? undefined,
    });

    const referer = req.get('Referer') || 'https://ganengile.web.app';

    const imageResponse = await fetchBinary(naverUrl, {
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
      'Referer': referer,
    });

    if (imageResponse.statusCode >= 400) {
      res.status(imageResponse.statusCode).send(imageResponse.body.toString('utf-8'));
      return;
    }

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.set('Content-Type', imageResponse.contentType);
    res.status(200).send(imageResponse.body);
  } catch (error) {
    console.error('naverStaticMapProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to render static map' });
  }
});

/**
 * HTTP: Naver geocode proxy
 * Converts a selected road address into latitude/longitude on the server side.
 */
export const naverGeocodeProxy = functions
  .runWith({ secrets: [NAVER_MAP_CLIENT_ID_SECRET, NAVER_MAP_CLIENT_SECRET_SECRET] })
  .https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'naverGeocodeProxy', 10, 60)) {
    console.warn(`[rate-limit] naverGeocodeProxy blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    let clientId = '';
    let clientSecret = '';
    try {
      clientId = NAVER_MAP_CLIENT_ID_SECRET.value() || process.env.NAVER_MAP_CLIENT_ID || '';
      clientSecret = NAVER_MAP_CLIENT_SECRET_SECRET.value() || process.env.NAVER_MAP_CLIENT_SECRET || '';
    } catch (e) {
      console.warn('Failed to read Naver Map secrets, falling back to process.env', e);
      clientId = process.env.NAVER_MAP_CLIENT_ID || '';
      clientSecret = process.env.NAVER_MAP_CLIENT_SECRET || '';
    }

    if (!clientId || !clientSecret) {
      res.status(503).json({ ok: false, message: 'naver map credentials are not configured' });
      return;
    }

    const address = readFirstQueryValue(req.query.query).trim();
    if (address.length < 2) {
      res.status(400).json({ ok: false, message: 'query is required' });
      return;
    }

    const referer = req.get('Referer') || 'https://ganengile.web.app';

    const naverUrl = buildNaverGeocodeUrl({ address });
    const payload = (await fetchJson(naverUrl, {
      headers: {
        Accept: 'application/json',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
        'Referer': referer,
      },
    })) as {
      status?: string;
      addresses?: Array<{
        roadAddress?: string;
        jibunAddress?: string;
        x?: string;
        y?: string;
      }>;
      errorMessage?: string;
    };

    if (payload.status !== 'OK') {
      res.status(502).json({ ok: false, message: payload.errorMessage ?? 'failed to geocode address' });
      return;
    }

    const first = payload.addresses?.[0];
    const longitude = Number(first?.x ?? 0);
    const latitude = Number(first?.y ?? 0);

    if (!first || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) {
      res.status(404).json({ ok: false, message: 'address coordinates not found' });
      return;
    }

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).json({
      ok: true,
      address: {
        roadAddress: first.roadAddress ?? address,
        jibunAddress: first.jibunAddress ?? '',
        latitude,
        longitude,
      },
    });
  } catch (error) {
    console.error('naverGeocodeProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to geocode address' });
  }
});

/**
 * HTTP: Naver reverse geocode proxy
 * Converts coordinates into a road address on the server side.
 */
export const naverReverseGeocodeProxy = functions
  .runWith({ secrets: [NAVER_MAP_CLIENT_ID_SECRET, NAVER_MAP_CLIENT_SECRET_SECRET] })
  .https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'naverReverseGeocodeProxy', 10, 60)) {
    console.warn(`[rate-limit] naverReverseGeocodeProxy blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    let clientId = '';
    let clientSecret = '';
    try {
      clientId = NAVER_MAP_CLIENT_ID_SECRET.value() || process.env.NAVER_MAP_CLIENT_ID || '';
      clientSecret = NAVER_MAP_CLIENT_SECRET_SECRET.value() || process.env.NAVER_MAP_CLIENT_SECRET || '';
    } catch (e) {
      console.warn('Failed to read Naver Map secrets, falling back to process.env', e);
      clientId = process.env.NAVER_MAP_CLIENT_ID || '';
      clientSecret = process.env.NAVER_MAP_CLIENT_SECRET || '';
    }

    if (!clientId || !clientSecret) {
      res.status(503).json({ ok: false, message: 'naver map credentials are not configured' });
      return;
    }

    const coords = readFirstQueryValue(req.query.coords).trim(); // e.g. "126.9783881,37.5666102"
    if (!coords) {
      res.status(400).json({ ok: false, message: 'coords is required' });
      return;
    }

    const referer = req.get('Referer') || 'https://ganengile.web.app';

    const naverUrl = buildNaverReverseGeocodeUrl({ coords });
    const payload = (await fetchJson(naverUrl, {
      headers: {
        Accept: 'application/json',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
        'Referer': referer,
      },
    })) as {
      status?: { code: number; name: string; message: string };
      results?: Array<{
        name: string;
        region: {
          area1?: { name: string };
          area2?: { name: string };
          area3?: { name: string };
          area4?: { name: string };
        };
        land?: {
          name?: string;
          number1?: string;
          number2?: string;
          addition0?: { value?: string };
        };
      }>;
    };

    if (payload.status?.code !== 0) {
      res.status(502).json({ ok: false, message: payload.status?.message ?? 'failed to reverse geocode' });
      return;
    }

    const result = payload.results?.[0];
    if (!result) {
      res.status(404).json({ ok: false, message: 'address not found for coordinates' });
      return;
    }

    // Build human readable address
    const region = result.region;
    const land = result.land;
    const parts = [
      region?.area1?.name,
      region?.area2?.name,
      region?.area3?.name,
      region?.area4?.name,
    ].filter(Boolean);

    if (result.name === 'roadaddr' && land) {
      // Road address format
      const roadName = land.name;
      const buildNum = land.number1;
      const subNum = land.number2 ? `-${land.number2}` : '';
      const bldgName = land.addition0?.value;
      if (roadName && buildNum) {
        parts.push(`${roadName} ${buildNum}${subNum}`);
        if (bldgName) {
          parts.push(`(${bldgName})`);
        }
      }
    } else if (land) {
      // Jibun address format
      const number1 = land.number1;
      const number2 = land.number2 ? `-${land.number2}` : '';
      if (number1) {
        parts.push(`${number1}${number2}`);
      }
    }

    const address = parts.join(' ').trim();

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).json({
      ok: true,
      address,
    });
  } catch (error) {
    console.error('naverReverseGeocodeProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to reverse geocode coordinates' });
  }
});

/**
 * HTTP: Naver directions proxy
 * Returns route coordinates between two points so the client can render an actual route line.
 */
export const naverDirectionsProxy = functions
  .runWith({ secrets: [NAVER_MAP_CLIENT_ID_SECRET, NAVER_MAP_CLIENT_SECRET_SECRET] })
  .https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'naverDirectionsProxy', 10, 60)) {
    console.warn(`[rate-limit] naverDirectionsProxy blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    let clientId = '';
    let clientSecret = '';
    try {
      clientId = NAVER_MAP_CLIENT_ID_SECRET.value() || process.env.NAVER_MAP_CLIENT_ID || '';
      clientSecret = NAVER_MAP_CLIENT_SECRET_SECRET.value() || process.env.NAVER_MAP_CLIENT_SECRET || '';
    } catch (e) {
      console.warn('Failed to read Naver Map secrets, falling back to process.env', e);
      clientId = process.env.NAVER_MAP_CLIENT_ID || '';
      clientSecret = process.env.NAVER_MAP_CLIENT_SECRET || '';
    }

    if (!clientId || !clientSecret) {
      res.status(503).json({ ok: false, message: 'naver map credentials are not configured' });
      return;
    }

    const start = readFirstQueryValue(req.query.start).trim();
    const goal = readFirstQueryValue(req.query.goal).trim();
    const option = readFirstQueryValue(req.query.option).trim() || 'trafast';

    if (!start || !goal) {
      res.status(400).json({ ok: false, message: 'start and goal are required' });
      return;
    }

    const referer = req.get('Referer') || 'https://ganengile.web.app';

    const directionsUrl = buildNaverDirectionsUrl({ start, goal, option });
    const payload = (await fetchJson(directionsUrl, {
      headers: {
        Accept: 'application/json',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
        'Referer': referer,
      },
    })) as {
      code?: number;
      message?: string;
      route?: Record<
        string,
        Array<{
          summary?: {
            distance?: number;
            duration?: number;
            tollFare?: number;
            taxiFare?: number;
            fuelPrice?: number;
          };
          path?: Array<[number, number]>;
        }>
      >;
    };

    const routeGroups = payload.route ?? {};
    const routeEntry = Object.values(routeGroups).find((items) => Array.isArray(items) && items.length > 0)?.[0];

    if (!routeEntry?.path || routeEntry.path.length === 0) {
      res.status(404).json({ ok: false, message: payload.message ?? 'route coordinates not found' });
      return;
    }

    const coordinates = routeEntry.path
      .map((point) => {
        const longitude = Number(point?.[0]);
        const latitude = Number(point?.[1]);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          latitude,
          longitude,
        };
      })
      .filter((point): point is { latitude: number; longitude: number } => point !== null);

    if (coordinates.length === 0) {
      res.status(404).json({ ok: false, message: 'route coordinates not found' });
      return;
    }

    res.set('Cache-Control', 'public, max-age=120, s-maxage=120');
    res.status(200).json({
      ok: true,
      route: {
        option,
        summary: {
          distanceMeters: Number(routeEntry.summary?.distance ?? 0),
          durationMs: Number(routeEntry.summary?.duration ?? 0),
          tollFare: Number(routeEntry.summary?.tollFare ?? 0),
          taxiFare: Number(routeEntry.summary?.taxiFare ?? 0),
          fuelPrice: Number(routeEntry.summary?.fuelPrice ?? 0),
        },
        coordinates,
      },
    });
  } catch (error) {
    console.error('naverDirectionsProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to fetch directions' });
  }
});

/**
 * HTTP: Road-name address search proxy for Juso API
 * Keeps the confirmation key on the server while the client searches by keyword.
 */
export const jusoAddressSearchProxy = functions.https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (checkRateLimit(ip, 'jusoAddressSearchProxy', 10, 60)) {
      console.warn(`[rate-limit] jusoAddressSearchProxy blocked for ip=${ip}`);
      res.status(429).json({ ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
      return;
    }

    const apiKey = getFirstNonEmptyString(JUSO_API_KEY_PARAM.value(), process.env.JUSO_API_KEY);
    if (!apiKey) {
      res.status(503).json({
        ok: false,
        message: 'JUSO API 키가 설정되지 않았습니다. Functions 환경변수(JUSO_API_KEY)를 설정해 주세요.',
      });
      return;
    }

    const keyword = readFirstQueryValue(req.query.keyword).trim();
    if (keyword.length < 2) {
      res.status(400).json({ ok: false, message: 'keyword must be at least 2 characters' });
      return;
    }

    const currentPage = String(readPositiveInteger(readFirstQueryValue(req.query.currentPage), 1, 1, 100));
    const countPerPage = String(readPositiveInteger(readFirstQueryValue(req.query.countPerPage), 10, 1, 100));

    const jusoUrl = buildJusoSearchUrl({
      confmKey: apiKey,
      keyword,
      currentPage,
      countPerPage,
    });

    const payload = await fetchJson(jusoUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).json(payload);
  } catch (error) {
    console.error('jusoAddressSearchProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to search road addresses' });
  }
});
