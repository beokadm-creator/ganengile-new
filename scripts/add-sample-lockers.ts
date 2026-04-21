/**
 * Add sample locker data for stations that don't have KRIC data.
 * Run: NODE_PATH=functions/node_modules npx tsx scripts/add-sample-lockers.ts
 */
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'ganengile' });
}

const db = admin.firestore();

const SAMPLE_LOCKERS: Array<{
  lockerId: string;
  stationId: string;
  stationName: string;
  line: string;
  floor: number;
  section: string;
  latitude: number;
  longitude: number;
  base: number;
  size: string;
  total: number;
}> = [
  // 문정역 (8호선)
  {
    lockerId: '818-1',
    stationId: '818',
    stationName: '문정역',
    line: '8호선',
    floor: -1,
    section: '1번 출구 앞',
    latitude: 37.486,
    longitude: 127.1225,
    base: 2000,
    size: 'medium',
    total: 6,
  },
  {
    lockerId: '818-2',
    stationId: '818',
    stationName: '문정역',
    line: '8호선',
    floor: -1,
    section: '3번 출구 앞',
    latitude: 37.4865,
    longitude: 127.123,
    base: 2000,
    size: 'small',
    total: 4,
  },
  // 장지역 (8호선)
  {
    lockerId: '819-1',
    stationId: '819',
    stationName: '장지역',
    line: '8호선',
    floor: -1,
    section: '1번 출구 앞',
    latitude: 37.4796,
    longitude: 127.1274,
    base: 2000,
    size: 'medium',
    total: 4,
  },
  // 복정역 (8호선)
  {
    lockerId: '820-1',
    stationId: '820',
    stationName: '복정역',
    line: '8호선',
    floor: -1,
    section: '2번 출구 앞',
    latitude: 37.4744,
    longitude: 127.1255,
    base: 2000,
    size: 'medium',
    total: 6,
  },
  // 산성역 (8호선)
  {
    lockerId: '821-1',
    stationId: '821',
    stationName: '산성역',
    line: '8호선',
    floor: -1,
    section: '1번 출구 대합실',
    latitude: 37.468,
    longitude: 127.126,
    base: 2000,
    size: 'medium',
    total: 4,
  },
  // 남한산성입구역 (8호선)
  {
    lockerId: '822-1',
    stationId: '822',
    stationName: '남한산성입구역',
    line: '8호선',
    floor: -1,
    section: '승강장 앞',
    latitude: 37.462,
    longitude: 127.127,
    base: 2000,
    size: 'small',
    total: 4,
  },
  // 모란역 (8호선)
  {
    lockerId: '823-1',
    stationId: '823',
    stationName: '모란역',
    line: '8호선',
    floor: -1,
    section: '1번 출구 대합실',
    latitude: 37.4544,
    longitude: 127.1289,
    base: 2000,
    size: 'large',
    total: 8,
  },
];

async function main() {
  console.log('📦 Adding sample lockers...');

  const batch = db.batch();

  for (const locker of SAMPLE_LOCKERS) {
    const ref = db.collection('lockers').doc(locker.lockerId);
    batch.set(ref, {
      lockerId: locker.lockerId,
      type: 'public',
      operator: 'seoul_metro',
      location: {
        stationId: locker.stationId,
        stationName: locker.stationName,
        line: locker.line,
        floor: locker.floor,
        section: locker.section,
        latitude: locker.latitude,
        longitude: locker.longitude,
        address: '',
        contactPhone: '',
        nearby: false,
      },
      size: locker.size,
      pricing: {
        base: locker.base,
        baseDuration: 240,
        extension: 0,
      },
      availability: {
        total: locker.total,
        occupied: 0,
        available: locker.total,
      },
      status: 'available',
      qrCode: '',
      accessMethod: 'qr',
      isSubway: true,
      source: 'sample_data',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  ✅ ${locker.stationName} - ${locker.section} (${locker.size}, ${locker.total}개)`);
  }

  await batch.commit();
  console.log(`\n🎉 Added ${SAMPLE_LOCKERS.length} sample lockers to Firestore!`);
}

main().catch(console.error);
