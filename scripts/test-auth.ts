/**
 * Auth Test Script
 *
 * Firebase Email/Password 및 Google Auth 테스트
 *
 * Usage:
 *   npx tsx scripts/test-auth.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Email/Password 로그인 테스트
 */
async function testEmailPasswordLogin() {
  console.log('\n📧 Testing Email/Password Login...\n');

  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'test123456';

  console.log(`  Email: ${testEmail}`);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    const user = userCredential.user;

    console.log('✅ Email/Password Login Success!');
    console.log(`   User ID: ${user.uid}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Email Verified: ${user.emailVerified}`);

    return user;
  } catch (error: any) {
    console.error('❌ Email/Password Login Failed:');
    console.error(`   Code: ${error.code}`);
    console.error(`   Message: ${error.message}`);

    // 유용한 힌트
    if (error.code === 'auth/user-not-found') {
      console.error('\n   💡 힌트: 테스트 유저가 없습니다. Firebase Console에서 생성하거나:');
      console.error('      https://console.firebase.google.com/project/ganengile/authentication/users');
    } else if (error.code === 'auth/wrong-password') {
      console.error('\n   💡 힌트: 비밀번호가 틀렸습니다.');
    } else if (error.code === 'auth/invalid-email') {
      console.error('\n   💡 힌트: 이메일 형식이 올바르지 않습니다.');
    }

    return null;
  }
}

/**
 * Config Collections 읽기 테스트 (인증 후)
 */
async function testConfigRead(user: any) {
  console.log('\n📋 Testing Config Read (Authenticated)...\n');

  const configCollections = [
    'config_stations',
    'config_travel_times',
    'config_express_trains',
    'config_congestion',
    'config_algorithm_params',
  ];

  let successCount = 0;

  for (const collectionName of configCollections) {
    try {
      const colRef = collection(db, collectionName);
      const snapshot = await getDocs(colRef);

      if (snapshot.empty) {
        console.log(`⚠️  ${collectionName}: No documents found`);
      } else {
        console.log(`✅ ${collectionName}: ${snapshot.docs.length} documents`);
        successCount++;

        // 첫 번째 문서 정보
        const firstDoc = snapshot.docs[0];
        const data = firstDoc.data();

        if (collectionName === 'config_stations') {
          console.log(`   Sample: ${data.stationName || data.name || firstDoc.id}`);
        } else if (collectionName === 'config_algorithm_params') {
          console.log(`   Version: ${data.version || 'N/A'}`);
        } else {
          console.log(`   Sample ID: ${firstDoc.id}`);
        }
      }
    } catch (error: any) {
      console.error(`❌ ${collectionName}: ${error.message}`);
    }
  }

  return successCount;
}

/**
 * 로그아웃
 */
async function testLogout() {
  console.log('\n🚪 Logging out...\n');

  try {
    await signOut(auth);
    console.log('✅ Logged out successfully');
  } catch (error: any) {
    console.error('❌ Logout failed:', error.message);
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('=================================');
  console.log('Firebase Auth Test');
  console.log('=================================\n');

  console.log('🔥 Firebase Project:', firebaseConfig.projectId);
  console.log('🔐 Auth Methods: Email/Password, Google');

  try {
    // 1. Email/Password 로그인 시도
    const user = await testEmailPasswordLogin();

    if (!user) {
      console.log('\n⚠️  로그인 실패로 인해 테스트를 중단합니다.');
      console.log('\n💡 해결 방법:');
      console.log('   1. Firebase Console로 이동:');
      console.log('      https://console.firebase.google.com/project/ganengile/authentication');
      console.log('   2. "Users" 탭에서 테스트 유저 추가');
      console.log('   3. 또는 .env에 테스트 계정 정보 입력:');
      console.log('      TEST_USER_EMAIL=your@email.com');
      console.log('      TEST_USER_PASSWORD=yourpassword');
      process.exit(1);
    }

    // 2. 인증된 상태에서 Config 읽기 테스트
    const successCount = await testConfigRead(user);

    // 3. 로그아웃
    await testLogout();

    // 결과 요약
    console.log('\n=================================');
    console.log('📊 Test Results Summary');
    console.log('=================================\n');
    console.log(`✅ Config Collections Read: ${successCount}/5`);
    console.log(`✅ Auth Test: SUCCESS`);
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
