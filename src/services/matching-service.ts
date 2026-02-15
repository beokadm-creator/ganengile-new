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
      const startStation = getStationByName(data.startStation.name);
      const endStation = getStationByName(data.endStation.name);

      if (!startStation || !endStation) {
        console.warn(`Station not found for route ${docSnapshot.id}`);
        return;
      }

      routes.push({
        gillerId: data.userId,
        gillerName: data.gillerName || '익명',
        startStation,
        endStation,
        departureTime: data.departureTime,
        daysOfWeek: data.daysOfWeek,
        rating: 4.0,
        totalDeliveries: 0, // TODO: Fetch from users collection
        completedDeliveries: 0, // TODO: Fetch from users collection
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
 * @returns User data { name, rating, totalDeliveries, completedDeliveries }
 */
export async function fetchUserInfo(userId: string): Promise<{
  name: string;
  rating: number;
  totalDeliveries: number;
  completedDeliveries: number;
}> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return {
        name: '익명',
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
      };
    }

    const data = userDoc.data();
    return {
      name: data.name || '익명',
      rating: data.rating || 3.5,
      totalDeliveries: data.gillerInfo?.totalDeliveries || 0,
      completedDeliveries: data.gillerInfo?.totalDeliveries || 0, // Assuming completed = total for now
    };
  } catch (error) {
    console.error('Error fetching user info:', error);
    return {
      name: '익명',
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
    };
  }
}

/**
 * Convert Firestore request to DeliveryRequest format
 * @param requestDoc Firestore request document
 * @returns DeliveryRequest object
 */
export function convertToDeliveryRequest(requestDoc: any): DeliveryRequest {
  return {
    requestId: requestDoc.id,
    pickupStationName: requestDoc.pickupStation.name,
    deliveryStationName: requestDoc.deliveryStation.name,
    pickupStartTime: '08:00', // TODO: Add to request schema
    pickupEndTime: '08:20',
    deliveryDeadline: '09:00',
    preferredDays: [1, 2, 3, 4, 5], // TODO: Add to request schema
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

    const request = convertToDeliveryRequest(requestDoc.data());

    // 2. Fetch active giller routes
    const gillerRoutes = await fetchActiveGillerRoutes();

    // 3. Filter by day of week
    // TODO: Get current day of week
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
    const dayOfWeek = today === 0 ? 7 : today; // Convert to 1-7 (Mon-Sun)

    const availableGillers = gillerRoutes.filter((giller) =>
      giller.daysOfWeek.includes(dayOfWeek)
    );

    // 4. Find matches
    const matches = matchGillersToRequest(availableGillers, request);

    // 5. Return top N
    return matches.slice(0, topN);
  } catch (error) {
    console.error('Error finding matches:', error);
    throw error;
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
  matchScore: MatchingResult
): Promise<string> {
  try {
    const matchData = {
      requestId,
      gllerId: matchScore.scores.ratingRawScore > 0 ? requestId : '',
      gillerId,
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

    // 2. Create match documents for each
    const matchPromises = matches.map((match) =>
      createMatchDocument(requestId, match.gillerId, match)
    );

    await Promise.all(matchPromises);

    // 3. Send FCM notifications to gillers
    const requestDoc = await getDoc(doc(db, 'requests', requestId));
    const request = requestDoc.data();

    if (request) {
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
        profileImage: undefined, // TODO: Add profile image to user data
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
