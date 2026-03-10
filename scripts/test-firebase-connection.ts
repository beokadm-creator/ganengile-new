/**
 * Firebase Connection Test Script
 * 실제 Firebase DB 연결 확인
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

async function testFirebaseConnection() {
  console.log('🔥 Firebase 연결 테스트 시작...\n');

  try {
    console.log('1️⃣ Firebase 초기화 중...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('✅ Firebase 초기화 성공\n');

    console.log('2️⃣ 컬렉션 확인 중...');
    const collections = ['users', 'routes', 'requests', 'matches', 'auctions', 'bids'];

    for (const colName of collections) {
      try {
        const snapshot = await getDocs(query(collection(db, colName), limit(1)));
        console.log(`   ✓ ${colName}: ${snapshot.size}개의 문서`);
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          console.log(`   ⚠ ${colName}: 권한 없음 (정상)`);
        } else {
          console.log(`   ✗ ${colName}: ${error.message}`);
        }
      }
    }
    console.log('');

    console.log('✅ Firebase 연결 테스트 완료!\n');
  } catch (error: any) {
    console.error('❌ Firebase 연결 실패:', error.message);
    process.exit(1);
  }
}

testFirebaseConnection();
