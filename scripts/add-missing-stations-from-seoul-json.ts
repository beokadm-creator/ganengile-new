/**
 * Add missing stations into config_stations from Seoul Metro station JSON.
 *
 * Usage:
 *   node scripts/add-missing-stations-from-seoul-json.ts --json /path/to/서울교통공사_노선별 지하철역 정보.json --apply
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

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(process.env.HOME || '', 'Downloads/ganengile-firebase-adminsdk-fbsvc-6178badd66.json');

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

function normalizeName(name: string): string {
  const trimmed = (name || '').replace(/\s+/g, '').trim();
  return trimmed.endsWith('역') ? trimmed.slice(0, -1) : trimmed;
}

function normalizeLineName(lineNum: string): string {
  const v = String(lineNum || '').trim();
  if (!v) return '';
  const digits = v.replace(/\D/g, '');
  if (digits) return `${parseInt(digits, 10)}호선`;
  return v;
}

function normalizeLineCode(lineNum: string): string {
  const digits = String(lineNum || '').replace(/\D/g, '');
  return digits ? String(parseInt(digits, 10)) : '';
}

function loadSeoulData(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ JSON not found: ${filePath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const items = raw?.DATA || raw?.data || raw || [];
  return Array.isArray(items) ? items : [];
}

async function main() {
  console.log('🔧 Add missing stations from Seoul JSON');
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Apply: ${apply ? 'YES' : 'NO (dry-run)'}`);

  const rows = loadSeoulData(jsonPath);
  const snap = await db.collection('config_stations').get();
  const existing = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));

  const existingByNameLine = new Set<string>();
  for (const s of existing) {
    const name = s.data.stationName || s.data.name || s.id;
    const nameKey = normalizeName(name);
    const lines = Array.isArray(s.data?.lines) ? s.data.lines : [];
    for (const line of lines) {
      const lineName = normalizeLineName(line.lineName || '');
      if (!lineName) continue;
      existingByNameLine.add(`${nameKey}|${lineName}`);
    }
  }

  let created = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const row of rows) {
    const stationName = String(row.station_nm || '').trim();
    if (!stationName) continue;
    const nameKey = normalizeName(stationName);
    const lineName = normalizeLineName(row.line_num || '');
    const lineCode = normalizeLineCode(row.line_num || '');
    if (!lineName) continue;
    const nameLineKey = `${nameKey}|${lineName}`;
    if (existingByNameLine.has(nameLineKey)) {
      continue;
    }

    const docId = row.fr_code || row.station_cd || `${lineCode}_${nameKey}`;
    const ref = db.collection('config_stations').doc(String(docId));

    const payload = {
      stationId: String(docId),
      stationName: stationName.endsWith('역') ? stationName : `${stationName}역`,
      stationNameEnglish: row.station_nm_eng || '',
      lines: [
        {
          lineId: lineCode || lineName,
          lineName,
          lineCode,
          lineColor: '#000000',
          lineType: 'general',
        },
      ],
      location: {
        latitude: 0,
        longitude: 0,
      },
      locationMissing: true,
      isTransferStation: false,
      isExpressStop: false,
      isTerminus: false,
      facilities: {
        hasElevator: false,
        hasEscalator: false,
        wheelchairAccessible: false,
      },
      region: 'seoul',
      priority: 1,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(ref, payload, { merge: true });
    batchCount++;
    created++;

    if (batchCount >= 400) {
      if (apply) {
        await batch.commit();
      }
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0 && apply) {
    await batch.commit();
  }

  console.log(`- Created: ${created}`);
  console.log('✅ Done');
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
