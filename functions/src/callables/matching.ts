import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared-admin';
import { FdsService } from '../services/fds-service';
import { getFunctionsPricingPolicyConfig } from '../pricing-policy-config';
import {
  calculateSharedSettlementBreakdown,
} from '../../../shared/pricing-policy';
import {
  getTopMatches as getTopSharedMatches,
  matchGillersToRequest as runSharedMatchingEngine,
  type SharedDeliveryRequest,
  type SharedGillerRoute,
  type SharedMatch,
} from '../../../shared/matching-engine';
import type {
  DeliveryRequest,
  Match,
  MatchRequestsData,
  MatchRequestsResult,
  AcceptMatchData,
  AcceptMatchResult,
  RejectMatchData,
  RejectMatchResult,
  CompleteMatchData,
  CompleteMatchResult,
  MatchingDetails,
  User,
  GillerRoute,
  RouteData,
} from '../types';

// Minimal interface for giller user doc — only fields used by matching functions
interface GillerUserDoc {
  name?: string;
  role?: string;
  rating?: number;
  gillerInfo?: {
    totalDeliveries?: number;
    completedDeliveries?: number;
  };
  gillerProfile?: {
    type?: string;
  };
}

// ==================== Helper Functions ====================

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

export async function createMatchesForRequest(
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

// ==================== Callable Functions ====================

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
        console.warn('Request not in pending status:', request.status);
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
      console.error('Error in matchRequests:', error);
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

      // Check FDS for self-matching abuse
      const fdsResult = await FdsService.checkSelfMatching(match.gllerId, match.gillerId);
      if (fdsResult.isFraud && fdsResult.action === 'block') {
        console.error(`[FDS Block] Match ${matchId} blocked: ${fdsResult.reason}`);
        throw new functions.https.HttpsError('permission-denied', `부정 사용(어뷰징)이 감지되어 매칭이 차단되었습니다: ${fdsResult.reason}`);
      }

      // Check if match is still pending
      if (match.status !== 'pending') {
        console.warn('Match not in pending status:', match.status);
        return { success: false, message: '이미 처리된 요청입니다.' };
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
        gllerId: match.gillerId,
        pickupStation: match.pickupStation,
        deliveryStation: match.deliveryStation,
        lockerId: (match as unknown as Record<string, unknown>).lockerId as string | null || null,
        reservationId: (match as unknown as Record<string, unknown>).reservationId as string | null || null,
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
      console.error('Error in acceptMatch:', error);
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
        console.warn('Match not in pending status:', match.status);
        return { success: false, message: '이미 처리된 요청입니다.' };
      }

      // 2. Transactionally update match and check if request needs reset
      await db.runTransaction(async (tx) => {
        const matchRef = db.collection('matches').doc(matchId);
        const matchDocTx = await tx.get(matchRef);
        if (!matchDocTx.exists) return;
        
        const currentMatch = matchDocTx.data() as Match;
        if (currentMatch.status !== 'pending') return;

        tx.update(matchRef, {
          status: 'rejected',
          rejectionReason: reason ?? 'Giller rejected',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Check if there are other pending matches for this request
        const otherMatchesSnapshot = await tx.get(
          db.collection('matches')
            .where('requestId', '==', match.requestId)
            .where('status', '==', 'pending')
        );

        // If this was the last pending match (it will be empty because we just rejected it in our logic, 
        // but since we query pending matches, we need to see if there are others besides this one)
        const otherPendingCount = otherMatchesSnapshot.docs.filter(doc => doc.id !== matchId).length;
        
        if (otherPendingCount === 0) {
          // No more matches available, reset request to pending
          tx.update(db.collection('requests').doc(match.requestId), {
            status: 'pending',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.warn('No more matches, request reset to pending');
        }
      });

      console.warn(`Match rejected: ${matchId}`);

      return { success: true };
    } catch (error) {
      console.error('Error in rejectMatch:', error);
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
        console.warn('Match not in accepted status:', match.status);
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
      const gillerData = gillerDoc.data() as GillerUserDoc | undefined;
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
      console.error('Error in completeMatch:', error);
      throw new functions.https.HttpsError('internal', 'Error completing match');
    }
  }
);
