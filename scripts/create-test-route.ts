/**
 * Create Test Route for Giller
 * 길러 테스트 동선 생성 스크립트
 *
 * Usage:
 *   npx tsx scripts/create-test-route.ts
 */

import admin from 'firebase-admin';
import * as fs from 'fs';

// Service Account Key 경로
const serviceAccountPath = '/Users/aaron/Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json';

// Load service account
const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf-8')
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

interface RouteData {
  gillerId: string;
  startStation: {
    stationId: string;
    stationName: string;
    line: string;
    lat: number;
    lng: number;
  };
  endStation: {
    stationId: string;
    stationName: string;
    line: string;
    lat: number;
    lng: number;
  };
  departureTime: string;
  selectedDays: number[];
}

async function createTestRoute() {
  try {
    // 테스트 길러 ID (이전에 생성한 테스트 사용자)
    const gillerId = 'test-user-ganengile-com';

    // 동선 데이터: 서울역 → 강남역 (08:00, 월~금)
    const routeData: RouteData = {
      gillerId,
      startStation: {
        stationId: 'station-seoul',
        stationName: '서울역',
        line: '1호선',
        lat: 37.5547,
        lng: 126.9707,
      },
      endStation: {
        stationId: 'station-gangnam',
        stationName: '강남역',
        line: '2호선',
        lat: 37.4980,
        lng: 127.0276,
      },
      departureTime: '08:00',
      selectedDays: [1, 2, 3, 4, 5], // 월~금
    };

    // Firestore에 동선 생성
    const routeRef = await db.collection('routes').add({
      ...routeData,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.warn('✅ Test route created successfully!');
    console.warn('Route ID:', routeRef.id);
    console.warn('Giller ID:', gillerId);
    console.warn('Route: 서울역 → 강남역');
    console.warn('Time: 08:00');
    console.warn('Days: 월~금');

    // 생성된 동선 확인
    const doc = await routeRef.get();
    if (doc.exists) {
      console.warn('✅ Route document verified in Firestore');
    }

  } catch (error) {
    console.error('❌ Error creating test route:', error);
    process.exit(1);
  }
}

// 실행
void createTestRoute().then(() => {
  console.warn('\n✨ Done!');
  process.exit(0);
});
