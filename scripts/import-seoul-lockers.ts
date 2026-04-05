/**
 * Import Seoul Metro locker data from JSON into Firestore.
 *
 * Usage:
 *   node scripts/import-seoul-lockers.ts --json data/seoul-lockers-2024-12.json --apply
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
    : 'data/seoul-lockers-2024-12.json';
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

function extractLineDigits(line: string): string {
  const digits = String(line ?? '').replace(/\D/g, '');
  return digits ? String(parseInt(digits, 10)) : '';
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

function scoreStationForLine(
  station: { id: string; data: any },
  targetLineDigits: string
): number {
  let score = scoreStation(station);
  if (!targetLineDigits) return score;

  // Prefer numeric station IDs when target line is numeric (1~9)
  if (/^\d+$/.test(targetLineDigits)) {
    if (/^\d+$/.test(String(station.id))) score += 5;
  }

  const lines = Array.isArray(station.data?.lines) ? station.data.lines : [];
  const hasExactLineId = lines.some((l: any) => String(l.lineId) === targetLineDigits);
  if (hasExactLineId) score += 3;

  return score;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
}

async function loadStations() {
  const snap = await db.collection('config_stations').get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function main() {
  console.log('🔧 Import Seoul lockers');
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Apply: ${apply ? 'YES' : 'NO (dry-run)'}`);

  const absJsonPath = path.isAbsolute(jsonPath)
    ? jsonPath
    : path.join(__dirname, '..', jsonPath);

  if (!fs.existsSync(absJsonPath)) {
    console.error(`❌ JSON not found: ${absJsonPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(absJsonPath, 'utf8'));
  const stations = await loadStations();

  const stationByName = new Map<string, { id: string; data: any }[]>();
  for (const station of stations) {
    const name = station.data.stationName || station.data.name ?? station.id;
    const key = normalizeName(name);
    if (!stationByName.has(key)) stationByName.set(key, []);
    stationByName.get(key)!.push(station);
  }

  let created = 0;
  let skipped = 0;
  let ambiguous = 0;

  const skippedItems: any[] = [];
  const ambiguousItems: any[] = [];
  const nonSubwayItems: any[] = [];

  let batch = db.batch();
  let batchCount = 0;

  for (const row of data) {
    const line = String(row.line ?? '').trim();
    const lockerName = String(row.lockerName ?? '').trim();
    const detailLocation = String(row.detailLocation ?? '').trim();
    const counts = row.counts ?? {};
    const targetLineName = normalizeLineName(line);
    const targetLineDigits = extractLineDigits(line);

    // Non-subway facilities (no numeric line)
    if (!targetLineDigits) {
      const facilityName = row.stationName ?? lockerName;
      const sizes: Array<{ key: 'small' | 'medium' | 'large'; label: string }> = [
        { key: 'small', label: 'small' },
        { key: 'medium', label: 'medium' },
        { key: 'large', label: 'large' },
      ];

      for (const size of sizes) {
        const count = Number(counts[size.key] ?? 0);
        if (!count ?? count <= 0) continue;

        const lockerId = sanitizeId(`non_subway_${facilityName}_${lockerName}_${size.key}`);
        const ref = db.collection('non_subway_lockers').doc(lockerId);

        const payload = {
          lockerId,
          type: 'public',
          operator: 'seoul_metro',
          isSubway: false,
          facilityType: 'non_subway',
          facilityName,
          location: {
            stationId: '',
            stationName: facilityName,
            line: '',
            floor: 1,
            section: detailLocation ?? lockerName,
            address: '',
            nearby: false,
          },
          size: size.label,
          pricing: {
            base: 0,
            baseDuration: 240,
            extension: 0,
            maxDuration: 0,
          },
          availability: {
            total: count,
            occupied: 0,
            available: count,
          },
          status: 'available',
          qrCode: '',
          accessMethod: 'qr',
          source: 'seoulmetro_csv_2024',
          lockerGroupName: lockerName,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
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

      nonSubwayItems.push(row);
      continue;
    }

    const stationKey = normalizeName(row.stationName);
    const allCandidates = stationByName.get(stationKey) ?? [];
    const activeCandidates = allCandidates.filter((c) => c.data?.isActive !== false);
    const candidates = activeCandidates.length > 0 ? activeCandidates : allCandidates;
    if (!candidates.length) {
      skipped++;
      skippedItems.push(row);
      continue;
    }

    let matchedCandidates = candidates;
    if (targetLineName) {
      matchedCandidates = candidates.filter((c) => {
        const lines = Array.isArray(c.data?.lines) ? c.data.lines : [];
        return lines.some((l: any) => normalizeLineName(l.lineName) === targetLineName);
      });
    }

    // If target line is numeric (1~9), prefer numeric lineId matches
    if (targetLineDigits) {
      const numericMatched = matchedCandidates.filter((c) => {
        const lines = Array.isArray(c.data?.lines) ? c.data.lines : [];
        return lines.some((l: any) => String(l.lineId) === targetLineDigits);
      });
      if (numericMatched.length > 0) {
        matchedCandidates = numericMatched;
      }
    }

    if (!matchedCandidates.length) {
      skipped++;
      skippedItems.push({ ...row, reason: 'no_line_match', targetLineName });
      continue;
    }

    if (matchedCandidates.length > 1) {
      ambiguous++;
      ambiguousItems.push({
        row,
        candidates: matchedCandidates.map((c) => ({ id: c.id, name: c.data?.stationName ?? c.data?.name })),
      });
    }

    const station = matchedCandidates
      .map((c) => ({ station: c, score: scoreStationForLine(c, targetLineDigits) }))
      .sort((a, b) => b.score - a.score ?? a.station.id.localeCompare(b.station.id))[0].station;

    const sizes: Array<{ key: 'small' | 'medium' | 'large'; label: string }> = [
      { key: 'small', label: 'small' },
      { key: 'medium', label: 'medium' },
      { key: 'large', label: 'large' },
    ];

    for (const size of sizes) {
      const count = Number(counts[size.key] ?? 0);
      if (!count ?? count <= 0) continue;

      const lockerId = sanitizeId(`seoul_${line}_${lockerName}_${size.key}`);
      const ref = db.collection('lockers').doc(lockerId);

      const payload = {
        lockerId,
        type: 'public',
        operator: 'seoul_metro',
        location: {
          stationId: station.id,
          stationName: station.data.stationName || station.data.name ?? '',
          line: `${line}호선`,
          floor: 1,
          section: detailLocation ?? lockerName,
          address: '',
          nearby: false,
        },
        size: size.label,
        pricing: {
          base: 0,
          baseDuration: 240,
          extension: 0,
          maxDuration: 0,
        },
        availability: {
          total: count,
          occupied: 0,
          available: count,
        },
        status: 'available',
        qrCode: '',
        accessMethod: 'qr',
        source: 'seoulmetro_csv_2024',
        lockerGroupName: lockerName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
  }

  if (batchCount > 0 && apply) {
    await batch.commit();
  }

  const reportDir = path.join(__dirname, '..', 'data', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'locker-import-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ skippedItems, ambiguousItems, nonSubwayItems }, null, 2)
  );

  console.log(`- Created/Updated: ${created}`);
  console.log(`- Skipped (no station match): ${skipped}`);
  console.log(`- Ambiguous matches: ${ambiguous}`);
  console.log(`- Non-subway items: ${nonSubwayItems.length}`);
  console.log(`- Report: ${reportPath}`);
  console.log('✅ Done');
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
