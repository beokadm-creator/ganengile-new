/**
 * Update KRIC station code mapping and detect duplicates
 *
 * Usage:
 *   node scripts/update-kric-mapping.ts --mapping data/kric-station-mapping.csv --dry-run
 *   node scripts/update-kric-mapping.ts --mapping data/kric-station-mapping.csv --apply
 *   node scripts/update-kric-mapping.ts --mapping data/kric-station-mapping.csv --apply --deactivate-duplicates
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const mappingArgIndex = process.argv.indexOf('--mapping');
const mappingPath =
  mappingArgIndex > -1 && process.argv[mappingArgIndex + 1]
    ? process.argv[mappingArgIndex + 1]
    : 'data/kric-station-mapping.csv';
const apply = args.has('--apply');
const deactivateDuplicates = args.has('--deactivate-duplicates');

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(process.env.HOME || '', 'Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json');

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

type MappingRow = {
  stationId: string;
  stationName: string;
  lineCode: string;
  stationCode: string;
  railOprIsttCd: string;
  fareStationCode: string;
};

function parseCsv(content: string): MappingRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: MappingRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(',').map((c) => c.trim());
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });
    if (!row.stationId && !row.stationName) continue;
    rows.push({
      stationId: row.stationId || '',
      stationName: row.stationName || '',
      lineCode: row.lineCode || '',
      stationCode: row.stationCode || '',
      railOprIsttCd: row.railOprIsttCd || 'S1',
      fareStationCode: row.fareStationCode || '',
    });
  }

  return rows;
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, '').trim();
}

async function loadStations() {
  const snap = await db.collection('config_stations').get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

function buildDuplicateReport(stations: { id: string; data: any }[]) {
  const byName = new Map<string, string[]>();
  const byNameLine = new Map<string, string[]>();
  const byCoords = new Map<string, string[]>();

  for (const station of stations) {
    const nameKey = normalizeName(station.data.stationName || station.id);
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey)!.push(station.id);

    const lines = Array.isArray(station.data.lines) ? station.data.lines : [];
    for (const line of lines) {
      const lineCode = line.lineCode || '';
      const nameLineKey = `${nameKey}|${lineCode}`;
      if (!byNameLine.has(nameLineKey)) byNameLine.set(nameLineKey, []);
      byNameLine.get(nameLineKey)!.push(station.id);
    }

    const loc = station.data.location;
    if (loc?.latitude && loc?.longitude) {
      const coordKey = `${loc.latitude.toFixed(5)}|${loc.longitude.toFixed(5)}`;
      if (!byCoords.has(coordKey)) byCoords.set(coordKey, []);
      byCoords.get(coordKey)!.push(station.id);
    }
  }

  const duplicates = {
    byName: Array.from(byName.entries()).filter(([, ids]) => ids.length > 1),
    byNameLine: Array.from(byNameLine.entries()).filter(([, ids]) => ids.length > 1),
    byCoords: Array.from(byCoords.entries()).filter(([, ids]) => ids.length > 1),
  };

  return duplicates;
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

async function updateMappings(rows: MappingRow[], stations: { id: string; data: any }[]) {
  let matched = 0;
  let updated = 0;
  let missing = 0;

  const byId = new Map(stations.map((s) => [s.id, s]));
  const byNameLine = new Map<string, { id: string; data: any }>();

  for (const station of stations) {
    const nameKey = normalizeName(station.data.stationName || station.id);
    const lines = Array.isArray(station.data.lines) ? station.data.lines : [];
    for (const line of lines) {
      const lineCode = line.lineCode || '';
      const key = `${nameKey}|${lineCode}`;
      if (!byNameLine.has(key)) {
        byNameLine.set(key, station);
      }
    }
  }

  const batch = db.batch();
  let batchCount = 0;

  for (const row of rows) {
    let target = row.stationId ? byId.get(row.stationId) : undefined;

    if (!target && row.stationName && row.lineCode) {
      const key = `${normalizeName(row.stationName)}|${row.lineCode}`;
      target = byNameLine.get(key);
    }

    if (!target) {
      missing++;
      console.warn(`⚠️ Station not found for mapping: ${row.stationId || row.stationName}`);
      continue;
    }

    matched++;
    const ref = db.collection('config_stations').doc(target.id);
    const updateData: any = {
      kric: {
        stationCode: row.stationCode || row.stationId,
        lineCode: row.lineCode,
        railOprIsttCd: row.railOprIsttCd || 'S1',
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (row.fareStationCode) {
      updateData.fare = {
        stationCode: row.fareStationCode,
      };
    }

    batch.update(ref, updateData);
    batchCount++;
    updated++;

    if (batchCount >= 400) {
      if (apply) {
        await batch.commit();
      }
      batchCount = 0;
    }
  }

  if (batchCount > 0 && apply) {
    await batch.commit();
  }

  return { matched, updated, missing };
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
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
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
  console.log('🔧 KRIC mapping update');
  console.log(`- Mapping file: ${mappingPath}`);
  console.log(`- Apply: ${apply ? 'YES' : 'NO (dry-run)'}`);
  console.log(`- Deactivate duplicates: ${deactivateDuplicates ? 'YES' : 'NO'}`);

  const absMappingPath = path.isAbsolute(mappingPath)
    ? mappingPath
    : path.join(__dirname, '..', mappingPath);

  if (!fs.existsSync(absMappingPath)) {
    console.error(`❌ Mapping file not found: ${absMappingPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absMappingPath, 'utf8');
  const rows = parseCsv(content);
  console.log(`- Rows loaded: ${rows.length}`);

  const stations = await loadStations();
  console.log(`- Stations loaded: ${stations.length}`);

  const duplicates = buildDuplicateReport(stations);
  const reportDir = path.join(__dirname, '..', 'data', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'config-stations-duplicates.json');
  fs.writeFileSync(reportPath, JSON.stringify(duplicates, null, 2));
  console.log(`- Duplicate report: ${reportPath}`);

  const result = await updateMappings(rows, stations);
  console.log(`- Matched: ${result.matched}`);
  console.log(`- Updated: ${result.updated}`);
  console.log(`- Missing: ${result.missing}`);

  if (deactivateDuplicates) {
    await deactivateDuplicateStations(stations);
  }

  console.log('✅ Done');
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
