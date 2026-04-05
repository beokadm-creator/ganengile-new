/**
 * Normalize station ids in requests/routes to config_stations canonical ids.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=... npx tsx scripts/normalize-station-ids-in-documents.ts
 *   FIREBASE_SERVICE_ACCOUNT_PATH=... npx tsx scripts/normalize-station-ids-in-documents.ts --apply
 */

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(process.env.HOME || '', 'Downloads/ganengile-firebase-adminsdk-fbsvc-6178badd66.json');

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`Service account not found: ${serviceAccountPath}`);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

type StationDoc = {
  id: string;
  data: any;
};

function normalizeName(name?: string): string {
  const trimmed = String(name ?? '')
    .replace(/\s+/g, '')
    .trim();
  if (!trimmed) return '';
  return trimmed.endsWith('역') ? trimmed.slice(0, -1) : trimmed;
}

function normalizeLineCode(value?: string): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? String(parseInt(digits, 10)) : '';
}

function stationScore(station: StationDoc, wantedLineCode?: string): number {
  let score = 0;
  if (station.data?.isActive) score += 10;
  if (station.data?.fare?.stationCode ?? station.data?.kric?.stationCode) score += 8;
  if (station.data?.location?.lat ?? station.data?.location?.latitude) score += 3;
  const lines = Array.isArray(station.data?.lines) ? station.data.lines : [];
  if (lines.length > 0) score += 2;
  if (wantedLineCode) {
    const found = lines.some((l: any) => normalizeLineCode(l?.lineCode ?? l?.lineName) === wantedLineCode);
    if (found) score += 15;
  }
  return score;
}

function buildStationPatch(station: StationDoc, original: any): any {
  const firstLine = Array.isArray(station.data?.lines) ? station.data.lines[0] : null;
  const lat = station.data?.location?.lat ?? station.data?.location?.latitude ?? original?.lat ?? 0;
  const lng = station.data?.location?.lng ?? station.data?.location?.longitude ?? original?.lng ?? 0;
  return {
    id: station.id,
    stationId: station.id,
    stationName: station.data?.stationName || original?.stationName ?? station.id,
    line: firstLine?.lineName || original?.line ?? '',
    lineCode: firstLine?.lineCode || normalizeLineCode(firstLine?.lineName) || original?.lineCode ?? '',
    lat,
    lng,
  };
}

function isSameStationInfo(a: any, b: any): boolean {
  return (
    String(a?.stationId ?? '') === String(b?.stationId ?? '') &&
    String(a?.id ?? '') === String(b?.id ?? '') &&
    String(a?.stationName ?? '') === String(b?.stationName ?? '') &&
    String(a?.lineCode ?? '') === String(b?.lineCode ?? '') &&
    Number(a?.lat ?? 0) === Number(b?.lat ?? 0) &&
    Number(a?.lng ?? 0) === Number(b?.lng ?? 0)
  );
}

async function run() {
  console.log(`Normalize station ids (apply=${apply ? 'YES' : 'NO'})`);

  const [stationsSnap, requestsSnap, routesSnap] = await Promise.all([
    db.collection('config_stations').where('isActive', '==', true).get(),
    db.collection('requests').limit(5000).get(),
    db.collection('routes').limit(3000).get(),
  ]);

  const stations: StationDoc[] = stationsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const byId = new Map<string, StationDoc>();
  const byName = new Map<string, StationDoc[]>();

  for (const s of stations) {
    byId.set(s.id, s);
    const key = normalizeName(s.data?.stationName ?? s.id);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(s);
  }

  const unresolved = new Set<string>();
  const updateOps: Array<{
    ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
    patch: Record<string, any>;
  }> = [];

  const resolveStation = (raw: any): StationDoc | null => {
    const stationId = String(raw?.stationId || raw?.id ?? '').trim();
    const stationName = String(raw?.stationName ?? '').trim();
    const wantedLineCode = normalizeLineCode(raw?.lineCode ?? raw?.line);

    const direct = stationId ? byId.get(stationId) : undefined;
    if (direct && (direct.data?.fare?.stationCode ?? direct.data?.kric?.stationCode)) {
      return direct;
    }

    const nameKey = normalizeName(stationName ?? stationId);
    const candidates = byName.get(nameKey) ?? [];
    if (candidates.length === 0) {
      unresolved.add(stationId || stationName ?? '(empty)');
      return null;
    }

    const ranked = candidates
      .map((s) => ({ s, score: stationScore(s, wantedLineCode) }))
      .sort((a, b) => b.score - a.score ?? a.s.id.localeCompare(b.s.id));
    return ranked[0]?.s ?? null;
  };

  for (const doc of requestsSnap.docs) {
    const data = doc.data() as any;
    const pickupResolved = resolveStation(data?.pickupStation);
    const deliveryResolved = resolveStation(data?.deliveryStation);
    if (!pickupResolved ?? !deliveryResolved) continue;

    const pickupPatch = buildStationPatch(pickupResolved, data?.pickupStation);
    const deliveryPatch = buildStationPatch(deliveryResolved, data?.deliveryStation);

    const patch: Record<string, any> = {};
    if (!isSameStationInfo(data?.pickupStation, pickupPatch)) patch.pickupStation = pickupPatch;
    if (!isSameStationInfo(data?.deliveryStation, deliveryPatch)) patch.deliveryStation = deliveryPatch;

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      updateOps.push({ ref: doc.ref, patch });
    }
  }

  for (const doc of routesSnap.docs) {
    const data = doc.data() as any;
    const startResolved = resolveStation(data?.startStation);
    const endResolved = resolveStation(data?.endStation);
    if (!startResolved ?? !endResolved) continue;

    const startPatch = buildStationPatch(startResolved, data?.startStation);
    const endPatch = buildStationPatch(endResolved, data?.endStation);

    const patch: Record<string, any> = {};
    if (!isSameStationInfo(data?.startStation, startPatch)) patch.startStation = startPatch;
    if (!isSameStationInfo(data?.endStation, endPatch)) patch.endStation = endPatch;

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      updateOps.push({ ref: doc.ref, patch });
    }
  }

  console.log(
    JSON.stringify(
      {
        activeStations: stations.length,
        scannedRequests: requestsSnap.size,
        scannedRoutes: routesSnap.size,
        docsToUpdate: updateOps.length,
        unresolvedStationRefs: Array.from(unresolved).sort(),
      },
      null,
      2
    )
  );

  if (!apply) return;

  let batch = db.batch();
  let count = 0;
  for (const op of updateOps) {
    batch.update(op.ref, op.patch);
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
