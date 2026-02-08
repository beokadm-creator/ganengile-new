/**
 * Seoul Subway Travel Time Matrix
 * Actual travel times between major stations (in seconds)
 */

import { TravelTimeInfo } from './subway-stations';

/**
 * Travel time matrix between major stations
 * Key: "fromStationId-toStationId"
 * Value: TravelTimeInfo
 */
export const TRAVEL_TIME_MATRIX: Record<string, TravelTimeInfo> = {
  // Seoul Station (150) to others
  '150-222': { // Seoul → Gangnam
    normalTime: 35 * 60, // 35 minutes (1→4→2 or 1→2→sinbundang)
    expressTime: 22 * 60, // 22 minutes (1→sinbundang express)
    transferCount: 1,
    transferStations: ['D08'],
    hasExpress: true,
    walkingDistance: 200,
  },
  '150-223': { // Seoul → Yeoksam
    normalTime: 32 * 60, // 32 minutes
    expressTime: 25 * 60, // 25 minutes (sinbundang express)
    transferCount: 1,
    transferStations: ['D09'],
    hasExpress: true,
    walkingDistance: 180,
  },
  '150-224': { // Seoul → Seolleung
    normalTime: 30 * 60, // 30 minutes
    expressTime: 24 * 60, // 24 minutes
    transferCount: 1,
    transferStations: ['D10'],
    hasExpress: true,
    walkingDistance: 220,
  },
  '150-234': { // Seoul → Gangnam-gu Office (Gyodae)
    normalTime: 30 * 60, // 30 minutes
    expressTime: 20 * 60, // 20 minutes (express via 3 or 9)
    transferCount: 1,
    transferStations: ['234'],
    hasExpress: true,
    walkingDistance: 150,
  },
  '150-426': { // Seoul → Ichon
    normalTime: 8 * 60, // 8 minutes (direct line 4)
    expressTime: undefined,
    transferCount: 0,
    transferStations: [],
    hasExpress: false,
    walkingDistance: 50,
  },

  // Gangnam (222) to others
  '222-150': { // Gangnam → Seoul
    normalTime: 35 * 60,
    expressTime: 22 * 60,
    transferCount: 1,
    transferStations: ['D08'],
    hasExpress: true,
    walkingDistance: 200,
  },
  '222-223': { // Gangnam → Yeoksam
    normalTime: 4 * 60, // 4 minutes (line 2 direct)
    expressTime: 2 * 60, // 2 minutes (sinbundang express)
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 30,
  },
  '222-224': { // Gangnam → Seolleung
    normalTime: 5 * 60, // 5 minutes
    expressTime: 3 * 60, // 3 minutes
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 40,
  },
  '222-234': { // Gangnam → Gyodae
    normalTime: 8 * 60, // 8 minutes (line 2 direct)
    expressTime: 5 * 60, // 5 minutes (line 9 express)
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 100,
  },
  '222-334': { // Gangnam → Yangjae
    normalTime: 12 * 60, // 12 minutes (line 2→3 or sinbundang)
    expressTime: 8 * 60, // 8 minutes (sinbundang express)
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 120,
  },

  // Yeoksam (223) to others
  '223-150': { // Yeoksam → Seoul
    normalTime: 32 * 60,
    expressTime: 25 * 60,
    transferCount: 1,
    transferStations: ['D09'],
    hasExpress: true,
    walkingDistance: 180,
  },
  '223-222': { // Yeoksam → Gangnam
    normalTime: 4 * 60,
    expressTime: 2 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 30,
  },
  '223-224': { // Yeoksam → Seolleung
    normalTime: 3 * 60, // 3 minutes
    expressTime: 2 * 60, // 2 minutes
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 20,
  },
  '223-234': { // Yeoksam → Gyodae
    normalTime: 10 * 60, // 10 minutes
    expressTime: 7 * 60, // 7 minutes
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 80,
  },

  // Seolleung (224) to others
  '224-150': { // Seolleung → Seoul
    normalTime: 30 * 60,
    expressTime: 24 * 60,
    transferCount: 1,
    transferStations: ['D10'],
    hasExpress: true,
    walkingDistance: 220,
  },
  '224-222': { // Seolleung → Gangnam
    normalTime: 5 * 60,
    expressTime: 3 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 40,
  },
  '224-223': { // Seolleung → Yeoksam
    normalTime: 3 * 60,
    expressTime: 2 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 20,
  },

  // Gyodae (234) to others
  '234-150': { // Gyodae → Seoul
    normalTime: 30 * 60,
    expressTime: 20 * 60,
    transferCount: 1,
    transferStations: ['234'],
    hasExpress: true,
    walkingDistance: 150,
  },
  '234-222': { // Gyodae → Gangnam
    normalTime: 8 * 60,
    expressTime: 5 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 100,
  },
  '234-334': { // Gyodae → Yangjae
    normalTime: 6 * 60, // 6 minutes (line 3 direct)
    expressTime: 4 * 60, // 4 minutes (sinbundang express)
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 90,
  },

  // Yangjae (334) to others
  '334-150': { // Yangjae → Seoul
    normalTime: 28 * 60,
    expressTime: 20 * 60,
    transferCount: 1,
    transferStations: ['D05'],
    hasExpress: true,
    walkingDistance: 180,
  },
  '334-222': { // Yangjae → Gangnam
    normalTime: 12 * 60,
    expressTime: 8 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 120,
  },
  '334-234': { // Yangjae → Gyodae
    normalTime: 6 * 60,
    expressTime: 4 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 90,
  },

  // Jongno 3-ga (156) to others
  '156-150': { // Jongno 3-ga → Seoul
    normalTime: 5 * 60, // 5 minutes (line 1 direct)
    expressTime: undefined,
    transferCount: 0,
    transferStations: [],
    hasExpress: false,
    walkingDistance: 40,
  },
  '156-222': { // Jongno 3-ga → Gangnam
    normalTime: 25 * 60, // 25 minutes (1→2 or 3→2)
    expressTime: 18 * 60, // 18 minutes (via 3→sinbundang)
    transferCount: 1,
    transferStations: ['223'],
    hasExpress: true,
    walkingDistance: 150,
  },

  // City Hall (152) to others
  '152-150': { // City Hall → Seoul
    normalTime: 3 * 60, // 3 minutes
    expressTime: undefined,
    transferCount: 0,
    transferStations: [],
    hasExpress: false,
    walkingDistance: 20,
  },
  '152-222': { // City Hall → Gangnam
    normalTime: 22 * 60,
    expressTime: 15 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 80,
  },

  // Ichon (426) to others
  '426-150': { // Ichon → Seoul
    normalTime: 8 * 60,
    expressTime: undefined,
    transferCount: 0,
    transferStations: [],
    hasExpress: false,
    walkingDistance: 50,
  },
  '426-222': { // Ichon → Gangnam
    normalTime: 28 * 60, // 28 minutes (4→2)
    expressTime: 20 * 60, // 20 minutes (4→sinbundang)
    transferCount: 1,
    transferStations: ['222'],
    hasExpress: true,
    walkingDistance: 200,
  },

  // Express Bus Terminal (339) to others
  '339-150': { // Express Bus Terminal → Seoul
    normalTime: 25 * 60,
    expressTime: 18 * 60,
    transferCount: 1,
    transferStations: ['152'],
    hasExpress: true,
    walkingDistance: 180,
  },
  '339-222': { // Express Bus Terminal → Gangnam
    normalTime: 15 * 60,
    expressTime: 10 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 120,
  },

  // Yeouido (540/915) to others
  '540-150': { // Yeouido → Seoul
    normalTime: 18 * 60,
    expressTime: 12 * 60, // 9호선 급행
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 100,
  },
  '540-222': { // Yeouido → Gangnam
    normalTime: 12 * 60,
    expressTime: 8 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 80,
  },

  // Jamsil (810) to others
  '810-150': { // Jamsil → Seoul
    normalTime: 30 * 60,
    expressTime: 22 * 60,
    transferCount: 1,
    transferStations: ['234'],
    hasExpress: true,
    walkingDistance: 200,
  },
  '810-222': { // Jamsil → Gangnam
    normalTime: 10 * 60,
    expressTime: 7 * 60,
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 70,
  },

  // Gongdeok (640) to others
  '640-150': { // Gongdeok → Seoul
    normalTime: 12 * 60,
    expressTime: 8 * 60, // 공항철도
    transferCount: 0,
    transferStations: [],
    hasExpress: true,
    walkingDistance: 80,
  },
  '640-222': { // Gongdeok → Gangnam
    normalTime: 25 * 60,
    expressTime: 18 * 60,
    transferCount: 1,
    transferStations: ['223'],
    hasExpress: true,
    walkingDistance: 180,
  },
};

/**
 * Get travel time between two stations
 * @param fromStationId Origin station ID
 * @param toStationId Destination station ID
 * @returns Travel time information or null if not found
 */
export function getTravelTime(
  fromStationId: string,
  toStationId: string
): TravelTimeInfo | null {
  const key = `${fromStationId}-${toStationId}`;

  // Direct lookup
  if (TRAVEL_TIME_MATRIX[key]) {
    return TRAVEL_TIME_MATRIX[key];
  }

  // Reverse lookup (same travel time in reverse direction)
  const reverseKey = `${toStationId}-${fromStationId}`;
  if (TRAVEL_TIME_MATRIX[reverseKey]) {
    return TRAVEL_TIME_MATRIX[reverseKey];
  }

  // Not found - estimate based on direct distance
  return null;
}

/**
 * Estimate travel time if not in matrix
 * @param distance Distance in meters
 * @param hasTransfer Whether transfer is needed
 * @returns Estimated travel time in seconds
 */
export function estimateTravelTime(
  distance: number,
  hasTransfer: boolean
): number {
  // Average subway speed: ~30 km/h = 500 m/min
  const baseTime = (distance / 500) * 60;

  // Add transfer time: ~5 minutes per transfer
  const transferTime = hasTransfer ? 5 * 60 : 0;

  return Math.ceil(baseTime + transferTime);
}

/**
 * Get express time savings
 * @param fromStationId Origin station ID
 * @param toStationId Destination station ID
 * @returns Time saved by taking express train (in seconds), or 0 if no express available
 */
export function getExpressTimeSaved(
  fromStationId: string,
  toStationId: string
): number {
  const travelTime = getTravelTime(fromStationId, toStationId);

  if (!travelTime?.expressTime) {
    return 0;
  }

  return travelTime.normalTime - travelTime.expressTime;
}
