import fs from 'fs';
import os from 'os';
import path from 'path';

const PROJECT_ID = process.env.PROJECT_ID || 'ganengile';
const SEOUL_API_KEY = process.env.SEOUL_SUBWAY_API_KEY || process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY || '4a57725a546d65743833756e765a6d';
const APPLY = process.argv.includes('--apply');
const CREATE_MISSING = process.argv.includes('--create-missing');
const REPORT_PATH = path.join(process.cwd(), 'data', 'reports', 'station-coordinate-sync-report.json');

function normalizeName(name) {
  return String(name || '')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeLineName(value) {
  const raw = String(value || '').replace(/\s+/g, '').trim();
  if (!raw) return '';

  const digitMatch = raw.match(/^0?(\d+)호선(?:\(연장\)|\(인천\))?$/);
  if (digitMatch) {
    return `${Number(digitMatch[1])}호선`;
  }

  const aliasMap = new Map([
    ['공항철도', '공항철도1호선'],
    ['공항철도1호선', '공항철도1호선'],
    ['경의선', '경의중앙선'],
    ['중앙선', '중앙선'],
    ['경의중앙선', '경의중앙선'],
    ['신분당선(연장)', '신분당선'],
    ['신분당선(연장2)', '신분당선'],
    ['신분당선', '신분당선'],
    ['7호선(인천)', '7호선'],
    ['9호선(연장)', '9호선'],
    ['수도권광역급행철도', 'GTX'],
    ['수도권 광역급행철도', 'GTX'],
  ]);

  return aliasMap.get(raw) || raw;
}

function slugifyLineId(lineName) {
  const normalized = normalizeLineName(lineName);
  const explicit = new Map([
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
    ['의정부선', 'uijeongbu'],
    ['인천1호선', 'incheon1'],
    ['인천2호선', 'incheon2'],
    ['김포골드라인', 'gimpo_gold'],
    ['에버라인선', 'everline'],
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

  if (explicit.has(normalized)) {
    return explicit.get(normalized);
  }

  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'line';
}

function inferRegion(record) {
  const lineName = normalizeLineName(record.lineName);
  if (lineName.startsWith('인천')) return 'incheon';
  if (lineName === '공항철도1호선' && record.longitude < 126.8) return 'incheon';
  if (record.longitude < 126.8) return 'incheon';
  if (record.latitude > 37.7 || record.latitude < 37.42 || record.longitude > 127.15 || record.longitude < 126.77) {
    return 'gyeonggi';
  }
  return 'seoul';
}

function configStorePath() {
  return path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
}

async function readFirebaseAccessToken() {
  const filePath = configStorePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`firebase-tools config not found: ${filePath}`);
  }

  const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const accessToken = config?.tokens?.access_token;
  const refreshToken = config?.tokens?.refresh_token;
  const expiresAt = Number(config?.tokens?.expires_at || 0);

  if (!accessToken && !refreshToken) {
    throw new Error('Firebase CLI tokens not found. Run `firebase login` first.');
  }

  if (accessToken && (!expiresAt || expiresAt > Date.now() + 60_000)) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error('Firebase CLI access token expired and no refresh token is available. Run `firebase login` again.');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    }),
  });

  const refreshed = await tokenResponse.json();
  if (!tokenResponse.ok || !refreshed.access_token) {
    throw new Error(`Failed to refresh Firebase CLI access token: ${JSON.stringify(refreshed)}`);
  }

  config.tokens = {
    ...config.tokens,
    access_token: refreshed.access_token,
    expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    expires_in: refreshed.expires_in,
    token_type: refreshed.token_type || 'Bearer',
    scope: refreshed.scope || config?.tokens?.scope || '',
  };
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));

  return refreshed.access_token;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return json;
}

async function fetchSeoulStationMaster() {
  const url = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/subwayStationMaster/1/1000/`;
  const json = await fetchJson(url);
  const rows = json?.subwayStationMaster?.row || [];

  return rows.map((row) => ({
    stationCode: String(row.BLDN_ID || '').trim(),
    stationName: String(row.BLDN_NM || '').trim(),
    lineName: normalizeLineName(row.ROUTE),
    latitude: Number(row.LAT),
    longitude: Number(row.LOT),
  })).filter((row) => row.stationCode && row.stationName && Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}

async function fetchSearchInfoByName(stationName) {
  const encodedName = encodeURIComponent(stationName);
  const url = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/SearchInfoBySubwayNameService/1/20/${encodedName}/`;
  const json = await fetchJson(url);
  return json?.SearchInfoBySubwayNameService?.row || [];
}

async function buildOfficialRecords(masterRows) {
  const byStationCode = new Map(masterRows.map((row) => [row.stationCode, row]));
  const officialRecords = [];
  const seen = new Set();
  const uniqueNames = [...new Set(masterRows.map((row) => row.stationName))];

  for (const stationName of uniqueNames) {
    const rows = await fetchSearchInfoByName(stationName);
    for (const row of rows) {
      const stationCode = String(row.STATION_CD || '').trim();
      const frCode = String(row.FR_CODE || '').trim();
      const lineName = normalizeLineName(row.LINE_NUM);
      const base = byStationCode.get(stationCode);
      if (!base) continue;

      const key = `${stationCode}|${lineName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      officialRecords.push({
        stationCode,
        frCode,
        stationName: String(row.STATION_NM || base.stationName || '').trim(),
        stationNameEnglish: '',
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

  return officialRecords;
}

function decodeFirestoreValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) {
    const fields = value.mapValue.fields || {};
    return Object.fromEntries(Object.entries(fields).map(([key, nested]) => [key, decodeFirestoreValue(nested)]));
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map((entry) => decodeFirestoreValue(entry));
  }

  return undefined;
}

function encodeFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => encodeFirestoreValue(item)) } };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, nested]) => nested !== undefined)
            .map(([key, nested]) => [key, encodeFirestoreValue(nested)])
        ),
      },
    };
  }

  throw new Error(`Unsupported Firestore value: ${value}`);
}

async function fetchAllFirestoreDocs(accessToken) {
  const docs = [];
  let pageToken = '';

  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/config_stations`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const json = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    for (const doc of json.documents || []) {
      docs.push({
        name: doc.name,
        id: doc.name.split('/').pop(),
        data: Object.fromEntries(
          Object.entries(doc.fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)])
        ),
      });
    }

    pageToken = json.nextPageToken || '';
  } while (pageToken);

  return docs;
}

function buildOfficialIndexes(officialRecords) {
  const byStationCode = new Map();
  const byFrCode = new Map();
  const byNameLine = new Map();
  const byName = new Map();

  for (const record of officialRecords) {
    byStationCode.set(record.stationCode, record);
    if (record.frCode) {
      byFrCode.set(record.frCode, record);
    }

    const key = `${normalizeName(record.stationName)}|${normalizeLineName(record.lineName)}`;
    if (!byNameLine.has(key)) {
      byNameLine.set(key, []);
    }
    byNameLine.get(key).push(record);

    const nameKey = normalizeName(record.stationName);
    if (!byName.has(nameKey)) {
      byName.set(nameKey, []);
    }
    byName.get(nameKey).push(record);
  }

  return { byStationCode, byFrCode, byNameLine, byName };
}

function readDocCoordinates(doc) {
  const location = doc?.data?.location || {};
  const latitude = Number(location.latitude ?? location.lat ?? 0);
  const longitude = Number(location.longitude ?? location.lng ?? 0);

  return {
    latitude,
    longitude,
    valid: Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0,
  };
}

function findMatchingOfficialRecord(doc, indexes) {
  const stationId = String(doc.data.stationId || doc.data.id || doc.id || '').trim();
  const fareCode = String(doc.data?.fare?.stationCode || '').trim();
  const kricCode = String(doc.data?.kric?.stationCode || '').trim();
  const stationName = String(doc.data.stationName || doc.data.name || '').trim();
  const lines = Array.isArray(doc.data.lines) ? doc.data.lines : [];

  const directCandidates = [
    fareCode && indexes.byStationCode.get(fareCode),
    stationId && indexes.byStationCode.get(stationId),
    doc.id && indexes.byStationCode.get(doc.id),
    kricCode && indexes.byFrCode.get(kricCode),
    stationId && indexes.byFrCode.get(stationId),
    doc.id && indexes.byFrCode.get(doc.id),
  ].filter(Boolean);

  if (directCandidates.length > 0) {
    return directCandidates[0];
  }

  const nameKey = normalizeName(stationName);
  for (const line of lines) {
    const lineName = normalizeLineName(line.lineName || line.lineId || '');
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

function shouldPatchCoordinates(current, official) {
  if (!current.valid) return true;
  const latitudeDiff = Math.abs(current.latitude - official.latitude);
  const longitudeDiff = Math.abs(current.longitude - official.longitude);
  return latitudeDiff > 0.0001 || longitudeDiff > 0.0001;
}

function buildPatchPayload(doc, official) {
  const payload = {
    location: {
      latitude: official.latitude,
      longitude: official.longitude,
    },
    locationMissing: false,
    updatedAt: new Date(),
  };

  if (!doc.data.stationName) {
    payload.stationName = official.stationName;
  }

  if (!doc.data.stationId) {
    payload.stationId = doc.id;
  }

  if (!Array.isArray(doc.data.lines) || doc.data.lines.length === 0) {
    payload.lines = [
      {
        lineId: official.lineId,
        lineName: official.lineName,
        lineCode: official.frCode || official.stationCode,
        lineColor: '#000000',
        lineType: 'general',
      },
    ];
  }

  if (!doc.data.region) {
    payload.region = official.region;
  }

  return payload;
}

function buildCreatePayload(official) {
  return {
    stationId: official.frCode || official.stationCode,
    stationName: official.stationName,
    stationNameEnglish: official.stationNameEnglish || official.stationName,
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
    kric: official.frCode
      ? {
          stationCode: official.frCode,
          lineCode: official.lineId,
          railOprIsttCd: 'S1',
        }
      : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function patchFirestoreDocument(accessToken, docId, payload) {
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/config_stations/${encodeURIComponent(docId)}`);
  for (const fieldPath of Object.keys(payload)) {
    url.searchParams.append('updateMask.fieldPaths', fieldPath);
  }

  await fetchJson(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, encodeFirestoreValue(value)])),
    }),
  });
}

async function createFirestoreDocument(accessToken, docId, payload) {
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/config_stations/${encodeURIComponent(docId)}`);
  await fetchJson(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined).map(([key, value]) => [key, encodeFirestoreValue(value)])),
    }),
  });
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  console.log('Station coordinate sync');
  console.log(`- Project: ${PROJECT_ID}`);
  console.log(`- Apply: ${APPLY ? 'YES' : 'NO (dry-run)'}`);
  console.log(`- Create missing docs: ${CREATE_MISSING ? 'YES' : 'NO'}`);

  const accessToken = readFirebaseAccessToken();
  const masterRows = await fetchSeoulStationMaster();
  const officialRecords = await buildOfficialRecords(masterRows);
  const firestoreDocs = await fetchAllFirestoreDocs(accessToken);
  const indexes = buildOfficialIndexes(officialRecords);

  const patches = [];
  const matchedStationCodes = new Set();
  let matchedDocs = 0;
  let invalidDocs = 0;

  for (const doc of firestoreDocs) {
    const currentCoords = readDocCoordinates(doc);
    if (!currentCoords.valid) {
      invalidDocs++;
    }

    const official = findMatchingOfficialRecord(doc, indexes);
    if (!official) {
      continue;
    }

    matchedDocs++;
    matchedStationCodes.add(official.stationCode);
    const patch = buildPatchPayload(doc, official);

    if (shouldPatchCoordinates(currentCoords, official) || doc.data.locationMissing === true || !doc.data.region || !Array.isArray(doc.data.lines) || doc.data.lines.length === 0) {
      patches.push({
        docId: doc.id,
        payload: patch,
        stationName: doc.data.stationName || doc.data.name || doc.id,
        lineNames: (doc.data.lines || []).map((line) => line.lineName || line.lineId || '').join(', '),
      });
    }
  }

  const missingOfficialRecords = officialRecords.filter((record) => !matchedStationCodes.has(record.stationCode));
  const creates = CREATE_MISSING
    ? missingOfficialRecords.map((record) => ({
        docId: record.frCode || record.stationCode,
        payload: buildCreatePayload(record),
        stationName: record.stationName,
        lineName: record.lineName,
      }))
    : [];

  const report = {
    generatedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    officialMasterRows: masterRows.length,
    officialRecords: officialRecords.length,
    firestoreDocs: firestoreDocs.length,
    firestoreDocsWithoutValidCoordinates: invalidDocs,
    matchedDocs,
    docsToPatch: patches.length,
    missingOfficialRecords: missingOfficialRecords.length,
    docsToCreate: creates.length,
    patchSamples: patches.slice(0, 20),
    createSamples: creates.slice(0, 20).map((item) => ({
      docId: item.docId,
      stationName: item.stationName,
      lineName: item.lineName,
    })),
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`- Official master rows: ${masterRows.length}`);
  console.log(`- Official normalized records: ${officialRecords.length}`);
  console.log(`- Firestore docs: ${firestoreDocs.length}`);
  console.log(`- Docs without valid coordinates: ${invalidDocs}`);
  console.log(`- Matched docs: ${matchedDocs}`);
  console.log(`- Docs to patch: ${patches.length}`);
  console.log(`- Missing official records: ${missingOfficialRecords.length}`);
  console.log(`- Docs to create: ${creates.length}`);
  console.log(`- Report: ${REPORT_PATH}`);

  if (!APPLY) {
    return;
  }

  let patched = 0;
  for (const item of patches) {
    await patchFirestoreDocument(accessToken, item.docId, item.payload);
    patched++;
    if (patched % 50 === 0) {
      console.log(`  patched ${patched}/${patches.length}`);
    }
  }

  let created = 0;
  for (const item of creates) {
    await createFirestoreDocument(accessToken, item.docId, item.payload);
    created++;
    if (created % 50 === 0) {
      console.log(`  created ${created}/${creates.length}`);
    }
  }

  console.log(`- Patched: ${patched}`);
  console.log(`- Created: ${created}`);
}

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
