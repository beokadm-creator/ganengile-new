/**
 * Update station mapping using 서울교통공사_노선별 지하철역 정보.json
 *
 * Usage:
 *   node scripts/update-station-mapping-from-seoul-json.ts --json /path/to/서울교통공사_노선별 지하철역 정보.json --apply --deactivate-duplicates
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const jsonArgIndex = process.argv.indexOf('--json');
const jsonPath =
  jsonArgIndex > -1 && process.argv[jsonArgIndex + 1]
    ? process.argv[jsonArgIndex + 1]
    : '/Users/aaron/Downloads/서울교통공사_노선별 지하철역 정보.json';
const apply = args.has('--apply');
const deactivateDuplicates = args.has('--deactivate-duplicates');

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(process.env.HOME || '', 'Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account not found: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

type SeoulRow = {
  line_num: string;
  station_nm: string;
  station_cd: string;
  fr_code: string;
};

function normalizeName(name: string): string {
  const trimmed = name.replace(/\s+/g, '').trim();
  return trimmed.endsWith('역') ? trimmed.slice(0, -1) : trimmed;
}

function normalizeLineCode(lineNum: string): string | null {
  const digits = (lineNum ?? '').replace(/\D/g, '');
  if (digits.length === 0) return null;
  const parsed = parseInt(digits, 10);
  if (Number.isNaN(parsed)) return null;
  return String(parsed);
}

function normalizeLineName(value: string): string {
  if (!value) return '';
  const v = value.trim();
  // "01호선" -> "1호선"
  if (/^\d+호선$/.test(v)) {
    return String(parseInt(v, 10)) + '호선';
  }
  if (/^\d+호선/.test(v)) {
    const digits = v.replace(/\D/g, '');
    return digits ? `${parseInt(digits, 10)}호선` : v;
  }
  return v;
}

function loadSeoulData(filePath: string): SeoulRow[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ JSON not found: ${filePath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const items = raw?.DATA || raw?.data || raw ?? [];
  return Array.isArray(items) ? items : [];
}

async function loadStations() {
  const snap = await db.collection('config_stations').get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

function scoreStation(station: { id: string; data: any }): number {
  let score = 0;
  if (station.data?.isActive) score += 10;
  if (station.data?.location?.latitude && station.data?.location?.longitude) score += 5;
  const lines = Array.isArray(station.data?.lines) ? station.data.lines.length : 0;
  score += Math.min(lines, 5);
  if (station.data?.isTransferStation) score += 3;
  if (typeof station.data?.priority === 'number') score += station.data.priority;
  return score;
}

function buildDuplicateReport(stations: { id: string; data: any }[]) {
  const byName = new Map<string, string[]>();
  const byNameLine = new Map<string, string[]>();

  for (const station of stations) {
    const nameKey = normalizeName(station.data.stationName || station.data.name ?? station.id);
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey)!.push(station.id);

    const lines = Array.isArray(station.data.lines) ? station.data.lines : [];
    for (const line of lines) {
      const lineName = normalizeLineName(line.lineName ?? '');
      const nameLineKey = `${nameKey}|${lineName}`;
      if (!byNameLine.has(nameLineKey)) byNameLine.set(nameLineKey, []);
      byNameLine.get(nameLineKey)!.push(station.id);
    }
  }

  return {
    byName: Array.from(byName.entries()).filter(([, ids]) => ids.length > 1),
    byNameLine: Array.from(byNameLine.entries()).filter(([, ids]) => ids.length > 1),
  };
}

async function deactivateDuplicateStations(stations: { id: string; data: any }[]) {
  const duplicates = buildDuplicateReport(stations);
  const toDeactivate = new Set<string>();

  for (const [, ids] of duplicates.byNameLine) {
    const candidates = ids
      .map((id) => stations.find((s) => s.id === id))
      .filter(Boolean) as { id: string; data: any }[];
    const ranked = candidates
      .map((s) => ({ id: s.id, score: scoreStation(s) }))
      .sort((a, b) => b.score - a.score ?? a.id.localeCompare(b.id));
    const keep = ranked[0]?.id;
    for (const id of ids) {
      if (id !== keep) toDeactivate.add(id);
    }
  }

  if (toDeactivate.size === 0) {
    console.log('✅ No duplicates to deactivate.');
    return;
  }

  console.warn(`⚠️ Marking ${toDeactivate.size} duplicate stations as inactive.`);
  if (!apply) {
    console.warn('Dry-run mode: no changes applied.');
    return;
  }

  const batch = db.batch();
  let count = 0;

  for (const id of toDeactivate) {
    const ref = db.collection('config_stations').doc(id);
    batch.update(ref, {
      isActive: false,
      duplicateOf: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();
  console.log(`✅ Deactivated ${toDeactivate.size} duplicate stations.`);
}

async function main() {
  console.log('🔧 Station mapping update from Seoul JSON');
  console.log(`- JSON file: ${jsonPath}`);
  console.log(`- Apply: ${apply ? 'YES' : 'NO (dry-run)'}`);
  console.log(`- Deactivate duplicates: ${deactivateDuplicates ? 'YES' : 'NO'}`);

  const rows = loadSeoulData(jsonPath);
  console.log(`- Rows loaded: ${rows.length}`);

  const byNameLine = new Map<string, SeoulRow>();
  for (const row of rows) {
    const nameKey = normalizeName(row.station_nm ?? '');
    const lineNameKey = normalizeLineName(row.line_num ?? '');
    if (!nameKey ?? !lineNameKey) continue;
    const key = `${nameKey}|${lineNameKey}`;
    if (!byNameLine.has(key)) {
      byNameLine.set(key, row);
    }
  }

  const stations = await loadStations();
  console.log(`- Stations loaded: ${stations.length}`);

  const reportDir = path.join(__dirname, '..', 'data', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const duplicatesReport = buildDuplicateReport(stations);
  const reportPath = path.join(reportDir, 'config-stations-duplicates.json');
  fs.writeFileSync(reportPath, JSON.stringify(duplicatesReport, null, 2));
  console.log(`- Duplicate report: ${reportPath}`);

  let matched = 0;
  let updated = 0;
  let missing = 0;

  let batch = db.batch();
  let batchCount = 0;

  for (const station of stations) {
    const stationName = station.data.stationName || station.data.name ?? station.id;
    const nameKey = normalizeName(stationName);
    const lines = Array.isArray(station.data.lines) ? station.data.lines : [];

    if (!lines.length) {
      missing++;
      continue;
    }

    for (const line of lines) {
      const lineName = normalizeLineName(line.lineName ?? '');
      const key = `${nameKey}|${lineName}`;
      const row = byNameLine.get(key);
      if (!row) continue;

      matched++;
      const lineCode = normalizeLineCode(row.line_num || '') ?? '';
      const ref = db.collection('config_stations').doc(station.id);
      const kricData: any = {
        stationCode: row.fr_code ?? row.station_cd,
        railOprIsttCd: 'S1',
      };
      if (lineCode) {
        kricData.lineCode = lineCode;
      }

      const updateData: any = {
        kric: kricData,
        fare: {
          stationCode: row.station_cd,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.update(ref, updateData);
      batchCount++;
      updated++;

      if (batchCount >= 400) {
        if (apply) {
          await batch.commit();
        }
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0 && apply) {
    await batch.commit();
  }

  console.log(`- Matched: ${matched}`);
  console.log(`- Updated: ${updated}`);
  console.log(`- Missing: ${missing}`);

  if (deactivateDuplicates) {
    await deactivateDuplicateStations(stations);
  }

  console.log('✅ Done');
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
