/**
 * Type definitions for 가는길에 Cloud Functions
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// ==================== Common Types ====================

export type FirestoreFieldValue = FieldValue;
export type FirestoreTimestamp = Timestamp;

// ==================== Station Types ====================

export interface Station {
  stationCode: string;
  stationName: string;
  line: number;
}

// ==================== User Types ====================

export interface GillerInfo {
  totalDeliveries: number;
  completedDeliveries: number;
  averageRating?: number;
}

export interface User {
  name: string;
  rating: number;
  gillerInfo?: GillerInfo;
  fcmToken?: string;
  fcmTokenUpdatedAt?: FirestoreFieldValue;
}

// ==================== Route Types ====================

export interface GillerRoute {
  gillerId: string;
  gillerName: string;
  startStation: Station;
  endStation: Station;
  departureTime: string; // HH:mm format
  daysOfWeek: number[]; // [1,2,3,4,5] for Mon-Fri
  rating: number;
  totalDeliveries: number;
  completedDeliveries: number;
}

export interface RouteData {
  userId: string;
  startStation: Station;
  endStation: Station;
  departureTime: string;
  daysOfWeek: number[];
  isActive: boolean;
}

// ==================== Request Types ====================

export interface FeeInfo {
  baseFee: number;
  distanceFee: number;
  urgencyFee: number;
  totalFee: number;
}

export interface DeliveryRequest {
  requesterId: string;
  pickupStation: Station;
  deliveryStation: Station;
  requestTime: FirestoreTimestamp;
  preferredDeliveryTime?: string;
  fee: FeeInfo;
  status: 'pending' | 'matched' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  gllerId?: string;
  matchedDeliveryId?: string;
  gillerName?: string;
}

// ==================== Match Types ====================

export interface MatchingDetails {
  routeScore: number;
  timeScore: number;
  ratingScore: number;
  responseTimeScore: number;
  calculatedAt: Date;
}

export interface Match {
  requestId: string;
  gllerId: string;
  gillerId: string;
  gillerName: string;
  gillerRating: number;
  gillerTotalDeliveries: number;
  matchScore: number;
  matchingDetails: MatchingDetails;
  pickupStation: Station;
  deliveryStation: Station;
  estimatedTravelTime: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  notifiedAt: FirestoreFieldValue | null;
  notificationSent?: boolean;
  fee: FeeInfo;
}

export interface ScoredGiller {
  giller: GillerRoute;
  score: number;
}

// ==================== Notification Types ====================

export interface NotificationSettings {
  enabled: boolean;
  fcmToken: string;
  settings: {
    new_message: boolean;
    match_found: boolean;
    request_accepted: boolean;
    delivery_completed: boolean;
  };
}

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// ==================== Chat Types ====================

export interface ChatParticipant {
  userId: string;
  name: string;
}

export interface ChatRoom {
  participants: {
    user1: ChatParticipant;
    user2: ChatParticipant;
  };
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface ChatMessage {
  senderId: string;
  content: string;
  timestamp: FirestoreTimestamp;
  read: boolean;
}

// ==================== Delivery Types ====================

export interface Delivery {
  id: string;
  gillerId: string;
  gillerName: string;
  requestId: string;
  status: 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  pickupStation: Station;
  deliveryStation: Station;
}

// ==================== HTTP Function Types ====================

export interface TriggerMatchingData {
  requestId: string;
}

export interface TriggerMatchingResult {
  success: boolean;
  matchesFound: number;
}

export interface SaveFCMTokenData {
  token: string;
}

export interface SaveFCMTokenResult {
  success: boolean;
}

export interface SendPushNotificationData {
  userId: string;
  notification: PushNotification;
}

export interface SendPushNotificationResult {
  success: boolean;
  reason?: string;
}

// ==================== Pricing Types ====================

export interface PricingOptions {
  distance?: number; // km
  travelTime?: number; // minutes
  isRushHour?: boolean; // 러시아워 여부
  urgency?: 'normal' | 'fast' | 'urgent'; // 긴급도
  isTransferRoute?: boolean;
  transferCount?: number;
  gillerLevel?: 'regular' | 'professional' | 'master';
}

export interface PricingBreakdown {
  type: 'base' | 'transfer' | 'express';
  amount: number;
  description: string;
}

export interface PricingDiscount {
  type: 'transfer_bonus' | 'professional_bonus' | 'express_discount' | 'master_bonus';
  amount: number;
  description: string;
}

export interface GillerEarnings {
  base: number;       // 보너스 제외 기본 수익
  bonus: number;      // 등급별 보너스
  preTax: number;     // 보너스 포함 세전 수익
  tax: number;        // 원천징수세
  net: number;        // 보너스 포함 세후 실수익
}

export interface PlatformEarnings {
  gross: number;      // 총 수수료
  net: number;        // 실수익 (PG 수수료 제외)
}

export interface CalculateDeliveryPricingData {
  distance?: number;
  travelTime?: number;
  isRushHour?: boolean; // 출퇴근 시간대
  urgency?: 'normal' | 'fast' | 'urgent'; // 긴급도
  isTransferRoute?: boolean;
  transferCount?: number;
  gillerLevel?: 'regular' | 'professional' | 'master';
}

export interface CalculateDeliveryPricingResult {
  baseFare: number;
  breakdown: PricingBreakdown[];
  discounts: PricingDiscount[];
  totalFare: number;
  gillerEarnings: GillerEarnings;
  platformEarnings: PlatformEarnings;
  pgFee?: number;      // PG사 수수료
  calculatedAt: Date;
}

// ==================== Matching Types ====================

export interface MatchRequestsData {
  requestId: string;
}

export interface MatchRequestsResult {
  success: boolean;
  matchesFound: number;
  matches?: Array<{
    matchId: string;
    gillerId: string;
    gillerName: string;
    score: number;
  }>;
}

export interface AcceptMatchData {
  matchId: string;
}

export interface AcceptMatchResult {
  success: boolean;
  deliveryId?: string;
}

export interface RejectMatchData {
  matchId: string;
  reason?: string;
}

export interface RejectMatchResult {
  success: boolean;
}

export interface CompleteMatchData {
  matchId: string;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  rating?: number;
  feedback?: string;
}

export interface CompleteMatchResult {
  success: boolean;
  finalEarnings?: {
    base: number;
    bonus: number;
    total: number;
  };
}

// ==================== On-Demand Mode Types ====================

export interface ActivateOnDemandModeData {
  currentLocation: {
    station: string;
    line: string;
  };
  availableUntil: string; // HH:mm format
  preferredLines?: string[];
  maxDetourTime?: number; // minutes
}

export interface ActivateOnDemandModeResult {
  success: boolean;
  routeId?: string;
}

export interface DeactivateOnDemandModeResult {
  success: boolean;
}

export interface OnDemandRoute {
  id: string;
  gillerId: string;
  type: 'on-demand';
  currentLocation: {
    station: string;
    line: string;
    timestamp: FirestoreTimestamp;
  };
  availableUntil: string; // HH:mm format
  preferredLines: string[];
  maxDetourTime: number;
  enabled: boolean;
  status: 'active' | 'inactive';
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
