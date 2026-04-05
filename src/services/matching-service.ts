/**
 * Matching Service
 * Integrates matching engine with Firestore
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { gillerAcceptRequest } from './delivery-service';
import {
  matchGillersToRequest,
  type MatchingResult,
} from '../../data/matching-engine';
import { getStationByName } from '../data/subway-stations';
import {
  sendMatchFoundNotification,
} from './matching-notification';
import { createChatService, getChatRoomByRequestId } from './chat-service';
import { BadgeService } from './BadgeService';
import { getUserActiveRoutes } from './route-service';
import { locationService, type LocationData } from './location-service';
import type {
  RouteMatchScore,
  LocationFilteredRequest,
  RouteFilteredRequest,
  MatchingFilterOptions,
  GillerMatchingStats,
} from '../types/matching-extended';
import type { Route } from '../types/route';

type LooseStationInput = {
  stationId?: string;
  id?: string;
  stationName?: string;
  line?: string;
  lineName?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

type LooseRouteInput = {
  userId?: string;
  startStation?: LooseStationInput;
  endStation?: LooseStationInput;
  departureTime?: string;
  daysOfWeek?: number[];
  isActive?: boolean;
};

type LooseRequestStation = {
  stationName?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

type RouteHeuristicRequest = {
  id?: string;
  pickupStation?: LooseRequestStation;
  deliveryStation?: LooseRequestStation;
};

type RouteScoreRequest = {
  pickupStation?: { stationName?: string };
  deliveryStation?: { stationName?: string };
  preferredTime?: { departureTime?: string };
};

type FilterStation = {
  stationName?: string;
  line?: string;
  region?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

type FilterRequestBase = {
  pickupStation: FilterStation;
  deliveryStation: FilterStation;
  fee?: { totalFee?: number };
  matchScore?: { score?: number };
  metadata?: {
    distanceFromCurrent?: number;
    nearestStation?: string;
    estimatedTimeMinutes?: number;
    distanceRank?: number;
  };
  [key: string]: unknown;
};

type EngineGillerRoute = {
  gillerId: string;
  gillerName?: string;
  departureStation: string;
  arrivalStation: string;
  departureTime: string;
  daysOfWeek: number[];
  rating?: number;
  totalDeliveries?: number;
  completedDeliveries?: number;
  badgeBonus?: number;
  priorityBoost?: number;
};

type EngineDeliveryRequest = {
  pickupStation: string;
  deliveryStation: string;
  dayOfWeek: string;
  time: string;
};

const runMatchingEngine = matchGillersToRequest as unknown as (
  request: EngineDeliveryRequest,
  gillerRoutes: EngineGillerRoute[]
) => MatchingResult[];

type RouteMatchableRequest = FilterRequestBase & RouteScoreRequest;

type BadgeCollections = {
  activity?: string[];
  quality?: string[];
  expertise?: string[];
  community?: string[];
};

type NormalizedBadgeCollections = {
  activity: string[];
  quality: string[];
  expertise: string[];
  community: string[];
};

type FirestoreUserDoc = {
  name?: string;
  rating?: number;
  profilePhoto?: string;
  profileImage?: string;
  badges?: BadgeCollections;
  stats?: {
    rating?: number;
    totalDeliveries?: number;
    completedDeliveries?: number;
    averageResponseTime?: number;
  };
  gillerInfo?: {
    totalDeliveries?: number;
    completedDeliveries?: number;
  };
  professionalLevel?: 'regular' | 'professional' | 'master';
  badgeBonus?: number;
};

type FirestoreRouteDoc = {
  userId?: string;
  gillerName?: string;
  startStation?: { stationName?: string };
  endStation?: { stationName?: string };
  departureTime?: string;
  daysOfWeek?: number[];
  rating?: number;
  totalDeliveries?: number;
  completedDeliveries?: number;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

type FirestoreMatchingRequestDoc = {
  id?: string;
  requesterId?: string;
  pickupStation?: { stationName?: string };
  deliveryStation?: { stationName?: string };
  preferredTime?: {
    departureTime?: string;
    arrivalTime?: string;
  };
  deadline?: Date | FirestoreTimestampLike;
  packageInfo?: {
    size?: string;
    weight?: string | number;
  };
  fee?: {
    totalFee?: number;
  };
  status?: string;
};

type FirestorePendingRequestDoc = FilterRequestBase & {
  requestId?: string;
  requesterId?: string;
  requesterName?: string;
  senderName?: string;
  matchedGillerId?: string;
  feeBreakdown?: { totalFee?: number };
};

function normalizeBadges(badges?: BadgeCollections): NormalizedBadgeCollections {
  return {
    activity: badges?.activity ?? [],
    quality: badges?.quality ?? [],
    expertise: badges?.expertise ?? [],
    community: badges?.community ?? [],
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function normalizeStationName(name?: string): string {
  return (name ?? '').replace(/\s+/g, '').replace(/\?/g, '').toLowerCase();
}

function namesLooselyEqual(a?: string, b?: string): boolean {
  const na = normalizeStationName(a);
  const nb = normalizeStationName(b);
  if (!na ?? !nb) return false;
  return na === nb || na.includes(nb) ?? nb.includes(na);
}

function normalizeRouteForMatching(routeData: LooseRouteInput, routeId: string): Route | null {
  if (!routeData?.userId || !routeData?.startStation ?? !routeData?.endStation) {
    return null;
  }

  const start = routeData.startStation;
  const end = routeData.endStation;

  const startStation = {
    stationId: start.stationId ?? start.id,
    stationName: start.stationName ?? '',
    line: start.line ?? start.lineName ?? '',
    lat: start.lat ?? start.latitude ?? 0,
    lng: start.lng ?? start.longitude ?? 0,
  };

  const endStation = {
    stationId: end.stationId ?? end.id,
    stationName: end.stationName ?? '',
    line: end.line ?? end.lineName ?? '',
    lat: end.lat ?? end.latitude ?? 0,
    lng: end.lng ?? end.longitude ?? 0,
  };

  if (!startStation.stationName ?? !endStation.stationName) {
    return null;
  }

  return {
    routeId,
    userId: routeData.userId,
    startStation,
    endStation,
    departureTime: routeData.departureTime ?? '08:00',
    daysOfWeek: Array.isArray(routeData.daysOfWeek) && routeData.daysOfWeek.length > 0
      ? routeData.daysOfWeek
      : [1, 2, 3, 4, 5, 6, 7],
    isActive: routeData.isActive !== false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Route;
}

async function findMatchesByRouteHeuristic(
  requestData: RouteHeuristicRequest,
  topN: number
): Promise<MatchingResult[]> {
  const snapshot = await getDocs(query(collection(db, 'routes'), where('isActive', '==', true)));
  const today = new Date().getDay();
  const dayOfWeek = today === 0 ? 7 : today;
  const requestPickup = requestData.pickupStation?.stationName ?? '';
  const requestDelivery = requestData.deliveryStation?.stationName ?? '';

  const routeCandidates: Array<{
    gillerId: string;
    route: Route;
    routeScore: RouteMatchScore;
  }> = [];

  snapshot.forEach((routeDoc) => {
    const route = normalizeRouteForMatching(routeDoc.data(), routeDoc.id);
    if (!route) return;

    const routeScore = calculateRouteMatchScore(requestData, route);
    const loosePickup = namesLooselyEqual(route.startStation.stationName, requestPickup);
    const looseDelivery = namesLooselyEqual(route.endStation.stationName, requestDelivery);
    const isTodayRoute = route.daysOfWeek.includes(dayOfWeek);
    const adjustedScore = routeScore.score + (isTodayRoute ? 10 : 0) + ((loosePickup ?? looseDelivery) ? 5 : 0);

    if (adjustedScore < 10) return;

    routeCandidates.push({
      gillerId: route.userId,
      route,
      routeScore: {
        ...routeScore,
        score: Math.min(100, adjustedScore),
      },
    });
  });

  routeCandidates.sort((a, b) => b.routeScore.score - a.routeScore.score);
  const uniqueByGiller = new Map<string, typeof routeCandidates[number]>();
  for (const candidate of routeCandidates) {
    if (!uniqueByGiller.has(candidate.gillerId)) {
      uniqueByGiller.set(candidate.gillerId, candidate);
    }
  }

  const topCandidates = Array.from(uniqueByGiller.values()).slice(0, Math.max(topN * 2, 10));
  const hydrated = await Promise.all(topCandidates.map(async (candidate) => {
    const [userInfo, userStats] = await Promise.all([
      fetchUserInfo(candidate.gillerId),
      fetchUserStats(candidate.gillerId),
    ]);
    return { ...candidate, userInfo, userStats };
  }));

  return hydrated
    .map((item) => {
      const routeMatchScore = Math.min(50, Math.round(item.routeScore.score * 0.5));
      const timeMatchScore = Math.min(30, Math.round((item.routeScore.details.timeScore + item.routeScore.details.dayOfWeekScore) * 1.2));
      const ratingScore = Math.min(15, Math.round(((item.userStats.rating - 1) / 4) * 15));
      const completionRate = item.userStats.totalDeliveries > 0
        ? (item.userStats.completedDeliveries / item.userStats.totalDeliveries)
        : 0.5;
      const completionRateScore = Math.min(5, Math.round(completionRate * 5));
      const totalScore = routeMatchScore + timeMatchScore + ratingScore + completionRateScore;

      return {
        gillerId: item.gillerId,
        gillerName: item.userInfo.name ?? 'giller',
        totalScore,
        routeMatchScore,
        timeMatchScore,
        ratingScore,
        completionRateScore,
        scores: {
          pickupMatchScore: item.routeScore.details.pickupStationScore,
          deliveryMatchScore: item.routeScore.details.deliveryStationScore,
          departureTimeMatchScore: item.routeScore.details.timeScore,
          scheduleFlexibilityScore: item.routeScore.details.dayOfWeekScore,
          ratingRawScore: ratingScore,
          completionRateRawScore: completionRateScore,
        },
        routeDetails: {
          travelTime: Math.max(1200, Math.round(3600 - item.routeScore.score * 20)),
          isExpressAvailable: false,
          transferCount: item.routeScore.routeDirection === 'exact' ? 0 : 1,
          congestionLevel: 'medium' as const,
        },
        reasons: [
          item.routeScore.pickupMatch ? '출발역 기준으로 등록 동선과 잘 맞습니다.' : '출발역 기준 동선 일치도가 낮습니다.',
          item.routeScore.deliveryMatch ? '도착역 기준으로 등록 동선과 잘 맞습니다.' : '도착역 기준 동선 일치도가 낮습니다.',
        ],
      } as MatchingResult;
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, topN);
}

/**
 * Calculate badge bonus for fee adjustment
 * @param userId User ID
 * @returns Badge bonus percentage and priority boost
 */
export async function calculateBadgeBonus(userId: string): Promise<{
  feeBonus: number; // 0.05 to 0.20 (5% to 20%)
  priorityBoost: number; // 0 to 20 (priority score boost)
}> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return { feeBonus: 0, priorityBoost: 0 };
    }

    const user = userDoc.data() as FirestoreUserDoc;
    const badgeTier = BadgeService.calculateBadgeTier(normalizeBadges(user.badges));

    // 배지 등급별 수수료 보너스와 우선순위 가산점
    // Bronze(3개): 수수료 5% 보너스
    // Silver(5개): 수수료 10% 보너스
    // Gold(7개): 수수료 15% 보너스 + 우선순위 가산점
    // Platinum(10개): 수수료 20% 보너스 + 큰 우선순위 가산점
    const bonusConfig = {
      bronze: { feeBonus: 0.05, priorityBoost: 0 },
      silver: { feeBonus: 0.10, priorityBoost: 0 },
      gold: { feeBonus: 0.15, priorityBoost: 10 },
      platinum: { feeBonus: 0.20, priorityBoost: 20 },
      none: { feeBonus: 0, priorityBoost: 0 },
    };

    const tier = badgeTier.tier ?? 'none';
    return bonusConfig[tier];
  } catch (error) {
    console.error('Error calculating badge bonus:', error);
    return { feeBonus: 0, priorityBoost: 0 };
  }
}

/**
 * Fetch user stats from users collection
 * @param userId User ID
 * @returns User stats
 */
async function fetchUserStats(userId: string): Promise<{
  rating: number;
  totalDeliveries: number;
  completedDeliveries: number;
}> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return {
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
      };
    }

    const data = userDoc.data() as FirestoreUserDoc;
    const stats = data.stats ?? {};
    const gillerInfo = data.gillerInfo ?? {};

    return {
      rating: stats.rating ?? data.rating ?? 3.5,
      totalDeliveries: stats.totalDeliveries ?? stats.completedDeliveries ?? gillerInfo.totalDeliveries ?? 0,
      completedDeliveries: stats.completedDeliveries ?? gillerInfo.completedDeliveries ?? gillerInfo.totalDeliveries ?? 0,
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return {
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
    };
  }
}

/**
 * Fetch all active giller routes from Firestore
 * @returns Array of giller routes
 */
export async function fetchActiveGillerRoutes(): Promise<EngineGillerRoute[]> {
  try {
    const q = query(
      collection(db, 'routes'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const routes: EngineGillerRoute[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as FirestoreRouteDoc;

      const startStationName = data.startStation?.stationName;
      const endStationName = data.endStation?.stationName;

      if (!data.userId || !startStationName ?? !endStationName) {
        return;
      }

      // Convert Firestore data to GillerRoute format
      const startStation = getStationByName(startStationName);
      const endStation = getStationByName(endStationName);

      if (!startStation ?? !endStation) {
        console.warn(`Station not found for route ${docSnapshot.id}`);
        return;
      }

      // Fetch user stats from users collection (using defaults for now)
      const userStats = {
        rating: data.rating ?? 4.5,
        totalDeliveries: data.totalDeliveries ?? 0,
        completedDeliveries: data.completedDeliveries ?? 0,
      };

      // Calculate badge bonus (using default for now)
      const badgeBonus = {
        feeBonus: 0,
        priorityBoost: 0,
      };

      routes.push({
        gillerId: data.userId,
        gillerName: data.gillerName ?? 'giller',
        departureStation: startStation.stationName,
        arrivalStation: endStation.stationName,
        departureTime: data.departureTime ?? '08:00',
        daysOfWeek: data.daysOfWeek ?? [1, 2, 3, 4, 5],
        rating: userStats.rating,
        totalDeliveries: userStats.totalDeliveries,
        completedDeliveries: userStats.completedDeliveries,
        badgeBonus: badgeBonus.feeBonus,
        priorityBoost: badgeBonus.priorityBoost,
      });
    });

    return routes;
  } catch (error) {
    console.error('Error fetching giller routes:', error);
    throw error;
  }
}

/**
 * Fetch user info by ID
 * @param userId User ID
 * @returns User data { name, rating, totalDeliveries, completedDeliveries, profileImage }
 */
export async function fetchUserInfo(userId: string): Promise<{
  name: string;
  rating: number;
  totalDeliveries: number;
  completedDeliveries: number;
  profileImage?: string;
}> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return {
        name: 'giller',
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
        profileImage: undefined,
      };
    }

    const data = userDoc.data() as FirestoreUserDoc;
    const gillerInfo = data.gillerInfo ?? {};
    return {
      name: data.name ?? 'giller',
      rating: data.rating ?? 3.5,
      totalDeliveries: gillerInfo.totalDeliveries ?? 0,
      completedDeliveries: gillerInfo.completedDeliveries ?? gillerInfo.totalDeliveries ?? 0,
      profileImage: data.profilePhoto ?? data.profileImage ?? undefined,
    };
  } catch (error) {
    console.error('Error fetching user info:', error);
    return {
      name: 'giller',
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
      profileImage: undefined,
    };
  }
}

/**
 * Convert Firestore request to DeliveryRequest format
 * @param requestDoc Firestore request document
 * @returns DeliveryRequest object
 */
export function convertToDeliveryRequest(requestDoc: FirestoreMatchingRequestDoc): EngineDeliveryRequest {
  const departureTime = requestDoc.preferredTime?.departureTime ?? '08:00';
  const today = new Date().getDay();
  const dayOfWeek = today === 0 ? 'sun' : today === 1 ? 'mon' : today === 2 ? 'tue' : today === 3 ? 'wed' : today === 4 ? 'thu' : today === 5 ? 'fri' : 'sat';

  return {
    pickupStation: requestDoc.pickupStation?.stationName ?? '',
    deliveryStation: requestDoc.deliveryStation?.stationName ?? '',
    dayOfWeek,
    time: departureTime,
  };
}

/**
 * Find matching gillers for a delivery request
 * @param requestId Request ID
 * @param topN Number of top matches to return (default: 5)
 * @returns Array of matching results
 */
export async function findMatchesForRequest(
  requestId: string,
  topN: number = 5
): Promise<MatchingResult[]> {
  try {
    // 1. Fetch request
    const requestDoc = await getDoc(doc(db, 'requests', requestId));

    if (!requestDoc.exists()) {
      throw new Error('Request not found');
    }

    const requestData = { id: requestDoc.id, ...(requestDoc.data() as FirestoreMatchingRequestDoc) };
    const request = convertToDeliveryRequest(requestData);

    // 2. Fetch active giller routes
    const gillerRoutes = await fetchActiveGillerRoutes();

    // 3. Filter by day of week
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
    const dayOfWeek = today === 0 ? 7 : today; // Convert to 1-7 (Mon-Sun)

    const availableGillers = gillerRoutes.filter((giller) =>
      giller.daysOfWeek.includes(dayOfWeek)
    );

    // 4. Find matches (major station engine first)
    const matches = runMatchingEngine(request, availableGillers).slice(0, topN);
    if (matches.length > 0) {
      return matches;
    }

    // 5. Fallback: route heuristic (works even for stations outside major station dataset)
    console.warn(`????????Matching engine returned 0 for request ${requestId}. Falling back to route heuristic.`);
    return await findMatchesByRouteHeuristic(requestData, topN);
  } catch (error) {
    console.error('Error finding matches:', error);
    // Engine exception fallback: request/route based heuristic
    try {
      const requestDoc = await getDoc(doc(db, 'requests', requestId));
      if (!requestDoc.exists()) {
        return [];
      }
      return await findMatchesByRouteHeuristic({ id: requestDoc.id, ...(requestDoc.data() as FirestoreMatchingRequestDoc) }, topN);
    } catch (fallbackError) {
      console.error('Error in fallback matching:', fallbackError);
      throw error;
    }
  }
}

/**
 * Create match document in Firestore
 * @param requestId Request ID
 * @param gillerId Giller (courier) ID
 * @param matchScore Matching score
 * @returns Created match document ID
 */
export async function createMatchDocument(
  requestId: string,
  gillerId: string,
  matchScore: MatchingResult,
  requesterId: string = ''
): Promise<string> {
  try {
    const matchData = {
      requestId,
      requesterId,
      gllerId: requesterId,
      gillerId, // 매칭 대상 길러 ID
      matchScore: matchScore.totalScore,
      matchingDetails: {
        routeScore: matchScore.scores.pickupMatchScore + matchScore.scores.deliveryMatchScore,
        timeScore: matchScore.scores.departureTimeMatchScore + matchScore.scores.scheduleFlexibilityScore,
        ratingScore: matchScore.scores.ratingRawScore,
        responseTimeScore: matchScore.scores.completionRateRawScore,
        calculatedAt: new Date(),
      },
      notifiedAt: new Date(),
      status: 'pending',
      createdAt: new Date(),
    };

    const docRef = await addDoc(collection(db, 'matches'), matchData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating match document:', error);
    throw error;
  }
}

/**
 * Process matching for a new delivery request
 * This should be called when a new request is created
 * @param requestId Request ID
 * @returns Number of matches created
 */
export async function processMatchingForRequest(
  requestId: string
): Promise<number> {
  try {
    // 1. 상위 3명의 매칭 후보를 찾습니다.
    const matches = await findMatchesForRequest(requestId, 3);

    if (matches.length === 0) {
      console.warn('No matches found for request', requestId);
      return 0;
    }

    // 2. 요청 문서에서 requesterId를 읽어옵니다.
    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);
    const request = requestDoc.data() as FirestoreMatchingRequestDoc | undefined;
    const requesterId = request?.requesterId ?? '';

    // 3. Create match documents for each
    const matchPromises = matches.map((match) =>
      createMatchDocument(requestId, match.gillerId, match, requesterId)
    );

    await Promise.all(matchPromises);

    if (request) {
      if (request.status === 'pending') {
        await updateDoc(requestRef, {
          status: 'matched',
          matchedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const notificationPromises = matches.map((match) =>
        sendMatchFoundNotification(
          match.gillerId,
          requestId,
          request.pickupStation?.stationName ?? '',
          request.deliveryStation?.stationName ?? '',
          request.fee?.totalFee ?? 0
        )
      );

      await Promise.all(notificationPromises);
      console.warn(`Sent ${matches.length} notifications`);
    }

    console.warn(`Created ${matches.length} matches for request ${requestId}`);

    return matches.length;
  } catch (error) {
    console.error('Error processing matching:', error);
    throw error;
  }
}

/**
 * Get matching results for UI display
 * @param requestId Request ID
 * @returns Formatted matching results
 */
export async function getMatchingResults(requestId: string) {
  const matches = await findMatchesForRequest(requestId, 10);

  // Fetch request to get fee information
  const requestDoc = await getDoc(doc(db, 'requests', requestId));
  const requestData = requestDoc.data() as FirestoreMatchingRequestDoc | undefined;
  const baseFee = requestData?.fee?.totalFee ?? 3000;

  return await Promise.all(
    matches.map(async (match, index) => {
      // Fetch user info for rating and completed deliveries
      const userInfo = await fetchUserInfo(match.gillerId);

      return {
        rank: index + 1,
        gillerId: match.gillerId,
        gillerName: match.gillerName,
        score: match.totalScore,
        routeMatchScore: match.routeMatchScore,
        timeMatchScore: match.timeMatchScore,
        ratingScore: match.ratingScore,
        completionRateScore: match.completionRateScore,
        travelTime: Math.round(match.routeDetails.travelTime / 60),
        hasExpress: match.routeDetails.isExpressAvailable,
        transferCount: match.routeDetails.transferCount,
        congestion: match.routeDetails.congestionLevel,
        reasons: match.reasons,
        rating: userInfo.rating,
        completedDeliveries: userInfo.completedDeliveries,
        estimatedFee: Math.round(baseFee * (1 + (index * 0.1))), // Slightly higher fee for lower ranked matches
        profileImage: userInfo.profileImage ?? undefined,
      };
    })
  );
}

/**
 * Giller accepts a delivery request
 * @param requestId Request ID
 * @param gillerId Giller ID who is accepting
 * @returns Success status and deliveryId
 */
export async function acceptRequest(
  requestId: string,
  gillerId: string
): Promise<{ success: boolean; message: string; deliveryId?: string }> {
  try {
    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      return { success: false, message: '요청을 찾을 수 없습니다.' };
    }

    const request = requestDoc.data() as FirestoreMatchingRequestDoc;
    const requesterId = request.requesterId ?? '';

    if (request.status !== 'matched' && request.status !== 'pending') {
      return { success: false, message: '현재 처리할 수 없는 요청입니다.' };
    }

    const result = await gillerAcceptRequest(requestId, gillerId);

    if (result.success && result.deliveryId) {
      const existingChatRoom = await getChatRoomByRequestId(requestId);

      if (!existingChatRoom) {
        const chatService = createChatService();

        if (!requesterId) {
          return { success: false, message: 'requester id is missing' };
        }

        const gllerDoc = await getDoc(doc(db, 'users', requesterId));
        const gllerData = (gllerDoc.data() as FirestoreUserDoc | undefined) ?? {};

        const gillerDoc = await getDoc(doc(db, 'users', gillerId));
        const gillerData = (gillerDoc.data() as FirestoreUserDoc | undefined) ?? {};

        await chatService.createChatRoom({
          user1: {
            userId: requesterId,
            name: gllerData.name ?? 'requester',
            profileImage: gllerData?.profileImage,
          },
          user2: {
            userId: gillerId,
            name: gillerData.name ?? 'giller',
            profileImage: gillerData?.profileImage,
          },
          requestId,
          matchId: result.deliveryId,
        });

        const newChatRoom = await getChatRoomByRequestId(requestId);

        if (newChatRoom) {
          await chatService.sendSystemMessage(
            newChatRoom.chatRoomId,
            'match_accepted',
            '배송 매칭이 완료되었습니다. 대화를 시작해 주세요.',
            { requestId, matchId: result.deliveryId }
          );
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error accepting request:', error);
    return { success: false, message: '요청 수락에 실패했습니다.' };
  }
}

/**
 * Giller declines a delivery request
 * @param requestId Request ID
 * @param gillerId Giller ID who is declining
 * @returns Success status
 */
export async function declineRequest(
  requestId: string,
  gillerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const matchQuery = query(
      collection(db, 'matches'),
      where('requestId', '==', requestId),
      where('gillerId', '==', gillerId)
    );

    const matchSnapshot = await getDocs(matchQuery);

    if (matchSnapshot.empty) {
      return { success: false, message: '매칭 정보를 찾을 수 없습니다.' };
    }

    matchSnapshot.forEach(async (matchDoc) => {
      await updateDoc(doc(db, 'matches', matchDoc.id), {
        status: 'declined',
        declinedAt: new Date(),
      });
    });

    return { success: true, message: '요청을 거절했습니다.' };
  } catch (error) {
    console.error('Error declining request:', error);
    return { success: false, message: '요청 거절에 실패했습니다.' };
  }
}

/**
 * Find a single best giller for a request (for UI display)
 * @param requestId Request ID
 * @returns Giller info or error
 */
export async function findGiller(requestId: string): Promise<{
  success: boolean;
  data?: {
    giller: {
      id: string;
      name: string;
      profileImage?: string;
      rating: number;
      completedDeliveries: number;
      estimatedTime?: number;
      fee?: number;
    };
    rank?: number; // 추천 결과 내 순위
  };
  error?: string;
}> {
  try {
    const matches = await getMatchingResults(requestId);

    if (matches.length === 0) {
      return { success: false, error: '현재 조건에 맞는 길러를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }

    // Return the best match (first in array is highest ranked)
    const bestMatch = matches[0];

    // Calculate estimated time based on route match score
    // Higher score = better route match = less time
    const baseTime = 20; // 20 minutes base time
    const estimatedTime = baseTime - Math.round((bestMatch.routeMatchScore / 100) * 10);

    return {
      success: true,
      data: {
        giller: {
          id: bestMatch.gillerId,
          name: bestMatch.gillerName,
          rating: bestMatch.rating,
          completedDeliveries: bestMatch.completedDeliveries,
          estimatedTime,
          fee: bestMatch.estimatedFee,
          profileImage: bestMatch.profileImage,
        },
        rank: bestMatch.rank, // 추천 결과 내 순위
      },
    };
  } catch (error: unknown) {
    console.error('Error finding giller:', error);
    return { success: false, error: getErrorMessage(error, '길러를 찾는 중 오류가 발생했습니다.') };
  }
}

/**
 * Accept a match (giller accepts request)
 * @param requestId Request ID
 * @param gillerId Giller ID
 * @returns Success status
 */
export async function acceptMatch(
  requestId: string,
  gillerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await acceptRequest(requestId, gillerId);
    return { success: result.success, error: result.success ? undefined : result.message };
  } catch (error: unknown) {
    console.error('Error accepting match:', error);
    return { success: false, error: getErrorMessage(error, '길러를 찾는 중 오류가 발생했습니다.') };
  }
}

/**
 * Reject a match (giller declines request)
 * @param requestId Request ID
 * @param gillerId Giller ID
 * @returns Success status
 */
export async function rejectMatch(
  requestId: string,
  gillerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await declineRequest(requestId, gillerId);
    return { success: result.success, error: result.success ? undefined : result.message };
  } catch (error: unknown) {
    console.error('Error rejecting match:', error);
    return { success: false, error: getErrorMessage(error, '길러를 찾는 중 오류가 발생했습니다.') };
  }
}

// ===== 등록된 동선을 기준으로 요청을 필터링하는 보조 로직 =====

/**
 * 길러가 등록한 동선을 기준으로 요청을 필터링합니다.
 * @param requests 필터링 대상 요청 목록
 * @param gillerId 길러 ID
 * @returns 동선과 일정이 맞는 요청 목록
 */
export async function filterRequestsByGillerRoutes(
  requests: RouteMatchableRequest[],
  gillerId: string
): Promise<RouteFilteredRequest[]> {
  try {
    // 1. 길러의 활성 동선을 조회합니다.
    const gillerRoutes = await getUserActiveRoutes(gillerId);

    if (gillerRoutes.length === 0) {
      console.warn('[filterRequestsByGillerRoutes] no active routes');
      return [];
    }

    // 2. 오늘 요일을 계산합니다.
    const today = new Date().getDay();
    const dayOfWeek = today === 0 ? 7 : today; // 1(월) - 7(일)

    // 3. 오늘 운행 동선이 있으면 우선 사용하고, 없으면 전체 활성 동선을 사용합니다.
    const todayRoutes = gillerRoutes.filter(route =>
      route.daysOfWeek.includes(dayOfWeek)
    );
    const routesToMatch = todayRoutes.length > 0 ? todayRoutes : gillerRoutes;
    console.warn(`[filterRequestsByGillerRoutes] today routes: ${todayRoutes.length}, match targets: ${routesToMatch.length}`);

    // 4. 최소 점수 이상인 요청만 후보로 남깁니다.
    const matchedRequests: RouteFilteredRequest[] = [];
    const MIN_MATCH_SCORE = 10;

    for (const request of requests) {
      const matchResults: { route: Route; score: RouteMatchScore }[] = [];

      for (const route of routesToMatch) {
        const score = calculateRouteMatchScore(request, route);
        if (score.score >= MIN_MATCH_SCORE) {
          matchResults.push({ route, score });
        }
      }

      if (matchResults.length > 0) {
        // 가장 높은 점수를 가진 동선을 우선 사용합니다.
        matchResults.sort((a, b) => b.score.score - a.score.score);
        const bestMatch = matchResults[0];
        const requestWithFallback = request as RouteMatchableRequest & Partial<RouteFilteredRequest>;

        matchedRequests.push({
          ...requestWithFallback,
          requestId: requestWithFallback.requestId ?? '',
          requesterId: requestWithFallback.requesterId ?? requestWithFallback.gllerId ?? '',
          gllerId: requestWithFallback.requesterId ?? requestWithFallback.gllerId ?? '',
          deliveryType: requestWithFallback.deliveryType ?? 'subway',
          packageInfo: requestWithFallback.packageInfo ?? { size: 'small', weight: 'light', description: '' },
          status: requestWithFallback.status ?? 'pending',
          initialNegotiationFee: requestWithFallback.initialNegotiationFee ?? requestWithFallback.fee?.totalFee ?? 0,
          deadline: requestWithFallback.deadline ?? new Date(),
          createdAt: requestWithFallback.createdAt ?? new Date(),
          updatedAt: requestWithFallback.updatedAt ?? new Date(),
          matchScore: bestMatch.score,
          matchedRouteCount: matchResults.length,
          matchedRoutes: matchResults.map(m => m.route),
        } as RouteFilteredRequest);
      }
    }

    // 5. 매칭 점수 기준으로 정렬합니다.
    matchedRequests.sort((a, b) => b.matchScore.score - a.matchScore.score);
    console.warn(`[filterRequestsByGillerRoutes] matched requests: ${matchedRequests.length}`);

    return matchedRequests;
  } catch (error) {
    console.error('Error filtering requests by giller routes:', error);
    return [];
  }
}

/**
 * 요청과 길러 동선의 일치도를 계산합니다.
 * @param request 요청 정보
 * @param route 길러 동선
 * @returns 매칭 점수(0~100)
 */
export function calculateRouteMatchScore(
  request: RouteScoreRequest,
  route: Route
): RouteMatchScore {
  let score = 0;

  // 역 이름 비교를 위한 정규화 함수
  const normalizeStationName = (name: string) =>
    (name ?? '').replace(/\?/g, '').trim().toLowerCase();

  const stationNamesMatch = (name1: string, name2: string): boolean => {
    const n1 = normalizeStationName(name1);
    const n2 = normalizeStationName(name2);
    return n1 === n2 || n1.includes(n2) ?? n2.includes(n1);
  };

  // 세부 점수 기록
  const details = {
    pickupStationScore: 0,
    deliveryStationScore: 0,
    dayOfWeekScore: 0,
    timeScore: 0,
    directionBonus: 0,
  };

  // 1. 출발역 일치: +30점
  const pickupMatch = stationNamesMatch(
    route.startStation?.stationName ?? '',
    request.pickupStation?.stationName ?? ''
  );
  if (pickupMatch) {
    details.pickupStationScore = 30;
    score += 30;
  }

  // 2. 도착역 일치: +30점
  const deliveryMatch = stationNamesMatch(
    route.endStation?.stationName ?? '',
    request.deliveryStation?.stationName ?? ''
  );
  if (deliveryMatch) {
    details.deliveryStationScore = 30;
    score += 30;
  }

  // 3. 요일 일치: +10점
  const today = new Date().getDay();
  const dayOfWeek = today === 0 ? 7 : today;
  const dayMatch = route.daysOfWeek.includes(dayOfWeek);
  if (dayMatch) {
    details.dayOfWeekScore = 10;
    score += 10;
  }

  // 4. 출발 시간 근접도 보너스(최대 15점)
  const requestTime = request.preferredTime?.departureTime ?? '08:00';
  const [requestHour, requestMinute] = requestTime.split(':').map(Number);
  const [routeHour, routeMinute] = (route.departureTime ?? '08:00').split(':').map(Number);

  const requestMinutes = requestHour * 60 + requestMinute;
  const routeMinutes = routeHour * 60 + routeMinute;
  const timeDiff = Math.abs(requestMinutes - routeMinutes);

  let timeMatch = 0;
  if (timeDiff <= 30) {
    timeMatch = Math.round(15 * (1 - timeDiff / 30)); // 30분 이내일 때만 가산
    details.timeScore = timeMatch;
    score += timeMatch;
  }

  // 5. 전체 방향 일치 보너스
  let routeDirection: 'exact' | 'partial' | 'reverse' = 'partial';
  if (pickupMatch && deliveryMatch) {
    routeDirection = 'exact';
    details.directionBonus = 15;
    score += 15;
  } else if (pickupMatch ?? deliveryMatch) {
    routeDirection = 'partial';
    details.directionBonus = 5;
    score += 5;
  } else {
    routeDirection = 'reverse';
    // 역방향이면 감점
    score -= 10;
  }

  return {
    score: Math.max(0, Math.min(score, 100)), // 0~100 범위로 보정
    pickupMatch,
    deliveryMatch,
    timeMatch,
    dayMatch,
    routeDirection,
    matchedRouteId: route.routeId,
    matchedRoute: route,
    details,
  };
}

/**
 * 현재 위치를 기준으로 요청을 필터링합니다.
 * @param requests 필터링 대상 요청 목록
 * @param currentLocation 현재 위치
 * @param radiusKm 검색 반경(km, 기본값 30)
 * @returns 반경 내 요청 목록
 */
export function filterRequestsByLocation(
  requests: FilterRequestBase[],
  currentLocation: LocationData,
  radiusKm: number = 30
): LocationFilteredRequest[] {
  try {
    const getLat = (station: FilterStation): number => station.lat ?? station.latitude ?? 0;
    const getLng = (station: FilterStation): number => station.lng ?? station.longitude ?? 0;

    const radiusMeters = radiusKm * 1000;
    const filteredRequests: LocationFilteredRequest[] = [];

    for (const request of requests) {
      // 현재 위치와 출발/도착역 거리 계산
      const pickupDist = locationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        getLat(request.pickupStation),
        getLng(request.pickupStation)
      );

      const deliveryDist = locationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        getLat(request.deliveryStation),
        getLng(request.deliveryStation)
      );

      const minDistance = Math.min(pickupDist, deliveryDist);

      // 반경 안에 들어오면 후보에 포함
      if (minDistance <= radiusMeters) {
        const nearestStation = pickupDist < deliveryDist
          ? request.pickupStation.stationName
          : request.deliveryStation.stationName;

        // 평균 40km/h 기준 예상 이동 시간
        const estimatedTimeMinutes = Math.round(minDistance / 1000 / 40 * 60);

        filteredRequests.push({
          ...request,
          metadata: {
            distanceFromCurrent: Math.round(minDistance),
            nearestStation,
            estimatedTimeMinutes,
          },
        } as LocationFilteredRequest);
      }
    }

    // 가까운 순서로 정렬
    filteredRequests.sort((a, b) =>
      a.metadata.distanceFromCurrent - b.metadata.distanceFromCurrent
    );

    // 거리 순위를 기록
    filteredRequests.forEach((req, index) => {
      req.metadata.distanceRank = index + 1;
    });

    return filteredRequests;
  } catch (error) {
    console.error('Error filtering requests by location:', error);
    return [];
  }
}

/**
 * ???????곷♧????????????????????????
 * @param gillerId ???????곷♧??????ID
 * @returns ???????곷♧????????????????븐뼐??????????
 */
export async function fetchGillerStats(
  gillerId: string
): Promise<GillerMatchingStats> {
  try {
    const userDoc = await getDoc(doc(db, 'users', gillerId));

    if (!userDoc.exists()) {
      return {
        gillerId,
        gillerName: 'giller',
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
        completionRate: 0,
        averageResponseTime: 30,
      };
    }

    const data = userDoc.data() as FirestoreUserDoc;
    const stats = data.stats ?? data.gillerInfo ?? {};
    const ratingValue = 'rating' in stats ? Number(stats.rating ?? data.rating ?? 3.5) : (data.rating ?? 3.5);
    const averageResponseTime =
      'averageResponseTime' in stats ? Number(stats.averageResponseTime ?? 30) : 30;

    const totalDeliveries = stats.totalDeliveries ?? stats.completedDeliveries ?? 0;
    const completedDeliveries = stats.completedDeliveries ?? totalDeliveries;
    const completionRate = totalDeliveries > 0
      ? (completedDeliveries / totalDeliveries) * 100
      : 0;

    return {
      gillerId,
      gillerName: data.name ?? 'giller',
      rating: ratingValue,
      totalDeliveries,
      completedDeliveries,
      completionRate: Math.round(completionRate),
      averageResponseTime,
      professionalLevel: data.professionalLevel ?? 'regular',
      badgeBonus: data.badgeBonus ?? 0,
    };
  } catch (error) {
    console.error('Error fetching giller stats:', error);
    return {
      gillerId,
      gillerName: 'giller',
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
      completionRate: 0,
      averageResponseTime: 30,
    };
  }
}

/**
 * 매칭 필터 옵션을 요청 목록에 적용합니다.
 * @param requests 필터링 대상 요청 목록
 * @param filters 필터 옵션
 * @returns 필터링된 요청 목록
 */
export function applyMatchingFilters<T extends LocationFilteredRequest | RouteFilteredRequest>(
  requests: T[],
  filters: MatchingFilterOptions
): T[] {
  let filtered = [...requests];

  // 노선 필터
  if (filters.lineFilter && !filters.lineFilter.showAllLines && filters.lineFilter.selectedLines.length > 0) {
    filtered = filtered.filter((request) => {
      const pickupLine = request.pickupStation.line;
      const deliveryLine = request.deliveryStation.line;
      return filters.lineFilter!.selectedLines.some(line =>
        pickupLine?.includes(line) ?? deliveryLine?.includes(line)
      );
    });
  }

  // 지역 필터
  if (filters.regionFilter && !filters.regionFilter.showAllRegions && filters.regionFilter.selectedRegions.length > 0) {
    filtered = filtered.filter((request) => {
      const pickupRegion = (request.pickupStation as FilterStation).region;
      const deliveryRegion = (request.deliveryStation as FilterStation).region;
      return filters.regionFilter!.selectedRegions.includes(pickupRegion ?? deliveryRegion ?? '');
    });
  }

  // 최소 매칭 점수 필터
  if (filters.minMatchScore) {
    filtered = filtered.filter((request) => {
      if (!('matchScore' in request)) return true;
      return (request.matchScore?.score ?? 0) >= filters.minMatchScore!;
    });
  }

  // 최대 거리 필터
  if (filters.maxDistance) {
    filtered = filtered.filter((request) => {
      if (!('metadata' in request)) return true;
      return (request.metadata?.distanceFromCurrent ?? Number.MAX_SAFE_INTEGER) <= filters.maxDistance!;
    });
  }

  // 예상 요금 필터
  if (filters.minFee) {
    filtered = filtered.filter((request) =>
      request.fee?.totalFee >= filters.minFee!
    );
  }

  if (filters.maxFee) {
    filtered = filtered.filter((request) =>
      request.fee?.totalFee <= filters.maxFee!
    );
  }

  return filtered;
}

/** Firestore 역 데이터의 좌표 필드를 정규화합니다. */
function normalizeStation<T extends FilterStation>(station: T | undefined): T | undefined {
  if (!station) return station;

  const lat = station.lat ?? station.latitude ?? station.location?.latitude ?? 0;
  const lng = station.lng ?? station.longitude ?? station.location?.longitude ?? 0;

  return {
    ...station,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
  };
}

/**
 * 현재 대기 중인 요청 목록을 가져옵니다.
 * @returns 길러에게 노출할 대기 요청 목록
 */
export async function getPendingGillerRequests(): Promise<FilterRequestBase[]> {
  try {
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    const requests: FilterRequestBase[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as FirestorePendingRequestDoc;

      const fee = data.fee ?? data.feeBreakdown ?? {
        totalFee: 0,
        baseFee: 0,
        distanceFee: 0,
        weightFee: 0,
        sizeFee: 0,
        serviceFee: 0,
        vat: 0,
      };

      const recipientName = data.requesterName ?? data.senderName ?? 'requester';

      // 이미 매칭된 요청은 제외
      if (data.matchedGillerId) {
        return;
      }

      requests.push({
        requestId: doc.id,
        ...data,
        fee,
        recipientName,
        // 좌표 정보 정규화
        pickupStation: normalizeStation(data.pickupStation) as FilterStation,
        deliveryStation: normalizeStation(data.deliveryStation) as FilterStation,
      });
    });

    return requests;
  } catch (error) {
    console.error('Error fetching pending giller requests:', error);
    return [];
  }
}
