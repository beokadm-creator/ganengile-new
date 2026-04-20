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
import { db } from '../firebase';
import { gillerAcceptRequest } from '../delivery-service';
import {
  matchGillersToRequest,
  type DeliveryRequest as SharedDeliveryRequest,
  type MatchingResult,
} from '../../data/matching-engine';
import {
  sendMatchFoundNotification,
} from '../matching-notification';
import { createChatService, getChatRoomByRequestId } from '../chat-service';
import { getUserActiveRoutes } from '../route-service';
import type {
  RouteMatchScore,
  RouteFilteredRequest,
} from '../../types/matching-extended';
import type { Route } from '../../types/route';
import type {
  FirestoreMatchingRequestDoc,
  FirestoreUserDoc,
  FilterRequestBase,
  RouteScoreRequest,
  LooseRouteInput,
  LooseRequestStation,
} from './types';
import { isMissionBoardManagedRequest, getErrorMessage } from './types';
import { snapshotExists } from './internal-helpers';
import { fetchActiveGillerRoutes, fetchUserInfo, findMatchesByRouteHeuristic } from './giller-search';
import { calculateRouteMatchScore } from './filtering';

type LocalDeliveryRequest = {
  id: string;
  pickupStation: string;
  deliveryStation: string;
  dayOfWeek: string;
  time: string;
  requestId?: string;
  pickupStationName?: string;
  deliveryStationName?: string;
  pickupStartTime?: string;
  pickupEndTime?: string;
  deliveryDeadline?: string;
  preferredDays?: number[];
  packageSize?: 'small' | 'medium' | 'large';
  packageWeight?: number;
};

export function convertToDeliveryRequest(requestDoc: FirestoreMatchingRequestDoc): LocalDeliveryRequest {
  const departureTime = requestDoc.preferredTime?.departureTime ?? '08:00';
  const today = new Date().getDay();
  const dayOfWeekNumber = today === 0 ? 7 : today;

  const pickupStationName = requestDoc.pickupStation?.stationName ?? '';
  const deliveryStationName = requestDoc.deliveryStation?.stationName ?? '';

  const pickupStartTime = departureTime;
  const pickupEndTime = departureTime;

  const deadlineDate =
    typeof (requestDoc.deadline as { toDate?: unknown })?.toDate === 'function'
      ? (requestDoc.deadline as { toDate: () => Date }).toDate()
      : requestDoc.deadline instanceof Date
        ? requestDoc.deadline
        : new Date(Date.now() + 1000 * 60 * 60 * 2);

  const packageSizeRaw = String(requestDoc.packageInfo?.size ?? 'medium').toLowerCase();
  const packageSize: LocalDeliveryRequest['packageSize'] =
    packageSizeRaw === 'small' ? 'small' : packageSizeRaw === 'large' ? 'large' : 'medium';

  const weightValue = requestDoc.packageInfo?.weight;
  const packageWeight = typeof weightValue === 'number' ? weightValue : Number(weightValue ?? 1);

  return {
    id: requestDoc.id ?? '',
    pickupStation: pickupStationName,
    deliveryStation: deliveryStationName,
    dayOfWeek: String(dayOfWeekNumber),
    time: departureTime,
    requestId: requestDoc.id ?? '',
    pickupStationName,
    deliveryStationName,
    pickupStartTime,
    pickupEndTime,
    deliveryDeadline: deadlineDate.toISOString(),
    preferredDays: [dayOfWeekNumber],
    packageSize,
    packageWeight: Number.isFinite(packageWeight) && packageWeight > 0 ? packageWeight : 1,
  };
}

export async function findMatchesForRequest(
  requestId: string,
  topN: number = 5
): Promise<MatchingResult[]> {
  try {
    const requestDoc = await getDoc(doc(db, 'requests', requestId));

    if (!snapshotExists(requestDoc)) {
      throw new Error('Request not found');
    }

    const requestData = { id: requestDoc.id, ...(requestDoc.data() as FirestoreMatchingRequestDoc) };
    const request = convertToDeliveryRequest(requestData);

    const gillerRoutes = await fetchActiveGillerRoutes();

    const today = new Date().getDay();
    const dayOfWeek = today === 0 ? 7 : today;

    const availableGillers = gillerRoutes.filter((giller) => giller.daysOfWeek?.includes(dayOfWeek));

    const sharedMatches = matchGillersToRequest(request, availableGillers).slice(0, topN);
    if (sharedMatches.length > 0) {
      return sharedMatches.map((m) => ({
        gillerId: m.gillerId,
        gillerName: '',
        totalScore: m.score,
        routeMatchScore: 0,
        timeMatchScore: 0,
        ratingScore: 0,
        completionRateScore: 0,
        scores: {
          pickupMatchScore: 0,
          deliveryMatchScore: 0,
          departureTimeMatchScore: 0,
          scheduleFlexibilityScore: 0,
          ratingRawScore: 0,
          completionRateRawScore: 0,
        },
        routeDetails: {
          travelTime: 0,
          isExpressAvailable: false,
          transferCount: 0,
          congestionLevel: 'low' as const,
        },
        reasons: [m.reason],
      }));
    }

    console.warn(`No matching engine results for request ${requestId}. Falling back to route heuristic.`);
    return await findMatchesByRouteHeuristic(requestData, topN);
  } catch (error) {
    console.error('Error finding matches:', error);
    try {
      const requestDoc = await getDoc(doc(db, 'requests', requestId));
      if (!snapshotExists(requestDoc)) {
        return [];
      }
      return await findMatchesByRouteHeuristic({ id: requestDoc.id, ...(requestDoc.data() as FirestoreMatchingRequestDoc) }, topN);
    } catch (fallbackError) {
      console.error('Error in fallback matching:', fallbackError);
      throw error;
    }
  }
}

export async function createMatchDocument(
  requestId: string,
  gillerId: string,
  matchScore: MatchingResult,
  requesterId: string = '',
  requestData?: any
): Promise<string> {
  try {
    const matchData = {
      requestId,
      userId: requesterId,
      requesterId,
      gllerId: requesterId,
      gillerId,
      pickupStation: requestData?.pickupStation || null,
      deliveryStation: requestData?.deliveryStation || null,
      lockerId: requestData?.lockerId || null,
      reservationId: requestData?.reservationId || null,
      fee: requestData?.fee || null,
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

export async function processMatchingForRequest(
  requestId: string
): Promise<number> {
  try {
    const requestRef = doc(db, 'requests', requestId);
    const existingMatchesSnapshot = await getDocs(
      query(collection(db, 'matches'), where('requestId', '==', requestId))
    );

    if (!existingMatchesSnapshot.empty) {
      const requestDoc = await getDoc(requestRef);
      const request = requestDoc.data() as FirestoreMatchingRequestDoc | undefined;

      if (request?.status === 'pending') {
        await updateDoc(requestRef, {
          status: 'matched',
          matchedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return existingMatchesSnapshot.size;
    }

    const matches = await findMatchesForRequest(requestId, 3);

    if (matches.length === 0) {
      console.warn('No matches found for request', requestId);
      return 0;
    }

    const requestDoc = await getDoc(requestRef);
    const request = requestDoc.data() as FirestoreMatchingRequestDoc | undefined;
    const requesterId = request?.requesterId ?? '';

    const matchPromises = matches.map((match) =>
      createMatchDocument(requestId, match.gillerId, match, requesterId, request)
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

export async function getMatchingResults(requestId: string) {
  const matches = await findMatchesForRequest(requestId, 10);

  const requestDoc = await getDoc(doc(db, 'requests', requestId));
  const requestData = requestDoc.data() as FirestoreMatchingRequestDoc | undefined;
  const baseFee = requestData?.fee?.totalFee ?? 3000;

  return await Promise.all(
    matches.map(async (match, index) => {
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
        estimatedFee: Math.round(baseFee * (1 + (index * 0.1))),
        profileImage: userInfo.profileImage ?? undefined,
      };
    })
  );
}

export async function acceptRequest(
  requestId: string,
  gillerId: string
): Promise<{ success: boolean; message: string; deliveryId?: string }> {
  try {
    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!snapshotExists(requestDoc)) {
      return { success: false, message: '요청을 찾을 수 없습니다.' };
    }

    const request = requestDoc.data() as FirestoreMatchingRequestDoc;
    const requesterId = request.requesterId ?? '';

    if (isMissionBoardManagedRequest(request)) {
      return { success: false, message: '이 요청은 미션 보드에서 수락해야 합니다.' };
    }

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

    await Promise.all(matchSnapshot.docs.map((matchDoc) =>
      updateDoc(doc(db, 'matches', matchDoc.id), {
        status: 'declined',
        declinedAt: new Date(),
      })
    ));

    return { success: true, message: '요청을 거절했습니다.' };
  } catch (error) {
    console.error('Error declining request:', error);
    return { success: false, message: '요청 거절에 실패했습니다.' };
  }
}

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
    rank?: number;
  };
  error?: string;
}> {
  try {
    const matches = await getMatchingResults(requestId);

    if (matches.length === 0) {
      return { success: false, error: '현재 조건에 맞는 길러를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }

    const bestMatch = matches[0];

    const baseTime = 20;
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
        rank: bestMatch.rank,
      },
    };
  } catch (error: unknown) {
    console.error('Error finding giller:', error);
    return { success: false, error: getErrorMessage(error, '길러를 찾는 중 오류가 발생했습니다.') };
  }
}

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

export async function filterRequestsByGillerRoutes(
  requests: LocalDeliveryRequest[],
  gillerId: string
): Promise<RouteFilteredRequest[]> {
  try {
    const gillerRoutes = await getUserActiveRoutes(gillerId);

    if (gillerRoutes.length === 0) {
      console.warn('[filterRequestsByGillerRoutes] no active routes');
      return [];
    }

    const today = new Date().getDay();
    const dayOfWeek = today === 0 ? 7 : today;

    const todayRoutes = gillerRoutes.filter(route =>
      route.daysOfWeek.includes(dayOfWeek)
    );
    const routesToMatch = todayRoutes.length > 0 ? todayRoutes : gillerRoutes;
    console.warn(`[filterRequestsByGillerRoutes] today routes: ${todayRoutes.length}, match targets: ${routesToMatch.length}`);

    const matchedRequests: RouteFilteredRequest[] = [];
    const MIN_MATCH_SCORE = 10;

    for (const request of requests) {
      const matchResults: { route: Route; score: RouteMatchScore }[] = [];

      const reqAny = request as unknown as Record<string, unknown>;
      const reqPickupStation = reqAny.pickupStation as Record<string, unknown> | undefined;
      const reqDeliveryStation = reqAny.deliveryStation as Record<string, unknown> | undefined;
      const reqPreferredTime = reqAny.preferredTime as Record<string, unknown> | undefined;
      const scoreRequest: RouteScoreRequest = {
        pickupStation: { 
          stationName: reqPickupStation?.stationName as string ?? request.pickupStationName 
        },
        deliveryStation: { 
          stationName: reqDeliveryStation?.stationName as string ?? request.deliveryStationName 
        },
        preferredTime: { 
          departureTime: reqPreferredTime?.departureTime as string ?? request.pickupStartTime 
        },
      };

      for (const route of routesToMatch) {
        const score = calculateRouteMatchScore(scoreRequest, route);
        if (score.score >= MIN_MATCH_SCORE) {
          matchResults.push({ route, score });
        }
      }

      if (matchResults.length > 0) {
        matchResults.sort((a, b) => b.score.score - a.score.score);
        const bestMatch = matchResults[0];
        const requestWithFallback = request as LocalDeliveryRequest & Partial<RouteFilteredRequest> & {
          initialNegotiationFee?: number;
          deadline?: Date;
          fee?: { totalFee: number };
          requestId?: string;
          requesterId?: string;
          gllerId?: string;
          deliveryType?: string;
          packageInfo?: any;
          status?: string;
          createdAt?: Date;
          updatedAt?: Date;
        };

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

    matchedRequests.sort((a, b) => b.matchScore.score - a.matchScore.score);
    console.warn(`[filterRequestsByGillerRoutes] matched requests: ${matchedRequests.length}`);

    return matchedRequests;
  } catch (error) {
    console.error('Error filtering requests by giller routes:', error);
    return [];
  }
}
