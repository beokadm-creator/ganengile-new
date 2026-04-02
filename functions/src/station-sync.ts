import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

type OfficialMasterRow = {
  stationCode: string;
  stationName: string;
  lineName: string;
  latitude: number;
  longitude: number;
};

type OfficialRecord = OfficialMasterRow & {
  frCode: string;
  lineId: string;
  region: string;
};

type FirestoreStationDoc = {
  id: string;
  ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
  data: FirebaseFirestore.DocumentData;
};

type CoordinatePoint = {
  latitude: number;
  longitude: number;
};

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'ganengile';
const SEOUL_API_KEY =
  process.env.SEOUL_SUBWAY_API_KEY ||
  process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY ||
  '4a57725a546d65743833756e765a6d';

function normalizeName(name: unknown): string {
  return String(name || '').replace(/\s+/g, '').trim();
}

function normalizeLineName(value: unknown): string {
  const raw = String(value || '').replace(/\s+/g, '').trim();
  if (!raw) {
    return '';
  }

  const digitMatch = raw.match(/^0?(\d+)호선(?:\(연장\)|\(인천\))?$/);
  if (digitMatch) {
    return `${Number(digitMatch[1])}호선`;
  }

  const aliasMap = new Map<string, string>([
    ['공항철도', '공항철도1호선'],
    ['공항철도1호선', '공항철도1호선'],
    ['경의선', '경의중앙선'],
    ['경의중앙', '경의중앙선'],
    ['신분당선(연장)', '신분당선'],
    ['신분당선(연장2)', '신분당선'],
    ['신분당선', '신분당선'],
    ['7호선(인천)', '7호선'],
    ['9호선(연장)', '9호선'],
    ['수도권급행철도', 'GTX'],
    ['수도권광역급행철도', 'GTX'],
  ]);

  return aliasMap.get(raw) || raw;
}

function slugifyLineId(lineName: string): string {
  const normalized = normalizeLineName(lineName);
  const explicit = new Map<string, string>([
    ['1호선', '1'],
    ['2호선', '2'],
    ['3호선', '3'],
    ['4호선', '4'],
    ['5호선', '5'],
    ['6호선', '6'],
    ['7호선', '7'],
    ['8호선', '8'],
    ['9호선', '9'],
    ['공항철도1호선', 'airport'],
    ['경의중앙선', 'gyeongui_jungang'],
    ['경춘선', 'gyeongchun'],
    ['분당선', 'bundang'],
    ['수인선', 'suin'],
    ['신분당선', 'sinbundang'],
    ['신림선', 'sillim'],
    ['우이신설선', 'ui_sinseol'],
    ['의정부경전철', 'uijeongbu'],
    ['인천1호선', 'incheon1'],
    ['인천2호선', 'incheon2'],
    ['김포골드라인', 'gimpo_gold'],
    ['에버라인', 'everline'],
    ['서해선', 'seohae'],
    ['경강선', 'gyeonggang'],
    ['일산선', 'ilsan'],
    ['안산선', 'ansan'],
    ['과천선', 'gwacheon'],
    ['장항선', 'janghang'],
    ['경부선', 'gyeongbu'],
    ['경원선', 'gyeongwon'],
    ['경인선', 'gyeongin'],
    ['중앙선', 'jungang'],
    ['별내선', 'byeollae'],
    ['진접선', 'jinjeop'],
    ['GTX', 'gtx'],
  ]);

  return (
    explicit.get(normalized) ||
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '_')
      .replace(/^_+|_+$/g, '') ||
    'line'
  );
}

function inferRegion(record: CoordinatePoint & { lineName: string }): string {
  const lineName = normalizeLineName(record.lineName);
  if (lineName.startsWith('인천')) {
    return 'incheon';
  }

  if (lineName === '공항철도1호선' && record.longitude < 126.8) {
    return 'incheon';
  }

  if (record.longitude < 126.8) {
    return 'incheon';
  }

  if (
    record.latitude > 37.7 ||
    record.latitude < 37.42 ||
    record.longitude > 127.15 ||
    record.longitude < 126.77
  ) {
    return 'gyeonggi';
  }

  return 'seoul';
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();
  const json = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return json;
}

async function fetchSeoulStationMaster(): Promise<OfficialMasterRow[]> {
  const url = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/subwayStationMaster/1/1000/`;
  const json = await fetchJson<{
    subwayStationMaster?: {
      row?: Array<{
        BLDN_ID?: string;
        BLDN_NM?: string;
        ROUTE?: string;
        LAT?: string | number;
        LOT?: string | number;
      }>;
    };
  }>(url);

  const rows = json.subwayStationMaster?.row ?? [];
  return rows
    .map((row) => ({
      stationCode: String(row.BLDN_ID || '').trim(),
      stationName: String(row.BLDN_NM || '').trim(),
      lineName: normalizeLineName(row.ROUTE),
      latitude: Number(row.LAT),
      longitude: Number(row.LOT),
    }))
    .filter(
      (row) =>
        row.stationCode &&
        row.stationName &&
        Number.isFinite(row.latitude) &&
        Number.isFinite(row.longitude)
    );
}

async function fetchSearchInfoByName(stationName: string): Promise<
  Array<{
    STATION_CD?: string;
    FR_CODE?: string;
    LINE_NUM?: string;
    STATION_NM?: string;
  }>
> {
  const encodedName = encodeURIComponent(stationName);
  const url = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/SearchInfoBySubwayNameService/1/20/${encodedName}/`;
  const json = await fetchJson<{
    SearchInfoBySubwayNameService?: {
      row?: Array<{
        STATION_CD?: string;
        FR_CODE?: string;
        LINE_NUM?: string;
        STATION_NM?: string;
      }>;
    };
  }>(url);

  return json.SearchInfoBySubwayNameService?.row ?? [];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(runners);
  return results;
}

async function buildOfficialRecords(masterRows: OfficialMasterRow[]): Promise<OfficialRecord[]> {
  const byStationCode = new Map(masterRows.map((row) => [row.stationCode, row]));
  const uniqueNames = [...new Set(masterRows.map((row) => row.stationName))];
  const searchResults = await mapWithConcurrency(uniqueNames, 8, async (stationName) => ({
    stationName,
    rows: await fetchSearchInfoByName(stationName),
  }));

  const records: OfficialRecord[] = [];
  const seen = new Set<string>();

  for (const result of searchResults) {
    for (const row of result.rows) {
      const stationCode = String(row.STATION_CD || '').trim();
      const frCode = String(row.FR_CODE || '').trim();
      const lineName = normalizeLineName(row.LINE_NUM || '');
      const base = byStationCode.get(stationCode);
      if (!base) {
        continue;
      }

      const key = `${stationCode}|${lineName}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      records.push({
        stationCode,
        frCode,
        stationName: String(row.STATION_NM || base.stationName || '').trim(),
        lineName,
        lineId: slugifyLineId(lineName),
        latitude: base.latitude,
        longitude: base.longitude,
        region: inferRegion({
          lineName,
          latitude: base.latitude,
          longitude: base.longitude,
        }),
      });
    }
  }

  return records;
}

function buildIndexes(officialRecords: OfficialRecord[]) {
  const byStationCode = new Map<string, OfficialRecord>();
  const byFrCode = new Map<string, OfficialRecord>();
  const byNameLine = new Map<string, OfficialRecord[]>();
  const byName = new Map<string, OfficialRecord[]>();

  for (const record of officialRecords) {
    byStationCode.set(record.stationCode, record);

    if (record.frCode) {
      byFrCode.set(record.frCode, record);
    }

    const nameKey = normalizeName(record.stationName);
    const lineKey = `${nameKey}|${normalizeLineName(record.lineName)}`;

    if (!byNameLine.has(lineKey)) {
      byNameLine.set(lineKey, []);
    }
    byNameLine.get(lineKey)!.push(record);

    if (!byName.has(nameKey)) {
      byName.set(nameKey, []);
    }
    byName.get(nameKey)!.push(record);
  }

  return { byStationCode, byFrCode, byNameLine, byName };
}

function readCoordinates(data: FirebaseFirestore.DocumentData): CoordinatePoint & { valid: boolean } {
  const location =
    typeof data?.location === 'object' && data.location != null
      ? (data.location as Record<string, unknown>)
      : {};

  const latitude = Number(location.latitude ?? location.lat ?? 0);
  const longitude = Number(location.longitude ?? location.lng ?? 0);

  return {
    latitude,
    longitude,
    valid: Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0,
  };
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadius = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildSafeNameCoordinateMap(
  firestoreDocs: FirestoreStationDoc[],
  officialRecords: OfficialRecord[]
): Map<string, CoordinatePoint> {
  const grouped = new Map<string, CoordinatePoint[]>();

  const push = (name: string, latitude: number, longitude: number) => {
    const key = normalizeName(name);
    if (!key || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) {
      return;
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push({ latitude, longitude });
  };

  for (const doc of firestoreDocs) {
    const coords = readCoordinates(doc.data);
    if (coords.valid) {
      push(String(doc.data.stationName || doc.data.name || doc.id), coords.latitude, coords.longitude);
    }
  }

  for (const record of officialRecords) {
    push(record.stationName, record.latitude, record.longitude);
  }

  const safe = new Map<string, CoordinatePoint>();

  for (const [nameKey, points] of grouped.entries()) {
    let maxDistance = 0;

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        maxDistance = Math.max(
          maxDistance,
          calculateDistanceMeters(
            points[i].latitude,
            points[i].longitude,
            points[j].latitude,
            points[j].longitude
          )
        );
      }
    }

    if (maxDistance <= 1000) {
      safe.set(nameKey, points[0]);
    }
  }

  return safe;
}

function findOfficialRecord(
  doc: FirestoreStationDoc,
  indexes: ReturnType<typeof buildIndexes>
): OfficialRecord | null {
  const data = doc.data || {};
  const stationId = String(data.stationId || data.id || doc.id || '').trim();
  const fareCode = String(data?.fare?.stationCode || '').trim();
  const kricCode = String(data?.kric?.stationCode || '').trim();
  const stationName = String(data.stationName || data.name || '').trim();
  const lines = Array.isArray(data.lines) ? data.lines : [];

  const directMatches = [
    fareCode ? indexes.byStationCode.get(fareCode) : null,
    stationId ? indexes.byStationCode.get(stationId) : null,
    doc.id ? indexes.byStationCode.get(doc.id) : null,
    kricCode ? indexes.byFrCode.get(kricCode) : null,
    stationId ? indexes.byFrCode.get(stationId) : null,
    doc.id ? indexes.byFrCode.get(doc.id) : null,
  ].filter((value): value is OfficialRecord => Boolean(value));

  if (directMatches.length > 0) {
    return directMatches[0];
  }

  const nameKey = normalizeName(stationName);
  for (const line of lines) {
    const lineName = normalizeLineName(line?.lineName || line?.lineId || '');
    const key = `${nameKey}|${lineName}`;
    const matches = indexes.byNameLine.get(key) || [];
    if (matches.length > 0) {
      return matches[0];
    }
  }

  const sameName = indexes.byName.get(nameKey) || [];
  if (sameName.length === 1) {
    return sameName[0];
  }

  return null;
}

function shouldPatchCoordinates(
  current: CoordinatePoint & { valid: boolean },
  official: CoordinatePoint
): boolean {
  if (!current.valid) {
    return true;
  }

  return (
    Math.abs(current.latitude - official.latitude) > 0.0001 ||
    Math.abs(current.longitude - official.longitude) > 0.0001
  );
}

function buildPatchPayload(
  doc: FirestoreStationDoc,
  official: OfficialRecord | (CoordinatePoint & Partial<OfficialRecord>)
): FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> {
  const data = doc.data || {};
  const payload: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
    location: {
      latitude: official.latitude,
      longitude: official.longitude,
    },
    locationMissing: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!data.stationName) {
    payload.stationName = official.stationName || String(data.name || doc.id);
  }

  if (!data.stationId) {
    payload.stationId = doc.id;
  }

  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    payload.lines = [
      {
        lineId: official.lineId || 'line',
        lineName: official.lineName || '',
        lineCode: official.frCode || official.stationCode || '',
        lineColor: '#000000',
        lineType: 'general',
      },
    ];
  }

  if (!data.region) {
    payload.region = official.region || 'seoul';
  }

  return payload;
}

function buildCreatePayload(official: OfficialRecord): FirebaseFirestore.DocumentData {
  return {
    stationId: official.frCode || official.stationCode,
    stationName: official.stationName,
    stationNameEnglish: official.stationName,
    lines: [
      {
        lineId: official.lineId,
        lineName: official.lineName,
        lineCode: official.frCode || official.stationCode,
        lineColor: '#000000',
        lineType: 'general',
      },
    ],
    location: {
      latitude: official.latitude,
      longitude: official.longitude,
    },
    locationMissing: false,
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    facilities: {
      hasElevator: false,
      hasEscalator: false,
      wheelchairAccessible: false,
    },
    region: official.region,
    priority: 100,
    isActive: true,
    fare: {
      stationCode: official.stationCode,
    },
    ...(official.frCode
      ? {
          kric: {
            stationCode: official.frCode,
            lineCode: official.lineId,
            railOprIsttCd: 'S1',
          },
        }
      : {}),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function commitInChunks<T>(
  items: T[],
  chunkSize: number,
  writer: (batch: FirebaseFirestore.WriteBatch, item: T) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = admin.firestore().batch();

    for (const item of chunk) {
      writer(batch, item);
    }

    await batch.commit();
  }
}

export const syncConfigStationsFromSeoulApi = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).json({ ok: false, message: 'method not allowed' });
        return;
      }

      const apply = String(req.query.apply || req.body?.apply || '').toLowerCase() === 'true';
      const createMissing =
        String(req.query.createMissing || req.body?.createMissing || '').toLowerCase() === 'true';
      const firestore = admin.firestore();

      const masterRows = await fetchSeoulStationMaster();
      const officialRecords = await buildOfficialRecords(masterRows);
      const indexes = buildIndexes(officialRecords);
      const snapshot = await firestore.collection('config_stations').get();
      const firestoreDocs: FirestoreStationDoc[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ref: doc.ref,
        data: doc.data(),
      }));
      const safeNameCoordinates = buildSafeNameCoordinateMap(firestoreDocs, officialRecords);

      const patches: Array<{
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        payload: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>;
        stationName: string;
      }> = [];
      const matchedStationCodes = new Set<string>();
      let invalidDocs = 0;
      let matchedDocs = 0;

      for (const doc of firestoreDocs) {
        const current = readCoordinates(doc.data);
        if (!current.valid) {
          invalidDocs += 1;
        }

        const official = findOfficialRecord(doc, indexes);
        const fallbackCoordinates = !official
          ? safeNameCoordinates.get(normalizeName(doc.data.stationName || doc.data.name || doc.id))
          : null;

        if (!official && !fallbackCoordinates) {
          continue;
        }

        if (official) {
          matchedDocs += 1;
          matchedStationCodes.add(official.stationCode);
        }

        const coordinateSource: OfficialRecord | (CoordinatePoint & Partial<OfficialRecord>) =
          official || {
            latitude: fallbackCoordinates!.latitude,
            longitude: fallbackCoordinates!.longitude,
            stationName: String(doc.data.stationName || doc.data.name || doc.id),
            lineName: String((doc.data.lines?.[0] || {}).lineName || ''),
            lineId: String((doc.data.lines?.[0] || {}).lineId || 'line'),
            stationCode: '',
            frCode: '',
            region: String(doc.data.region || 'seoul'),
          };

        if (
          shouldPatchCoordinates(current, coordinateSource) ||
          doc.data.locationMissing === true ||
          !doc.data.region ||
          !Array.isArray(doc.data.lines) ||
          doc.data.lines.length === 0
        ) {
          patches.push({
            ref: doc.ref,
            payload: buildPatchPayload(doc, coordinateSource),
            stationName: String(doc.data.stationName || doc.data.name || doc.id),
          });
        }
      }

      const missingOfficialRecords = officialRecords.filter(
        (record) => !matchedStationCodes.has(record.stationCode)
      );
      const creates = createMissing
        ? missingOfficialRecords.map((record) => ({
            ref: firestore.collection('config_stations').doc(record.frCode || record.stationCode),
            payload: buildCreatePayload(record),
            stationName: record.stationName,
            lineName: record.lineName,
          }))
        : [];

      if (apply) {
        await commitInChunks(patches, 350, (batch, item) => batch.set(item.ref, item.payload, { merge: true }));
        await commitInChunks(creates, 350, (batch, item) => batch.set(item.ref, item.payload, { merge: true }));
      }

      res.status(200).json({
        ok: true,
        projectId: PROJECT_ID,
        apply,
        createMissing,
        officialMasterRows: masterRows.length,
        officialRecords: officialRecords.length,
        firestoreDocs: firestoreDocs.length,
        firestoreDocsWithoutValidCoordinates: invalidDocs,
        matchedDocs,
        docsToPatch: patches.length,
        missingOfficialRecords: missingOfficialRecords.length,
        docsToCreate: creates.length,
        patchSamples: patches.slice(0, 20).map((item) => ({ stationName: item.stationName })),
        createSamples: creates
          .slice(0, 20)
          .map((item) => ({ stationName: item.stationName, lineName: item.lineName })),
      });
    } catch (error) {
      console.error('syncConfigStationsFromSeoulApi error:', error);
      res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'internal error',
      });
    }
  });
