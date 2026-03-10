/**
 * Firebase Sample Data Seeding Script
 * 샘플 데이터 생성 (테스트용)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 샘플 역 데이터
const stations = [
  { id: 'S001', stationId: 'S001', stationName: '서울역', line: '1호선', lineCode: '1', lat: 37.5547, lng: 126.9707 },
  { id: 'S002', stationId: 'S002', stationName: '시청역', line: '1호선', lineCode: '1', lat: 37.5658, lng: 126.9770 },
  { id: 'S003', stationId: 'S003', stationName: '종각역', line: '1호선', lineCode: '1', lat: 37.5697, lng: 126.9854 },
  { id: 'S004', stationId: 'S004', stationName: '강남역', line: '2호선', lineCode: '2', lat: 37.5172, lng: 127.0473 },
  { id: 'S005', stationId: 'S005', stationName: '역삼역', line: '2호선', lineCode: '2', lat: 37.5008, lng: 127.0364 },
  { id: 'S006', stationId: 'S006', stationName: '삼성역', line: '2호선', lineCode: '2', lat: 37.5089, lng: 127.0632 },
  { id: 'S007', stationId: 'S007', stationName: '홍대입구역', line: '2호선', lineCode: '2', lat: 37.5569, lng: 126.9229 },
  { id: 'S008', stationId: 'S008', stationName: '합정역', line: '2호선', lineCode: '2', lat: 37.5505, lng: 126.9147 },
];

// 샘플 사용자 데이터
const sampleUsers = [
  {
    email: 'giller1@test.com',
    name: '길러철수',
    role: 'GILLER',
    phone: '010-1234-5678',
    rating: 4.8,
    gillerInfo: {
      totalDeliveries: 45,
      completedDeliveries: 43,
      totalEarnings: 385000,
      level: 'regular',
    },
  },
  {
    email: 'giller2@test.com',
    name: '길러영희',
    role: 'GILLER',
    phone: '010-2345-6789',
    rating: 4.9,
    gillerInfo: {
      totalDeliveries: 82,
      completedDeliveries: 80,
      totalEarnings: 720000,
      level: 'professional',
    },
  },
  {
    email: 'gller1@test.com',
    name: '글러민수',
    role: 'GLLER',
    phone: '010-3456-7890',
    rating: 4.5,
  },
  {
    email: 'gller2@test.com',
    name: '글러수진',
    role: 'GLLER',
    phone: '010-4567-8901',
    rating: 4.7,
  },
];

// 샘플 경로 데이터
const sampleRoutes = [
  {
    userId: 'giller1@test.com',
    gillerName: '길러철수',
    startStation: stations[0], // 서울역
    endStation: stations[3],    // 강남역
    departureTime: '08:30',
    daysOfWeek: [1, 2, 3, 4, 5],
    isActive: true,
  },
  {
    userId: 'giller2@test.com',
    gillerName: '길러영희',
    startStation: stations[6], // 홍대입구역
    endStation: stations[4],    // 역삼역
    departureTime: '09:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    isActive: true,
  },
];

// 샘플 요청 데이터
const sampleRequests = [
  {
    requesterId: 'gller1@test.com',
    pickupStation: stations[0], // 서울역
    deliveryStation: stations[3], // 강남역
    packageInfo: {
      size: 'small',
      weight: 'light',
      description: '서류 봉투',
    },
    fee: 5300,
    preferredTime: {
      departureTime: '09:00',
      arrivalTime: '10:00',
    },
    deadline: new Date(Date.now() + 86400000),
    urgency: 'normal',
    status: 'pending',
  },
  {
    requesterId: 'gller2@test.com',
    pickupStation: stations[6], // 홍대입구역
    deliveryStation: stations[4], // 역삼역
    packageInfo: {
      size: 'medium',
      weight: 'medium',
      description: '책 3권',
    },
    fee: 6100,
    preferredTime: {
      departureTime: '14:00',
      arrivalTime: '15:00',
    },
    deadline: new Date(Date.now() + 72000000),
    urgency: 'fast',
    status: 'pending',
  },
];

// 샘플 경매 데이터
const sampleAuctions = [
  {
    gllerId: 'gller1@test.com',
    gllerName: '글러민수',
    pickupStation: stations[1], // 시청역
    deliveryStation: stations[5], // 삼성역
    packageSize: 'small',
    packageWeight: 1,
    packageDescription: '급한 서류',
    baseFee: 3500,
    distanceFee: 720,
    weightFee: 100,
    sizeFee: 0,
    serviceFee: 648,
    vat: 497,
    currentHighestBid: 3500,
    preferredPickupTime: '10:00',
    preferredDeliveryTime: '11:00',
    deliveryDeadline: new Date(Date.now() + 3600000), // 1시간 후
    durationMinutes: 30,
  },
];

async function seedData() {
  console.log('🌱 샘플 데이터 생성 시작...\n');

  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // 1. 사용자 생성
    console.log('1️⃣ 사용자 생성 중...');
    for (const user of sampleUsers) {
      const docRef = await addDoc(collection(db, 'users'), {
        ...user,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`   ✓ 사용자 생성: ${user.name} (${docRef.id})`);
    }
    console.log('');

    // 2. 경로 생성
    console.log('2️⃣ 경로 생성 중...');
    for (const route of sampleRoutes) {
      const docRef = await addDoc(collection(db, 'routes'), {
        ...route,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`   ✓ 경로 생성: ${route.startStation.stationName} → ${route.endStation.stationName}`);
    }
    console.log('');

    // 3. 요청 생성
    console.log('3️⃣ 배송 요청 생성 중...');
    for (const request of sampleRequests) {
      const docRef = await addDoc(collection(db, 'requests'), {
        ...request,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`   ✓ 요청 생성: ${request.pickupStation.stationName} → ${request.deliveryStation.stationName} (${request.fee}원)`);
    }
    console.log('');

    // 4. 경매 생성
    console.log('4️⃣ 경매 생성 중...');
    for (const auction of sampleAuctions) {
      const now = new Date();
      const endsAt = new Date(now.getTime() + auction.durationMinutes * 60 * 1000);

      const docRef = await addDoc(collection(db, 'auctions'), {
        ...auction,
        auctionType: 'reverse_auction',
        status: 'active',
        startedAt: now,
        endsAt: endsAt,
        totalBids: 0,
        config: {
          durationMinutes: 30,
          minBidIncrement: 500,
          autoExtend: true,
          autoExtendMinutes: 5,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`   ✓ 경매 생성: ${auction.pickupStation.stationName} → ${auction.deliveryStation.stationName}`);
    }
    console.log('');

    console.log('✅ 샘플 데이터 생성 완료!\n');
    console.log('📊 생성된 데이터:');
    console.log(`   - 사용자: ${sampleUsers.length}명`);
    console.log(`   - 경로: ${sampleRoutes.length}개`);
    console.log(`   - 배송 요청: ${sampleRequests.length}개`);
    console.log(`   - 경매: ${sampleAuctions.length}개`);

  } catch (error: any) {
    console.error('❌ 데이터 생성 실패:', error.message);
    process.exit(1);
  }
}

seedData()
  .then(() => {
    console.log('\n✨ 모든 데이터 생성 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 데이터 생성 실패:', error);
    process.exit(1);
  });
