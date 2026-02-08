/**
 * Config Initialization Script
 * 
 * Initialize Firestore Config Collections from hardcoded data
 * 
 * Usage:
 *   npm run init-config
 *   or
 *   ts-node scripts/init-config.ts
 * 
 * Options:
 *   --force  : Overwrite existing config collections
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, writeBatch } from 'firebase/firestore';

// Load environment variables using dotenv
import 'dotenv/config';

// Firebase initialization
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Import hardcoded data
import { MAJOR_STATIONS } from '../data/subway-stations';
import { TRAVEL_TIME_MATRIX } from '../data/travel-times';
import { EXPRESS_TRAIN_SCHEDULES } from '../data/express-trains';
import { CONGESTION_DATA } from '../data/congestion';

interface InitOptions {
  force?: boolean;
  verbose?: boolean;
}

/**
 * Initialize config_stations collection
 */
async function initConfigStations(options: InitOptions = {}) {
  console.log('\n🚉 Initializing config_stations collection...');
  
  const batch = writeBatch(db);
  let count = 0;

  for (const station of MAJOR_STATIONS) {
    const docRef = doc(db, 'config_stations', station.stationId);
    
    const stationData = {
      stationId: station.stationId,
      stationName: station.stationName,
      stationNameEnglish: station.stationNameEnglish || '',
      lines: station.lines.map(line => ({
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
      isExpressStop: station.isExpressStop || false,
      isTerminus: station.isTerminus || false,
      facilities: {
        hasElevator: station.facilities?.hasElevator || false,
        hasEscalator: station.facilities?.hasEscalator || false,
        wheelchairAccessible: station.facilities?.wheelchairAccessible || false,
      },
      region: station.region || 'etc',
      priority: station.priority || 5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    batch.set(docRef, stationData);
    count++;

    if (options.verbose) {
      console.log(`  ✓ ${station.stationName} (${station.stationId})`);
    }

    // Firestore batch limit: 500 operations
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Committed ${count} stations...`);
    }
  }

  await batch.commit();
  console.log(`✅ config_stations: ${count} stations initialized\n`);

  return count;
}

/**
 * Initialize config_travel_times collection
 */
async function initConfigTravelTimes(options: InitOptions = {}) {
  console.log('🚄 Initializing config_travel_times collection...');
  
  const batch = writeBatch(db);
  let count = 0;

  for (const [fromId, destinations] of Object.entries(TRAVEL_TIME_MATRIX)) {
    for (const [toId, timeInfo] of Object.entries(destinations)) {
      const travelTimeId = `${fromId}-${toId}`;
      const docRef = doc(db, 'config_travel_times', travelTimeId);

      const travelTimeData = {
        travelTimeId,
        fromStationId: fromId,
        toStationId: toId,
        fromStationName: timeInfo.fromStationName || '',
        toStationName: timeInfo.toStationName || '',
        normalTime: timeInfo.normalTime || 0,
        expressTime: timeInfo.expressTime || null,
        transferCount: timeInfo.transferCount || 0,
        transferStations: timeInfo.transferStations || [],
        hasExpress: timeInfo.hasExpress || false,
        walkingDistance: timeInfo.walkingDistance || 0,
        distance: timeInfo.distance || 0,
        lineIds: timeInfo.lineIds || [],
        reliability: timeInfo.reliability || 8,
        lastVerified: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      batch.set(docRef, travelTimeData);
      count++;

      if (options.verbose) {
        console.log(`  ✓ ${fromId} → ${toId}: ${Math.floor((timeInfo.normalTime || 0) / 60)}min`);
      }

      if (count % 500 === 0) {
        await batch.commit();
        console.log(`  Committed ${count} travel times...`);
      }
    }
  }

  await batch.commit();
  console.log(`✅ config_travel_times: ${count} routes initialized\n`);

  return count;
}

/**
 * Initialize config_express_trains collection
 */
async function initConfigExpressTrains(options: InitOptions = {}) {
  console.log('🚄 Initializing config_express_trains collection...');
  
  const batch = writeBatch(db);
  let count = 0;

  for (const express of EXPRESS_TRAIN_SCHEDULES) {
    const expressId = `${express.lineId}-${express.type}`;
    const docRef = doc(db, 'config_express_trains', expressId);

    const expressData = {
      expressId: expressId,
      lineId: express.lineId,
      lineName: express.lineName || express.lineId,
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
      avgSpeed: 40,
      timeSavings: express.timeSavings || {},
      isActive: true,
      seasonStart: null,
      seasonEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    batch.set(docRef, expressData);
    count++;

    if (options.verbose) {
      console.log(`  ✓ ${express.lineName} ${express.typeName}`);
    }

    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Committed ${count} express trains...`);
    }
  }

  await batch.commit();
  console.log(`✅ config_express_trains: ${count} express trains initialized\n`);

  return count;
}

/**
 * Initialize config_congestion collection
 */
async function initConfigCongestion(options: InitOptions = {}) {
  console.log('👥 Initializing config_congestion collection...');
  
  const batch = writeBatch(db);
  let count = 0;

  for (const [lineId, congestionInfo] of Object.entries(CONGESTION_DATA)) {
    const congestionId = `line-${lineId}-congestion`;
    const docRef = doc(db, 'config_congestion', congestionId);

    const congestionData = {
      congestionId,
      lineId,
      lineName: congestionInfo.lineName || '',
      timeSlots: congestionInfo.timeSlots || {},
      sections: congestionInfo.sections || [],
      dataSource: congestionInfo.dataSource || 'seoul-metro',
      lastUpdated: new Date(),
      isValid: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    batch.set(docRef, congestionData);
    count++;

    if (options.verbose) {
      console.log(`  ✓ ${congestionInfo.lineName} (${lineId})`);
    }

    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Committed ${count} congestion data...`);
    }
  }

  await batch.commit();
  console.log(`✅ config_congestion: ${count} lines initialized\n`);

  return count;
}

/**
 * Initialize config_algorithm_params collection
 */
async function initConfigAlgorithmParams(options: InitOptions = {}) {
  console.log('⚙️ Initializing config_algorithm_params collection...');
  
  const paramId = 'matching-weights-v1';
  const docRef = doc(db, 'config_algorithm_params', paramId);

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await setDoc(docRef, algorithmParams);
  console.log(`✅ config_algorithm_params: ${paramId} initialized\n`);

  return 1;
}

/**
 * Main initialization function
 */
async function initializeConfig(options: InitOptions = {}) {
  console.log('='.repeat(60));
  console.log('🔧 Firebase Config Initialization');
  console.log('='.repeat(60));
  console.log(`Project: ${firebaseConfig.projectId}`);
  console.log(`Force: ${options.force || false}`);
  console.log(`Verbose: ${options.verbose || false}`);

  try {
    const startTime = Date.now();

    // Initialize all collections
    const stationsCount = await initConfigStations(options);
    const travelTimesCount = await initConfigTravelTimes(options);
    const expressTrainsCount = await initConfigExpressTrains(options);
    const congestionCount = await initConfigCongestion(options);
    const paramsCount = await initConfigAlgorithmParams(options);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('='.repeat(60));
    console.log('✅ Initialization Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`  - Stations:        ${stationsCount}`);
    console.log(`  - Travel Times:    ${travelTimesCount}`);
    console.log(`  - Express Trains:  ${expressTrainsCount}`);
    console.log(`  - Congestion:      ${congestionCount}`);
    console.log(`  - Algorithm Params: ${paramsCount}`);
    console.log(`  - Total:           ${stationsCount + travelTimesCount + expressTrainsCount + congestionCount + paramsCount} documents`);
    console.log(`⏱️  Elapsed: ${elapsed}s`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: InitOptions = {
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run init-config [options]

Options:
  --force     Overwrite existing config collections
  --verbose   Show detailed progress
  --help      Show this help message

Examples:
  npm run init-config
  npm run init-config -- --force
  npm run init-config -- --verbose
    `);
    process.exit(0);
  }

  try {
    await initializeConfig(options);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { initializeConfig, InitOptions };
