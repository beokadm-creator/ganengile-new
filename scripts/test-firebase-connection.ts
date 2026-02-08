/**
 * Firebase Connection Test Script
 *
 * Firebase 연결과 Config 데이터 읽기 테스트
 *
 * Usage:
 *   npx tsx scripts/test-firebase-connection.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import 'dotenv/config';

// Firebase 초기화
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

console.log('🔥 Firebase Configuration:');
console.log('  Project ID:', firebaseConfig.projectId);
console.log('  Auth Domain:', firebaseConfig.authDomain);

// Firebase App 초기화
const app = initializeApp(firebaseConfig);
console.log('✅ Firebase App initialized');

// Firestore 초기화
const db = getFirestore(app);
console.log('✅ Firestore initialized');

/**
 * Config Collections 테스트
 */
async function testConfigCollections() {
  console.log('\n📋 Testing Config Collections...\n');

  const configCollections = [
    'config_stations',
    'config_travel_times',
    'config_express_trains',
    'config_congestion',
    'config_algorithm_params',
  ];

  const results = {
    success: [] as string[],
    failed: [] as string[],
  };

  for (const collectionName of configCollections) {
    try {
      const colRef = collection(db, collectionName);
      const snapshot = await getDocs(colRef);

      if (snapshot.empty) {
        console.log(`⚠️  ${collectionName}: No documents found`);
        results.failed.push(`${collectionName} (empty)`);
      } else {
        console.log(`✅ ${collectionName}: ${snapshot.docs.length} documents`);
        results.success.push(`${collectionName} (${snapshot.docs.length})`);

        // 첫 번째 문서 샘플 출력
        const firstDoc = snapshot.docs[0];
        console.log(`   Sample: ${firstDoc.id}`);

        // 특정 컬렉션 상세 정보
        if (collectionName === 'config_stations') {
          const sampleData = firstDoc.data();
          console.log(`   Sample station: ${sampleData.stationName || sampleData.name || 'N/A'}`);
        } else if (collectionName === 'config_algorithm_params') {
          const sampleData = firstDoc.data();
          console.log(`   Version: ${sampleData.version || 'N/A'}`);
        }
      }
    } catch (error: any) {
      console.error(`❌ ${collectionName}: ${error.message}`);
      results.failed.push(`${collectionName} (${error.message})`);
    }
  }

  return results;
}

/**
 * 특정 문서 읽기 테스트
 */
async function testDocumentRead() {
  console.log('\n📄 Testing Document Read...\n');

  try {
    // config_stations에서 첫 번째 역 읽기
    const stationsRef = collection(db, 'config_stations');
    const stationsSnapshot = await getDocs(stationsRef);

    if (!stationsSnapshot.empty) {
      const firstStationId = stationsSnapshot.docs[0].id;
      const stationRef = doc(db, 'config_stations', firstStationId);
      const stationDoc = await getDoc(stationRef);

      if (stationDoc.exists()) {
        const data = stationDoc.data();
        console.log('✅ Successfully read station document:');
        console.log(`   ID: ${stationDoc.id}`);
        console.log(`   Name: ${data.stationName || data.name || 'N/A'}`);
        console.log(`   Lines: ${JSON.stringify(data.lines || [])}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Document read failed:', error.message);
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('=================================');
  console.log('Firebase Connection Test');
  console.log('=================================\n');

  try {
    // Config Collections 테스트
    const results = await testConfigCollections();

    // 문서 읽기 테스트
    await testDocumentRead();

    // 결과 요약
    console.log('\n=================================');
    console.log('📊 Test Results Summary');
    console.log('=================================\n');
    console.log(`✅ Success: ${results.success.length} collections`);
    results.success.forEach((result) => console.log(`   - ${result}`));

    if (results.failed.length > 0) {
      console.log(`\n❌ Failed: ${results.failed.length} collections`);
      results.failed.forEach((result) => console.log(`   - ${result}`));
    }

    console.log('\n✅ All tests completed!');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
