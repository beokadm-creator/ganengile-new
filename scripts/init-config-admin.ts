/**
 * Config Initialization Script with Firebase Admin SDK
 * Uses service account for server-side permissions
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account key
const serviceAccountPath = path.join(process.env.HOME, 'Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

// Import hardcoded data (will be loaded in main function)
let MAJOR_STATIONS: any[], TRAVEL_TIME_MATRIX: any, EXPRESS_TRAIN_SCHEDULES: any[], CONGESTION_DATA: any[];

async function loadData() {
  const stations = await import('../data/subway-stations');
  const times = await import('../data/travel-times');
  const expresses = await import('../data/express-trains');
  const congestion = await import('../data/congestion');
  
  MAJOR_STATIONS = stations.MAJOR_STATIONS;
  TRAVEL_TIME_MATRIX = times.TRAVEL_TIME_MATRIX;
  EXPRESS_TRAIN_SCHEDULES = expresses.EXPRESS_TRAIN_SCHEDULES;
  CONGESTION_DATA = congestion.CONGESTION_DATA;
}

console.warn('='.repeat(60));
console.warn('🔧 Firebase Config Initialization (Admin SDK)');
console.warn('='.repeat(60));
console.warn(`Project: ${serviceAccount.project_id}`);
console.warn(`Method: Admin SDK (server permissions)`);
console.warn(`Service Account: ${serviceAccount.client_email}`);
console.warn('='.repeat(60));

/**
 * Initialize config_stations collection
 */
async function initConfigStations() {
  console.log('\n🚉 Initializing config_stations collection...');
  
  const batch = db.batch();
  let count = 0;

  for (const station of MAJOR_STATIONS) {
    const docRef = db.collection('config_stations').doc(station.stationId);
    
    const stationData = {
      stationId: station.stationId,
      stationName: station.stationName,
      stationNameEnglish: station.stationNameEnglish || '',
      lines: station.lines.map((line: any) => ({
        lineId: line.lineId,
        lineName: line.lineName,
        lineCode: line.lineCode || '',
        lineColor: line.lineColor || '#000000',
        lineType: line.lineType || 'general',
      })),
      location: {
        latitude: station.location.latitude,
        longitude: station.location.longitude,
      },
      isTransferStation: station.isTransferStation || false,
      isExpressStop: false,
      isTerminus: false,
      facilities: {
        hasElevator: station.facilities?.hasElevator || false,
        hasEscalator: station.facilities?.hasEscalator || false,
        wheelchairAccessible: station.facilities?.wheelchairAccessible || false,
      },
      region: station.region || 'etc',
      priority: station.priority || 5,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, stationData);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      console.warn(`  Committed ${count} stations...`);
    }
  }

  await batch.commit();
  console.warn(`✅ config_stations: ${count} stations initialized\n`);

  return count;
}

/**
 * Initialize config_travel_times collection
 */
async function initConfigTravelTimes() {
  console.warn('🚄 Initializing config_travel_times collection...');
  
  const batch = db.batch();
  let count = 0;

  for (const [routeId, timeInfo] of Object.entries(TRAVEL_TIME_MATRIX)) {
    const docRef = db.collection('config_travel_times').doc(routeId);

    const [fromId, toId] = routeId.split('-');

    const travelTimeData = {
      travelTimeId: routeId,
      fromStationId: fromId,
      toStationId: toId,
      fromStationName: '', // Will be populated by client
      toStationName: '', // Will be populated by client
      normalTime: (timeInfo as any).normalTime || 0,
      expressTime: (timeInfo as any).expressTime || null,
      transferCount: (timeInfo as any).transferCount || 0,
      transferStations: (timeInfo as any).transferStations || [],
      hasExpress: (timeInfo as any).hasExpress || false,
      walkingDistance: (timeInfo as any).walkingDistance || 0,
      distance: 0, // Calculate later
      lineIds: [], // Extract from route
      reliability: 8,
      lastVerified: new Date(),
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, travelTimeData);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      console.warn(`  Committed ${count} travel times...`);
    }
  }

  await batch.commit();
  console.warn(`✅ config_travel_times: ${count} routes initialized\n`);

  return count;
}

/**
 * Initialize config_express_trains collection
 */
async function initConfigExpressTrains() {
  console.warn('🚄 Initializing config_express_trains collection...');
  
  // Line name mapping
  const lineNames: Record<string, string> = {
    '1': '1호선',
    '2': '2호선',
    '3': '3호선',
    '4': '4호선',
    '5': '5호선',
    '6': '6호선',
    '7': '7호선',
    '8': '8호선',
    '9': '9호선',
    'sinbundang': '신분당선',
    'airport': '공항철도',
    'gyeongui': '경의중앙선',
    'gyeongchun': '경춘선',
  };
  
  const batch = db.batch();
  let count = 0;

  for (const express of EXPRESS_TRAIN_SCHEDULES) {
    const docRef = db.collection('config_express_trains').doc(express.lineId + '-' + express.type);

    const expressData = {
      expressId: express.lineId + '-' + express.type,
      lineId: express.lineId,
      lineName: lineNames[express.lineId] || express.lineId,
      type: express.type,
      typeName: express.typeName,
      operatingDays: express.operatingDays || [1, 2, 3, 4, 5, 6, 7],
      firstTrain: express.firstTrain || '05:30',
      lastTrain: express.lastTrain || '23:50',
      rushHourMorningInterval: express.intervals?.rushHourMorning || 300,
      rushHourEveningInterval: express.intervals?.rushHourEvening || 300,
      daytimeInterval: express.intervals?.daytime || 600,
      nightInterval: express.intervals?.night || 900,
      stops: express.stops || [],
      avgSpeed: 45,
      timeSavings: express.timeSavings || {},
      isActive: true,
      seasonStart: null,
      seasonEnd: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, expressData);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      console.warn(`  Committed ${count} express trains...`);
    }
  }

  await batch.commit();
  console.warn(`✅ config_express_trains: ${count} express trains initialized\n`);

  return count;
}

/**
 * Initialize config_congestion collection
 */
async function initConfigCongestion() {
  console.warn('👥 Initializing config_congestion collection...');
  
  const batch = db.batch();
  let count = 0;

  for (const congestionInfo of CONGESTION_DATA) {
    const congestionId = `line-${congestionInfo.lineId}-congestion`;
    const docRef = db.collection('config_congestion').doc(congestionId);

    const congestionData = {
      congestionId,
      lineId: congestionInfo.lineId,
      lineName: congestionInfo.lineName || '',
      timeSlots: congestionInfo.timeSlots || {},
      sections: congestionInfo.sections || [],
      dataSource: 'seoul-metro',
      lastUpdated: new Date(),
      isValid: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, congestionData);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      console.warn(`  Committed ${count} congestion data...`);
    }
  }

  await batch.commit();
  console.warn(`✅ config_congestion: ${count} lines initialized\n`);

  return count;
}

/**
 * Initialize config_algorithm_params collection
 */
async function initConfigAlgorithmParams() {
  console.warn('⚙️  Initializing config_algorithm_params collection...');
  
  const paramId = 'matching-weights-v1';
  const docRef = db.collection('config_algorithm_params').doc(paramId);

  const algorithmParams = {
    paramId,
    version: '1.0',
    
    // Matching weights (total must be 1.0)
    weights: {
      timeEfficiency: 0.5,     // 50%
      routeConvenience: 0.3,   // 30%
      gillerReliability: 0.2,  // 20%
    },
    
    // Time efficiency breakdown
    timeEfficiency: {
      travelTime: 0.6,         // 60% of timeEfficiency
      waitingTime: 0.2,        // 20%
      scheduleMatch: 0.2,      // 20%
    },
    
    // Route convenience breakdown
    routeConvenience: {
      transferPenalty: 0.4,    // 40%
      congestion: 0.3,         // 30%
      walkingDistance: 0.3,    // 30%
    },
    
    // Giller reliability breakdown
    gillerReliability: {
      rating: 0.6,             // 60%
      responseTime: 0.4,       // 40%
    },
    
    // Scoring parameters
    scoring: {
      // Travel time score (0-30)
      travelTime: {
        excellentMargin: 30,   // 30 minutes → 30 points
        goodMargin: 15,        // 15 minutes → 25 points
        acceptableMargin: 5,   // 5 minutes → 20 points
        tightMargin: 0,        // 0 minutes → 10 points
      },
      
      // Waiting time score (0-10)
      waitingTime: {
        maxWaitTime: 30,       // 30 minutes for 0 points
        pointsPer5Minutes: 5,  // 1 point per 5 minutes
      },
      
      // Transfer penalty (0-12)
      transfer: {
        penaltyPerTransfer: 3, // 3 points per transfer
        maxScore: 12,          // 12 points (no transfer)
      },
      
      // Congestion score (0-9)
      congestion: {
        rushHourPenalty: -3,   // -3 points during rush hour
        maxScore: 9,           // 9 points
      },
      
      // Walking distance score (0-9)
      walkingDistance: {
        penaltyPer100m: 1,     // 1 point per 100m
        maxScore: 9,           // 9 points
      },
      
      // Rating score (0-12)
      rating: {
        minRating: 3.0,        // Minimum rating
        maxRating: 5.0,        // Maximum rating
        maxScore: 12,          // 12 points
      },
      
      // Response time score (0-8)
      responseTime: {
        excellent: 5,          // 0-5 minutes → 8 points
        good: 15,              // 5-15 minutes → 5 points
        fair: 30,              // 15-30 minutes → 3 points
        poor: 60,              // >30 minutes → 0 points
      },
    },
    
    // Matching limits
    limits: {
      maxMatchesPerRequest: 5,   // Top 5 matches
      matchTimeoutMinutes: 5,    // 5 minutes timeout
      maxRetryCount: 3,          // Max 3 retries
      minScore: 20,              // Minimum score to match
    },
    
    // Priority multipliers
    priorities: {
      proGillerMultiplier: 1.2,        // 20% bonus for pro gillers
      premiumBusinessMultiplier: 1.15, // 15% bonus for premium requests
      newGillerPenalty: 0.9,           // 10% penalty for new gillers
    },
    
    // Feature flags
    features: {
      enableExpressBonus: true,       // Enable express train bonus
      enableCongestionPenalty: true,  // Enable congestion penalty
      enableRushHourPenalty: true,    // Enable rush hour penalty
      enableTransferPenalty: true,    // Enable transfer penalty
      enableProGillerPriority: true,  // Enable pro giller priority
    },
    
    // Metadata
    isActive: true,
    description: '초기 매칭 알고리즘 v1.0 - 시간 효율 50%, 경로 편의성 30%, 길러 신뢰도 20%',
    createdBy: 'admin',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await docRef.set(algorithmParams);
  console.warn(`✅ config_algorithm_params: ${paramId} initialized\n`);

  return 1;
}

/**
 * Main initialization function
 */
async function initializeConfig() {
  const startTime = Date.now();

  try {
    // Load data
    await loadData();
    
    // Test connection
    console.warn('Testing Firestore connection...');
    await db.collection('test').doc('test').get();
    console.warn('✅ Connection successful!\n');

    // Initialize all collections
    const stationsCount = await initConfigStations();
    const travelTimesCount = await initConfigTravelTimes();
    const expressTrainsCount = await initConfigExpressTrains();
    const congestionCount = await initConfigCongestion();
    const paramsCount = await initConfigAlgorithmParams();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.warn('='.repeat(60));
    console.warn('✅ Initialization Complete!');
    console.warn('='.repeat(60));
    console.warn(`📊 Summary:`);
    console.warn(`  - Stations:        ${stationsCount}`);
    console.warn(`  - Travel Times:    ${travelTimesCount}`);
    console.warn(`  - Express Trains:  ${expressTrainsCount}`);
    console.warn(`  - Congestion:      ${congestionCount}`);
    console.warn(`  - Algorithm Params: ${paramsCount}`);
    console.warn(`  - Total:           ${stationsCount + travelTimesCount + expressTrainsCount + congestionCount + paramsCount} documents`);
    console.warn(`⏱️  Elapsed: ${elapsed}s`);
    console.warn('='.repeat(60));

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    throw error;
  }
}

// Run initialization
void initializeConfig()
  .then(() => {
    console.warn('\n✅ Success! Check Firebase Console to verify.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
