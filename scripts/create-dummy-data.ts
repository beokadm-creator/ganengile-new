/**
 * 더미 데이터 생성 스크립트
 * Firebase Admin SDK를 사용하여 테스트 데이터 생성
 *
 * 실행 방법:
 * npx ts-node scripts/create-dummy-data.ts
 */

import admin from 'firebase-admin';
import * as fs from 'fs';

// Firebase Admin SDK 초기화
const serviceAccountPath = `${process.env.HOME}/Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json`;
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ==================== 더미 데이터 ====================

const dummyUsers = [
  {
    email: 'test1@ganengile.com',
    name: '김철수',
    role: 'gller',
    rating: 4.8,
    completedDeliveries: 127,
    isVerified: true,
    createdAt: new Date(),
  },
  {
    email: 'test2@ganengile.com',
    name: '이영희',
    role: 'user',
    rating: 4.5,
    completedDeliveries: 23,
    isVerified: true,
    createdAt: new Date(),
  },
  {
    email: 'test3@ganengile.com',
    name: '박지성',
    role: 'gller',
    rating: 4.9,
    completedDeliveries: 256,
    isVerified: true,
    createdAt: new Date(),
  },
];

const dummyRoutes = [
  {
    userId: 'test1@ganengile.com',
    startStationId: 'SEOUL-01',
    endStationId: 'SEOUL-05',
    startTime: '08:00',
    endTime: '08:30',
    weekdays: [1, 2, 3, 4, 5],
    createdAt: new Date(),
  },
  {
    userId: 'test3@ganengile.com',
    startStationId: 'SEOUL-03',
    endStationId: 'SEOUL-07',
    startTime: '09:00',
    endTime: '09:40',
    weekdays: [1, 2, 3, 4, 5],
    createdAt: new Date(),
  },
];

const dummyRequests = [
  {
    requesterId: 'test2@ganengile.com',
    pickupStationId: 'SEOUL-02',
    dropoffStationId: 'SEOUL-06',
    itemDescription: '문서 봉투',
    deliveryFee: 3000,
    status: 'pending',
    createdAt: new Date(),
  },
  {
    requesterId: 'test2@ganengile.com',
    pickupStationId: 'SEOUL-04',
    dropoffStationId: 'SEOUL-08',
    itemDescription: '소포',
    deliveryFee: 5000,
    status: 'matched',
    createdAt: new Date(),
  },
];

const dummyMatches = [
  {
    requestId: 'dummy-request-1',
    gllerId: 'test1@ganengile.com',
    matchScore: 0.95,
    status: 'completed',
    commission: 300,
    createdAt: new Date(),
  },
];

// ==================== 데이터 생성 함수 ====================

async function createDummyData() {
  console.log('📊 더미데이터 생성 시작...\n');

  try {
    // 1. 사용자 생성
    console.log('1️⃣  사용자 생성...');
    for (const user of dummyUsers) {
      await db.collection('users').doc(user.email).set(user);
      console.log(`  ✅ ${user.name} (${user.email})`);
    }

    // 2. 동선 생성
    console.log('\n2️⃣  동선 생성...');
    for (const route of dummyRoutes) {
      const docRef = await db.collection('routes').add(route);
      console.log(`  ✅ ${route.userId}의 동선 (${docRef.id})`);
    }

    // 3. 배송 요청 생성
    console.log('\n3️⃣  배송 요청 생성...');
    for (const request of dummyRequests) {
      const docRef = await db.collection('requests').add(request);
      console.log(`  ✅ ${request.itemDescription} (${docRef.id})`);
    }

    // 4. 매칭 생성
    console.log('\n4️⃣  매칭 생성...');
    for (const match of dummyMatches) {
      const docRef = await db.collection('matches').add(match);
      console.log(`  ✅ 매칭 완료 (${docRef.id})`);
    }

    console.log('\n✅ 더미데이터 생성 완료!');
    console.log('\n📱 테스트 계정:');
    dummyUsers.forEach(user => {
      console.log(`  - ${user.email} (비밀번호: test123456)`);
    });

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  }
}

// 실행
createDummyData().then(() => {
  console.log('\n🎉 완료!');
  process.exit(0);
});
