/**
 * Test Matching Service
 * 배송 요청과 길러 루트 간의 매칭 테스트
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(process.env.HOME, 'Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Test Data: Mock Giller Routes
 */
const mockGillerRoutes = [
  {
    gillerId: 'giller1',
    gillerName: '김길동',
    startStationName: '서울역',
    endStationName: '강남역',
    departureTime: '08:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    rating: 4.8,
  },
  {
    gillerId: 'giller2',
    gillerName: '이철수',
    startStationName: '시청역',
    endStationName: '교대역',
    departureTime: '08:30',
    daysOfWeek: [1, 2, 3, 4, 5],
    rating: 4.5,
  },
  {
    gillerId: 'giller3',
    gillerName: '박영희',
    startStationName: '서울역',
    endStationName: '역삼역',
    departureTime: '08:15',
    daysOfWeek: [2, 3, 4, 5, 6],
    rating: 4.9,
  },
];

/**
 * Helper: Create test request in Firestore
 */
async function createTestRequest() {
  try {
    const requestData = {
      gllerId: 'test-gller-001',
      gllerName: '테스트 사용자',
      pickupStation: {
        stationId: 'station-seoul',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      },
      deliveryStation: {
        stationId: 'station-gangnam',
        stationName: '강남역',
        line: '2호선',
        lineCode: '222',
        lat: 37.5172,
        lng: 127.0473,
      },
      deliveryType: 'standard',
      packageInfo: {
        size: 'medium',
        weight: 3.0,
        description: '테스트 물품',
        isFragile: false,
        isPerishable: false,
      },
      fee: {
        baseFee: 3000,
        distanceFee: 1500,
        weightFee: 300,
        sizeFee: 500,
        serviceFee: 0,
        vat: 530,
        totalFee: 5830,
      },
      recipientName: '홍길동',
      recipientPhone: '010-1234-5678',
      recipientVerificationCode: '123456',
      pickupDeadline: admin.firestore.Timestamp.now(),
      deliveryDeadline: admin.firestore.Timestamp.now(),
      specialRequests: [],
      status: 'pending',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    const docRef = await db.collection('requests').add(requestData);
    console.log('✅ Test request created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating test request:', error);
    throw error;
  }
}

/**
 * Helper: Create test routes in Firestore
 */
async function createTestRoutes() {
  try {
    const routePromises = mockGillerRoutes.map(async (route) => {
      const routeData = {
        userId: route.gillerId,
        gillerName: route.gillerName,
        startStation: {
          name: route.startStationName,
        },
        endStation: {
          name: route.endStationName,
        },
        departureTime: route.departureTime,
        daysOfWeek: route.daysOfWeek,
        isActive: true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      const docRef = await db.collection('routes').add(routeData);
      console.log(`✅ Test route created: ${route.gillerName} (${docRef.id})`);
      return docRef.id;
    });

    await Promise.all(routePromises);
    console.log(`✅ All ${mockGillerRoutes.length} test routes created`);
  } catch (error) {
    console.error('❌ Error creating test routes:', error);
    throw error;
  }
}

/**
 * Test: Find matching gillers
 */
async function testMatching() {
  try {
    console.log('\n🔍 Starting matching test...\n');

    // 1. Create test data
    console.log('📝 Creating test data...');
    const requestId = await createTestRequest();
    await createTestRoutes();

    // Wait for indexes to update
    console.log('⏳ Waiting 2 seconds for indexes...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Fetch request
    console.log('\n📦 Fetching request...');
    const requestDoc = await db.collection('requests').doc(requestId).get();
    const request = requestDoc.data();
    console.log(`Request: ${request.pickupStation.stationName} → ${request.deliveryStation.stationName}`);

    // 3. Fetch active giller routes
    console.log('\n🚇 Fetching giller routes...');
    const routesSnapshot = await db.collection('routes')
      .where('isActive', '==', true)
      .get();

    const gillerRoutes = [];
    routesSnapshot.forEach(doc => {
      gillerRoutes.push({
        routeId: doc.id,
        ...doc.data()
      });
    });

    console.log(`Found ${gillerRoutes.length} active routes`);

    // 4. Simple matching logic (route compatibility)
    console.log('\n🎯 Finding matches...');
    const matches = gillerRoutes
      .filter(route => {
        // Check if route covers the pickup and delivery stations
        const startMatch = route.startStation.name === request.pickupStation.stationName ||
                          route.endStation.name === request.pickupStation.stationName;
        const endMatch = route.startStation.name === request.deliveryStation.stationName ||
                        route.endStation.name === request.deliveryStation.stationName;
        return startMatch && endMatch;
      })
      .map(route => ({
        gillerId: route.userId,
        gillerName: route.gillerName,
        route: `${route.startStation.name} → ${route.endStation.name}`,
        departureTime: route.departureTime,
        matchReason: 'Route compatible',
      }));

    console.log(`\n✅ Found ${matches.length} matches:\n`);
    matches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.gillerName}`);
      console.log(`   Route: ${match.route}`);
      console.log(`   Departure: ${match.departureTime}`);
      console.log(`   Reason: ${match.matchReason}\n`);
    });

    // 5. Create match documents
    if (matches.length > 0) {
      console.log('💾 Creating match documents...');
      const matchPromises = matches.map(match =>
        db.collection('matches').add({
          requestId: requestId,
          gllerId: request.gllerId,
          gillerId: match.gillerId,
          matchScore: 85.5, // Mock score
          status: 'pending',
          createdAt: admin.firestore.Timestamp.now(),
        })
      );

      await Promise.all(matchPromises);
      console.log(`✅ Created ${matches.length} match documents`);
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await db.collection('requests').doc(requestId).delete();
    console.log('✅ Test request deleted');

    const deletePromises = gillerRoutes.map(route =>
      db.collection('routes').doc(route.routeId).delete()
    );
    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${gillerRoutes.length} test routes`);

    // Delete matches
    const matchesSnapshot = await db.collection('matches')
      .where('requestId', '==', requestId)
      .get();

    const matchDeletePromises = [];
    matchesSnapshot.forEach(doc => {
      matchDeletePromises.push(doc.ref.delete());
    });
    await Promise.all(matchDeletePromises);
    console.log('✅ Deleted match documents');

    console.log('\n✅ Matching test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

/**
 * Run tests
 */
async function runTests() {
  try {
    console.log('====================================');
    console.log('   Matching Service Test Suite');
    console.log('====================================\n');

    await testMatching();

    console.log('====================================');
    console.log('   All Tests Passed! ✅');
    console.log('====================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n====================================');
    console.error('   Tests Failed ❌');
    console.error('====================================\n');
    process.exit(1);
  }
}

// Run tests
runTests();
