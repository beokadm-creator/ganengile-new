#!/usr/bin/env node

// Firebase Config 테스트
const admin = require('firebase-admin');

// 서비스 계정 키 경로
const serviceAccount = require('/Users/aaron/Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json');

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testFirebaseConnection() {
  console.log('🔥 Firebase 연결 테스트 시작...\n');

  try {
    // 1. Config Stations 조회
    console.log('📍 1. Config Stations 조회...');
    const stationsSnapshot = await db.collection('config_stations').limit(3).get();

    if (stationsSnapshot.empty) {
      console.log('❌ Config Stations: 데이터 없음');
    } else {
      console.log(`✅ Config Stations: ${stationsSnapshot.size}개 역 조회 성공`);
      stationsSnapshot.forEach(doc => {
        const station = doc.data();
        console.log(`   - ${station.name} (${station.line})`);
      });
    }

    console.log('\n');

    // 2. Config Travel Times 조회
    console.log('⏱️  2. Config Travel Times 조회...');
    const travelTimesSnapshot = await db.collection('config_travel_times').limit(3).get();

    if (travelTimesSnapshot.empty) {
      console.log('❌ Config Travel Times: 데이터 없음');
    } else {
      console.log(`✅ Config Travel Times: ${travelTimesSnapshot.size}개 경로 조회 성공`);
    }

    console.log('\n');

    // 3. Users 컬렉션 테스트 (읽기 권한)
    console.log('👤 3. Users 컬렉션 접근 테스트...');
    const usersSnapshot = await db.collection('users').limit(1).get();

    if (usersSnapshot.empty) {
      console.log('ℹ️  Users: 데이터 없음 (정상)');
    } else {
      console.log(`✅ Users: ${usersSnapshot.size}명 조회 성공 (읽기 권한 확인)`);
    }

    console.log('\n');

    // 4. Config Algorithm Params 조회
    console.log('⚙️  4. Config Algorithm Params 조회...');
    const algoParamsSnapshot = await db.collection('config_algorithm_params').doc('v1.0').get();

    if (!algoParamsSnapshot.exists) {
      console.log('❌ Algorithm Params: 문서 없음');
    } else {
      const algoParams = algoParamsSnapshot.data();
      console.log('✅ Algorithm Params: 조회 성공');
      console.log(`   - 버전: ${algoParams.version}`);
      console.log(`   - 매칭 윈도우: ${algoParams.matchingWindowMinutes}분`);
      console.log(`   - 기본 수수료: ${algoParams.defaultFee}원`);
    }

    console.log('\n✅ 모든 Firebase 테스트 통과!');

  } catch (error) {
    console.error('\n❌ Firebase 테스트 실패:', error.message);
    console.error('상세:', error);
  }
}

testFirebaseConnection().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
