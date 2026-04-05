/**
 * Deduplicate config_stations by (station name + line name).
 *
 * Usage:
 *   node scripts/deduplicate-config-stations.ts --apply
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(process.env.HOME || '', 'Downloads/ganengile-firebase-adminsdk-fbsvc-6178badd66.json');

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
  const trimmed = (name ?? '').replace(/\s+/g, '').trim();
  return trimmed.endsWith('역') ? trimmed.slice(0, -1) : trimmed;
}

function normalizeLineName(line: string): string {
  const v = String(line ?? '').trim();
  if (!v) return '';
  const digits = v.replace(/\D/g, '');
  if (digits) return `${parseInt(digits, 10)}호선`;
  return v;
}

function scoreStation(station: { id: string; data: any }, lineName: string): number {
  let score = 0;
  if (station.data?.isActive) score += 10;
  if (station.data?.location?.latitude && station.data?.location?.longitude) score += 5;
  const lines = Array.isArray(station.data?.lines) ? station.data.lines.length : 0;
  score += Math.min(lines, 5);
  if (station.data?.isTransferStation) score += 3;
  if (typeof station.data?.priority === 'number') score += station.data.priority;

  // Prefer numeric lineId for numeric line
  const digits = lineName.replace(/\D/g, '');
  if (digits) {
    const hasExactLineId = (station.data?.lines ?? []).some((l: any) => String(l.lineId) === digits);
    if (hasExactLineId) score += 3;
  }

  // Prefer numeric stationId for numeric lines
  if (digits && /^\d+$/.test(String(station.id))) score += 2;

  return score;
}

async function main() {
  console.log('🔧 Deduplicate config_stations');
  console.log(`- Apply: ${apply ? 'YES' : 'NO (dry-run)'}`);

  const snap = await db.collection('config_stations').get();
  const stations = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));

  const groups = new Map<string, { station: { id: string; data: any }; lineName: string }[]>();

  for (const station of stations) {
    const name = station.data.stationName || station.data.name ?? station.id;
    const nameKey = normalizeName(name);
    const lines = Array.isArray(station.data?.lines) ? station.data.lines : [];
    for (const line of lines) {
      const lineName = normalizeLineName(line.lineName ?? '');
      if (!lineName) continue;
      const key = `${nameKey}|${lineName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ station, lineName });
    }
  }

  let toDeactivate: string[] = [];
  for (const [key, entries] of groups.entries()) {
    if (entries.length <= 1) continue;
    const ranked = entries
      .map((e) => ({
        id: e.station.id,
        score: scoreStation(e.station, e.lineName),
      }))
      .sort((a, b) => b.score - a.score ?? a.id.localeCompare(b.id));
    const keep = ranked[0]?.id;
    for (const entry of entries) {
      if (entry.station.id !== keep) {
        toDeactivate.push(entry.station.id);
      }
    }
  }

  toDeactivate = Array.from(new Set(toDeactivate));
  console.log(`- Duplicates to deactivate: ${toDeactivate.length}`);

  if (!apply) {
    console.log('Dry-run mode. No changes applied.');
    return;
  }

  let batch = db.batch();
  let batchCount = 0;
  for (const id of toDeactivate) {
    const ref = db.collection('config_stations').doc(id);
    batch.update(ref, {
      isActive: false,
      duplicateOf: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batchCount++;
    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log('✅ Done');
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
