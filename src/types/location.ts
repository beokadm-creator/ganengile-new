/**
 * Location Type Definitions
 * Station and location-related types for the subway delivery system
 */

/**
 * Subway line information
 */
export interface LineInfo {
  /** Line number (e.g., "1", "2", "3", ...) */
  line: string;

  /** Line name (e.g., "일호선", "이호선", ...) */
  lineName: string;

  /** Line color code (hex) */
  lineColor: string;
}

/**
 * GeoPoint for Firestore
 */
export interface GeoPoint {
  /** Latitude */
  latitude: number;

  /** Longitude */
  longitude: number;
}

/**
 * Station information
 */
export interface Station {
  /** Unique station ID */
  stationId: string;

  /** Station name (Korean) */
  name: string;

  /** Station name (English) */
  nameEnglish?: string;

  /** Lines that serve this station */
  lines: LineInfo[];

  /** Station location */
  location: GeoPoint;

  /** Station address */
  address?: string;

  /** Station code (e.g., "150") */
  stationCode?: string;

  /** Transfer station flag */
  isTransferStation: boolean;

  /** Available facilities */
  facilities?: StationFacilities;

  /** Operating hours */
  operatingHours?: {
    firstTrain: string;
    lastTrain: string;
  };

  /** Station photo URL */
  photoURL?: string;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Station facilities
 */
export interface StationFacilities {
  /** Elevator available */
  elevator: boolean;

  /** Escalator available */
  escalator: boolean;

  /** Restroom available */
  restroom: boolean;

  /** Wheelchair accessible */
  wheelchairAccessible: boolean;

  /** Parking available */
  parking: boolean;

  /** Bike storage available */
  bikeStorage: boolean;

  /** Lockers available */
  lockers: boolean;
}

/**
 * Real-time arrival information
 */
export interface ArrivalInfo {
  /** Station ID */
  stationId: string;

  /** Line number */
  line: string;

  /** Train destination */
  destination: string;

  /** Expected arrival time (minutes) */
  arrivalTime: number;

  /** Current train location */
  currentLocation?: GeoPoint;

  /** Train direction (inbound/outbound) */
  direction: 'inbound' | 'outbound';

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Train location information
 */
export interface LocationInfo {
  /** Train ID */
  trainId: string;

  /** Line number */
  line: string;

  /** Current location */
  location: GeoPoint;

  /** Direction */
  direction: 'inbound' | 'outbound';

  /** Speed (km/h) */
  speed: number;

  /** Next station ID */
  nextStationId: string;

  /** Previous station ID */
  previousStationId: string;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Route segment between two stations
 */
export interface RouteSegment {
  /** From station */
  fromStation: Station;

  /** To station */
  toStation: Station;

  /** Line number for this segment */
  line: string;

  /** Distance in meters */
  distance: number;

  /** Estimated travel time (minutes) */
  travelTime: number;

  /** Transfer required at toStation */
  requiresTransfer: boolean;

  /** Transfer line (if applicable) */
  transferLine?: string;
}

/**
 * Complete route from start to destination
 */
export interface Route {
  /** Unique route ID */
  routeId: string;

  /** Starting station */
  startStation: Station;

  /** Destination station */
  endStation: Station;

  /** Route segments */
  segments: RouteSegment[];

  /** Total distance (meters) */
  totalDistance: number;

  /** Total travel time (minutes) */
  totalTravelTime: number;

  /** Number of transfers */
  transferCount: number;

  /** Estimated fare (KRW) */
  fare: number;

  /** Created timestamp */
  createdAt: Date;
}

/**
 * Location search filters
 */
export interface LocationSearchFilters {
  /** Search by line number */
  lines?: string[];

  /** Filter by facilities */
  facilities?: Partial<StationFacilities>;

  /** Transfer stations only */
  transferOnly?: boolean;

  /** Maximum distance from point (meters) */
  maxDistance?: number;
}

/**
 * Location partner (pickup point) information
 */
export interface LocationPartner {
  /** Unique partner ID */
  partnerId: string;

  /** Partner name */
  partnerName: string;

  /** Partner type */
  partnerType: 'store' | 'locker' | 'counter';

  /** Station ID where located */
  stationId: string;

  /** Station name (denormalized) */
  stationName?: string;

  /** Store address */
  address: string;

  /** Location coordinates */
  location: GeoPoint;

  /** Phone number */
  phone: string;

  /** Manager name */
  managerName: string;

  /** Manager phone */
  managerPhone: string;

  /** Storage capacity */
  storageCapacity: number;

  /** Current storage usage */
  currentUsage: number;

  /** Operating hours */
  operatingHours: {
    open: string;
    close: string;
  };

  /** Operating days */
  operatingDays: number[];

  /** Active status */
  isActive: boolean;

  /** Verification status */
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';

  /** Rating */
  rating: number;

  /** Total pickups handled */
  totalPickups: number;

  /** Commission rate (%) */
  commissionRate: number;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Pickup information at location partner
 */
export interface Pickup {
  /** Unique pickup ID */
  pickupId: string;

  /** Delivery ID */
  deliveryId: string;

  /** Partner ID */
  partnerId: string;

  /** Gller (sender) ID */
  gllerId: string;

  /** Pickup verification code (6 digits) */
  verificationCode: string;

  /** Pickup status */
  status: 'pending' | 'ready' | 'picked_up' | 'expired';

  /** Package storage location */
  storageLocation: string;

  /** Pickup scheduled time */
  scheduledTime: Date;

  /** Actual pickup time */
  actualPickupTime?: Date;

  /** Storage start time */
  storageStartTime: Date;

  /** Storage end time */
  storageEndTime?: Date;

  /** Storage fee */
  storageFee: number;

  /** Created timestamp */
  createdAt: Date;
}

/**
 * Station zone/area for matching
 */
export interface StationZone {
  /** Unique zone ID */
  zoneId: string;

  /** Zone name */
  zoneName: string;

  /** Center station ID */
  centerStationId: string;

  /** Radius in meters */
  radius: number;

  /** Included station IDs */
  stationIds: string[];

  /** Zone priority (for matching) */
  priority: number;
}
