import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const KRIC_SERVICE_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY;
const KRIC_LOCKER_API_URL = process.env.EXPO_PUBLIC_KRIC_LOCKER_API_URL || 'https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker';

if (!KRIC_SERVICE_KEY) {
  console.error('❌ EXPO_PUBLIC_KRIC_SERVICE_KEY is missing');
  process.exit(1);
}

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(process.env.HOME || '', 'Downloads/ganengile-firebase-adminsdk-fbsvc-6178badd66.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.warn(`⚠️ Service account not found at ${serviceAccountPath}, trying default credentials`);
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'ganengile'
    });
  }
} else {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
}

const db = admin.firestore();

function normalizeLockerSize(value: string = ''): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('소')) return 'small';
  if (normalized.includes('대')) return 'large';
  return 'medium';
}

function normalizeOperator(value: string = ''): string {
  const normalized = value.toLowerCase();
  if (normalized === 'k1') return 'korail';
  if (['i1', 'd1', 'b1', 'g1'].includes(normalized)) return 'local_gov';
  if (normalized === 's1') return 'seoul_metro';
  return 'seoul_metro';
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🔄 Syncing lockers from KRIC API...');

  // 1. Load all stations that have KRIC config
  const stationsSnap = await db.collection('config_stations').get();
  const stations = stationsSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  
  let successCount = 0;
  let emptyCount = 0;
  let errorCount = 0;

  for (const station of stations) {
    const kric = station.data.kric;
    const lines = station.data.lines || [];
    const lineCode = kric?.lineCode || lines[0]?.lineCode;
    const stationCode = kric?.stationCode || station.id;
    const railCode = kric?.railOprIsttCd || 'S1';

    if (!lineCode || !stationCode) {
      continue;
    }

    const queryString = `?serviceKey=${KRIC_SERVICE_KEY}&format=json&railOprIsttCd=${railCode}&lnCd=${lineCode}&stinCd=${stationCode}`;
    const url = KRIC_LOCKER_API_URL + queryString;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`⚠️ Fetch failed for ${station.data.stationName || station.id}: HTTP ${res.status}`);
        errorCount++;
        continue;
      }

      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        console.warn(`⚠️ Parse failed for ${station.data.stationName || station.id}:`, text);
        errorCount++;
        continue;
      }

      const rawItems = payload?.body || [];

      if (!rawItems || rawItems.length === 0 || (payload.header && payload.header.resultCode !== '00')) {
        emptyCount++;
        continue;
      }

      const batch = db.batch();
      let hasUpdates = false;

      for (let i = 0; i < rawItems.length; i++) {
        const record = rawItems[i];
        const facilityCount = Number(record.faclNum) || 1;
        const baseFare = Number(record.utlFare) || 0;
        const line = record.lnCd;
        const floorNum = Number(record.stinFlor) || 1;
        const isUnderground = record.grndDvNm === '지하';
        const operatorCode = record.railOprIsttCd;

        const lockerId = `${stationCode}-${i + 1}`;
        const ref = db.collection('lockers').doc(lockerId);

        const payloadData = {
          lockerId,
          type: 'public',
          operator: normalizeOperator(operatorCode),
          location: {
            stationId: stationCode,
            stationName: station.data.stationName || station.id,
            line: line ? `${line}호선` : '',
            floor: isUnderground ? -floorNum : floorNum,
            section: record.dtlLoc || `보관함 ${i + 1}`,
            latitude: station.data.location?.latitude ?? station.data.location?.lat,
            longitude: station.data.location?.longitude ?? station.data.location?.lng,
            address: '',
            contactPhone: record.telNo || '',
            nearby: false,
          },
          size: normalizeLockerSize(record.szNm),
          pricing: {
            base: baseFare,
            baseDuration: 240,
            extension: 0,
          },
          availability: {
            total: facilityCount,
            occupied: 0,
            available: facilityCount
          },
          status: 'available',
          qrCode: '',
          accessMethod: 'qr',
          isSubway: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'kric_api'
        };

        batch.set(ref, payloadData, { merge: true });
        hasUpdates = true;
      }

      if (hasUpdates) {
        await batch.commit();
        successCount += rawItems.length;
        console.log(`✅ Synced ${rawItems.length} lockers for ${station.data.stationName || station.id}`);
      }

    } catch (e) {
      console.error(`❌ Error syncing ${station.data.stationName || station.id}:`, e);
      errorCount++;
    }

    // Be nice to the API
    await delay(100);
  }

  console.log(`\n🎉 Sync complete!`);
  console.log(`- Lockers updated/created: ${successCount}`);
  console.log(`- Stations with no lockers: ${emptyCount}`);
  console.log(`- Errors: ${errorCount}`);
}

main().catch(console.error);
