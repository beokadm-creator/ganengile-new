// @ts-nocheck - Temporarily suppress TypeScript errors for rapid development
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
  getTopMatches,
  type GillerRoute,
  type DeliveryRequest,
  type MatchingResult,
} from '../../data/matching-engine';
import { getStationByName } from '../../data/subway-stations';
import {
  sendMatchFoundNotification,
} from './matching-notification';
import { createChatService, getChatRoomByRequestId } from './chat-service';
import { MessageType } from '../types/chat';
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
import type { Route, StationInfo } from '../types/route';

function normalizeStationName(name?: string): string {
  return (name || '').replace(/\s+/g, '').replace(/역$/, '').toLowerCase();
}

function namesLooselyEqual(a?: string, b?: string): boolean {
  const na = normalizeStationName(a);
  const nb = normalizeStationName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function normalizeRouteForMatching(routeData: any, routeId: string): Route | null {
  if (!routeData?.userId || !routeData?.startStation || !routeData?.endStation) {
    return null;
  }

  const startStation = {
    stationId: routeData.startStation.stationId || routeData.startStation.id,
    stationName: routeData.startStation.stationName || '',
    line: routeData.startStation.line || routeData.startStation.lineName || '',
    lat: routeData.startStation.lat ?? routeData.startStation.latitude ?? 0,
    lng: routeData.startStation.lng ?? routeData.startStation.longitude ?? 0,
  };

  const endStation = {
    stationId: routeData.endStation.stationId || routeData.endStation.id,
    stationName: routeData.endStation.stationName || '',
    line: routeData.endStation.line || routeData.endStation.lineName || '',
    lat: routeData.endStation.lat ?? routeData.endStation.latitude ?? 0,
    lng: routeData.endStation.lng ?? routeData.endStation.longitude ?? 0,
  };

  if (!startStation.stationName || !endStation.stationName) {
    return null;
  }

  return {
    routeId,
    userId: routeData.userId,
    startStation,
    endStation,
    departureTime: routeData.departureTime || '08:00',
    daysOfWeek: Array.isArray(routeData.daysOfWeek) && routeData.daysOfWeek.length > 0
      ? routeData.daysOfWeek
      : [1, 2, 3, 4, 5, 6, 7],
    isActive: routeData.isActive !== false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Route;
}

async function findMatchesByRouteHeuristic(requestData: any, topN: number): Promise<MatchingResult[]> {
  const snapshot = await getDocs(query(collection(db, 'routes'), where('isActive', '==', true)));
  const today = new Date().getDay();
  const dayOfWeek = today === 0 ? 7 : today;
  const requestPickup = requestData?.pickupStation?.stationName || '';
  const requestDelivery = requestData?.deliveryStation?.stationName || '';

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
    const adjustedScore = routeScore.score + (isTodayRoute ? 10 : 0) + ((loosePickup || looseDelivery) ? 5 : 0);

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
        gillerName: item.userInfo.name || '길러',
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
          item.routeScore.pickupMatch ? '픽업 역이 동선과 일치합니다.' : '픽업 역 인접 동선입니다.',
          item.routeScore.deliveryMatch ? '도착 역이 동선과 일치합니다.' : '도착 역 인접 동선입니다.',
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

    const user = userDoc.data();
    const badgeTier = BadgeService.calculateBadgeTier(user.badges);

    // 배지 보너스 로직
    // Bronze (3개): 요금 5% 보너스
    // Silver (5개): 요금 10% 보너스
    // Gold (7개): 요금 15% 보너스 + 우선순위
    // Platinum (10개): 요금 20% 보너스 + 높은 우선순위
    const bonusConfig = {
      bronze: { feeBonus: 0.05, priorityBoost: 0 },
      silver: { feeBonus: 0.10, priorityBoost: 0 },
      gold: { feeBonus: 0.15, priorityBoost: 10 },
      platinum: { feeBonus: 0.20, priorityBoost: 20 },
      none: { feeBonus: 0, priorityBoost: 0 },
    };

    const tier = badgeTier.tier || 'none';
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

    const data = userDoc.data();
    const stats = data.stats || {};

    return {
      rating: stats.rating || data.rating || 3.5,
      totalDeliveries: stats.completedDeliveries || data.gillerInfo?.totalDeliveries || 0,
      completedDeliveries: stats.completedDeliveries || data.gillerInfo?.totalDeliveries || 0,
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
export async function fetchActiveGillerRoutes(): Promise<GillerRoute[]> {
  try {
    const q = query(
      collection(db, 'routes'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const routes: GillerRoute[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      // Convert Firestore data to GillerRoute format
      const startStation = getStationByName(data.startStation.stationName);
      const endStation = getStationByName(data.endStation.stationName);

      if (!startStation || !endStation) {
        console.warn(`Station not found for route ${docSnapshot.id}`);
        return;
      }

      // Fetch user stats from users collection (using defaults for now)
      const userStats = {
        rating: data.rating || 4.5,
        totalDeliveries: data.totalDeliveries || 0,
        completedDeliveries: data.completedDeliveries || 0,
      };

      // Calculate badge bonus (using default for now)
      const badgeBonus = {
        feeBonus: 0,
        currentTier: 'none' as const,
      };

      routes.push({
        gillerId: data.userId,
        gillerName: data.gillerName || '익명',
        startStation,
        endStation,
        departureTime: data.departureTime,
        daysOfWeek: data.daysOfWeek,
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
        name: '익명',
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
        profileImage: undefined,
      };
    }

    const data = userDoc.data();
    return {
      name: data.name || '익명',
      rating: data.rating || 3.5,
      totalDeliveries: data.gillerInfo?.totalDeliveries || 0,
      completedDeliveries: data.gillerInfo?.totalDeliveries || 0, // Assuming completed = total for now
      profileImage: data.profilePhoto || data.profileImage || undefined,
    };
  } catch (error) {
    console.error('Error fetching user info:', error);
    return {
      name: '익명',
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
export function convertToDeliveryRequest(requestDoc: any): DeliveryRequest {
  // preferredTime에서 departureTime 추출, 없으면 기본값 사용
  const departureTime = requestDoc.preferredTime?.departureTime || '08:00';
  const arrivalTime = requestDoc.preferredTime?.arrivalTime || '09:00';

  // deadline에서 배송 마감 시간 추출
  const deadlineTime = requestDoc.deadline
    ? new Date(requestDoc.deadline.toDate?.() || requestDoc.deadline)
    : new Date();

  return {
    requestId: requestDoc.id,
    pickupStationName: requestDoc.pickupStation.stationName,
    deliveryStationName: requestDoc.deliveryStation.stationName,
    pickupStartTime: departureTime,
    pickupEndTime: arrivalTime,
    deliveryDeadline: deadlineTime.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    preferredDays: [1, 2, 3, 4, 5], // 평일 기본값 (필요시 우선순위 필드 추가)
    packageSize: requestDoc.packageInfo.size,
    packageWeight: requestDoc.packageInfo.weight === 'light' ? 1 :
                   requestDoc.packageInfo.weight === 'medium' ? 3 : 7,
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

    const requestData = requestDoc.data();
    const request = convertToDeliveryRequest(requestData);

    // 2. Fetch active giller routes
    const gillerRoutes = await fetchActiveGillerRoutes();

    // 3. Filter by day of week
    // TODO: Get current day of week
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
    const dayOfWeek = today === 0 ? 7 : today; // Convert to 1-7 (Mon-Sun)

    const availableGillers = gillerRoutes.filter((giller) =>
      giller.daysOfWeek.includes(dayOfWeek)
    );

    // 4. Find matches (major station engine first)
    const matches = matchGillersToRequest(availableGillers, request).slice(0, topN);
    if (matches.length > 0) {
      return matches;
    }

    // 5. Fallback: route heuristic (works even for stations outside major station dataset)
    console.warn(`⚠️ Matching engine returned 0 for request ${requestId}. Falling back to route heuristic.`);
    return await findMatchesByRouteHeuristic(requestData, topN);
  } catch (error) {
    console.error('Error finding matches:', error);
    // Engine exception fallback: request/route based heuristic
    try {
      const requestDoc = await getDoc(doc(db, 'requests', requestId));
      if (!requestDoc.exists()) {
        return [];
      }
      return await findMatchesByRouteHeuristic(requestDoc.data(), topN);
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
  gllerId: string = ''
): Promise<string> {
  try {
    const matchData = {
      requestId,
      gllerId,   // 요청자(이용자) ID
      gillerId,  // 배송자 ID
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
    // 1. Find top 3 matches (상위 3명 길러)
    const matches = await findMatchesForRequest(requestId, 3);

    if (matches.length === 0) {
      console.log('No matches found for request', requestId);
      return 0;
    }

    // 2. 요청 문서에서 requesterId(이용자 ID) 조회
    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);
    const request = requestDoc.data();
    const requesterId = request?.requesterId || '';

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
          request.pickupStation.stationName,
          request.deliveryStation.stationName,
          request.fee.totalFee
        )
      );

      await Promise.all(notificationPromises);
      console.log(`📤 Sent ${matches.length} notifications`);
    }

    console.log(`✅ Created ${matches.length} matches for request ${requestId}`);

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
  const requestData = requestDoc.data();
  const baseFee = requestData?.fee?.totalFee || 3000;

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
        profileImage: userInfo.profileImage || undefined,
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

    const request = requestDoc.data();

    if (request.status !== 'matched' && request.status !== 'pending') {
      return { success: false, message: '이미 매칭된 요청입니다.' };
    }

    const result = await gillerAcceptRequest(requestId, gillerId);

    if (result.success && result.deliveryId) {
      const existingChatRoom = await getChatRoomByRequestId(requestId);

      if (!existingChatRoom) {
        const chatService = createChatService();

        const gllerDoc = await getDoc(doc(db, 'users', request.requesterId));
        const gllerData = gllerDoc.data();

        const gillerDoc = await getDoc(doc(db, 'users', gillerId));
        const gillerData = gillerDoc.data();

        await chatService.createChatRoom({
          user1: {
            userId: request.requesterId,
            name: gllerData?.name || '이용자',
            profileImage: gllerData?.profileImage,
          },
          user2: {
            userId: gillerId,
            name: gillerData?.name || '길러',
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
            '✅ 배송이 매칭되었습니다. 채팅을 시작하세요!',
            { requestId, matchId: result.deliveryId }
          );
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error accepting request:', error);
    return { success: false, message: '수락에 실패했습니다.' };
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
    return { success: false, message: '거절에 실패했습니다.' };
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
    rank?: number; // 순위 추가
  };
  error?: string;
}> {
  try {
    const matches = await getMatchingResults(requestId);

    if (matches.length === 0) {
      return { success: false, error: '매칭 가능한 기일러를 찾을 수 없습니다.' };
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
        rank: bestMatch.rank, // 순위 추가
      },
    };
  } catch (error: any) {
    console.error('Error finding giller:', error);
    return { success: false, error: error.message || '기일러 찾기에 실패했습니다.' };
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
  } catch (error: any) {
    console.error('Error accepting match:', error);
    return { success: false, error: error.message || '매칭 수락에 실패했습니다.' };
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
  } catch (error: any) {
    console.error('Error rejecting match:', error);
    return { success: false, error: error.message || '매칭 거절에 실패했습니다.' };
  }
}

// ===== 길러 배송 매칭 시스템 개선 =====

/**
 * 동선 기반 요청 필터링
 * @param requests 전체 배송 요청 목록
 * @param gillerId 길러 ID
 * @returns 동선이 일치하는 요청 목록과 매칭 점수
 */
export async function filterRequestsByGillerRoutes(
  requests: any[],
  gillerId: string
): Promise<RouteFilteredRequest[]> {
  try {
    // 1. 길러의 활성 동선 조회
    const gillerRoutes = await getUserActiveRoutes(gillerId);

    if (gillerRoutes.length === 0) {
      console.log('[filterRequestsByGillerRoutes] 등록된 동선 없음');
      return [];
    }

    // 2. 오늘 요일 계산
    const today = new Date().getDay();
    const dayOfWeek = today === 0 ? 7 : today; // 1(월) - 7(일)

    // 3. 오늘 운행 동선 우선 사용, 없으면 전체 활성 동선 사용 (fallback)
    const todayRoutes = gillerRoutes.filter(route =>
      route.daysOfWeek.includes(dayOfWeek)
    );
    const routesToMatch = todayRoutes.length > 0 ? todayRoutes : gillerRoutes;
    console.log(`[filterRequestsByGillerRoutes] 오늘 동선: ${todayRoutes.length}개, 매칭 대상: ${routesToMatch.length}개`);

    // 4. 각 요청에 대해 매칭 점수 계산 (최소 점수 10점으로 대폭 완화)
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
        // 가장 높은 점수 선택
        matchResults.sort((a, b) => b.score.score - a.score.score);
        const bestMatch = matchResults[0];

        matchedRequests.push({
          ...request,
          matchScore: bestMatch.score,
          matchedRouteCount: matchResults.length,
          matchedRoutes: matchResults.map(m => m.route),
        });
      }
    }

    // 5. 매칭 점수 기반 정렬
    matchedRequests.sort((a, b) => b.matchScore.score - a.matchScore.score);
    console.log(`[filterRequestsByGillerRoutes] 매칭된 요청: ${matchedRequests.length}건`);

    return matchedRequests;
  } catch (error) {
    console.error('Error filtering requests by giller routes:', error);
    return [];
  }
}

/**
 * 동선 매칭 점수 계산
 * @param request 배송 요청
 * @param route 길러 동선
 * @returns 매칭 점수 (0-100)
 */
export function calculateRouteMatchScore(
  request: any,
  route: Route
): RouteMatchScore {
  let score = 0;

  // 역이름 유연 비교 ('역' 접미사 무시, 부분 매칭 지원)
  const normalizeStationName = (name: string) =>
    (name || '').replace(/역$/, '').trim().toLowerCase();

  const stationNamesMatch = (name1: string, name2: string): boolean => {
    const n1 = normalizeStationName(name1);
    const n2 = normalizeStationName(name2);
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  };

  // 점수 상세
  const details = {
    pickupStationScore: 0,
    deliveryStationScore: 0,
    dayOfWeekScore: 0,
    timeScore: 0,
    directionBonus: 0,
  };

  // 1. 픽업역 일치: +30점
  const pickupMatch = stationNamesMatch(
    route.startStation?.stationName || '',
    request.pickupStation?.stationName || ''
  );
  if (pickupMatch) {
    details.pickupStationScore = 30;
    score += 30;
  }

  // 2. 배송역 일치: +30점
  const deliveryMatch = stationNamesMatch(
    route.endStation?.stationName || '',
    request.deliveryStation?.stationName || ''
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

  // 4. 시간대 일치 (±30분): +15점
  const requestTime = request.preferredTime?.departureTime || '08:00';
  const [requestHour, requestMinute] = requestTime.split(':').map(Number);
  const [routeHour, routeMinute] = (route.departureTime || '08:00').split(':').map(Number);

  const requestMinutes = requestHour * 60 + requestMinute;
  const routeMinutes = routeHour * 60 + routeMinute;
  const timeDiff = Math.abs(requestMinutes - routeMinutes);

  let timeMatch = 0;
  if (timeDiff <= 30) {
    timeMatch = Math.round(15 * (1 - timeDiff / 30)); // 30분일수록 높은 점수
    details.timeScore = timeMatch;
    score += timeMatch;
  }

  // 5. 방향성 보너스: +15점
  let routeDirection: 'exact' | 'partial' | 'reverse' = 'partial';
  if (pickupMatch && deliveryMatch) {
    routeDirection = 'exact';
    details.directionBonus = 15;
    score += 15;
  } else if (pickupMatch || deliveryMatch) {
    routeDirection = 'partial';
    details.directionBonus = 5;
    score += 5;
  } else {
    routeDirection = 'reverse';
    // 역방향은 감점
    score -= 10;
  }

  return {
    score: Math.max(0, Math.min(score, 100)), // 0~100점 범위
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
 * 위치 기반 요청 필터링
 * @param requests 전체 배송 요청 목록
 * @param currentLocation 현재 위치
 * @param radiusKm 반경 (km, 기본값 30)
 * @returns 위치 기반 필터링된 요청 목록
 */
export async function filterRequestsByLocation(
  requests: any[],
  currentLocation: LocationData,
  radiusKm: number = 30
): Promise<LocationFilteredRequest[]> {
  try {
    const radiusMeters = radiusKm * 1000;
    const filteredRequests: LocationFilteredRequest[] = [];

    for (const request of requests) {
      // 픽업역과 배송역 중 더 가까운 역 찾기
      const pickupDist = locationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        request.pickupStation.lat || request.pickupStation.latitude,
        request.pickupStation.lng || request.pickupStation.longitude
      );

      const deliveryDist = locationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        request.deliveryStation.lat || request.deliveryStation.latitude,
        request.deliveryStation.lng || request.deliveryStation.longitude
      );

      const minDistance = Math.min(pickupDist, deliveryDist);

      // 반경 내에 있는 경우만 포함
      if (minDistance <= radiusMeters) {
        const nearestStation = pickupDist < deliveryDist
          ? request.pickupStation.stationName
          : request.deliveryStation.stationName;

        // 예상 시간 (지하철 평균 속도 40km/h 가정)
        const estimatedTimeMinutes = Math.round(minDistance / 1000 / 40 * 60);

        filteredRequests.push({
          ...request,
          metadata: {
            distanceFromCurrent: Math.round(minDistance),
            nearestStation,
            estimatedTimeMinutes,
          },
        });
      }
    }

    // 거리 기반 정렬
    filteredRequests.sort((a, b) =>
      a.metadata.distanceFromCurrent - b.metadata.distanceFromCurrent
    );

    // 거리 순위 부여
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
 * 길러 통계 조회
 * @param gillerId 길러 ID
 * @returns 길러 통계 정보
 */
export async function fetchGillerStats(
  gillerId: string
): Promise<GillerMatchingStats> {
  try {
    const userDoc = await getDoc(doc(db, 'users', gillerId));

    if (!userDoc.exists()) {
      return {
        gillerId,
        gillerName: '익명',
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
        completionRate: 0,
        averageResponseTime: 30,
      };
    }

    const data = userDoc.data();
    const stats = data.stats || data.gillerInfo || {};

    const totalDeliveries = stats.completedDeliveries || stats.totalDeliveries || 0;
    const completedDeliveries = stats.completedDeliveries || totalDeliveries;
    const completionRate = totalDeliveries > 0
      ? (completedDeliveries / totalDeliveries) * 100
      : 0;

    return {
      gillerId,
      gillerName: data.name || '익명',
      rating: stats.rating || data.rating || 3.5,
      totalDeliveries,
      completedDeliveries,
      completionRate: Math.round(completionRate),
      averageResponseTime: stats.averageResponseTime || 30,
      professionalLevel: data.professionalLevel || 'regular',
      badgeBonus: data.badgeBonus || 0,
    };
  } catch (error) {
    console.error('Error fetching giller stats:', error);
    return {
      gillerId,
      gillerName: '익명',
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
      completionRate: 0,
      averageResponseTime: 30,
    };
  }
}

/**
 * 필터 옵션 적용
 * @param requests 필터링할 요청 목록
 * @param filters 필터 옵션
 * @returns 필터링된 요청 목록
 */
export function applyMatchingFilters<T extends LocationFilteredRequest | RouteFilteredRequest>(
  requests: T[],
  filters: MatchingFilterOptions
): T[] {
  let filtered = [...requests];

  // 호선 필터
  if (filters.lineFilter && !filters.lineFilter.showAllLines && filters.lineFilter.selectedLines.length > 0) {
    filtered = filtered.filter((request: any) => {
      const pickupLine = request.pickupStation.line;
      const deliveryLine = request.deliveryStation.line;
      return filters.lineFilter!.selectedLines.some(line =>
        pickupLine?.includes(line) || deliveryLine?.includes(line)
      );
    });
  }

  // 지역 필터
  if (filters.regionFilter && !filters.regionFilter.showAllRegions && filters.regionFilter.selectedRegions.length > 0) {
    filtered = filtered.filter((request: any) => {
      const pickupRegion = request.pickupStation.region;
      const deliveryRegion = request.deliveryStation.region;
      return filters.regionFilter!.selectedRegions.includes(pickupRegion || deliveryRegion);
    });
  }

  // 최소 매칭 점수 (동선 매칭인 경우)
  if (filters.minMatchScore) {
    filtered = filtered.filter((request: any) =>
      request.matchScore?.score >= filters.minMatchScore!
    );
  }

  // 최대 거리 (위치 매칭인 경우)
  if (filters.maxDistance) {
    filtered = filtered.filter((request: any) =>
      request.metadata?.distanceFromCurrent <= filters.maxDistance!
    );
  }

  // 배송비 필터
  if (filters.minFee) {
    filtered = filtered.filter((request: any) =>
      request.fee?.totalFee >= filters.minFee!
    );
  }

  if (filters.maxFee) {
    filtered = filtered.filter((request: any) =>
      request.fee?.totalFee <= filters.maxFee!
    );
  }

  return filtered;
}

/**
 * 역 정보 정규화 - Firestore 저장 형태와 관계없이 lat/lng 보장
 */
function normalizeStation(station: any): any {
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
 * 대기 중인 배송 요청 조회 (길러용)
 * @returns 대기 중인 요청 목록
 */
export async function getPendingGillerRequests(): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'requests'),
      where('status', 'in', ['pending', 'matched'])
    );

    const snapshot = await getDocs(q);
    const requests: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // fee 필드 정규화: fee가 없으면 feeBreakdown 사용
      const fee = data.fee || data.feeBreakdown || { totalFee: 0, baseFee: 0, distanceFee: 0, weightFee: 0, sizeFee: 0, serviceFee: 0, vat: 0 };

      // 수신자 이름 (채팅 시 필요)
      const recipientName = data.requesterName || data.senderName || '이용자';

      requests.push({
        requestId: doc.id,
        ...data,
        fee,
        recipientName,
        // 역 정보 좌표 정규화
        pickupStation: normalizeStation(data.pickupStation),
        deliveryStation: normalizeStation(data.deliveryStation),
      });
    });

    return requests;
  } catch (error) {
    console.error('Error fetching pending giller requests:', error);
    return [];
  }
}
