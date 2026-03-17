/**
 * Seed config_fares for request/route station pairs by calling Seoul fare API.
 *
 * Usage:
 *   EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY=... npx tsx scripts/seed-fares-from-api.ts
 *   EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY=... npx tsx scripts/seed-fares-from-api.ts --apply
 */

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(process.env.HOME || '', 'Downloads/ganengile-firebase-adminsdk-fbsvc-6178badd66.json');

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

const FARE_API_URL = process.env.EXPO_PUBLIC_SEOUL_FARE_API_URL || 'https://apis.data.go.kr/B553766/fare';
const FARE_SERVICE_KEY = process.env.EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY || '';
if (!FARE_SERVICE_KEY) {
  throw new Error('EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY is required');
}

function getEncodedServiceKey(key: string): string {
  return key.includes('%') ? key : encodeURIComponent(key);
}

function normalizeItems(payload: any): any[] {
  const candidates =
    payload?.response?.body?.items?.item ||
    payload?.body?.items?.item ||
    payload?.getRltmFare?.row ||
    payload?.getRltmFare ||
    payload?.row ||
    [];
  const list = Array.isArray(candidates) ? candidates : [candidates];
  return list.filter(Boolean);
}

function extractFare(items: any[]): { fare: number; raw: any } | null {
  if (!items.length) return null;
  const item = items[0];
  const v = [item?.gnrlCardFare, item?.gnrlCashFare, item?.fare]
    .map((x) => (typeof x === 'string' ? parseInt(x, 10) : x))
    .find((x) => typeof x === 'number' && !Number.isNaN(x) && x > 0) as number | undefined;
  if (!v) return null;
  return { fare: v, raw: item };
}

async function fetchFareByCode(dptreStnCd: string, arvlStnCd: string): Promise<{ fare: number; raw: any } | null> {
  const base = FARE_API_URL.replace(/\/$/, '');
  const params = new URLSearchParams({
    serviceKey: getEncodedServiceKey(FARE_SERVICE_KEY),
    dataType: 'JSON',
    dptreStnCd,
    arvlStnCd,
    selectFields: 'gnrlCardFare,gnrlCashFare,yungCardFare,yungCashFare,childCardFare,childCashFare,mvmnDstc',
  });
  const url = `${base}/getRltmFare?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return extractFare(normalizeItems(json));
  } catch {
    const match = text.match(/<gnrlCardFare>(\d+)<\/gnrlCardFare>/);
    if (!match) return null;
    const fare = parseInt(match[1], 10);
    if (!Number.isFinite(fare) || fare <= 0) return null;
    return { fare, raw: { gnrlCardFare: fare } };
  }
}

async function fetchFareByName(dptreStnNm: string, arvlStnNm: string): Promise<{ fare: number; raw: any } | null> {
  const base = FARE_API_URL.replace(/\/$/, '');
  const params = new URLSearchParams({
    serviceKey: getEncodedServiceKey(FARE_SERVICE_KEY),
    dataType: 'JSON',
    dptreStnNm,
    avrlStnNm: arvlStnNm,
    selectFields: 'gnrlCardFare,gnrlCashFare,yungCardFare,yungCashFare,childCardFare,childCashFare,mvmnDstc',
  });
  const url = `${base}/getRltmFare?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return extractFare(normalizeItems(json));
  } catch {
    return null;
  }
}

async function run() {
  const [stationsSnap, requestsSnap, routesSnap] = await Promise.all([
    db.collection('config_stations').where('isActive', '==', true).get(),
    db.collection('requests').limit(5000).get(),
    db.collection('routes').where('isActive', '==', true).limit(2000).get(),
  ]);

  const stations = new Map<string, any>();
  stationsSnap.docs.forEach((d) => stations.set(d.id, d.data()));

  const pairCodes = new Set<string>();
  const stationNameByCode = new Map<string, string>();
  const add = (a?: string, b?: string) => {
    const from = String(a || '').trim();
    const to = String(b || '').trim();
    if (!from || !to || from === to) return;
    const s1 = stations.get(from);
    const s2 = stations.get(to);
    const c1 = s1?.fare?.stationCode || s1?.kric?.stationCode;
    const c2 = s2?.fare?.stationCode || s2?.kric?.stationCode;
    if (!c1 || !c2) return;
    const n1 = String(s1?.stationName || '').trim();
    const n2 = String(s2?.stationName || '').trim();
    if (n1) stationNameByCode.set(String(c1), n1.endsWith('역') ? n1.slice(0, -1) : n1);
    if (n2) stationNameByCode.set(String(c2), n2.endsWith('역') ? n2.slice(0, -1) : n2);
    pairCodes.add(`${c1}_${c2}`);
  };

  requestsSnap.docs.forEach((d) => {
    const r = d.data() as any;
    add(r?.pickupStation?.stationId, r?.deliveryStation?.stationId);
    add(r?.deliveryStation?.stationId, r?.pickupStation?.stationId);
  });
  routesSnap.docs.forEach((d) => {
    const r = d.data() as any;
    add(r?.startStation?.stationId, r?.endStation?.stationId);
    add(r?.endStation?.stationId, r?.startStation?.stationId);
  });

  const missing: string[] = [];
  for (const key of pairCodes) {
    const snap = await db.collection('config_fares').doc(key).get();
    if (!snap.exists || !((snap.data() as any)?.fare > 0)) missing.push(key);
  }

  console.log(
    JSON.stringify(
      {
        apply,
        pairCodes: pairCodes.size,
        missingBefore: missing.length,
        sample: missing.slice(0, 20),
      },
      null,
      2
    )
  );

  if (!apply || !missing.length) return;

  let updated = 0;
  const failed: string[] = [];
  for (const key of missing) {
    const [from, to] = key.split('_');
    let fareResult = await fetchFareByCode(from, to);
    if (!fareResult) {
      const fromName = stationNameByCode.get(from);
      const toName = stationNameByCode.get(to);
      if (fromName && toName) {
        fareResult = await fetchFareByName(fromName, toName);
      }
    }
    if (!fareResult?.fare) {
      failed.push(key);
      continue;
    }
    await db
      .collection('config_fares')
      .doc(key)
      .set(
        {
          departureStationCode: from,
          arrivalStationCode: to,
          fare: fareResult.fare,
          raw: fareResult.raw || null,
          source: 'seed_script',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    updated++;
  }

  console.log(
    JSON.stringify(
      {
        updated,
        failed: failed.length,
        failedSample: failed.slice(0, 20),
      },
      null,
      2
    )
  );
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
