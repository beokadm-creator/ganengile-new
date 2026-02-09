/**
 * Travel Time 데이터 생성 스크립트
 * 
 * 접근 방법:
 * 1. 인접한 역 간의 실제 이동 시간 (노선 따라)
 * 2. 환승역 경로 데이터
 * 3. 주요 경로 샘플
 */

const admin = require('firebase-admin');
const serviceAccount = require('/Users/aaron/Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 실제 지하철 노선별 역 순서 (일부 샘플)
const lineRoutes = {
  'line-1': [
    '101', '102', '103', '104', '105', '106', '107', '108', '109', '110',
    '111', '112', '113', '114', '115', '116', '117', '118', '119', '120',
    '121', '122', '123', '124', '125', '126', '127', '128', '129', '130',
    '131', '132', '133', '134', '135', '136', '137', '138', '139', '140',
    '141', '142', '143', '144', '145', '146', '147', '148', '149', '150',
    '151', '152', '153', '154', '155', '156', '157', '158', '159', '160',
    '161', '162', '163'
  ],
  'line-2': [
    '201', '202', '203', '204', '205', '206', '207', '208', '209', '210',
    '211', '212', '213', '214', '215', '216', '217', '218', '219', '220',
    '221', '222', '223', '224', '225', '226', '227', '228', '229', '230',
    '231', '232', '233', '234', '235', '236'
  ],
  'line-3': [
    '320', '319', '318', '317', '316', '315', '314', '313', '312', '311',
    '310', '309', '308', '307', '306', '305', '304', '303', '302', '301',
    '300', '299', '298', '297', '296', '295', '294', '293', '292', '291',
    '290', '289', '288', '287', '286', '285', '284', '283', '282', '281',
    '280', '279', '278', '277', '276', '275', '274', '273', '272', '271',
    '270', '269'
  ]
};

// 인접한 역 간 평균 이동 시간 (분)
const avgTimeBetweenStations = 2.5; // 2.5분 = 역 간 평균 거리

async function generateTravelTimes() {
  const snapshot = await db.collection('config_stations').get();
  const stations = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    stations[doc.id] = data;
  });

  const batch = db.batch();
  let count = 0;

  // 각 노선별 인접한 역 간의 시간 생성
  for (const [lineId, routeStations] of Object.entries(lineRoutes)) {
    for (let i = 0; i < routeStations.length - 1; i++) {
      const fromStationId = routeStations[i];
      const toStationId = routeStations[i + 1];
      
      const fromStation = stations[fromStationId];
      const toStation = stations[toStationId];
      
      if (!fromStation || !toStation) continue;
      
      // 거리 계산 (Haversine formula)
      const distance = calculateDistance(
        fromStation.location.latitude,
        fromStation.location.longitude,
        toStation.location.latitude,
        toStation.location.longitude
      );
      
      // 이동 시간 (평균 속도 30km/h 가정)
      const travelTime = Math.round((distance / 30) * 60);
      
      const docRef = db.collection('config_travel_times').doc();
      batch.set(docRef, {
        travelTimeId: docRef.id,
        fromStationId,
        toStationId,
        fromStationName: fromStation.stationName,
        toStationName: toStation.stationName,
        normalTime: Math.max(2, travelTime), // 최소 2분
        expressTime: null, // 급행 시간은 별도 계산 필요
        transferCount: 0,
        transferStations: [],
        hasExpress: false,
        walkingDistance: Math.round(distance * 1000), // 미터
        distance: Number(distance.toFixed(2)),
        lineIds: [lineId],
        reliability: 0.95,
        lastVerified: new Date(),
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      count++;
      
      // Batch limit check
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`Batch committed: ${count} records`);
        batch.reset();
      }
    }
  }
  
  // Remaining records
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Travel Time 데이터 ${count}개 생성 완료`);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반경 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

generateTravelTimes().catch(console.error);
