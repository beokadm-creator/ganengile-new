/**
 * Backfill missing config_stations.stationName using Seoul station JSON by fare.stationCode.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=... npx tsx scripts/backfill-station-names-from-seoul-json.ts
 *   FIREBASE_SERVICE_ACCOUNT_PATH=... npx tsx scripts/backfill-station-names-from-seoul-json.ts --apply
 */

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

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
  throw new Error(`Service account not found: ${serviceAccountPath}`);
}
if (!fs.existsSync(jsonPath)) {
  throw new Error(`JSON not found: ${jsonPath}`);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}
const db = admin.firestore();

type SeoulRow = {
  station_nm?: string;
  station_nm_eng?: string;
  station_cd?: string;
};

async function run() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const rows: SeoulRow[] = Array.isArray(raw?.DATA) ? raw.DATA : Array.isArray(raw) ? raw : [];

  const byCode = new Map<string, SeoulRow>();
  for (const row of rows) {
    const code = String(row.station_cd || '').trim();
    if (!code || byCode.has(code)) continue;
    byCode.set(code, row);
  }

  const snap = await db.collection('config_stations').get();
  const targets = snap.docs.filter((doc) => {
    const data = doc.data() as any;
    const name = String(data?.stationName || '').trim();
    const code = String(data?.fare?.stationCode || '').trim();
    return !name && !!code && byCode.has(code);
  });

  console.log(
    JSON.stringify(
      {
        apply,
        stations: snap.size,
        candidates: targets.length,
      },
      null,
      2
    )
  );

  if (!apply) return;

  let batch = db.batch();
  let count = 0;
  for (const doc of targets) {
    const data = doc.data() as any;
    const code = String(data?.fare?.stationCode || '').trim();
    const row = byCode.get(code);
    if (!row) continue;
    const stationName = String(row.station_nm || '').trim();
    if (!stationName) continue;

    batch.update(doc.ref, {
      stationName: stationName.endsWith('역') ? stationName : `${stationName}역`,
      stationNameEnglish: String(row.station_nm_eng || '').trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 400 !== 0) {
    await batch.commit();
  }
  console.log(`Applied updates: ${count}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
