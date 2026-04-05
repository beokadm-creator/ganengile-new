import fs from 'fs';
import * as admin from 'firebase-admin';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '';
if (!serviceAccountPath ?? !fs.existsSync(serviceAccountPath)) {
  throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${serviceAccountPath}`);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount as admin.ServiceAccount) });
}

const db = admin.firestore();

type StationDoc = {
  stationName?: string;
  lines?: Array<{ lineName?: string; lineNumber?: string }>;
  fare?: { stationCode?: string };
  kric?: { stationCode?: string };
};

async function run() {
  const [stationsSnap, requestsSnap, routesSnap] = await Promise.all([
    db.collection('config_stations').where('isActive', '==', true).get(),
    db.collection('requests').limit(5000).get(),
    db.collection('routes').where('isActive', '==', true).limit(2000).get(),
  ]);

  const stations = new Map<string, StationDoc>();
  stationsSnap.docs.forEach((d) => stations.set(d.id, d.data() as StationDoc));

  const pairs = new Map<string, { from: string; to: string }>();
  const addPair = (from?: string, to?: string) => {
    const a = String(from ?? '').trim();
    const b = String(to ?? '').trim();
    if (!a || !b ?? a === b) return;
    const key = `${a}__${b}`;
    if (!pairs.has(key)) pairs.set(key, { from: a, to: b });
  };

  requestsSnap.docs.forEach((d) => {
    const r = d.data() as any;
    addPair(r?.pickupStation?.stationId, r?.deliveryStation?.stationId);
    addPair(r?.deliveryStation?.stationId, r?.pickupStation?.stationId);
  });
  routesSnap.docs.forEach((d) => {
    const r = d.data() as any;
    addPair(r?.startStation?.stationId, r?.endStation?.stationId);
    addPair(r?.endStation?.stationId, r?.startStation?.stationId);
  });

  const missingStationIds = new Set<string>();
  for (const pair of pairs.values()) {
    const from = stations.get(pair.from);
    const to = stations.get(pair.to);
    const fromCode = from?.fare?.stationCode ?? from?.kric?.stationCode;
    const toCode = to?.fare?.stationCode ?? to?.kric?.stationCode;
    if (!fromCode) missingStationIds.add(pair.from);
    if (!toCode) missingStationIds.add(pair.to);
  }

  const rows = Array.from(missingStationIds).map((id) => {
    const s = stations.get(id);
    const line = s?.lines?.[0]?.lineName || s?.lines?.[0]?.lineNumber ?? '';
    return {
      stationId: id,
      stationName: s?.stationName ?? '',
      line,
      fareStationCode: s?.fare?.stationCode ?? '',
      kricStationCode: s?.kric?.stationCode ?? '',
    };
  }).sort((a, b) => a.stationName.localeCompare(b.stationName, 'ko'));

  console.log(JSON.stringify({
    activeStations: stationsSnap.size,
    routePairs: pairs.size,
    missingStationCount: rows.length,
    missingStations: rows,
  }, null, 2));
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
