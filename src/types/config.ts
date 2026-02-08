/**
 * Config Types
 * Firestore Config Collections 타입 정의
 */

// ==================== Station Types ====================

export interface StationLine {
  lineId: string;
  lineName: string;
  lineCode: string;
  lineColor: string;
  lineType: 'general' | 'express' | 'special';
}

export interface StationLocation {
  latitude: number;
  longitude: number;
}

export interface StationFacilities {
  hasElevator: boolean;
  hasEscalator: boolean;
  wheelchairAccessible?: boolean;
}

export interface Station {
  stationId: string;
  stationName: string;
  stationNameEnglish: string;
  lines: StationLine[];
  location: StationLocation;
  isTransferStation: boolean;
  isExpressStop: boolean;
  isTerminus: boolean;
  facilities: StationFacilities;
  isActive: boolean;
  region: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Travel Time Types ====================

export interface TravelTime {
  travelTimeId: string;
  fromStationId: string;
  toStationId: string;
  fromStationName: string;
  toStationName: string;

  // Travel time information
  normalTime: number; // seconds
  expressTime?: number; // seconds

  // Route details
  transferCount: number;
  transferStations: string[];
  hasExpress: boolean;

  // Additional info
  walkingDistance: number; // meters
  distance: number; // total distance in meters
  lineIds: string[];

  // Quality
  reliability: number; // 1-10
  lastVerified: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Express Train Types ====================

export type ExpressTrainType = 'special' | 'express' | 'itx' | 'ktx' | 'srt' | 'airport';

export interface TimeSavings {
  [key: string]: number; // routeId -> seconds saved
}

export interface ExpressTrain {
  expressId: string;
  lineId: string;
  lineName: string;
  type: ExpressTrainType;
  typeName: string;

  // Operating schedule
  operatingDays: number[]; // [1,2,3,4,5] or [1,2,3,4,5,6,7]
  firstTrain: string; // "HH:mm"
  lastTrain: string; // "HH:mm"

  // Intervals (seconds)
  rushHourMorningInterval: number;
  rushHourEveningInterval: number;
  daytimeInterval: number;
  nightInterval: number;

  // Stops
  stops: string[]; // Array of station IDs

  // Performance
  avgSpeed: number; // km/h
  timeSavings: TimeSavings;

  isActive: boolean;
  seasonStart?: Date;
  seasonEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Congestion Types ====================

export type TimeSlot = 'earlyMorning' | 'rushHourMorning' | 'morning' | 'lunch' | 'afternoon' | 'rushHourEvening' | 'evening';

export interface CongestionTimeSlots {
  earlyMorning: number; // 05:00-07:00
  rushHourMorning: number; // 07:00-09:00
  morning: number; // 09:00-12:00
  lunch: number; // 12:00-14:00
  afternoon: number; // 14:00-18:00
  rushHourEvening: number; // 18:00-20:00
  evening: number; // 20:00-23:00
}

export interface CongestionSection {
  stationId: string;
  stationName: string;
  congestionLevel: number; // 1-10
}

export interface CongestionData {
  congestionId: string;
  lineId: string;
  lineName: string;

  // Congestion by time slot
  timeSlots: CongestionTimeSlots;

  // Congestion by sections
  sections: CongestionSection[];

  // Metadata
  dataSource: string;
  lastUpdated: Date;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Algorithm Params Types ====================

export interface AlgorithmWeights {
  timeEfficiency: number; // 0.5
  routeConvenience: number; // 0.3
  gillerReliability: number; // 0.2
}

export interface TimeEfficiencyBreakdown {
  travelTime: number; // 0.6
  waitingTime: number; // 0.2
  scheduleMatch: number; // 0.2
}

export interface RouteConvenienceBreakdown {
  transferPenalty: number; // 0.4
  congestion: number; // 0.3
  walkingDistance: number; // 0.3
}

export interface GillerReliabilityBreakdown {
  rating: number; // 0.6
  responseTime: number; // 0.4
}

export interface TravelTimeScoring {
  excellentMargin: number; // 30 minutes
  goodMargin: number; // 15 minutes
  acceptableMargin: number; // 5 minutes
  tightMargin: number; // 0 minutes
  impossibleMargin: number; // < 0
}

export interface WaitingTimeScoring {
  maxWaitTime: number; // 30 minutes
  pointsPer5Minutes: number; // 1 point per 5 minutes
}

export interface TransferScoring {
  penaltyPerTransfer: number; // 3 points
  maxScore: number; // 12 points
}

export interface CongestionScoring {
  rushHourPenalty: number; // -3 points
  maxScore: number; // 9 points
}

export interface WalkingDistanceScoring {
  penaltyPer100m: number; // 1 point
  maxScore: number; // 9 points
}

export interface RatingScoring {
  minRating: number; // 3.0
  maxRating: number; // 5.0
  maxScore: number; // 12 points
}

export interface ResponseTimeScoring {
  excellent: number; // 0-5 minutes
  good: number; // 5-15 minutes
  fair: number; // 15-30 minutes
  poor: number; // > 30 minutes
}

export interface ScoringParams {
  travelTime: TravelTimeScoring;
  waitingTime: WaitingTimeScoring;
  transfer: TransferScoring;
  congestion: CongestionScoring;
  walkingDistance: WalkingDistanceScoring;
  rating: RatingScoring;
  responseTime: ResponseTimeScoring;
}

export interface MatchingLimits {
  maxMatchesPerRequest: number; // 5
  matchTimeoutMinutes: number; // 5
  maxRetryCount: number; // 3
  minScore: number; // 20
}

export interface PriorityMultipliers {
  proGillerMultiplier: number; // 1.2
  premiumBusinessMultiplier: number; // 1.15
  newGillerPenalty: number; // 0.9
}

export interface FeatureFlags {
  enableExpressBonus: boolean;
  enableCongestionPenalty: boolean;
  enableRushHourPenalty: boolean;
  enableTransferPenalty: boolean;
  enableProGillerPriority: boolean;
}

export interface AlgorithmParams {
  paramId: string;
  version: string;

  // Matching weights
  weights: AlgorithmWeights;

  // Breakdowns
  timeEfficiency: TimeEfficiencyBreakdown;
  routeConvenience: RouteConvenienceBreakdown;
  gillerReliability: GillerReliabilityBreakdown;

  // Scoring parameters
  scoring: ScoringParams;

  // Matching limits
  limits: MatchingLimits;

  // Priority multipliers
  priorities: PriorityMultipliers;

  // Feature flags
  features: FeatureFlags;

  // Metadata
  isActive: boolean;
  description: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Region Types ====================

export interface Region {
  regionId: string;
  regionName: string;
  stationIds: string[];

  // Region characteristics
  avgCongestion: number; // 1-10
  businessDensity: number; // 1-10
  populationDensity: number; // 1-10

  // Matching preferences
  priority: number; // 1-10

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Route Query Result Types ====================

export interface RouteResult {
  fromStationId: string;
  toStationId: string;
  normalTime: number; // seconds
  expressTime?: number; // seconds
  transferCount: number;
  hasExpress: boolean;
  walkingDistance: number;
  lineIds: string[];
}

export interface DetourInfo {
  originalTime: number; // seconds
  detourTime: number; // seconds
  extraTime: number; // seconds
  extraDistance: number; // meters
  isAcceptable: boolean;
}
