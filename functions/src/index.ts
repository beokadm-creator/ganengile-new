/**
 * Cloud Functions for 媛?붽만??
 * FCM ?몄떆 ?뚮┝, ?먮룞 留ㅼ묶 ??
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as https from 'https';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { defineString } from 'firebase-functions/params';
import {
  User,
  GillerRoute,
  RouteData,
  DeliveryRequest,
  Match,
  MatchingDetails,
  NotificationSettings,
  ChatRoom,
  ChatMessage,
  TriggerMatchingData,
  TriggerMatchingResult,
  SaveFCMTokenData,
  SaveFCMTokenResult,
  SendPushNotificationData,
  SendPushNotificationResult,
  CalculateDeliveryPricingData,
  CalculateDeliveryPricingResult,
  PricingBreakdown,
  PricingDiscount,
  MatchRequestsData,
  MatchRequestsResult,
  AcceptMatchData,
  AcceptMatchResult,
  RejectMatchData,
  RejectMatchResult,
  CompleteMatchData,
  CompleteMatchResult,
  RequestPhoneOtpData,
  RequestPhoneOtpResult,
  ConfirmPhoneOtpData,
  ConfirmPhoneOtpResult,
} from './types';
import {
  executeMissionPlanning,
  executePricingQuoteGeneration,
  executeRequestDraftAnalysis,
  type Beta1MissionPlanInput,
  type Beta1PricingQuoteInput,
  type Beta1RequestDraftAnalysisInput,
} from './beta1-ai';
import { taxInvoiceScheduler } from './scheduled/tax-invoice-scheduler';
import { gillerSettlementScheduler } from './scheduled/settlement-scheduler';
import { partnerSettlementScheduler } from './scheduled/partner-settlement-scheduler';
import { fareCacheScheduler } from './scheduled/fare-cache-scheduler';
import { syncConfigStationsFromSeoulApi } from './station-sync';
import {
  calculateSharedDeliveryFee,
  calculateSharedSettlementBreakdown,
  estimateStationCountFromDistanceKm,
  estimateStationCountFromTravelTimeMinutes,
} from '../../shared/pricing-policy';
import { getFunctionsPricingPolicyConfig } from './pricing-policy-config';
import {
  getTopMatches as getTopSharedMatches,
  matchGillersToRequest as runSharedMatchingEngine,
  type SharedDeliveryRequest,
  type SharedGillerRoute,
  type SharedMatch,
} from '../../shared/matching-engine';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();
const CI_PASS_URL_PARAM = defineString('CI_PASS_URL', { default: '' });
const CI_KAKAO_URL_PARAM = defineString('CI_KAKAO_URL', { default: '' });
const NAVER_MAP_CLIENT_ID_PARAM = defineString('NAVER_MAP_CLIENT_ID', { default: '' });
const NAVER_MAP_CLIENT_SECRET_PARAM = defineString('NAVER_MAP_CLIENT_SECRET', { default: '' });
const JUSO_API_KEY_PARAM = defineString('JUSO_API_KEY', { default: '' });
const OTP_TEST_CODE_PARAM = defineString('OTP_TEST_CODE', { default: '123456' });
const OTP_TEST_MODE_PARAM = defineString('OTP_TEST_MODE', { default: 'true' });

const OTP_SESSION_COLLECTION = 'otp_verifications';
const OTP_LENGTH = 6;
const OTP_TTL_MS = 1000 * 60 * 5;
const OTP_RESEND_MS = 1000 * 45;
const OTP_MAX_ATTEMPTS = 5;

type KakaoUserResponse = {
  id?: string | number;
  kakao_account?: Record<string, unknown>;
  properties?: Record<string, unknown>;
};

type KakaoLinkedUserDoc = {
  role?: 'gller' | 'giller' | 'both';
  name?: string;
  phoneNumber?: string;
  gillerApplicationStatus?: string;
  profilePhoto?: string;
  isVerified?: boolean;
  hasCompletedOnboarding?: boolean;
  agreedTerms?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  badges?: Record<string, unknown>;
  badgeBenefits?: Record<string, unknown>;
};

function requireCallableAuth(context: functions.https.CallableContext, functionName: string): string {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', `${functionName} requires authentication`);
  }
  return uid;
}

function getRequestDayOfWeek(request: DeliveryRequest): string {
  const requestDate = request.requestTime?.toDate?.() ?? new Date();
  const weekday = requestDate.getDay();
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][weekday] ?? 'mon';
}

function getRequestTime(request: DeliveryRequest): string {
  if (typeof request.preferredDeliveryTime === 'string' && request.preferredDeliveryTime) {
    return request.preferredDeliveryTime;
  }

  const requestDate = request.requestTime?.toDate?.() ?? new Date();
  const hours = String(requestDate.getHours()).padStart(2, '0');
  const minutes = String(requestDate.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function readFirstQueryValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return '';
}

function readObjectString(source: unknown, key: string): string {
  if (typeof source !== 'object' || source === null) {
    return '';
  }

  const value = (source as Record<string, unknown>)[key];
  return readFirstQueryValue(value);
}

function readPositiveInteger(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 7) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 4)}**-${phoneNumber.slice(-4)}`;
}

function isValidKoreanMobileNumber(phoneNumber: string): boolean {
  return /^010\d{8}$/.test(phoneNumber);
}

function hashOtpCode(sessionId: string, code: string): string {
  return createHash('sha256').update(`${sessionId}:${code}`).digest('hex');
}

function createOtpCode(): string {
  const max = 10 ** OTP_LENGTH;
  const code = Math.floor(Math.random() * max);
  return String(code).padStart(OTP_LENGTH, '0');
}

function isOtpTestModeEnabled(): boolean {
  const raw = getFirstNonEmptyString(
    OTP_TEST_MODE_PARAM.value(),
    process.env.OTP_TEST_MODE,
    'true'
  )
    .trim()
    .toLowerCase();
  return raw !== 'false';
}

function getFirstNonEmptyString(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';
}

function buildNaverStaticMapUrl(query: {
  center: string;
  level: string;
  width: string;
  height: string;
  scale: string;
  markers?: string;
}): string {
  const params = new URLSearchParams({
    center: query.center,
    level: query.level,
    w: query.width,
    h: query.height,
    scale: query.scale,
  });

  if (query.markers) {
    params.set('markers', query.markers);
  }

  return `https://maps.apigw.ntruss.com/map-static/v2/raster?${params.toString()}`;
}

function buildNaverGeocodeUrl(query: { address: string }): string {
  const params = new URLSearchParams({
    query: query.address,
  });

  return `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?${params.toString()}`;
}

function buildNaverDirectionsUrl(query: {
  start: string;
  goal: string;
  option?: string;
}): string {
  const params = new URLSearchParams({
    start: query.start,
    goal: query.goal,
    option: query.option ?? 'trafast',
  });

  return `https://maps.apigw.ntruss.com/map-direction/v1/driving?${params.toString()}`;
}

function buildJusoSearchUrl(query: {
  confmKey: string;
  keyword: string;
  currentPage: string;
  countPerPage: string;
}): string {
  const params = new URLSearchParams({
    confmKey: query.confmKey,
    keyword: query.keyword,
    currentPage: query.currentPage,
    countPerPage: query.countPerPage,
    resultType: 'json',
  });

  return `https://business.juso.go.kr/addrlink/addrLinkApi.do?${params.toString()}`;
}

function fetchBinary(url: string, headers: Record<string, string>): Promise<{ statusCode: number; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        headers,
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 500,
            contentType: response.headers['content-type'] ?? 'image/png',
            body: Buffer.concat(chunks),
          });
        });
      }
    );

    request.on('error', reject);
    request.end();
  });
}

function fetchJson(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: options?.method ?? 'GET',
        headers: options?.headers,
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve(raw ? JSON.parse(raw) : {});
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }
    );

    request.on('error', reject);
    if (options?.body) {
      request.write(options.body);
    }
    request.end();
  });
}

type BadgeCategory = 'activity' | 'quality' | 'expertise' | 'community';

interface RequestAcceptedDeliveryDoc {
  gillerName?: string;
}

type CompletedRequestDoc = Partial<DeliveryRequest> & {
  matchedGillerId?: string;
  requestMode?: 'immediate' | 'reservation';
  initialNegotiationFee?: number;
  itemValue?: number;
  depositAmount?: number;
  urgency?: 'low' | 'medium' | 'high' | 'normal' | 'fast' | 'urgent';
  primaryDeliveryId?: string;
  pricingPolicyVersion?: string;
  pricingContext?: {
    requestMode?: 'immediate' | 'reservation';
    weather?: 'clear' | 'rain' | 'snow';
    isPeakTime?: boolean;
    isProfessionalPeak?: boolean;
    nearbyGillerCount?: number | null;
    requestedHour?: number | null;
    urgencyBucket?: 'normal' | 'fast' | 'urgent';
  };
  fee?: {
    baseFee?: number;
    distanceFee?: number;
    weightFee?: number;
    sizeFee?: number;
    urgencySurcharge?: number;
    serviceFee?: number;
    vat?: number;
    dynamicAdjustment?: number;
    totalFee?: number;
  };
  feeBreakdown?: {
    baseFee?: number;
    distanceFee?: number;
    weightFee?: number;
    sizeFee?: number;
    urgencySurcharge?: number;
    serviceFee?: number;
    vat?: number;
    dynamicAdjustment?: number;
    totalFee?: number;
  };
  pickupStation?: { stationId?: string; stationName?: string };
  deliveryStation?: { stationId?: string; stationName?: string };
};

interface BadgeStats {
  completedDeliveries?: number;
  recent30DaysDeliveries?: number;
  rating?: number;
  recentPenalties?: number;
  accountAgeDays?: number;
}

interface BadgeCollections {
  activity?: string[];
  quality?: string[];
  expertise?: string[];
  community?: string[];
}

interface BadgeBenefits {
  totalBadges?: number;
  currentTier?: string;
  profileFrame?: string;
}

interface BadgeUserDoc {
  stats?: BadgeStats;
  badges?: BadgeCollections;
  badgeBenefits?: BadgeBenefits;
  role?: string;
  gillerProfile?: {
    type?: string;
    promotion?: {
      status?: string;
    };
    benefits?: {
      rateBonus?: number;
    };
  };
}

interface CalculateDeliveryRateData {
  baseRate?: number;
  gillerId?: string;
}

interface BadgeCheck {
  id: string;
  category: BadgeCategory;
  condition: boolean;
}

type FirestoreUpdateValue = ReturnType<typeof admin.firestore.FieldValue.arrayUnion> | string | number;

function countBadges(items?: string[]): number {
  return items?.length ?? 0;
}

function readUserRole(userData: BadgeUserDoc | undefined): string {
  return userData?.role ?? '';
}

function buildSharedRequest(requestId: string, request: DeliveryRequest): SharedDeliveryRequest {
  return {
    id: requestId,
    pickupStation: request.pickupStation.stationName,
    deliveryStation: request.deliveryStation.stationName,
    dayOfWeek: getRequestDayOfWeek(request),
    time: getRequestTime(request),
  };
}

function buildSharedRoute(giller: GillerRoute): SharedGillerRoute {
  return {
    gillerId: giller.gillerId,
    gillerName: giller.gillerName,
    departureStation: giller.startStation.stationName,
    arrivalStation: giller.endStation.stationName,
    departureTime: giller.departureTime,
    daysOfWeek: giller.daysOfWeek,
    rating: giller.rating,
    totalDeliveries: giller.totalDeliveries,
    completedDeliveries: giller.completedDeliveries,
  };
}

function estimateTravelTimeForMatch(
  request: SharedDeliveryRequest,
  route: SharedGillerRoute,
  match: SharedMatch
): number {
  const exactRoute =
    route.departureStation === request.pickupStation &&
    route.arrivalStation === request.deliveryStation;
  const routeHour = parseInt(route.departureTime.split(':')[0] ?? '0', 10);
  const requestHour = parseInt(request.time.split(':')[0] ?? '0', 10);
  const hourDiff = Math.abs(routeHour - requestHour);

  if (exactRoute && hourDiff === 0) {
    return 18;
  }

  if (exactRoute) {
    return 24;
  }

  if (match.score >= 70) {
    return 30;
  }

  return 40;
}

function buildMatchingDetails(score: number): MatchingDetails {
  const normalized = Math.max(0, Math.min(score, 100));
  return {
    routeScore: Math.round(normalized * 0.45 * 100) / 100,
    timeScore: Math.round(normalized * 0.25 * 100) / 100,
    ratingScore: Math.round(normalized * 0.2 * 100) / 100,
    responseTimeScore: Math.round(normalized * 0.1 * 100) / 100,
    calculatedAt: new Date(),
  };
}

async function getAvailableGillerRoutesForRequest(request: DeliveryRequest): Promise<GillerRoute[]> {
  const routesSnapshot = await db.collection('routes').where('isActive', '==', true).get();
  if (routesSnapshot.empty) {
    return [];
  }

  const requestDate = request.requestTime?.toDate?.() ?? new Date();
  const dayOfWeek = requestDate.getDay() === 0 ? 7 : requestDate.getDay();
  
  // 1차 필터링: 요일 매칭
  const validRoutes = routesSnapshot.docs
    .map(doc => doc.data() as RouteData)
    .filter(routeData => routeData.daysOfWeek?.includes(dayOfWeek) && routeData.userId);

  if (validRoutes.length === 0) {
    return [];
  }

  // 2차: 중복 제거된 userId 추출
  const userIds = [...new Set(validRoutes.map(r => r.userId))];
  
  // 3차: 병렬 일괄 조회 (N+1 문제 해결)
  const userDocs = await Promise.all(
    userIds.map(id => db.collection('users').doc(id).get())
  );
  
  const userMap = new Map<string, User>();
  for (const userDoc of userDocs) {
    if (userDoc.exists) {
      userMap.set(userDoc.id, userDoc.data() as User);
    }
  }

  const gillerRoutes: GillerRoute[] = [];

  for (const routeData of validRoutes) {
    const userData = userMap.get(routeData.userId);
    if (!userData) continue;

    gillerRoutes.push({
      gillerId: routeData.userId,
      gillerName: userData?.name ?? '이름 미설정',
      startStation: routeData.startStation,
      endStation: routeData.endStation,
      departureTime: routeData.departureTime,
      daysOfWeek: routeData.daysOfWeek,
      rating: userData?.rating ?? 3.5,
      totalDeliveries: userData?.gillerInfo?.totalDeliveries ?? 0,
      completedDeliveries: userData?.gillerInfo?.completedDeliveries ?? 0,
    });
  }

  return gillerRoutes;
}

async function createMatchesForRequest(
  requestId: string,
  request: DeliveryRequest,
  options?: { updateRequestStatus?: boolean }
): Promise<Array<{ matchId: string; gillerId: string; gillerName: string; score: number }>> {
  const gillerRoutes = await getAvailableGillerRoutesForRequest(request);
  if (gillerRoutes.length === 0) {
    return [];
  }

  const existingMatchesSnapshot = await db
    .collection('matches')
    .where('requestId', '==', requestId)
    .where('status', 'in', ['pending', 'accepted'])
    .get();

  const existingGillerIds = new Set(
    existingMatchesSnapshot.docs
      .map((docSnap) => (docSnap.data() as Partial<Match>).gillerId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  );

  const sharedRequest = buildSharedRequest(requestId, request);
  const sharedRoutes = gillerRoutes.map(buildSharedRoute);
  const scoredMatches = getTopSharedMatches(
    runSharedMatchingEngine(sharedRequest, sharedRoutes).filter(
      (item) => !existingGillerIds.has(item.gillerId)
    ),
    3
  );

  if (scoredMatches.length === 0) {
    return [];
  }

  const routeMap = new Map(sharedRoutes.map((route) => [route.gillerId, route]));
  const gillerMap = new Map(gillerRoutes.map((route) => [route.gillerId, route]));
  const batch = db.batch();
  const createdMatches: Array<{ matchId: string; gillerId: string; gillerName: string; score: number }> = [];

  for (const scoredMatch of scoredMatches) {
    const route = routeMap.get(scoredMatch.gillerId);
    const giller = gillerMap.get(scoredMatch.gillerId);
    if (!route || !giller) {
      continue;
    }

    const matchRef = db.collection('matches').doc();
    const matchData: Match = {
      requestId,
      gllerId: request.requesterId ?? '',
      gillerId: giller.gillerId,
      gillerName: giller.gillerName,
      gillerRating: giller.rating,
      gillerTotalDeliveries: giller.totalDeliveries,
      matchScore: scoredMatch.score,
      matchingDetails: buildMatchingDetails(scoredMatch.score),
      pickupStation: request.pickupStation,
      deliveryStation: request.deliveryStation,
      estimatedTravelTime: estimateTravelTimeForMatch(sharedRequest, route, scoredMatch),
      status: 'pending',
      notifiedAt: null,
      fee: request.fee,
    };

    batch.set(matchRef, matchData);
    createdMatches.push({
      matchId: matchRef.id,
      gillerId: giller.gillerId,
      gillerName: giller.gillerName,
      score: scoredMatch.score,
    });
  }

  await batch.commit();

  if (options?.updateRequestStatus !== false && createdMatches.length > 0) {
    await db.collection('requests').doc(requestId).update({
      status: 'matched',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return createdMatches;
}

export const confirmDeliveryReceipt = functions.https.onCall(
  async (data: { deliveryId: string; photoUrl?: string; notes?: string; location?: any }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const requesterId = context.auth.uid;
    const { deliveryId, photoUrl, notes, location } = data;
    
    if (!deliveryId) {
      throw new functions.https.HttpsError('invalid-argument', 'deliveryId is required');
    }
    
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    
    return db.runTransaction(async (tx) => {
      const deliveryDoc = await tx.get(deliveryRef);
      if (!deliveryDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Delivery not found');
      }
      
      const delivery = deliveryDoc.data() as any;
      if (delivery.status === 'cancelled') {
        throw new functions.https.HttpsError('failed-precondition', 'Cancelled delivery cannot be confirmed');
      }
      
      const requestId = delivery.requestId;
      if (!requestId) {
        throw new functions.https.HttpsError('failed-precondition', 'Request info missing');
      }
      
      const requestRef = db.collection('requests').doc(requestId);
      const requestDoc = await tx.get(requestRef);
      if (!requestDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }
      const request = requestDoc.data() as DeliveryRequest;
      
      const ownerId = request.requesterId ?? delivery.gllerId;
      if (ownerId && ownerId !== requesterId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized');
      }
      
      const confirmableStatuses = new Set(['delivered', 'at_locker', 'completed']);
      if (!delivery.status || !confirmableStatuses.has(delivery.status)) {
        throw new functions.https.HttpsError('failed-precondition', 'Not in confirmable status');
      }
      
      if (delivery.requesterConfirmedAt) {
        return { success: true, message: 'Already confirmed', alreadyCompleted: true };
      }
      
      const settlementRef = db.collection('settlements').doc(requestId);
      const settlementSnap = await tx.get(settlementRef);
      if (settlementSnap.exists && settlementSnap.data()?.status === 'completed') {
        return { success: true, alreadyCompleted: true };
      }
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      if (!settlementSnap.exists) {
        tx.set(settlementRef, {
          requestId,
          deliveryId,
          gillerId: delivery.gillerId,
          requesterId,
          status: 'processing',
          createdAt: now,
          updatedAt: now,
        });
      } else {
        tx.update(settlementRef, {
          status: 'processing',
          updatedAt: now,
        });
      }
      
      const trackingEvents = delivery.tracking?.events ?? [];
      tx.update(deliveryRef, {
        status: 'completed',
        requesterConfirmedAt: now,
        requesterConfirmedBy: requesterId,
        confirmationPhotos: photoUrl ? [photoUrl] : [],
        confirmationNote: notes || null,
        'tracking.events': [
          ...trackingEvents,
          {
            type: 'confirmed_by_requester',
            timestamp: new Date().toISOString(),
            description: '수령자가 배송을 확인했습니다',
            actorId: requesterId,
            location: location || null,
          }
        ],
        'tracking.progress': 100,
        updatedAt: now,
      });
      
      tx.update(requestRef, {
        status: 'completed',
        requesterConfirmedAt: now,
        requesterConfirmedBy: requesterId,
        updatedAt: now,
      });
      
      return { success: true, alreadyCompleted: false };
    });
  }
);

// ==================== FCM Notification Functions ====================

/**
 * Cloud Function: Trigger matching when a new request is created
 * Automatically finds top 3 guiders and creates match documents
 */
export const onRequestCreated = functions.firestore
  .document('requests/{requestId}')
  .onCreate(async (snapshot, context) => {
    const request = snapshot.data() as DeliveryRequest;
    const requestId = context.params.requestId;

    if (request?.status !== 'pending') {
      console.warn('??툘 Skipping matching - request not in pending status');
      return null;
    }

    console.warn(`?렞 New request created: ${requestId}`);
    console.warn(`?뱧 Route: ${request.pickupStation?.stationName} ??${request.deliveryStation?.stationName}`);

    try {
      const matches = await createMatchesForRequest(requestId, request);
      if (matches.length === 0) {
        console.warn('?좑툘 No matches created for request');
        return null;
      }

      console.warn(`?럦 Matching complete for request ${requestId} (${matches.length} matches)`);

      return null;
    } catch (error) {
      console.error('??Error in onRequestCreated:', error);
      return null;
    }
  });

/**
 * Send FCM push notification
 * @param token FCM token
 * @param title Notification title
 * @param body Notification body
 * @param data Additional data
 */
async function sendFCM(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const message: admin.messaging.Message = {
    token,
    notification: {
      title,
      body,
    },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    await fcm.send(message);
    console.warn('??FCM sent successfully:', title);
  } catch (error) {
    console.error('??FCM send error:', error);
    throw error;
  }
}

/**
 * Cloud Function: Send match found notification to giller
 * Triggered when a new match is created
 */
export const sendMatchFoundNotification = functions.firestore
  .document('matches/{matchId}')
  .onCreate(async (snapshot, context) => {
    const match = snapshot.data() as Match;

    if (!match) {
      return null;
    }

    const { requestId } = match;

    try {
      // Get request details
      const requestDoc = await db.collection('requests').doc(requestId).get();

      if (!requestDoc.exists) {
        console.error('??Request not found:', requestId);
        return null;
      }

      const request = requestDoc.data() as DeliveryRequest;
      if (!request) return null;

      // Get giller's FCM token
      const gillerDoc = await db.collection('users').doc(match.gillerId).get();

      if (!gillerDoc.exists) {
        console.error('??Giller not found:', match.gillerId);
        return null;
      }

      const giller = gillerDoc.data() as User;
      const fcmToken = giller?.fcmToken;

      if (!fcmToken) {
        console.warn('?좑툘 No FCM token for giller:', match.gillerId);
        return null;
      }

      // Send notification
      const title = '?렞 ?덈줈??諛곗넚 ?붿껌';
      const body = `${request.pickupStation.stationName} -> ${request.deliveryStation.stationName} (${request.fee.totalFee.toLocaleString()}원)`;

      await sendFCM(fcmToken, title, body, {
        type: 'match_found',
        requestId,
        matchId: context.params.matchId,
        screen: 'GillerRequests',
      });

      // Update match document
      await snapshot.ref.update({
        notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        notificationSent: true,
      });

      console.warn('??Match notification sent:', context.params.matchId);
      return null;
    } catch (error) {
      console.error('??Error sending match notification:', error);
      return null;
    }
  });

/**
 * Cloud Function: Send request accepted notification to gller
 * Triggered when request status changes to 'accepted'
 */
export const onRequestStatusChanged = functions.firestore
  .document('requests/{requestId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as DeliveryRequest;
    const after = change.after.data() as CompletedRequestDoc;

    if (!before || !after) {
      return null;
    }

    // Check if status changed to 'accepted'
    if (before.status === 'matched' && after.status === 'accepted') {
      const { gllerId, matchedDeliveryId } = after;

      if (!matchedDeliveryId || !gllerId) {
        console.warn('?좑툘 No matched delivery ID or gller ID');
        return null;
      }

      try {
        // Get gller's FCM token
        const gllerDoc = await db.collection('users').doc(gllerId).get();

        if (!gllerDoc.exists) {
          console.error('??Gller not found:', gllerId);
          return null;
        }

        const gller = gllerDoc.data() as User;
        const fcmToken = gller?.fcmToken;

        if (!fcmToken) {
          console.warn('?좑툘 No FCM token for gller:', gllerId);
          return null;
        }

        // Get delivery details to find giller name
        const deliveryDoc = await db.collection('deliveries').doc(matchedDeliveryId).get();
        const deliveryData = deliveryDoc.data() as RequestAcceptedDeliveryDoc | undefined;
        const gillerName = deliveryDoc.exists ? (deliveryData?.gillerName ?? '길러') : '길러';

        // Send notification
        const title = '배송 요청이 수락되었습니다.';
        const body = `${gillerName}?섏씠 諛곗넚???섎씫?덉뒿?덈떎.`;

        await sendFCM(fcmToken, title, body, {
          type: 'request_accepted',
          requestId: context.params.requestId,
          deliveryId: matchedDeliveryId,
          screen: 'RequestDetail',
        });

        console.warn('??Request accepted notification sent:', context.params.requestId);
        return null;
      } catch (error) {
        console.error('??Error sending request accepted notification:', error);
        return null;
      }
    }

    // Check if status changed to 'completed'
    if (before.status !== 'completed' && after.status === 'completed') {
      const { gllerId } = after; // gllerId = ?붿껌??(?댁슜??
      const gillerId = after.matchedGillerId ?? ''; // ?ㅼ젣 諛곗넚??湲몃윭

      const requestId = context.params.requestId;

      try {
        const pickupStationId = String(after.pickupStation?.stationId ?? '');
        const deliveryStationId = String(after.deliveryStation?.stationId ?? '');
        const requestMode = after.requestMode === 'reservation' ? 'reservation' : 'immediate';
        const totalFee = Number(after.fee?.totalFee ?? after.initialNegotiationFee ?? 0);
        const routeKey = pickupStationId && deliveryStationId
          ? `${pickupStationId}_${deliveryStationId}_${requestMode}`
          : null;

        if (routeKey && totalFee > 0) {
          const pricingContext =
            after.pricingContext && typeof after.pricingContext === 'object'
              ? after.pricingContext
              : {
                  requestMode,
                  weather: 'clear',
                  isPeakTime: false,
                  isProfessionalPeak: false,
                  nearbyGillerCount: null,
                  requestedHour: null,
                  urgencyBucket: 'normal',
                };

          await db.collection('request_pricing_history').doc(requestId).set({
            requestId,
            routeKey,
            requestMode,
            pickupStationId,
            pickupStationName: after.pickupStation?.stationName ?? null,
            deliveryStationId,
            deliveryStationName: after.deliveryStation?.stationName ?? null,
            totalFee,
            finalFee: totalFee,
            baseFee: Number(after.fee?.baseFee ?? after.feeBreakdown?.baseFee ?? 0),
            distanceFee: Number(after.fee?.distanceFee ?? after.feeBreakdown?.distanceFee ?? 0),
            weightFee: Number(after.fee?.weightFee ?? after.feeBreakdown?.weightFee ?? 0),
            sizeFee: Number(after.fee?.sizeFee ?? after.feeBreakdown?.sizeFee ?? 0),
            urgencySurcharge: Number(after.fee?.urgencySurcharge ?? after.feeBreakdown?.urgencySurcharge ?? 0),
            serviceFee: Number(after.fee?.serviceFee ?? after.feeBreakdown?.serviceFee ?? 0),
            vat: Number(after.fee?.vat ?? after.feeBreakdown?.vat ?? 0),
            dynamicAdjustment: Number(after.fee?.dynamicAdjustment ?? after.feeBreakdown?.dynamicAdjustment ?? 0),
            itemValue: Number(after.itemValue ?? 0),
            depositAmount: Number(after.depositAmount ?? 0),
            urgency: after.urgency ?? 'medium',
            policyVersion:
              typeof after.pricingPolicyVersion === 'string' && after.pricingPolicyVersion.length > 0
                ? after.pricingPolicyVersion
                : null,
            pricingContext,
            matchedGillerId: gillerId || null,
            primaryDeliveryId: after.primaryDeliveryId ?? null,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      } catch (error) {
        console.error('Error storing request pricing history:', error);
      }

      // 1. 湲몃윭 ?섏씡 ?덉퐫???앹꽦 (?뚮옯???섏닔猷?15% + ?먯쿇吏뺤닔??3.3%)
      if (gillerId) {
        try {
          const totalFee: number = after.fee?.totalFee ?? 0;

          if (totalFee > 0) {
            const pricingPolicy = await getFunctionsPricingPolicyConfig();
            const PLATFORM_FEE_RATE = pricingPolicy.platformFeeRate;
            const TAX_RATE = pricingPolicy.withholdingTaxRate;

            const platformFee = Math.round(totalFee * PLATFORM_FEE_RATE);
            const afterFee = totalFee - platformFee;
            const tax = Math.round(afterFee * TAX_RATE);
            const netAmount = afterFee - tax;

            // payments 而щ젆?섏뿉 ?섏씡 ?덉퐫???앹꽦
            const paymentRef = db.collection('payments').doc();
            await paymentRef.set({
              paymentId: paymentRef.id,
              userId: gillerId,
              type: 'giller_earning',
              amount: totalFee,
              fee: platformFee,
              tax,
              netAmount,
              status: 'completed',
              requestId,
              description: '諛곗넚 ?꾨즺 ?섏씡',
              metadata: {
                platformFeeRate: PLATFORM_FEE_RATE,
                taxRate: TAX_RATE,
                taxWithheld: tax,
                isTaxable: true,
              },
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 湲몃윭 ?ъ슜??臾몄꽌 totalEarnings, totalTaxWithheld ?낅뜲?댄듃
            await db.collection('users').doc(gillerId).update({
              totalEarnings: admin.firestore.FieldValue.increment(netAmount),
              totalTaxWithheld: admin.firestore.FieldValue.increment(tax),
              earningsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.warn(`??Giller earning created for ${gillerId}: ${netAmount}??net (fee: ${platformFee}?? tax: ${tax}??`);
          } else {
            console.warn(`?좑툘 No fee info for request ${requestId}, skipping earning creation`);
          }
        } catch (error) {
          console.error('??Error creating giller earning:', error);
          // ?섏씡 ?앹꽦 ?ㅽ뙣?대룄 ?뚮┝? 怨꾩냽 ?꾩넚
        }
      }

      // 2. ?댁슜??gller)?먭쾶 諛곗넚 ?꾨즺 FCM ?뚮┝ ?꾩넚
      if (!gllerId) {
        console.warn('?좑툘 No gller ID for notification');
        return null;
      }

      try {
        const gllerDoc = await db.collection('users').doc(gllerId).get();

        if (!gllerDoc.exists) {
          console.error('??Gller not found:', gllerId);
          return null;
        }

        const gller = gllerDoc.data() as User;
        const fcmToken = gller?.fcmToken;

        if (!fcmToken) {
          console.warn('?좑툘 No FCM token for gller:', gllerId);
          return null;
        }

        const gillerName = after.gillerName ?? '湲몃윭';
        const title = '배송이 완료되었습니다.';
        const body = `${gillerName}?섏씠 諛곗넚???꾨즺?덉뒿?덈떎.`;

        await sendFCM(fcmToken, title, body, {
          type: 'delivery_completed',
          requestId,
          screen: 'RequestDetail',
        });

        console.warn('??Delivery completed notification sent:', requestId);
        return null;
      } catch (error) {
        console.error('??Error sending delivery completed notification:', error);
        return null;
      }
    }

    return null;
  });

/**
 * HTTP Function: Manual trigger for matching
 * Can be called from client to trigger matching process
 */
export const triggerMatching = functions.https.onCall((data: TriggerMatchingData, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { requestId } = data;

  if (!requestId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'requestId is required'
    );
  }

  return db
    .collection('requests')
    .doc(requestId)
    .get()
    .then(async (requestDoc) => {
      if (!requestDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const request = requestDoc.data() as DeliveryRequest;
      const matches = await createMatchesForRequest(requestId, request);
      const result: TriggerMatchingResult = {
        success: true,
        matchesFound: matches.length,
        matches,
      };

      return result;
    })
    .catch((error) => {
      console.error('??Error triggering matching:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Error triggering matching');
    });
});

/**
 * HTTP Function: Save FCM token
 * Called from client when token is refreshed
 */
export const saveFCMToken = functions.https.onCall(async (data: SaveFCMTokenData, context): Promise<SaveFCMTokenResult> => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { token } = data;

  if (!token) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'FCM token is required'
    );
  }

  try {
    const userId = context.auth.uid;

    await db.collection('users').doc(userId).update({
      fcmToken: token,
      fcmTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.warn('??FCM token saved for user:', userId);

    return { success: true };
  } catch (error) {
    console.error('??Error saving FCM token:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error saving FCM token'
    );
  }
});

export const beta1AnalyzeRequestDraft = functions.https.onCall(
  async (data: Beta1RequestDraftAnalysisInput, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (data.requesterUserId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'requesterUserId mismatch');
    }

    try {
      return await executeRequestDraftAnalysis(db, data);
    } catch (error) {
      console.error('beta1AnalyzeRequestDraft error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to analyze request draft');
    }
  }
);

export const beta1GeneratePricingQuotes = functions.https.onCall(
  async (data: Beta1PricingQuoteInput, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (data.requesterUserId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'requesterUserId mismatch');
    }

    try {
      return await executePricingQuoteGeneration(db, data);
    } catch (error) {
      console.error('beta1GeneratePricingQuotes error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to generate pricing quotes');
    }
  }
);

export const beta1PlanMissionExecution = functions.https.onCall(
  async (data: Beta1MissionPlanInput, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const requestSnap = await db.collection('requests').doc(data.requestId).get();
      if (!requestSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const requestData = requestSnap.data() as Record<string, unknown> | undefined;
      const requesterUserId = typeof requestData?.requesterId === 'string' ? requestData.requesterId : '';
      const matchedGillerId = typeof requestData?.matchedGillerId === 'string' ? requestData.matchedGillerId : '';
      const roleAllowed = context.auth.uid === requesterUserId || context.auth.uid === matchedGillerId;

      if (!roleAllowed) {
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data() as BadgeUserDoc | undefined;
        const role = readUserRole(userData);
        if (role !== 'admin' && role !== 'superadmin') {
          throw new functions.https.HttpsError('permission-denied', 'Not allowed to plan mission');
        }
      }

      return await executeMissionPlanning(db, data);
    } catch (error) {
      console.error('beta1PlanMissionExecution error:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to plan mission execution');
    }
  }
);

/**
 * Scheduled Function: Cleanup old notifications
 * Runs every day at midnight
 */
export const cleanupOldNotifications = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('Asia/Seoul')
  .onRun(async (_context) => {
    const now = admin.firestore.Timestamp.now();
    const thirtyDaysAgo = new Date(now.toDate().getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const oldNotifications = await db
        .collection('notifications')
        .where('read', '==', true)
        .where('createdAt', '<', thirtyDaysAgo)
        .limit(500)
        .get();

      const batch = db.batch();

      oldNotifications.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.warn(`??Deleted ${oldNotifications.size} old notifications`);
      return null;
    } catch (error) {
      console.error('??Error cleaning up notifications:', error);
      return null;
    }
  });

/**
 * Cloud Function: Send chat message notification
 * Triggered when a new message is created in a chat room
 */
export const onChatMessageCreated = functions.firestore
  .document('chatRooms/{chatRoomId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data() as ChatMessage;

    if (!message) {
      return null;
    }

    // ?쒖뒪??硫붿떆吏??FCM ?뚮┝ ?꾩넚 遺덊븘??
    if (message.type === 'system') {
      return null;
    }

    const { chatRoomId } = context.params;

    try {
      const chatRoomDoc = await db.collection('chatRooms').doc(chatRoomId).get();

      if (!chatRoomDoc.exists) {
        console.error('??Chat room not found:', chatRoomId);
        return null;
      }

      const chatRoom = chatRoomDoc.data() as ChatRoom;
      if (!chatRoom) return null;

      const senderId = message.senderId;

      const recipientId = chatRoom.participants.user1.userId === senderId
        ? chatRoom.participants.user2.userId
        : chatRoom.participants.user1.userId;

      const senderName = chatRoom.participants.user1.userId === senderId
        ? chatRoom.participants.user1.name
        : chatRoom.participants.user2.name;

      const recipientDoc = await db.collection('notificationSettings').doc(recipientId).get();

      if (!recipientDoc.exists) {
        console.warn('?좑툘 No notification settings for recipient:', recipientId);
        return null;
      }

      const settings = recipientDoc.data() as NotificationSettings;

      if (!settings?.enabled || !settings?.settings?.new_message) {
        console.warn('?좑툘 Notifications disabled for recipient:', recipientId);
        return null;
      }

      const fcmToken = settings.fcmToken;
      if (!fcmToken) {
        console.warn('?좑툘 No FCM token for recipient:', recipientId);
        return null;
      }

      const title = '?뮠 ??硫붿떆吏';
      const body = `${senderName}: ${message.content}`;

      await sendFCM(fcmToken, title, body, {
        type: 'new_message',
        chatRoomId,
        senderId,
      });

      console.warn('??Chat message notification sent:', context.params.messageId);
      return null;
    } catch (error) {
      console.error('??Error sending chat message notification:', error);
      return null;
    }
  });

/**
 * HTTP Function: Send push notification
 * Called from client to send custom push notifications
 */
export const sendPushNotification = functions.https.onCall(async (data: SendPushNotificationData, context): Promise<SendPushNotificationResult> => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { userId, notification } = data;

  if (!userId || !notification) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'userId and notification are required'
    );
  }

  try {
    const settingsDoc = await db.collection('notificationSettings').doc(userId).get();

    if (!settingsDoc.exists) {
      console.warn('?좑툘 No notification settings for user:', userId);
      return { success: false, reason: 'No notification settings' };
    }

    const settings = settingsDoc.data() as NotificationSettings;

    if (!settings?.enabled) {
      console.warn('?좑툘 Notifications disabled for user:', userId);
      return { success: false, reason: 'Notifications disabled' };
    }

    const fcmToken = settings.fcmToken;
    if (!fcmToken) {
      console.warn('?좑툘 No FCM token for user:', userId);
      return { success: false, reason: 'No FCM token' };
    }

    await sendFCM(fcmToken, notification.title, notification.body, notification.data);

    return { success: true };
  } catch (error) {
    console.error('??Error sending push notification:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error sending push notification'
    );
  }
});

// ==================== P1: Professional Giller System ====================

/**
 * Cloud Function: Auto-review promotion applications
 * Triggered when a user applies for promotion
 */
export const reviewPromotion = functions.https.onCall(async (data, context): Promise<{ approved: boolean; reason?: string }> => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const user = userDoc.data() as BadgeUserDoc | undefined;
    const promotion = user?.gillerProfile?.promotion;

    if (promotion?.status !== 'pending') {
      return { approved: false, reason: 'No pending promotion application' };
    }

    // Get current grade and target grade
    const currentGrade = user?.gillerProfile?.type ?? 'regular';
    const targetGrade = currentGrade === 'regular' ? 'professional' : 'master';

    // Define requirements
    const requirements = targetGrade === 'professional'
      ? {
          minCompletedDeliveries: 50,
          minRating: 4.7,
          maxRecentPenalties: 2,
          minAccountAgeDays: 30,
          minRecent30DaysDeliveries: 20,
        }
      : {
          minCompletedDeliveries: 200,
          minRating: 4.9,
          maxRecentPenalties: 1,
          minAccountAgeDays: 90,
          minRecent30DaysDeliveries: 50,
        };

    const stats = user?.stats ?? {};

    // Check requirements
    const checks = {
      completedDeliveries: (stats.completedDeliveries ?? 0) >= requirements.minCompletedDeliveries,
      rating: (stats.rating ?? 0) >= requirements.minRating,
      penalties: (stats.recentPenalties ?? 0) <= requirements.maxRecentPenalties,
      accountAge: (stats.accountAgeDays ?? 0) >= requirements.minAccountAgeDays,
      recentActivity: (stats.recent30DaysDeliveries ?? 0) >= requirements.minRecent30DaysDeliveries,
    };

    const allPassed = Object.values(checks).every(check => check === true);

    if (allPassed) {
      // Approve promotion
      const limits = targetGrade === 'professional'
        ? { maxRoutes: 10, maxDailyDeliveries: 20 }
        : { maxRoutes: 15, maxDailyDeliveries: 30 };

      const benefits = targetGrade === 'professional'
        ? {
            priorityMatching: 'high',
            rateBonus: 0.15,
            supportLevel: 'priority',
            exclusiveRequests: true,
            analytics: true,
            earlyAccess: true,
          }
        : {
            priorityMatching: 'highest',
            rateBonus: 0.25,
            supportLevel: 'dedicated',
            exclusiveRequests: true,
            analytics: true,
            earlyAccess: true,
          };

      await db.collection('users').doc(userId).update({
        'gillerProfile.type': targetGrade,
        'gillerProfile.limits': limits,
        'gillerProfile.benefits': benefits,
        'gillerProfile.promotion.status': 'approved',
        'gillerProfile.promotion.approvedAt': admin.firestore.FieldValue.serverTimestamp(),
        'updatedAt': admin.firestore.FieldValue.serverTimestamp(),
      });

      console.warn(`Promoted: ${userId} -> ${targetGrade}`);
      return { approved: true };
    } else {
      // Reject promotion
      const failedChecks = Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([key]) => key);

      await db.collection('users').doc(userId).update({
        'gillerProfile.promotion.status': 'rejected',
      });

      console.warn(`Promotion rejected: ${userId} - ${failedChecks.join(', ')}`);
      return {
        approved: false,
        reason: `Requirements not met: ${failedChecks.join(', ')}`,
      };
    }
  } catch (error) {
    console.error('??Error reviewing promotion:', error);
    throw new functions.https.HttpsError('internal', 'Error reviewing promotion');
  }
});

/**
 * Trigger: Auto-check badges on delivery completion
 */
export const onDeliveryCompleted = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, _context) => {
    const before = change.before.data() as Match;
    const after = change.after.data() as Match;

    // Only trigger when status changes to 'completed'
    if (before.status === 'completed' || after.status !== 'completed') {
      return null;
    }

    const gillerId = after.gillerId;

    try {
      // Check badge eligibility
      const userDoc = await db.collection('users').doc(gillerId).get();
      if (!userDoc.exists) {
        console.warn('?좑툘 User not found:', gillerId);
        return null;
      }

      const user = userDoc.data() as BadgeUserDoc | undefined;
      const stats = user?.stats ?? {};
      const badges: Required<BadgeCollections> = {
        activity: user?.badges?.activity ?? [],
        quality: user?.badges?.quality ?? [],
        expertise: user?.badges?.expertise ?? [],
        community: user?.badges?.community ?? [],
      };

      // Define badge checks
      const badgeChecks: BadgeCheck[] = [
        {
          id: 'badge_newbie',
          category: 'activity',
          condition: (stats.completedDeliveries ?? 0) >= 1,
        },
        {
          id: 'badge_active',
          category: 'activity',
          condition: (stats.recent30DaysDeliveries ?? 0) >= 10,
        },
        {
          id: 'badge_friendly',
          category: 'quality',
          condition: (stats.rating ?? 0) >= 4.9 && (stats.completedDeliveries ?? 0) >= 20,
        },
        {
          id: 'badge_trusted',
          category: 'quality',
          condition: (stats.recentPenalties ?? 0) === 0 && (stats.completedDeliveries ?? 0) >= 100,
        },
      ];

      // Award new badges
      const updates: Record<string, FirestoreUpdateValue> = {};
      let newBadgesAwarded = 0;

      for (const check of badgeChecks) {
        if (!badges[check.category]?.includes(check.id) && check.condition) {
          updates[`badges.${check.category}`] = admin.firestore.FieldValue.arrayUnion(check.id);
          newBadgesAwarded++;
          console.warn(`Badge awarded: ${check.id} to ${gillerId}`);
        }
      }

      // Update badge benefits
      if (newBadgesAwarded > 0) {
        const totalBadges =
          countBadges(badges.activity) +
          countBadges(badges.quality) +
          countBadges(badges.expertise) +
          countBadges(badges.community) +
          newBadgesAwarded;

        let tier = 'none';
        if (totalBadges >= 13) tier = 'platinum';
        else if (totalBadges >= 9) tier = 'gold';
        else if (totalBadges >= 5) tier = 'silver';
        else if (totalBadges >= 1) tier = 'bronze';

        updates['badgeBenefits.totalBadges'] = totalBadges;
        updates['badgeBenefits.currentTier'] = tier;
        updates['badgeBenefits.profileFrame'] = tier;

        await db.collection('users').doc(gillerId).update(updates);
        console.warn(`Updated badges for ${gillerId}: ${totalBadges} total, ${tier} tier`);
      }

      return null;
    } catch (error) {
      console.error('??Error checking badges:', error);
      return null;
    }
  });

/**
 * HTTP Function: Calculate delivery rate with bonus
 */
export const calculateDeliveryRate = functions.https.onCall(async (data: CalculateDeliveryRateData, context): Promise<{ rate: number; bonus: number; total: number }> => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { baseRate, gillerId } = data;

  if (typeof baseRate !== 'number' || !gillerId) {
    throw new functions.https.HttpsError('invalid-argument', 'baseRate and gillerId are required');
  }

  try {
    const userDoc = await db.collection('users').doc(gillerId).get();

    if (!userDoc.exists) {
      return { rate: baseRate, bonus: 0, total: baseRate };
    }

    const user = userDoc.data() as BadgeUserDoc | undefined;
    const rateBonus = user?.gillerProfile?.benefits?.rateBonus ?? 0;

    const bonusAmount = baseRate * rateBonus;
    const totalRate = baseRate + bonusAmount;

    return {
      rate: baseRate,
      bonus: bonusAmount,
      total: totalRate,
    };
  } catch (error) {
    console.error('??Error calculating rate:', error);
    throw new functions.https.HttpsError('internal', 'Error calculating rate');
  }
});

// ==================== Pricing Functions ====================

/**
 * Pricing Constants (Updated with actual costs)
 */
/**
 * HTTP Function: Calculate delivery pricing *
 * Calculates delivery pricing based on distance, time, and other factors
 */
export const calculateDeliveryPricing = functions.https.onCall(
  async (data: CalculateDeliveryPricingData, context): Promise<CalculateDeliveryPricingResult> => {
    requireCallableAuth(context, 'calculateDeliveryPricing');

    const {
      distance,
      travelTime,
      isRushHour = false,
      urgency = 'normal',
      isTransferRoute = false,
      transferCount = 0,
      gillerLevel = 'regular',
      weather = 'clear',
      nearbyGillerCount,
      isProfessionalPeak = false,
    } = data;

    console.warn('Pricing calculation requested:', data);

    try {
      const pricingPolicy = await getFunctionsPricingPolicyConfig();
      const estimatedStationCount =
        typeof distance === 'number' && distance > 0
          ? estimateStationCountFromDistanceKm(distance)
          : estimateStationCountFromTravelTimeMinutes(typeof travelTime === 'number' ? travelTime : 15);

      const sharedFee = calculateSharedDeliveryFee({
        stationCount: estimatedStationCount,
        urgency: urgency ?? 'normal',
        context: {
          weather,
          isPeakTime: isRushHour,
          nearbyGillerCount,
          isProfessionalPeak,
        },
      }, pricingPolicy);

      const breakdown: PricingBreakdown[] = [
        {
          type: 'base',
          amount: sharedFee.baseFee,
          description: `기본 요금 (${estimatedStationCount}개 역 기준)`,
        },
        {
          type: 'base',
          amount: sharedFee.distanceFee,
          description: '거리/역수 가산',
        },
      ];

      if (sharedFee.weightFee > 0) {
        breakdown.push({
          type: 'base',
          amount: sharedFee.weightFee,
          description: '기본 무게 반영',
        });
      }

      if (sharedFee.urgencySurcharge > 0) {
        breakdown.push({
          type: 'express',
          amount: sharedFee.urgencySurcharge,
          description: `긴급도 가산 (${urgency === 'urgent' ? '긴급' : '빠른 요청'})`,
        });
      }

      if (isRushHour) {
        breakdown.push({
          type: 'express',
          amount: 0,
          description: '러시아워 여부는 현재 ETA 판단에만 반영합니다.',
        });
      }

      const discounts: PricingDiscount[] = [];
      if (isTransferRoute) {
        discounts.push({
          type: 'transfer_bonus',
          amount: -(pricingPolicy.incentiveRules.transferDiscount ?? 500),
          description: '환승 구간 할인',
        });

        const transferBonus = transferCount * (pricingPolicy.incentiveRules.transferBonusPerHop ?? 500);
        if (transferBonus > 0) {
          discounts.push({
            type: 'transfer_bonus',
            amount: transferBonus,
            description: `환승 협조 보너스 (${transferCount}회)`,
          });
        }
      }

      let totalFare = sharedFee.totalFee + discounts.reduce((sum, item) => sum + item.amount, 0);
      totalFare = Math.max(pricingPolicy.minFee, totalFare);
      totalFare = Math.min(pricingPolicy.maxFee, totalFare);

      const baseSettlement = calculateSharedSettlementBreakdown(totalFare, 0, pricingPolicy);

      let gillerBonus = 0;
      if (gillerLevel === 'professional') {
        gillerBonus = Math.round(
          baseSettlement.platformRevenue * (pricingPolicy.incentiveRules.professionalBonusRate ?? 0.25)
        );
        discounts.push({
          type: 'professional_bonus',
          amount: gillerBonus,
          description: '전문 길러 보너스',
        });
      } else if (gillerLevel === 'master') {
        gillerBonus = Math.round(
          baseSettlement.platformRevenue * (pricingPolicy.incentiveRules.masterBonusRate ?? 0.35)
        );
        discounts.push({
          type: 'master_bonus',
          amount: gillerBonus,
          description: '마스터 길러 보너스',
        });
      }

      const finalPricing = calculateSharedSettlementBreakdown(totalFare, gillerBonus, pricingPolicy);

      const result: CalculateDeliveryPricingResult = {
        baseFare: sharedFee.baseFee,
        breakdown,
        discounts,
        totalFare: finalPricing.totalFare,
        gillerEarnings: {
          base: finalPricing.gillerPreTaxEarnings - gillerBonus,
          bonus: gillerBonus,
          preTax: finalPricing.gillerPreTaxEarnings,
          tax: finalPricing.withholdingTax,
          net: finalPricing.gillerNetEarnings,
        },
        platformEarnings: {
          gross: finalPricing.serviceFee,
          net: finalPricing.platformNetEarnings,
        },
        pgFee: finalPricing.pgFee,
        calculatedAt: new Date(),
      };

      console.warn('Pricing calculation completed:', result);
      return result;
    } catch (error) {
      console.error('Error in calculateDeliveryPricing:', error);
      throw new functions.https.HttpsError('internal', 'Error calculating delivery pricing');
    }
  }
);

// ==================== Matching Functions ====================

/**
 * HTTP Function: Match requests with available gillers
 *
 * Finds compatible gillers for a delivery request and creates match documents
 */
export const matchRequests = functions.https.onCall(
  async (data: MatchRequestsData, context): Promise<MatchRequestsResult> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { requestId } = data;

    if (!requestId) {
      throw new functions.https.HttpsError('invalid-argument', 'requestId is required');
    }

    console.warn(`Matching started for request: ${requestId}`);

    try {
      const requestDoc = await db.collection('requests').doc(requestId).get();

      if (!requestDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const request = requestDoc.data() as DeliveryRequest;

      if (request?.status !== 'pending') {
        console.warn('??툘 Request not in pending status:', request.status);
        return { success: false, matchesFound: 0 };
      }

      const matches = await createMatchesForRequest(requestId, request);
      console.warn(`Matching complete for request ${requestId}`);

      return {
        success: true,
        matchesFound: matches.length,
        matches,
      };
    } catch (error) {
      console.error('??Error in matchRequests:', error);
      throw new functions.https.HttpsError('internal', 'Error matching requests');
    }
  }
);

/**
 * HTTP Function: Accept a match
 *
 * Giller accepts a match, creates a delivery document
 */
export const acceptMatch = functions.https.onCall(
  async (data: AcceptMatchData, context): Promise<AcceptMatchResult> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { matchId } = data;

    if (!matchId) {
      throw new functions.https.HttpsError('invalid-argument', 'matchId is required');
    }

    const gillerId = context.auth.uid;

    console.warn(`Accepting match: ${matchId} by giller: ${gillerId}`);

    try {
      // 1. Get match details
      const matchDoc = await db.collection('matches').doc(matchId).get();

      if (!matchDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Match not found');
      }

      const match = matchDoc.data() as Match;

      // Verify giller is the match owner
      if (match.gillerId !== gillerId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to accept this match');
      }

      // Check if match is still pending
      if (match.status !== 'pending') {
        console.warn('?좑툘 Match not in pending status:', match.status);
        return { success: false, message: '?대? 泥섎━???붿껌?낅땲??' };
      }

      // 2. Create delivery document
      const deliveryRef = db.collection('deliveries').doc();
      const deliveryId = deliveryRef.id;

      const deliveryData = {
        id: deliveryId,
        matchId,
        requestId: match.requestId,
        gillerId: match.gillerId,
        gillerName: match.gillerName,
        gllerId: match.gllerId,
        pickupStation: match.pickupStation,
        deliveryStation: match.deliveryStation,
        fee: match.fee,
        status: 'accepted',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await deliveryRef.set(deliveryData);

      // 3. Update match status
      await matchDoc.ref.update({
        status: 'accepted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4. Update request status
      await db.collection('requests').doc(match.requestId).update({
        status: 'accepted',
        matchedDeliveryId: deliveryId,
        gillerId: match.gillerId,
        gillerName: match.gillerName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Reject other matches for this request (with chunking for >500 limit)
      const otherMatchesSnapshot = await db
        .collection('matches')
        .where('requestId', '==', match.requestId)
        .where('status', '==', 'pending')
        .get();

      if (!otherMatchesSnapshot.empty) {
        const docsToReject = otherMatchesSnapshot.docs.filter((doc) => doc.id !== matchId);
        
        // Firestore batch limit is 500
        const CHUNK_SIZE = 400;
        for (let i = 0; i < docsToReject.length; i += CHUNK_SIZE) {
          const chunk = docsToReject.slice(i, i + CHUNK_SIZE);
          const batch = db.batch();
          chunk.forEach((doc) => {
            batch.update(doc.ref, {
              status: 'rejected',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });
          await batch.commit();
        }
        
        console.warn(`Rejected ${docsToReject.length} other matches`);
      }

      console.warn(`Match accepted: ${matchId}, delivery created: ${deliveryId}`);

      return {
        success: true,
        deliveryId,
      };
    } catch (error) {
      console.error('??Error in acceptMatch:', error);
      throw new functions.https.HttpsError('internal', 'Error accepting match');
    }
  }
);

/**
 * HTTP Function: Reject a match
 *
 * Giller rejects a match
 */
export const rejectMatch = functions.https.onCall(
  async (data: RejectMatchData, context): Promise<RejectMatchResult> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { matchId, reason } = data;

    if (!matchId) {
      throw new functions.https.HttpsError('invalid-argument', 'matchId is required');
    }

    const gillerId = context.auth.uid;

    console.warn(`Rejecting match: ${matchId} by giller: ${gillerId}, reason: ${reason}`);

    try {
      // 1. Get match details
      const matchDoc = await db.collection('matches').doc(matchId).get();

      if (!matchDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Match not found');
      }

      const match = matchDoc.data() as Match;

      // Verify giller is the match owner
      if (match.gillerId !== gillerId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to reject this match');
      }

      // Check if match is still pending
      if (match.status !== 'pending') {
        console.warn('?좑툘 Match not in pending status:', match.status);
        return { success: false, message: '?대? 泥섎━???붿껌?낅땲??' };
      }

      // 2. Update match status
      await matchDoc.ref.update({
        status: 'rejected',
        rejectionReason: reason ?? 'Giller rejected',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 3. Check if there are other pending matches for this request
      const otherMatchesSnapshot = await db
        .collection('matches')
        .where('requestId', '==', match.requestId)
        .where('status', '==', 'pending')
        .get();

      if (otherMatchesSnapshot.empty) {
        // No more matches available, reset request to pending
        await db.collection('requests').doc(match.requestId).update({
          status: 'pending',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.warn('No more matches, request reset to pending');
      }

      console.warn(`Match rejected: ${matchId}`);

      return { success: true };
    } catch (error) {
      console.error('??Error in rejectMatch:', error);
      throw new functions.https.HttpsError('internal', 'Error rejecting match');
    }
  }
);

/**
 * HTTP Function: Complete a match/delivery
 *
 * Marks delivery as completed, updates earnings and stats
 */
export const completeMatch = functions.https.onCall(
  async (data: CompleteMatchData, context): Promise<CompleteMatchResult> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { matchId, actualPickupTime, actualDeliveryTime, rating, feedback } = data;

    if (!matchId) {
      throw new functions.https.HttpsError('invalid-argument', 'matchId is required');
    }

    const userId = context.auth.uid;

    console.warn(`Completing match: ${matchId} by user: ${userId}`);

    try {
      // 1. Get match details
      const matchDoc = await db.collection('matches').doc(matchId).get();

      if (!matchDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Match not found');
      }

      const match = matchDoc.data() as Match;

      // Verify user is either giller or gller
      if (match.gillerId !== userId && match.gllerId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to complete this match');
      }

      // Check if match can be completed (must be accepted)
      if (match.status !== 'accepted') {
        console.warn('?좑툘 Match not in accepted status:', match.status);
        return { success: false };
      }

      // 2. Get delivery document
      const deliverySnapshot = await db
        .collection('deliveries')
        .where('matchId', '==', matchId)
        .limit(1)
        .get();

      if (deliverySnapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'Delivery not found');
      }

      const deliveryDoc = deliverySnapshot.docs[0];

      // 3. Calculate final earnings
      const totalFare = match.fee.totalFee;
      const pricingPolicy = await getFunctionsPricingPolicyConfig();
      const settlementBreakdown = calculateSharedSettlementBreakdown(totalFare, 0, pricingPolicy);
      const baseEarnings = settlementBreakdown.gillerPreTaxEarnings;

      // Get giller level for bonus
      const gillerDoc = await db.collection('users').doc(match.gillerId).get();
      const gillerData = gillerDoc.data() as BadgeUserDoc | undefined;
      const gillerLevel = gillerData?.gillerProfile?.type ?? 'regular';

      let bonus = 0;
      if (gillerLevel === 'professional') {
        bonus = Math.round(
          settlementBreakdown.platformRevenue * (pricingPolicy.incentiveRules.professionalBonusRate ?? 0.25)
        );
      } else if (gillerLevel === 'master') {
        bonus = Math.round(
          settlementBreakdown.platformRevenue * (pricingPolicy.incentiveRules.masterBonusRate ?? 0.35)
        );
      }

      const totalEarnings = baseEarnings + bonus;

      // 4. Update delivery status
      await deliveryDoc.ref.update({
        status: 'completed',
        actualPickupTime: actualPickupTime ?? admin.firestore.FieldValue.serverTimestamp(),
        actualDeliveryTime: actualDeliveryTime ?? admin.firestore.FieldValue.serverTimestamp(),
        finalEarnings: {
          base: baseEarnings,
          bonus,
          total: totalEarnings,
        },
        rating: rating ?? null,
        feedback: feedback ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Update match status
      await matchDoc.ref.update({
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 6. Update request status
      await db.collection('requests').doc(match.requestId).update({
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 7. Update giller stats
      await db.collection('users').doc(match.gillerId).update({
        'gillerInfo.totalDeliveries': admin.firestore.FieldValue.increment(1),
        'gillerInfo.completedDeliveries': admin.firestore.FieldValue.increment(1),
        'stats.completedDeliveries': admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 8. Save rating if provided
      if (rating && feedback) {
        const ratingRef = db.collection('ratings').doc();
        await ratingRef.set({
          matchId,
          requestId: match.requestId,
          deliveryId: deliveryDoc.id,
          fromUserId: userId,
          toUserId: match.gillerId,
          rating,
          feedback,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.warn(`Rating saved: ${rating} stars`);
      }

      console.warn(`Match completed: ${matchId}, earnings: ${totalEarnings}원`);

      return {
        success: true,
        finalEarnings: {
          base: baseEarnings,
          bonus,
          total: totalEarnings,
        },
      };
    } catch (error) {
      console.error('??Error in completeMatch:', error);
      throw new functions.https.HttpsError('internal', 'Error completing match');
    }
  }
);

// ==================== P3: B2B Scheduled Functions ====================

/**
 * Scheduled Function: Tax Invoice Scheduler
 * 留ㅼ썡 1??00:00???ㅽ뻾?섏뼱 B2B 怨꾩빟 湲곗뾽???멸툑怨꾩궛?쒕? ?먮룞 諛쒗뻾?⑸땲??
 */
export const scheduledTaxInvoice = functions.pubsub
  .schedule('0 0 1 * *')
  .timeZone('Asia/Seoul')
  .onRun(async (_context) => {
    console.warn('?㎨ [Scheduled Tax Invoice] Triggered at:', new Date().toISOString());
    try {
      const result = await taxInvoiceScheduler();
      console.warn('??Tax invoice scheduler completed:', result);
      return null;
    } catch (error) {
      console.error('??Tax invoice scheduler error:', error);
      return null;
    }
  });

/**
 * Scheduled Function: Giller Settlement Scheduler
 * 留ㅼ썡 5??00:00???ㅽ뻾?섏뼱 B2B 湲몃윭???붽컙 ?뺤궛???먮룞 泥섎━?⑸땲??
 */
export const scheduledGillerSettlement = functions.pubsub
  .schedule('0 0 5 * *')
  .timeZone('Asia/Seoul')
  .onRun(async (_context) => {
    console.warn('?뮥 [Scheduled Giller Settlement] Triggered at:', new Date().toISOString());
    try {
      const result = await gillerSettlementScheduler();
      console.warn('??Giller settlement scheduler completed:', result);
      return null;
    } catch (error) {
      console.error('??Giller settlement scheduler error:', error);
      return null;
    }
  });

/**
 * Scheduled Function: Fare Cache Scheduler
 * 留ㅼ＜ ?붿슂??03:00???ㅽ뻾?섏뼱 ??컙 ?댁엫 罹먯떆(config_fares)瑜?媛깆떊?⑸땲??
 */
export const scheduledFareCacheSync = functions.pubsub
  .schedule('0 3 * * 1')
  .timeZone('Asia/Seoul')
  .onRun(async (_context) => {
    console.warn('?쉯 [Scheduled Fare Cache Sync] Triggered at:', new Date().toISOString());
    try {
      const result = await fareCacheScheduler();
      console.warn('??Fare cache scheduler completed:', result);
      return null;
    } catch (error) {
      console.error('??Fare cache scheduler error:', error);
      return null;
    }
  });

/**
 * Callable Function: Manual Fare Cache Sync (Admin only)
 * 愿由ъ옄媛 ?섎룞?쇰줈 ?댁엫 罹먯떆 媛깆떊???몃━嫄고븷 ???덉뒿?덈떎.
 */
export const triggerFareCacheSync = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data() as { role?: unknown } | undefined;
  const role = typeof userData?.role === 'string' ? userData.role : undefined;
  if (role !== 'admin' && role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin role required.');
  }
  try {
    const result = await fareCacheScheduler();
    return { success: true, result };
  } catch (error) {
    console.error('??Manual fare cache sync error:', error);
    throw new functions.https.HttpsError('internal', 'Fare cache sync failed.');
  }
});

// ==================== CI Verification APIs (PASS / Kakao) ====================

type CiProvider = 'pass' | 'kakao';

interface StartCiVerificationSessionData {
  provider: CiProvider;
}

interface StartCiVerificationSessionResult {
  sessionId: string;
  provider: CiProvider;
  redirectUrl: string;
  callbackUrl: string;
}

interface CompleteCiVerificationTestData {
  provider: CiProvider;
  sessionId?: string;
}

interface IdentityIntegrationProviderSettings {
  enabled?: boolean;
  startUrl?: string;
  callbackUrl?: string;
  apiKey?: string;
  clientId?: string;
  webhookSecret?: string;
  signatureParam?: string;
  signatureHeader?: string;
}

interface IdentityIntegrationSettings {
  pass?: IdentityIntegrationProviderSettings;
  kakao?: IdentityIntegrationProviderSettings;
}

const CI_FUNCTION_REGION = 'us-central1';

function getFunctionBaseUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT is not defined');
  }
  return `https://${CI_FUNCTION_REGION}-${projectId}.cloudfunctions.net`;
}

function assertCiProvider(provider: unknown): asserts provider is CiProvider {
  if (provider !== 'pass' && provider !== 'kakao') {
    throw new functions.https.HttpsError('invalid-argument', 'provider must be pass or kakao');
  }
}

function buildCiHash(userId: string, provider: CiProvider, seed?: string): string {
  return createHash('sha256')
    .update(`${userId}:${provider}:${seed ?? randomUUID()}`)
    .digest('hex');
}

function buildCallbackSigningPayload(
  sessionId: string,
  provider: CiProvider,
  result: string,
  ciSeed: string
): string {
  return `${sessionId}|${provider}|${result}|${ciSeed}`;
}

function verifyCallbackSignature(
  payload: string,
  providedSignature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function getIdentityIntegrationSettings(): Promise<IdentityIntegrationSettings> {
  const doc = await db.collection('admin_settings').doc('identity_verification').get();
  if (!doc.exists) {
    return {};
  }
  return doc.data() as IdentityIntegrationSettings;
}

async function markCiVerified(params: {
  userId: string;
  provider: CiProvider;
  sessionId: string;
  ciSeed?: string;
}): Promise<string> {
  const { userId, provider, sessionId, ciSeed } = params;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ciHash = buildCiHash(userId, provider, ciSeed ?? sessionId);

  const verificationRef = db.doc(`users/${userId}/verification/${userId}`);
  const userRef = db.doc(`users/${userId}`);
  const profileRef = db.doc(`users/${userId}/profile/${userId}`);
  const sessionRef = db.collection('verification_sessions').doc(sessionId);

  await db.runTransaction((tx) => {
    tx.set(
      verificationRef,
      {
        userId,
        status: 'approved',
        verificationMethod: 'ci',
        ciHash,
        externalAuth: {
          provider,
          status: 'verified',
          verifiedAt: now,
        },
        reviewedAt: now,
        reviewedBy: 'ci-provider',
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      userRef,
      {
        isVerified: true,
        verificationInfo: {
          method: 'ci',
          provider,
          ciHash,
          verifiedAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      profileRef,
      {
        isVerified: true,
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      sessionRef,
      {
        status: 'completed',
        ciHash,
        completedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    return Promise.resolve();
  });

  return ciHash;
}

/**
 * Callable: CI ?몄쬆 ?몄뀡 ?쒖옉
 * - ?댁쁺: 諛섑솚??redirectUrl??PASS/Kakao 蹂몄씤?몄쬆 URL濡??ъ슜
 * - ?뚯뒪?? 誘몄꽕????mock ?섏씠吏濡?由щ떎?대젆??
 */
export const startCiVerificationSession = functions.https.onCall(
  async (data: StartCiVerificationSessionData, context): Promise<StartCiVerificationSessionResult> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const provider = data?.provider;
    assertCiProvider(provider);

    const userId = context.auth.uid;
    const sessionId = randomUUID();
    const baseUrl = getFunctionBaseUrl();
    const settings = await getIdentityIntegrationSettings();
    const providerSettings = provider === 'pass' ? settings.pass : settings.kakao;
    const callbackUrl = providerSettings?.callbackUrl ?? `${baseUrl}/ciVerificationCallback`;
    const mockUrl = `${baseUrl}/ciMock?sessionId=${encodeURIComponent(sessionId)}&provider=${provider}`;
    const providerUrlConfig = providerSettings?.startUrl ?? (
      provider === 'pass'
        ? CI_PASS_URL_PARAM.value()
        : CI_KAKAO_URL_PARAM.value()
    );

    if (providerSettings?.enabled === false) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `${provider.toUpperCase()} integration is disabled by admin`
      );
    }

    let redirectUrl = mockUrl;
    if (providerUrlConfig) {
      const queryParts = [
        `sessionId=${encodeURIComponent(sessionId)}`,
        `callbackUrl=${encodeURIComponent(callbackUrl)}`,
      ];
      if (providerSettings?.clientId) {
        queryParts.push(`clientId=${encodeURIComponent(providerSettings.clientId)}`);
      }
      redirectUrl = `${providerUrlConfig}${providerUrlConfig.includes('?') ? '&' : '?'}${queryParts.join('&')}`;
    }

    await db.collection('verification_sessions').doc(sessionId).set({
      sessionId,
      userId,
      provider,
      status: 'started',
      callbackUrl,
      redirectUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc(`users/${userId}/verification/${userId}`).set(
      {
        userId,
        status: 'pending',
        verificationMethod: 'ci',
        externalAuth: {
          provider,
          status: 'started',
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      sessionId,
      provider,
      redirectUrl,
      callbackUrl,
    };
  }
);

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per IP + endpoint key)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  ip: string,
  key: string,
  maxRequests: number,
  windowSeconds: number
): boolean {
  const now = Date.now();
  const limitKey = `${ip}:${key}`;
  const record = rateLimitMap.get(limitKey);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(limitKey, { count: 1, resetTime: now + windowSeconds * 1000 });
    return false; // under limit
  }

  if (record.count >= maxRequests) {
    return true; // over limit
  }

  record.count++;
  return false; // under limit
}

function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  return req.ip || (typeof req.headers?.['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : 'unknown');
}

/**
 * HTTP: ?뚯뒪?몄슜 CI mock ?붾㈃
 */
export const ciMock = functions.https.onRequest((req, res) => {
  // Rate limit: 1 request per minute per IP
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'ciMock', 1, 60)) {
    console.warn(`[rate-limit] ciMock blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }
  const sessionId = readFirstQueryValue(req.query.sessionId);
  const provider = readFirstQueryValue(req.query.provider);

  if (!sessionId || (provider !== 'pass' && provider !== 'kakao')) {
    res.status(400).send('Invalid query');
    return;
  }

  const baseUrl = getFunctionBaseUrl();
  const successUrl = `${baseUrl}/ciVerificationCallback?sessionId=${encodeURIComponent(sessionId)}&provider=${provider}&result=success&ci=mock-ci-${Date.now()}`;
  const failUrl = `${baseUrl}/ciVerificationCallback?sessionId=${encodeURIComponent(sessionId)}&provider=${provider}&result=failed`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CI Mock Verification</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px;">
    <h2>CI ?몄쬆 ?뚯뒪??(${provider.toUpperCase()})</h2>
    <p>sessionId: ${sessionId}</p>
    <p>?꾨옒 踰꾪듉?쇰줈 ?몄쬆 寃곌낵 肄쒕갚???쒕??덉씠?섑븷 ???덉뒿?덈떎.</p>
    <a href="${successUrl}" style="display:inline-block;margin-right:12px;padding:12px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">?깃났 肄쒕갚</a>
    <a href="${failUrl}" style="display:inline-block;padding:12px 16px;background:#ef4444;color:#fff;text-decoration:none;border-radius:8px;">?ㅽ뙣 肄쒕갚</a>
  </body>
</html>`);
});

export const issueKakaoCustomToken = functions.https.onCall(
  async (
    data: {
      accessToken?: string;
      expectedKakaoId?: string;
      role?: 'gller' | 'giller' | 'both';
      name?: string;
      phoneNumber?: string;
    },
    context
  ): Promise<{ customToken: string; uid: string; isNewUser: boolean }> => {
    const accessToken = typeof data?.accessToken === 'string' ? data.accessToken.trim() : '';
    const expectedKakaoId = typeof data?.expectedKakaoId === 'string' ? data.expectedKakaoId.trim() : '';
    const role = data?.role === 'gller' || data?.role === 'giller' || data?.role === 'both' ? data.role : 'gller';
    const providedName = typeof data?.name === 'string' ? data.name.trim() : '';
    const providedPhoneNumber = typeof data?.phoneNumber === 'string' ? data.phoneNumber.trim() : '';

    if (!accessToken) {
      throw new functions.https.HttpsError('invalid-argument', 'accessToken is required');
    }

    if (!expectedKakaoId) {
      throw new functions.https.HttpsError('invalid-argument', 'expectedKakaoId is required');
    }

    const kakaoResponse = await fetchJson('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (typeof kakaoResponse !== 'object' || kakaoResponse === null || !('id' in kakaoResponse)) {
      throw new functions.https.HttpsError('unauthenticated', 'Failed to verify Kakao access token');
    }

    const kakaoUser = kakaoResponse as KakaoUserResponse;
    const rawKakaoId = kakaoUser.id;
    const kakaoId =
      typeof rawKakaoId === 'string' || typeof rawKakaoId === 'number'
        ? String(rawKakaoId)
        : '';
    if (!kakaoId) {
      throw new functions.https.HttpsError('unauthenticated', 'Kakao user id is missing');
    }

    if (expectedKakaoId && expectedKakaoId !== kakaoId) {
      throw new functions.https.HttpsError('permission-denied', 'Kakao user id mismatch');
    }

    const kakaoAccount =
      typeof kakaoUser.kakao_account === 'object' && kakaoUser.kakao_account !== null
        ? (kakaoUser.kakao_account ?? {})
        : {};
    const properties =
      typeof kakaoUser.properties === 'object' && kakaoUser.properties !== null
        ? (kakaoUser.properties ?? {})
        : {};

    const email = typeof kakaoAccount.email === 'string' ? kakaoAccount.email : '';
    const nickname = typeof properties.nickname === 'string' ? properties.nickname : '카카오 사용자';
    const profileImage =
      typeof properties.profile_image === 'string'
        ? properties.profile_image
        : typeof properties.thumbnail_image === 'string'
          ? properties.thumbnail_image
          : '';

    const uid = `kakao_${kakaoId}`;
    if (context.auth?.uid && context.auth.uid !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Authenticated user does not match Kakao identity');
    }

    const userRef = db.collection('users').doc(uid);
    const existing = await userRef.get();
    const existingData = (existing.data() ?? {}) as KakaoLinkedUserDoc;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userRole =
      existing.exists && (existingData.role === 'gller' || existingData.role === 'giller' || existingData.role === 'both')
        ? existingData.role
        : role;
    const userName =
      existing.exists && typeof existingData.name === 'string' && existingData.name.trim()
        ? existingData.name
        : providedName || nickname;
    const userPhoneNumber =
      existing.exists && typeof existingData.phoneNumber === 'string' && existingData.phoneNumber.trim()
        ? existingData.phoneNumber
        : providedPhoneNumber;

    await userRef.set(
      {
        uid,
        email,
        name: userName,
        phoneNumber: userPhoneNumber,
        role: userRole,
        gillerApplicationStatus: existingData.gillerApplicationStatus ?? 'none',
        authProvider: 'kakao',
        authProviderUserId: kakaoId,
        signupMethod: 'kakao',
        providerLinkedAt: now,
        profilePhoto: profileImage ?? existingData.profilePhoto ?? '',
        updatedAt: now,
        isActive: true,
        isVerified: existingData.isVerified ?? false,
        hasCompletedOnboarding: existing.exists ? existingData.hasCompletedOnboarding ?? false : false,
        agreedTerms: existing.exists
          ? existingData.agreedTerms ?? { giller: false, gller: false, privacy: false, marketing: false }
          : { giller: false, gller: false, privacy: false, marketing: false },
        stats: existing.exists
          ? existingData.stats ?? {
              completedDeliveries: 0,
              totalEarnings: 0,
              rating: 0,
              recentPenalties: 0,
              accountAgeDays: 0,
              recent30DaysDeliveries: 0,
            }
          : {
              completedDeliveries: 0,
              totalEarnings: 0,
              rating: 0,
              recentPenalties: 0,
              accountAgeDays: 0,
              recent30DaysDeliveries: 0,
            },
        badges: existing.exists
          ? existingData.badges ?? { activity: [], quality: [], expertise: [], community: [] }
          : { activity: [], quality: [], expertise: [], community: [] },
        badgeBenefits: existing.exists
          ? existingData.badgeBenefits ?? { profileFrame: 'none', totalBadges: 0, currentTier: 'none' }
          : { profileFrame: 'none', totalBadges: 0, currentTier: 'none' },
        ...(existing.exists ? {} : { createdAt: now }),
      },
      { merge: true }
    );

    const customToken = await admin.auth().createCustomToken(uid, {
      provider: 'kakao',
      authProviderUserId: kakaoId,
    });

    return {
      customToken,
      uid,
      isNewUser: !existing.exists,
    };
  }
);

/**
 * HTTP: Naver static map proxy
 * Keeps the secret key on the server side while the app/web can request a rendered image.
 */
export const naverStaticMapProxy = functions.https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'naverStaticMapProxy', 10, 60)) {
    console.warn(`[rate-limit] naverStaticMapProxy blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    const clientId = getFirstNonEmptyString(
      NAVER_MAP_CLIENT_ID_PARAM.value(),
      process.env.NAVER_MAP_CLIENT_ID
    );
    const clientSecret = getFirstNonEmptyString(
      NAVER_MAP_CLIENT_SECRET_PARAM.value(),
      process.env.NAVER_MAP_CLIENT_SECRET
    );

    if (!clientId || !clientSecret) {
      res.status(503).json({ ok: false, message: 'naver map credentials are not configured' });
      return;
    }

    const center = readFirstQueryValue(req.query.center);
    if (!center) {
      res.status(400).json({ ok: false, message: 'center is required' });
      return;
    }

    const level = String(readPositiveInteger(readFirstQueryValue(req.query.level), 14, 1, 18));
    const width = String(readPositiveInteger(readFirstQueryValue(req.query.w), 640, 64, 1280));
    const height = String(readPositiveInteger(readFirstQueryValue(req.query.h), 320, 64, 1280));
    const scale = String(readPositiveInteger(readFirstQueryValue(req.query.scale), 2, 1, 2));
    const markers = readFirstQueryValue(req.query.markers);

    const naverUrl = buildNaverStaticMapUrl({
      center,
      level,
      width,
      height,
      scale,
      markers: markers ?? undefined,
    });

    const imageResponse = await fetchBinary(naverUrl, {
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
    });

    if (imageResponse.statusCode >= 400) {
      res.status(imageResponse.statusCode).send(imageResponse.body.toString('utf-8'));
      return;
    }

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.set('Content-Type', imageResponse.contentType);
    res.status(200).send(imageResponse.body);
  } catch (error) {
    console.error('naverStaticMapProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to render static map' });
  }
});

/**
 * HTTP: Naver geocode proxy
 * Converts a selected road address into latitude/longitude on the server side.
 */
export const naverGeocodeProxy = functions.https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'naverGeocodeProxy', 10, 60)) {
    console.warn(`[rate-limit] naverGeocodeProxy blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const clientId = getFirstNonEmptyString(
      NAVER_MAP_CLIENT_ID_PARAM.value(),
      process.env.NAVER_MAP_CLIENT_ID
    );
    const clientSecret = getFirstNonEmptyString(
      NAVER_MAP_CLIENT_SECRET_PARAM.value(),
      process.env.NAVER_MAP_CLIENT_SECRET
    );

    if (!clientId || !clientSecret) {
      res.status(503).json({ ok: false, message: 'naver map credentials are not configured' });
      return;
    }

    const address = readFirstQueryValue(req.query.query).trim();
    if (address.length < 2) {
      res.status(400).json({ ok: false, message: 'query is required' });
      return;
    }

    const naverUrl = buildNaverGeocodeUrl({ address });
    const payload = (await fetchJson(naverUrl, {
      headers: {
        Accept: 'application/json',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    })) as {
      status?: string;
      addresses?: Array<{
        roadAddress?: string;
        jibunAddress?: string;
        x?: string;
        y?: string;
      }>;
      errorMessage?: string;
    };

    if (payload.status !== 'OK') {
      res.status(502).json({ ok: false, message: payload.errorMessage ?? 'failed to geocode address' });
      return;
    }

    const first = payload.addresses?.[0];
    const longitude = Number(first?.x ?? 0);
    const latitude = Number(first?.y ?? 0);

    if (!first || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) {
      res.status(404).json({ ok: false, message: 'address coordinates not found' });
      return;
    }

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).json({
      ok: true,
      address: {
        roadAddress: first.roadAddress ?? address,
        jibunAddress: first.jibunAddress ?? '',
        latitude,
        longitude,
      },
    });
  } catch (error) {
    console.error('naverGeocodeProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to geocode address' });
  }
});

/**
 * HTTP: Naver directions proxy
 * Returns route coordinates between two points so the client can render an actual route line.
 */
export const naverDirectionsProxy = functions.https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'naverDirectionsProxy', 10, 60)) {
    console.warn(`[rate-limit] naverDirectionsProxy blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const clientId = getFirstNonEmptyString(
      NAVER_MAP_CLIENT_ID_PARAM.value(),
      process.env.NAVER_MAP_CLIENT_ID
    );
    const clientSecret = getFirstNonEmptyString(
      NAVER_MAP_CLIENT_SECRET_PARAM.value(),
      process.env.NAVER_MAP_CLIENT_SECRET
    );

    if (!clientId || !clientSecret) {
      res.status(503).json({ ok: false, message: 'naver map credentials are not configured' });
      return;
    }

    const start = readFirstQueryValue(req.query.start).trim();
    const goal = readFirstQueryValue(req.query.goal).trim();
    const option = readFirstQueryValue(req.query.option).trim() || 'trafast';

    if (!start || !goal) {
      res.status(400).json({ ok: false, message: 'start and goal are required' });
      return;
    }

    const directionsUrl = buildNaverDirectionsUrl({ start, goal, option });
    const payload = (await fetchJson(directionsUrl, {
      headers: {
        Accept: 'application/json',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    })) as {
      code?: number;
      message?: string;
      route?: Record<
        string,
        Array<{
          summary?: {
            distance?: number;
            duration?: number;
            tollFare?: number;
            taxiFare?: number;
            fuelPrice?: number;
          };
          path?: Array<[number, number]>;
        }>
      >;
    };

    const routeGroups = payload.route ?? {};
    const routeEntry = Object.values(routeGroups).find((items) => Array.isArray(items) && items.length > 0)?.[0];

    if (!routeEntry?.path || routeEntry.path.length === 0) {
      res.status(404).json({ ok: false, message: payload.message ?? 'route coordinates not found' });
      return;
    }

    const coordinates = routeEntry.path
      .map((point) => {
        const longitude = Number(point?.[0]);
        const latitude = Number(point?.[1]);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          latitude,
          longitude,
        };
      })
      .filter((point): point is { latitude: number; longitude: number } => point !== null);

    if (coordinates.length === 0) {
      res.status(404).json({ ok: false, message: 'route coordinates not found' });
      return;
    }

    res.set('Cache-Control', 'public, max-age=120, s-maxage=120');
    res.status(200).json({
      ok: true,
      route: {
        option,
        summary: {
          distanceMeters: Number(routeEntry.summary?.distance ?? 0),
          durationMs: Number(routeEntry.summary?.duration ?? 0),
          tollFare: Number(routeEntry.summary?.tollFare ?? 0),
          taxiFare: Number(routeEntry.summary?.taxiFare ?? 0),
          fuelPrice: Number(routeEntry.summary?.fuelPrice ?? 0),
        },
        coordinates,
      },
    });
  } catch (error) {
    console.error('naverDirectionsProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to fetch directions' });
  }
});

/**
 * HTTP: Road-name address search proxy for Juso API
 * Keeps the confirmation key on the server while the client searches by keyword.
 */
export const jusoAddressSearchProxy = functions.https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'jusoAddressSearchProxy', 10, 60)) {
    console.warn(`[rate-limit] jusoAddressSearchProxy blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const apiKey = getFirstNonEmptyString(JUSO_API_KEY_PARAM.value(), process.env.JUSO_API_KEY);
    if (!apiKey) {
      res.status(503).json({ ok: false, message: 'juso api key is not configured' });
      return;
    }

    const keyword = readFirstQueryValue(req.query.keyword).trim();
    if (keyword.length < 2) {
      res.status(400).json({ ok: false, message: 'keyword must be at least 2 characters' });
      return;
    }

    const currentPage = String(readPositiveInteger(readFirstQueryValue(req.query.currentPage), 1, 1, 100));
    const countPerPage = String(readPositiveInteger(readFirstQueryValue(req.query.countPerPage), 10, 1, 100));

    const jusoUrl = buildJusoSearchUrl({
      confmKey: apiKey,
      keyword,
      currentPage,
      countPerPage,
    });

    const payload = await fetchJson(jusoUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).json(payload);
  } catch (error) {
    console.error('jusoAddressSearchProxy error:', error);
    res.status(500).json({ ok: false, message: 'failed to search road addresses' });
  }
});

/**
 * HTTP: CI ?몄쬆 肄쒕갚
 */
export const ciVerificationCallback = functions.https.onRequest(async (req, res) => {
  const ip = getClientIp(req);
  if (checkRateLimit(ip, 'ciVerificationCallback', 10, 60)) {
    console.warn(`[rate-limit] ciVerificationCallback blocked for ip=${ip}`);
    res.status(429).send('Too many requests');
    return;
  }

  try {
    const sessionId = readFirstQueryValue(req.query.sessionId) ?? readObjectString(req.body, 'sessionId');
    const provider = readFirstQueryValue(req.query.provider) ?? readObjectString(req.body, 'provider');
    const result = readFirstQueryValue(req.query.result) || readObjectString(req.body, 'result') || 'success';
    const ciSeed = readFirstQueryValue(req.query.ci) || readObjectString(req.body, 'ci') || sessionId;

    if (!sessionId || (provider !== 'pass' && provider !== 'kakao')) {
      res.status(400).json({ ok: false, message: 'invalid parameters' });
      return;
    }

    const sessionRef = db.collection('verification_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data() as { userId?: string; provider?: CiProvider } | undefined;

    if (!sessionSnap.exists || !session?.userId) {
      res.status(404).json({ ok: false, message: 'session not found' });
      return;
    }

    if (session.provider !== provider) {
      res.status(400).json({ ok: false, message: 'provider mismatch' });
      return;
    }

    const settings = await getIdentityIntegrationSettings();
    const providerSettings = provider === 'pass' ? settings.pass : settings.kakao;
    const webhookSecret = providerSettings?.webhookSecret;
    const signatureParam = providerSettings?.signatureParam ?? 'signature';
    const signatureHeader = providerSettings?.signatureHeader ?? 'x-signature';

    if (webhookSecret) {
      const providedSignature =
        readFirstQueryValue(req.query?.[signatureParam]) ||
        readObjectString(req.body, signatureParam) || readFirstQueryValue(req.headers?.[signatureHeader]);
      if (!providedSignature) {
        res.status(401).json({ ok: false, message: 'missing signature' });
        return;
      }

      const payload = buildCallbackSigningPayload(sessionId, provider, result, ciSeed);
      const valid = verifyCallbackSignature(payload, providedSignature, webhookSecret);
      if (!valid) {
        res.status(401).json({ ok: false, message: 'invalid signature' });
        return;
      }
    }

    if (result !== 'success') {
      await sessionRef.set(
        {
          status: 'failed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await db.doc(`users/${session.userId}/verification/${session.userId}`).set(
        {
          status: 'rejected',
          verificationMethod: 'ci',
          rejectionReason: '蹂몄씤?몄쬆??痍⑥냼?섏뿀嫄곕굹 ?ㅽ뙣?덉뒿?덈떎.',
          externalAuth: {
            provider,
            status: 'failed',
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      res.status(200).json({ ok: false, message: 'verification failed' });
      return;
    }

    const ciHash = await markCiVerified({
      userId: session.userId,
      provider,
      sessionId,
      ciSeed,
    });

    res.status(200).json({
      ok: true,
      sessionId,
      provider,
      ciHash,
      message: 'verification completed',
    });
  } catch (error) {
    console.error('ciVerificationCallback error:', error);
    res.status(500).json({ ok: false, message: 'internal error' });
  }
});

/**
 * Callable: ?뚯뒪???섍꼍?먯꽌 ?몄쬆 ?꾨즺 媛뺤젣 泥섎━
 */
export const completeCiVerificationTest = functions.https.onCall(
  async (data: CompleteCiVerificationTestData, context): Promise<{ ok: boolean; ciHash: string }> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const provider = data?.provider;
    assertCiProvider(provider);

    const userId = context.auth.uid;
    const sessionId = data?.sessionId ?? randomUUID();

    const ciHash = await markCiVerified({
      userId,
      provider,
      sessionId,
      ciSeed: `test-${Date.now()}`,
    });

    return { ok: true, ciHash };
  }
);

export const requestPhoneOtp = functions.https.onCall(
  async (data: RequestPhoneOtpData, context): Promise<RequestPhoneOtpResult> => {
    const userId = requireCallableAuth(context, 'requestPhoneOtp');
    const phoneNumber = normalizePhoneNumber(data?.phoneNumber ?? '');
    if (!isValidKoreanMobileNumber(phoneNumber)) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid Korean mobile number is required');
    }

    const testMode = isOtpTestModeEnabled();
    const now = Date.now();
    const verifiedPhoneOwnerQuery = await db
      .collection('users')
      .where('phoneVerification.phoneNumber', '==', phoneNumber)
      .where('phoneVerification.verified', '==', true)
      .limit(1)
      .get();

    if (!verifiedPhoneOwnerQuery.empty) {
      const ownerDoc = verifiedPhoneOwnerQuery.docs[0];
      if (ownerDoc.id !== userId) {
        throw new functions.https.HttpsError(
          'already-exists',
          '이미 다른 계정에서 인증에 사용 중인 휴대폰 번호입니다.'
        );
      }

      return {
        success: true,
        sessionId: `verified-${ownerDoc.id}`,
        expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
        resendAvailableAt: new Date(now).toISOString(),
        maskedDestination: maskPhoneNumber(phoneNumber),
        alreadyVerified: true,
      };
    }

    const sessionQuery = await db
      .collection(OTP_SESSION_COLLECTION)
      .where('phoneNumber', '==', phoneNumber)
      .where('status', '==', 'pending')
      .get();

    if (!sessionQuery.empty) {
      const latestPending = sessionQuery.docs
        .sort((left, right) => {
          const leftTimestamp = left.get('createdAt') as admin.firestore.Timestamp | undefined;
          const rightTimestamp = right.get('createdAt') as admin.firestore.Timestamp | undefined;
          const leftTime = leftTimestamp?.toDate().getTime() ?? 0;
          const rightTime = rightTimestamp?.toDate().getTime() ?? 0;
          return rightTime - leftTime;
        })[0];
      const latestData = latestPending.data() as { resendAvailableAt?: admin.firestore.Timestamp };
      const resendAvailableAt = latestData.resendAvailableAt?.toDate().getTime() ?? 0;

      if (resendAvailableAt > now) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'OTP was requested too recently. Please wait before requesting another code.'
        );
      }
    }

    const sessionId = randomUUID();
    const code = testMode ? OTP_TEST_CODE_PARAM.value() ?? '123456' : createOtpCode();
    const nowDate = new Date(now);
    const expiresAt = new Date(now + OTP_TTL_MS);
    const resendAvailableAt = new Date(now + OTP_RESEND_MS);

    await db.collection(OTP_SESSION_COLLECTION).doc(sessionId).set({
      sessionId,
      userId,
      phoneNumber,
      maskedDestination: maskPhoneNumber(phoneNumber),
      codeHash: hashOtpCode(sessionId, code),
      status: 'pending',
      attemptsRemaining: OTP_MAX_ATTEMPTS,
      createdAt: admin.firestore.Timestamp.fromDate(nowDate),
      updatedAt: admin.firestore.Timestamp.fromDate(nowDate),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      resendAvailableAt: admin.firestore.Timestamp.fromDate(resendAvailableAt),
      deliveryProvider: testMode ? 'test' : 'manual',
    });

    console.warn(`[OTP] issued session=${sessionId} destination=${maskPhoneNumber(phoneNumber)} mode=${testMode ? 'test' : 'manual'} code=${code}`);

    return {
      success: true,
      sessionId,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      maskedDestination: maskPhoneNumber(phoneNumber),
      ...(testMode ? { testCode: code } : {}),
    };
  }
);

export const confirmPhoneOtp = functions.https.onCall(
  async (data: ConfirmPhoneOtpData, context): Promise<ConfirmPhoneOtpResult> => {
    const userId = requireCallableAuth(context, 'confirmPhoneOtp');
    const sessionId = typeof data?.sessionId === 'string' ? data.sessionId.trim() : '';
    const phoneNumber = normalizePhoneNumber(data?.phoneNumber ?? '');
    const code = typeof data?.code === 'string' ? data.code.trim() : '';

    if (!sessionId || !isValidKoreanMobileNumber(phoneNumber) || !/^\d{6}$/.test(code)) {
      throw new functions.https.HttpsError('invalid-argument', 'sessionId, phoneNumber, and a 6-digit code are required');
    }

    const sessionRef = db.collection(OTP_SESSION_COLLECTION).doc(sessionId);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'OTP session was not found');
    }

    const session = sessionSnapshot.data() as {
      userId?: string;
      phoneNumber?: string;
      codeHash?: string;
      status?: string;
      expiresAt?: admin.firestore.Timestamp;
      attemptsRemaining?: number;
    };

    if (session.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'This OTP session belongs to a different user');
    }

    if (session.phoneNumber !== phoneNumber) {
      throw new functions.https.HttpsError('permission-denied', 'Phone number does not match this session');
    }

    if (session.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'This OTP session is no longer active');
    }

    const expiresAt = session.expiresAt?.toDate().getTime() ?? 0;
    if (!expiresAt || expiresAt < Date.now()) {
      await sessionRef.set(
        {
          status: 'expired',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw new functions.https.HttpsError('deadline-exceeded', 'OTP code has expired');
    }

    const expectedHash = hashOtpCode(sessionId, code);
    if (!session.codeHash || session.codeHash !== expectedHash) {
      const nextAttempts = Math.max((session.attemptsRemaining ?? OTP_MAX_ATTEMPTS) - 1, 0);
      await sessionRef.set(
        {
          attemptsRemaining: nextAttempts,
          status: nextAttempts === 0 ? 'locked' : 'pending',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw new functions.https.HttpsError(
        nextAttempts === 0 ? 'permission-denied' : 'invalid-argument',
        nextAttempts === 0 ? 'Too many invalid OTP attempts' : 'OTP code is invalid'
      );
    }

    const verifiedAt = new Date();
    const verificationToken = randomUUID();
    const verifiedPhoneOwnerQuery = await db
      .collection('users')
      .where('phoneVerification.phoneNumber', '==', phoneNumber)
      .where('phoneVerification.verified', '==', true)
      .limit(1)
      .get();

    if (!verifiedPhoneOwnerQuery.empty && verifiedPhoneOwnerQuery.docs[0].id !== userId) {
      throw new functions.https.HttpsError(
        'already-exists',
        '이미 다른 계정에서 인증에 사용 중인 휴대폰 번호입니다.'
      );
    }

    await sessionRef.set(
      {
        status: 'verified',
        verifiedAt: admin.firestore.Timestamp.fromDate(verifiedAt),
        verificationToken,
        updatedAt: admin.firestore.Timestamp.fromDate(verifiedAt),
      },
      { merge: true }
    );

    await db.collection('users').doc(userId).set(
      {
        phoneNumber,
        phoneVerification: {
          verified: true,
          phoneNumber,
          verificationToken,
          verifiedAt: admin.firestore.Timestamp.fromDate(verifiedAt),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      success: true,
      verificationToken,
      verifiedAt: verifiedAt.toISOString(),
    };
  }
);

export { syncConfigStationsFromSeoulApi };
