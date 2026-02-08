/**
 * Delivery Type Definitions
 * Delivery and delivery request related types
 */

import { StationInfo } from './route';
import { UserRole } from './user';

/**
 * Delivery status enum
 */
export enum DeliveryStatus {
  /** Request created, waiting for match */
  PENDING = 'pending',

  /** Match found, waiting for courier acceptance */
  MATCHED = 'matched',

  /** Courier accepted, waiting for pickup */
  ACCEPTED = 'accepted',

  /** Package picked up by courier */
  IN_TRANSIT = 'in_transit',

  /** Courier arrived at destination station */
  ARRIVED = 'arrived',

  /** Delivery completed */
  COMPLETED = 'completed',

  /** Delivery cancelled */
  CANCELLED = 'cancelled',

  /** Quote requested (cargo) */
  QUOTE_REQUESTED = 'quote_requested',

  /** Quote received (cargo) */
  QUOTE_RECEIVED = 'quote_received',

  /** Delivery scheduled (cargo) */
  SCHEDULED = 'scheduled',
}

/**
 * Delivery type enum
 */
export enum DeliveryType {
  /** Standard subway delivery */
  STANDARD = 'standard',

  /** Express delivery */
  EXPRESS = 'express',

  /** Same-day delivery */
  SAME_DAY = 'same_day',

  /** Scheduled delivery */
  SCHEDULED = 'scheduled',

  /** Large cargo delivery */
  CARGO = 'cargo',

  /** Multi-drop delivery */
  MULTI_DROP = 'multi_drop',
}

/**
 * Package size categories
 */
export enum PackageSize {
  /** Small (fits in backpack) */
  SMALL = 'small',

  /** Medium (fits in shopping bag) */
  MEDIUM = 'medium',

  /** Large (requires cart) */
  LARGE = 'large',

  /** Extra large (requires special equipment) */
  EXTRA_LARGE = 'extra_large',
}

/**
 * Package information
 */
export interface PackageInfo {
  /** Package size category */
  size: PackageSize;

  /** Estimated weight (kg) */
  weight: number;

  /** Package description */
  description: string;

  /** Package category */
  category?: string;

  /** Package photos */
  photos?: string[];

  /** Fragile flag */
  isFragile: boolean;

  /** Perishable flag */
  isPerishable: boolean;

  /** Special handling instructions */
  specialInstructions?: string;

  /** Declared value (KRW) for insurance */
  declaredValue?: number;
}

/**
 * Delivery fee breakdown
 */
export interface DeliveryFee {
  /** Base fee */
  baseFee: number;

  /** Distance fee */
  distanceFee: number;

  /** Weight fee */
  weightFee: number;

  /** Size fee */
  sizeFee: number;

  /** Express fee (if applicable) */
  expressFee?: number;

  /** Insurance fee (if applicable) */
  insuranceFee?: number;

  /** Service fee */
  serviceFee: number;

  /** Discount amount */
  discount?: number;

  /** Total fee */
  totalFee: number;

  /** VAT */
  vat: number;
}

/**
 * Delivery request interface
 */
export interface DeliveryRequest {
  /** Unique request ID */
  requestId: string;

  /** Gller (sender) user ID */
  gllerId: string;

  /** Gller name (denormalized) */
  gllerName?: string;

  /** Pickup station */
  pickupStation: StationInfo;

  /** Delivery station */
  deliveryStation: StationInfo;

  /** Delivery type */
  deliveryType: DeliveryType;

  /** Package information */
  packageInfo: PackageInfo;

  /** Delivery fee */
  fee: DeliveryFee;

  /** Recipient name */
  recipientName: string;

  /** Recipient phone */
  recipientPhone: string;

  /** Recipient verification code (6 digits) */
  recipientVerificationCode: string;

  /** Preferred delivery time window */
  preferredTimeWindow?: {
    start: Date;
    end: Date;
  };

  /** Deadline for pickup */
  pickupDeadline: Date;

  /** Deadline for delivery */
  deliveryDeadline: Date;

  /** Special requests */
  specialRequests?: string[];

  /** Request status */
  status: DeliveryStatus;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;

  /** Matched delivery ID (if matched) */
  matchedDeliveryId?: string;

  /** Cancellation reason (if cancelled) */
  cancellationReason?: string;

  /** Cancelled by user ID */
  cancelledBy?: string;

  /** Cancelled at timestamp */
  cancelledAt?: Date;
}

/**
 * Courier location during delivery
 */
export interface CourierLocation {
  /** Current location */
  location: {
    latitude: number;
    longitude: number;
  };

  /** Location timestamp */
  timestamp: Date;

  /** Accuracy in meters */
  accuracy: number;

  /** Current station ID (if at station) */
  currentStationId?: string;
}

/**
 * Delivery tracking information
 */
export interface DeliveryTracking {
  /** Courier location */
  courierLocation?: CourierLocation;

  /** Estimated pickup time */
  estimatedPickupTime?: Date;

  /** Estimated delivery time */
  estimatedDeliveryTime?: Date;

  /** Actual pickup time */
  actualPickupTime?: Date;

  /** Actual delivery time */
  actualDeliveryTime?: Date;

  /** Tracking events */
  events: TrackingEvent[];

  /** Current progress percentage (0-100) */
  progress: number;

  /** Distance remaining (meters) */
  distanceRemaining?: number;
}

/**
 * Tracking event
 */
export interface TrackingEvent {
  /** Event type */
  type: 'created' | 'matched' | 'accepted' | 'picked_up' | 'in_transit' | 'arrived' | 'delivered' | 'cancelled';

  /** Event timestamp */
  timestamp: Date;

  /** Event location */
  location?: {
    latitude: number;
    longitude: number;
  };

  /** Event description */
  description: string;

  /** Actor (user ID) */
  actorId?: string;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Delivery interface
 */
export interface Delivery {
  /** Unique delivery ID */
  deliveryId: string;

  /** Associated request ID */
  requestId: string;

  /** Gller (sender) user ID */
  gllerId: string;

  /** Courier (giller) user ID */
  gillerId: string;

  /** Courier name (denormalized) */
  gillerName?: string;

  /** Courier role */
  gillerRole: UserRole;

  /** Pickup station */
  pickupStation: StationInfo;

  /** Delivery station */
  deliveryStation: StationInfo;

  /** Delivery type */
  deliveryType: DeliveryType;

  /** Package information */
  packageInfo: PackageInfo;

  /** Delivery fee */
  fee: DeliveryFee;

  /** Recipient information */
  recipientInfo: {
    name: string;
    phone: string;
    verificationCode: string;
  };

  /** Delivery status */
  status: DeliveryStatus;

  /** Delivery tracking */
  tracking: DeliveryTracking;

  /** Match ID */
  matchId: string;

  /** Scheduled pickup time (for scheduled deliveries) */
  scheduledPickupTime?: Date;

  /** Scheduled delivery time (for scheduled deliveries) */
  scheduledDeliveryTime?: Date;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;

  /** Completed timestamp */
  completedAt?: Date;

  /** Completion note */
  completionNote?: string;

  /** Cancellation reason (if cancelled) */
  cancellationReason?: string;

  /** Cancelled by user ID */
  cancelledBy?: string;

  /** Cancelled at timestamp */
  cancelledAt?: Date;

  /** Delivery photos (proof of delivery) */
  deliveryPhotos?: string[];

  /** Rating from gller */
  gllerRating?: {
    rating: number;
    comment?: string;
    ratedAt: Date;
  };

  /** Rating from giller */
  gillerRating?: {
    rating: number;
    comment?: string;
    ratedAt: Date;
  };

  /** Issue reported */
  issueReported?: {
    type: string;
    description: string;
    reportedAt: Date;
    resolved: boolean;
  };
}

/**
 * Delivery statistics
 */
export interface DeliveryStats {
  /** Total deliveries */
  totalDeliveries: number;

  /** Completed deliveries */
  completedDeliveries: number;

  /** Cancelled deliveries */
  cancelledDeliveries: number;

  /** In-progress deliveries */
  inProgressDeliveries: number;

  /** Average rating */
  averageRating: number;

  /** Total earnings (for couriers) */
  totalEarnings: number;

  /** Completion rate (%) */
  completionRate: number;

  /** Average delivery time (minutes) */
  averageDeliveryTime: number;

  /** On-time delivery rate (%) */
  onTimeDeliveryRate: number;
}

/**
 * Delivery history filter
 */
export interface DeliveryHistoryFilter {
  /** Filter by status */
  status?: DeliveryStatus[];

  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Filter by route */
  route?: {
    pickupStationId?: string;
    deliveryStationId?: string;
  };

  /** Filter by courier ID */
  courierId?: string;

  /** Filter by gller ID */
  gllerId?: string;

  /** Filter by delivery type */
  deliveryType?: DeliveryType;

  /** Pagination */
  pagination?: {
    limit: number;
    offset: number;
  };

  /** Sort order */
  sort?: {
    field: 'createdAt' | 'updatedAt' | 'scheduledPickupTime' | 'fee';
    order: 'asc' | 'desc';
  };
}

/**
 * Cargo request extension
 */
export interface CargoRequest extends DeliveryRequest {
  /** Cargo-specific items */
  cargoItems: CargoRequestItem[];

  /** Requested quotes */
  quotes?: CargoQuote[];

  /** Accepted quote ID */
  acceptedQuoteId?: string;

  /** Vehicle type preference */
  vehicleTypePreference?: string[];

  /** Special handling requirements */
  specialHandling?: string[];
}

/**
 * Cargo request item
 */
export interface CargoRequestItem {
  /** Item name */
  name: string;

  /** Item category */
  category: string;

  /** Quantity */
  quantity: number;

  /** Dimensions */
  dimensions: {
    length: number;
    width: number;
    height: number;
  };

  /** Weight per unit (kg) */
  weight: number;

  /** Total weight (kg) */
  totalWeight: number;

  /** Special handling */
  specialHandling?: string[];

  /** Photos */
  photos?: string[];
}

/**
 * Cargo quote
 */
export interface CargoQuote {
  /** Quote ID */
  quoteId: string;

  /** Cargo request ID */
  cargoRequestId: string;

  /** Partner ID */
  partnerId: string;

  /** Partner name */
  partnerName: string;

  /** Quoted price */
  price: number;

  /** Price breakdown */
  priceBreakdown: {
    baseFee: number;
    distanceFee: number;
    weightFee: number;
    handlingFee: number;
    total: number;
  };

  /** Estimated pickup time */
  estimatedPickupTime: Date;

  /** Estimated delivery time */
  estimatedDeliveryTime: Date;

  /** Vehicle type */
  vehicleType: string;

  /** Valid until */
  validUntil: Date;

  /** Quote status */
  status: 'pending' | 'accepted' | 'rejected' | 'expired';

  /** Additional notes */
  notes?: string;

  /** Created at */
  createdAt: Date;
}

/**
 * Delivery confirmation
 */
export interface DeliveryConfirmation {
  /** Delivery ID */
  deliveryId: string;

  /** Confirmation type */
  type: 'pickup' | 'delivery';

  /** Verification code */
  verificationCode: string;

  /** Photo evidence */
  photos?: string[];

  /** Location */
  location: {
    latitude: number;
    longitude: number;
  };

  /** Confirmed by user ID */
  confirmedBy: string;

  /** Confirmed at timestamp */
  confirmedAt: Date;

  /** Notes */
  notes?: string;
}
