/**
 * Seed E2E flow data for settlement verification (admin UI)
 */

import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_SERVICE_ACCOUNT_PATH is required');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const now = admin.firestore.Timestamp.now();

async function getStationInfo(docId: string) {
  const snap = await db.collection('config_stations').doc(docId).get();
  if (!snap.exists) {
    throw new Error(`config_stations/${docId} not found`);
  }
  const data = snap.data() as any;
  const firstLine = Array.isArray(data?.lines) ? data.lines[0] : null;
  const lat = data?.location?.lat ?? data?.location?.latitude ?? 0;
  const lng = data?.location?.lng ?? data?.location?.longitude ?? 0;
  return {
    id: docId,
    stationId: docId,
    stationName: data?.name ?? '',
    line: firstLine?.lineName ?? '',
    lineCode: firstLine?.lineId ?? '',
    lat,
    lng,
  };
}

async function run() {
  const pickupStation = await getStationInfo('1029'); // 서울역
  const deliveryStation = await getStationInfo('1028'); // 시청역

  const requesterId = `test_requester_${Date.now()}`;
  const gillerId = `test_giller_${Date.now()}`;

  await Promise.all([
    db.collection('users').doc(requesterId).set(
      {
        userId: requesterId,
        name: '테스트 요청자',
        role: 'GLLER',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    db.collection('users').doc(gillerId).set(
      {
        userId: gillerId,
        name: '테스트 길러',
        role: 'GILLER',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  const feeBreakdown = {
    baseFee: 3500,
    distanceFee: 600,
    sizeFee: 0,
    weightFee: 100,
    urgencySurcharge: 0,
    publicFare: 1550,
    manualAdjustment: 0,
    serviceFee: 630,
    vat: 638,
    totalFee: 7018,
    breakdown: {
      gillerFee: 5965,
      platformFee: 1053,
    },
  };

  const requestRef = db.collection('requests').doc();
  const requestId = requestRef.id;
  await requestRef.set({
    requestId,
    requesterId,
    pickupStation,
    deliveryStation,
    packageInfo: {
      size: 'small',
      weight: 'light',
      description: 'E2E 테스트 물품',
    },
    itemValue: 50000,
    depositAmount: 40000,
    initialNegotiationFee: feeBreakdown.totalFee,
    feeBreakdown,
    fee: feeBreakdown,
    preferredTime: {
      departureTime: '10:00',
      arrivalTime: '11:00',
    },
    deadline: now,
    urgency: 'low',
    status: 'completed',
    matchedGillerId: gillerId,
    matchedAt: now,
    acceptedAt: now,
    deliveredAt: now,
    requesterConfirmedAt: now,
    requesterConfirmedBy: requesterId,
    createdAt: now,
    updatedAt: now,
  });

  const deliveryRef = db.collection('deliveries').doc();
  const deliveryId = deliveryRef.id;
  await deliveryRef.set({
    deliveryId,
    requestId,
    gllerId: requesterId,
    gillerId,
    gillerRole: 'GILLER',
    pickupStation,
    deliveryStation,
    deliveryType: 'standard',
    packageInfo: {
      size: 'small',
      weight: 1,
      description: 'E2E 테스트 물품',
      isFragile: false,
      isPerishable: false,
    },
    fee: feeBreakdown,
    recipientInfo: {
      name: '테스트 수신자',
      phone: '010-0000-0000',
      verificationCode: '123456',
    },
    status: 'completed',
    tracking: {
      events: [
        {
          type: 'created',
          timestamp: now.toDate(),
          description: '요청 생성',
        },
        {
          type: 'delivered',
          timestamp: now.toDate(),
          description: '전달 완료',
          actorId: gillerId,
        },
        {
          type: 'confirmed_by_requester',
          timestamp: now.toDate(),
          description: '수령 확인',
          actorId: requesterId,
        },
      ],
      progress: 100,
    },
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    requesterConfirmedAt: now,
    requesterConfirmedBy: requesterId,
  });

  const settlementRef = db.collection('settlements').doc(requestId);
  await settlementRef.set({
    requestId,
    deliveryId,
    gillerId,
    requesterId,
    status: 'completed',
    depositId: `deposit_${requestId}`,
    depositAmount: 40000,
    refundStatus: 'refunded',
    earningPaymentId: `earning_${requestId}`,
    earningAmount: feeBreakdown.totalFee,
    createdAt: now,
    updatedAt: now,
    settledAt: now,
  });

  console.log('✅ E2E seed 완료');
  console.log('requestId:', requestId);
  console.log('deliveryId:', deliveryId);
  console.log('settlementId:', requestId);
  console.log('requesterId:', requesterId);
  console.log('gillerId:', gillerId);
}

run().catch((error) => {
  console.error('❌ E2E seed 실패:', error);
  process.exit(1);
});
