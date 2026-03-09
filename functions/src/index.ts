/**
 * Cloud Functions for 가는길에
 * FCM 푸시 알림, 자동 매칭 등
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  User,
  GillerRoute,
  RouteData,
  DeliveryRequest,
  Match,
  ScoredGiller,
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
} from './types';
import { taxInvoiceScheduler } from './scheduled/tax-invoice-scheduler';
import { gillerSettlementScheduler } from './scheduled/settlement-scheduler';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

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
      console.warn('⏭️ Skipping matching - request not in pending status');
      return null;
    }

    console.warn(`🎯 New request created: ${requestId}`);
    console.warn(`📍 Route: ${request.pickupStation?.stationName} → ${request.deliveryStation?.stationName}`);

    try {
      // 1. Fetch active giller routes from Firestore
      const routesSnapshot = await db
        .collection('routes')
        .where('isActive', '==', true)
        .get();

      if (routesSnapshot.empty) {
        console.warn('⚠️ No active routes found');
        return null;
      }

      // 2. Get current day of week
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1-7 (Mon-Sun)

      // 3. Build giller routes data
      const gillerRoutes: GillerRoute[] = [];

      for (const routeDoc of routesSnapshot.docs) {
        const routeData = routeDoc.data() as RouteData;

        // Filter by day of week
        if (!routeData.daysOfWeek?.includes(dayOfWeek)) {
          continue;
        }

        // Fetch user info for rating and delivery stats
        const userDoc = await db.collection('users').doc(routeData.userId).get();

        if (!userDoc.exists) {
          continue;
        }

        const userData = userDoc.data() as User;

        gillerRoutes.push({
          gillerId: routeData.userId,
          gillerName: userData?.name ?? '익명',
          startStation: routeData.startStation,
          endStation: routeData.endStation,
          departureTime: routeData.departureTime,
          daysOfWeek: routeData.daysOfWeek,
          rating: userData?.rating ?? 3.5,
          totalDeliveries: userData?.gillerInfo?.totalDeliveries ?? 0,
          completedDeliveries: userData?.gillerInfo?.totalDeliveries ?? 0,
        });
      }

      if (gillerRoutes.length === 0) {
        console.warn('⚠️ No gillers available for this route/day');
        return null;
      }

      console.warn(`📊 Found ${gillerRoutes.length} available gillers`);

      // 4. Import matching engine (this needs to be adapted for Cloud Functions)
      // For now, we'll use a simplified matching logic
      // In production, this would call the matching-engine.ts functions

      // TODO: Integrate with matching-engine.ts
      // For now, create matches based on a simple heuristic

      // Simple scoring: prioritize by rating and proximity
      const scoredGillers: ScoredGiller[] = gillerRoutes.map((giller): ScoredGiller => ({
        giller,
        score: giller.rating * 20, // Base score from rating
      }));

      // Sort by score (descending)
      scoredGillers.sort((a, b) => b.score - a.score);

      // Get top 3
      const top3Gillers = scoredGillers.slice(0, 3);

      console.warn(`🏆 Selected top ${top3Gillers.length} gillers`);

      // 5. Create match documents for top 3 guiders
      const batch = db.batch();

      for (const { giller, score } of top3Gillers) {
        const matchRef = db.collection('matches').doc();

        const matchingDetails: MatchingDetails = {
          routeScore: score * 0.5,
          timeScore: score * 0.3,
          ratingScore: score * 0.15,
          responseTimeScore: score * 0.05,
          calculatedAt: new Date(),
        };

        const matchData: Match = {
          requestId,
          gllerId: request.requesterId ?? '',
          gillerId: giller.gillerId,
          gillerName: giller.gillerName,
          gillerRating: giller.rating,
          gillerTotalDeliveries: giller.totalDeliveries,
          matchScore: score,
          matchingDetails,
          pickupStation: request.pickupStation,
          deliveryStation: request.deliveryStation,
          estimatedTravelTime: 30, // TODO: Calculate actual travel time
          status: 'pending',
          notifiedAt: null,
          fee: request.fee,
        };

        batch.set(matchRef, matchData);

        console.warn(`✅ Created match for giller ${giller.gillerName} (score: ${score})`);
      }

      await batch.commit();

      console.warn(`🎉 Matching complete for request ${requestId}`);

      return null;
    } catch (error) {
      console.error('❌ Error in onRequestCreated:', error);
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
    console.warn('✅ FCM sent successfully:', title);
  } catch (error) {
    console.error('❌ FCM send error:', error);
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
        console.error('❌ Request not found:', requestId);
        return null;
      }

      const request = requestDoc.data() as DeliveryRequest;
      if (!request) return null;

      // Get giller's FCM token
      const gillerDoc = await db.collection('users').doc(match.gillerId).get();

      if (!gillerDoc.exists) {
        console.error('❌ Giller not found:', match.gillerId);
        return null;
      }

      const giller = gillerDoc.data() as User;
      const fcmToken = giller?.fcmToken;

      if (!fcmToken) {
        console.warn('⚠️ No FCM token for giller:', match.gillerId);
        return null;
      }

      // Send notification
      const title = '🎯 새로운 배송 요청';
      const body = `${request.pickupStation.stationName} → ${request.deliveryStation.stationName} (${request.fee.totalFee.toLocaleString()}원)`;

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

      console.warn('✅ Match notification sent:', context.params.matchId);
      return null;
    } catch (error) {
      console.error('❌ Error sending match notification:', error);
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
    const after = change.after.data() as DeliveryRequest;

    if (!before || !after) {
      return null;
    }

    // Check if status changed to 'accepted'
    if (before.status === 'matched' && after.status === 'accepted') {
      const { gllerId, matchedDeliveryId } = after;

      if (!matchedDeliveryId || !gllerId) {
        console.warn('⚠️ No matched delivery ID or gller ID');
        return null;
      }

      try {
        // Get gller's FCM token
        const gllerDoc = await db.collection('users').doc(gllerId).get();

        if (!gllerDoc.exists) {
          console.error('❌ Gller not found:', gllerId);
          return null;
        }

        const gller = gllerDoc.data() as User;
        const fcmToken = gller?.fcmToken;

        if (!fcmToken) {
          console.warn('⚠️ No FCM token for gller:', gllerId);
          return null;
        }

        // Get delivery details to find giller name
        const deliveryDoc = await db.collection('deliveries').doc(matchedDeliveryId).get();
        const gillerName = deliveryDoc.exists && (deliveryDoc.data()?.gillerName ?? '길러');

        // Send notification
        const title = '✅ 배송이 수락되었습니다';
        const body = `${gillerName}님이 배송을 수락했습니다.`;

        await sendFCM(fcmToken, title, body, {
          type: 'request_accepted',
          requestId: context.params.requestId,
          deliveryId: matchedDeliveryId,
          screen: 'RequestDetail',
        });

        console.warn('✅ Request accepted notification sent:', context.params.requestId);
        return null;
      } catch (error) {
        console.error('❌ Error sending request accepted notification:', error);
        return null;
      }
    }

    // Check if status changed to 'completed'
    if (before.status !== 'completed' && after.status === 'completed') {
      const { gllerId } = after;

      if (!gllerId) {
        console.warn('⚠️ No gller ID');
        return null;
      }

      try {
        // Get gller's FCM token
        const gllerDoc = await db.collection('users').doc(gllerId).get();

        if (!gllerDoc.exists) {
          console.error('❌ Gller not found:', gllerId);
          return null;
        }

        const gller = gllerDoc.data() as User;
        const fcmToken = gller?.fcmToken;

        if (!fcmToken) {
          console.warn('⚠️ No FCM token for gller:', gllerId);
          return null;
        }

        // Get giller name
        const gillerName = after.gillerName ?? '길러';

        // Send notification
        const title = '🎉 배송이 완료되었습니다';
        const body = `${gillerName}님이 배송을 완료했습니다.`;

        await sendFCM(fcmToken, title, body, {
          type: 'delivery_completed',
          requestId: context.params.requestId,
          screen: 'RequestDetail',
        });

        console.warn('✅ Delivery completed notification sent:', context.params.requestId);
        return null;
      } catch (error) {
        console.error('❌ Error sending delivery completed notification:', error);
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

  try {
    // Import matching service logic
    // Note: This would need to be adapted for Cloud Functions environment
    const matches: Match[] = []; // TODO: Implement matching logic

    const result: TriggerMatchingResult = {
      success: true,
      matchesFound: matches.length,
    };

    return result;
  } catch (error) {
    console.error('❌ Error triggering matching:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error triggering matching'
    );
  }
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

    console.warn('✅ FCM token saved for user:', userId);

    return { success: true };
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error saving FCM token'
    );
  }
});

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

      console.warn(`✅ Deleted ${oldNotifications.size} old notifications`);
      return null;
    } catch (error) {
      console.error('❌ Error cleaning up notifications:', error);
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

    const { chatRoomId } = context.params;

    try {
      const chatRoomDoc = await db.collection('chatRooms').doc(chatRoomId).get();

      if (!chatRoomDoc.exists) {
        console.error('❌ Chat room not found:', chatRoomId);
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
        console.warn('⚠️ No notification settings for recipient:', recipientId);
        return null;
      }

      const settings = recipientDoc.data() as NotificationSettings;

      if (!settings?.enabled || !settings?.settings?.new_message) {
        console.warn('⚠️ Notifications disabled for recipient:', recipientId);
        return null;
      }

      const fcmToken = settings.fcmToken;
      if (!fcmToken) {
        console.warn('⚠️ No FCM token for recipient:', recipientId);
        return null;
      }

      const title = '💬 새 메시지';
      const body = `${senderName}: ${message.content}`;

      await sendFCM(fcmToken, title, body, {
        type: 'new_message',
        chatRoomId,
        senderId,
      });

      console.warn('✅ Chat message notification sent:', context.params.messageId);
      return null;
    } catch (error) {
      console.error('❌ Error sending chat message notification:', error);
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
      console.warn('⚠️ No notification settings for user:', userId);
      return { success: false, reason: 'No notification settings' };
    }

    const settings = settingsDoc.data() as NotificationSettings;

    if (!settings?.enabled) {
      console.warn('⚠️ Notifications disabled for user:', userId);
      return { success: false, reason: 'Notifications disabled' };
    }

    const fcmToken = settings.fcmToken;
    if (!fcmToken) {
      console.warn('⚠️ No FCM token for user:', userId);
      return { success: false, reason: 'No FCM token' };
    }

    await sendFCM(fcmToken, notification.title, notification.body, notification.data);

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
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

    const user = userDoc.data();
    const promotion = user?.gillerProfile?.promotion;

    if (promotion?.status !== 'pending') {
      return { approved: false, reason: 'No pending promotion application' };
    }

    // Get current grade and target grade
    const currentGrade = user?.gillerProfile?.type || 'regular';
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

    const stats = user?.stats || {};

    // Check requirements
    const checks = {
      completedDeliveries: (stats.completedDeliveries || 0) >= requirements.minCompletedDeliveries,
      rating: (stats.rating || 0) >= requirements.minRating,
      penalties: (stats.recentPenalties || 0) <= requirements.maxRecentPenalties,
      accountAge: (stats.accountAgeDays || 0) >= requirements.minAccountAgeDays,
      recentActivity: (stats.recent30DaysDeliveries || 0) >= requirements.minRecent30DaysDeliveries,
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

      console.log(`✅ Promoted: ${userId} -> ${targetGrade}`);
      return { approved: true };
    } else {
      // Reject promotion
      const failedChecks = Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([key]) => key);

      await db.collection('users').doc(userId).update({
        'gillerProfile.promotion.status': 'rejected',
      });

      console.log(`❌ Promotion rejected: ${userId} - ${failedChecks.join(', ')}`);
      return {
        approved: false,
        reason: `Requirements not met: ${failedChecks.join(', ')}`,
      };
    }
  } catch (error) {
    console.error('❌ Error reviewing promotion:', error);
    throw new functions.https.HttpsError('internal', 'Error reviewing promotion');
  }
});

/**
 * Trigger: Auto-check badges on delivery completion
 */
export const onDeliveryCompleted = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, context) => {
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
        console.warn('⚠️ User not found:', gillerId);
        return null;
      }

      const user = userDoc.data();
      const stats = user?.stats || {};
      const badges = user?.badges || { activity: [], quality: [], expertise: [], community: [] };

      // Define badge checks
      const badgeChecks = [
        {
          id: 'badge_newbie',
          category: 'activity',
          condition: (stats.completedDeliveries || 0) >= 1,
        },
        {
          id: 'badge_active',
          category: 'activity',
          condition: (stats.recent30DaysDeliveries || 0) >= 10,
        },
        {
          id: 'badge_friendly',
          category: 'quality',
          condition: (stats.rating || 0) >= 4.9 && (stats.completedDeliveries || 0) >= 20,
        },
        {
          id: 'badge_trusted',
          category: 'quality',
          condition: (stats.recentPenalties || 0) === 0 && (stats.completedDeliveries || 0) >= 100,
        },
      ];

      // Award new badges
      const updates: any = {};
      let newBadgesAwarded = 0;

      for (const check of badgeChecks) {
        if (!badges[check.category]?.includes(check.id) && check.condition) {
          updates[`badges.${check.category}`] = admin.firestore.FieldValue.arrayUnion(check.id);
          newBadgesAwarded++;
          console.log(`🎖️ Badge awarded: ${check.id} to ${gillerId}`);
        }
      }

      // Update badge benefits
      if (newBadgesAwarded > 0) {
        const totalBadges =
          (badges.activity?.length || 0) +
          (badges.quality?.length || 0) +
          (badges.expertise?.length || 0) +
          (badges.community?.length || 0) +
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
        console.log(`✅ Updated badges for ${gillerId}: ${totalBadges} total, ${tier} tier`);
      }

      return null;
    } catch (error) {
      console.error('❌ Error checking badges:', error);
      return null;
    }
  });

/**
 * HTTP Function: Calculate delivery rate with bonus
 */
export const calculateDeliveryRate = functions.https.onCall(async (data, context): Promise<{ rate: number; bonus: number; total: number }> => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { baseRate, gillerId } = data;

  if (!baseRate || !gillerId) {
    throw new functions.https.HttpsError('invalid-argument', 'baseRate and gillerId are required');
  }

  try {
    const userDoc = await db.collection('users').doc(gillerId).get();

    if (!userDoc.exists) {
      return { rate: baseRate, bonus: 0, total: baseRate };
    }

    const user = userDoc.data();
    const rateBonus = user?.gillerProfile?.benefits?.rateBonus || 0;

    const bonusAmount = baseRate * rateBonus;
    const totalRate = baseRate + bonusAmount;

    return {
      rate: baseRate,
      bonus: bonusAmount,
      total: totalRate,
    };
  } catch (error) {
    console.error('❌ Error calculating rate:', error);
    throw new functions.https.HttpsError('internal', 'Error calculating rate');
  }
});

// ==================== Pricing Functions ====================

/**
 * Pricing Constants (Updated with actual costs)
 */
const PRICING_CONSTANTS = {
  // 기본 요금 (이용자 결제금액)
  BASE_FARE: 4000,
  SECOND_FARE: 5000,
  THIRD_FARE: 6000,
  TRANSFER_BONUS: 500,
  TRANSFER_DISCOUNT: 500,
  EXPRESS_SURCHARGE: 500,
  
  // ==================== 실제 비용 ====================
  
  // PG사 수수료 (결제 대행 수수료)
  PG_FEE_RATE: 0.03, // 3% (NICE, Toss 평균)
  
  // 플랫폼 수수료 (PG 수수료 차감 후, 단계별)
  SERVICE_FEE_RATE: 0.08, // 8% (초기 우대, 나중에 10%로 조정)
  
  // 원천징수세 (길러 수익에서)
  WITHHOLDING_TAX_RATE: 0.033, // 3.3%
  
  // ==================== 할증/할인 ====================
  
  RUSH_HOUR_SURCHARGE_RATE: 0.15, // 러시아워 할증 15%
  URGENCY_SURCHARGE_RATES: {
    normal: 0,
    fast: 0.10,
    urgent: 0.20,
  },
  
  // ==================== 길러 보너스 ====================
  
  PROFESSIONAL_BONUS_RATE: 0.25, // 25% (플랫폼 수수료 후)
  MASTER_BONUS_RATE: 0.35,      // 35%
  
  // ==================== 기타 ====================
  
  PER_KM_RATE: 100,
};

/**
 * HTTP Function: Calculate delivery pricing
 *
 * Calculates delivery pricing based on distance, time, and other factors
 */
export const calculateDeliveryPricing = functions.https.onCall(
  async (data: CalculateDeliveryPricingData, context): Promise<CalculateDeliveryPricingResult> => {
    // Authentication check (optional - adjust based on requirements)
    // if (!context.auth) {
    //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    // }

    const {
      distance,
      travelTime,
      isRushHour = false,
      urgency = 'normal',
      isTransferRoute = false,
      transferCount = 0,
      gillerLevel = 'regular',
    } = data;

    console.log('💰 calculateDeliveryPricing called:', data);

    try {
      // 1. Calculate base fare
      let baseFare = calculateBaseFare(distance, travelTime);

      // 2. Calculate additional charges
      const breakdown: PricingBreakdown[] = [];

      // Rush hour surcharge (07:00-09:00, 18:00-20:00)
      if (isRushHour) {
        const rushHourSurcharge = Math.round(baseFare * PRICING_CONSTANTS.RUSH_HOUR_SURCHARGE_RATE);
        breakdown.push({
          type: 'base',
          amount: rushHourSurcharge,
          description: '러시아워 할증 (07:00-09:00, 18:00-20:00)',
        });
        baseFare += rushHourSurcharge;
      }

      // Urgency surcharge
      const urgencyRate = PRICING_CONSTANTS.URGENCY_SURCHARGE_RATES[urgency || 'normal'];
      if (urgencyRate > 0) {
        const urgencySurcharge = Math.round(baseFare * urgencyRate);
        breakdown.push({
          type: 'express',
          amount: urgencySurcharge,
          description: `긴급도 할증 (${urgency === 'fast' ? '빠름' : '긴급'})`,
        });
        baseFare += urgencySurcharge;
      }

      // 3. Calculate discounts/bonuses
      const discounts: PricingDiscount[] = [];

      // Transfer discount
      if (isTransferRoute) {
        discounts.push({
          type: 'transfer_bonus',
          amount: -PRICING_CONSTANTS.TRANSFER_DISCOUNT,
          description: '환승 할인',
        });

        // Transfer bonus (additional bonus for transfer count)
        const transferBonus = transferCount * PRICING_CONSTANTS.TRANSFER_BONUS;
        if (transferBonus > 0) {
          discounts.push({
            type: 'transfer_bonus',
            amount: transferBonus,
            description: `환승 보너스 (${transferCount}회)`,
          });
        }
      }

      // Giller level bonus (플랫폼 수수료 후 보너스)
      let gillerBonus = 0;
      if (gillerLevel === 'professional') {
        // 플랫폼 수수료 후에 보너스 계산 (calculateActualPricing 호출 후)
        gillerBonus = 0; // calculateActualPricing에서 계산됨
        discounts.push({
          type: 'professional_bonus',
          amount: 0, // 임시, 나중에 calculateActualPricing에서 계산
          description: '전문 길러 보너스 (25%)',
        });
      } else if (gillerLevel === 'master') {
        gillerBonus = 0;
        discounts.push({
          type: 'master_bonus',
          amount: 0,
          description: '마스터 길러 보너스 (35%)',
        });
      }

      // 4. Calculate total fare (이용자 결제액)
      const totalFare = Math.max(
    3500, // Minimum fare
        baseFare + discounts.reduce((sum, d) => sum + d.amount, 0)
      );

      // 5. 실제 비용 계산 (PG사 수수료, 세금 반영)
      const actualPricing = calculateActualPricing(totalFare, 0);

      // 6. 길러 등급별 보너스 재계산 (실제 플랫폼 수수료 후)
      if (gillerLevel === 'professional') {
        gillerBonus = Math.round(
          actualPricing.platformRevenue * PRICING_CONSTANTS.PROFESSIONAL_BONUS_RATE
        );
      } else if (gillerLevel === 'master') {
        gillerBonus = Math.round(
          actualPricing.platformRevenue * PRICING_CONSTANTS.MASTER_BONUS_RATE
        );
      }

      // 보너스 포함하여 다시 계산
      const finalPricing = calculateActualPricing(totalFare, gillerBonus);

      const result: CalculateDeliveryPricingResult = {
        baseFare: PRICING_CONSTANTS.BASE_FARE,
        breakdown,
        discounts,
        totalFare: finalPricing.totalFare,
        gillerEarnings: {
          base: finalPricing.gillerPreTaxEarnings - gillerBonus, // 보너스 제외 기본
          bonus: gillerBonus,
          preTax: finalPricing.gillerPreTaxEarnings, // 보너스 포함 세전
          tax: finalPricing.withholdingTax,
          net: finalPricing.gillerNetEarnings, // 보너스 포함 세후
        },
        platformEarnings: {
          gross: actualPricing.serviceFee, // 총 수수료
          net: actualPricing.platformNetEarnings, // 실수익
        },
        pgFee: actualPricing.pgFee,
        calculatedAt: new Date(),
      };

      console.log('✅ Pricing calculation completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Error in calculateDeliveryPricing:', error);
      throw new functions.https.HttpsError('internal', 'Error calculating delivery pricing');
    }
  }
);

/**
 * Helper: Calculate base fare
 */
function calculateBaseFare(distance?: number, travelTime?: number): number {
  // Distance-based fare
  if (distance !== undefined) {
    if (distance <= 10) {
      return PRICING_CONSTANTS.BASE_FARE;
    } else if (distance <= 30) {
      return PRICING_CONSTANTS.SECOND_FARE;
    } else {
      return PRICING_CONSTANTS.THIRD_FARE;
    }
  }

  // Time-based fare
  if (travelTime !== undefined) {
    if (travelTime <= 30) {
      return PRICING_CONSTANTS.BASE_FARE;
    } else if (travelTime <= 60) {
      return PRICING_CONSTANTS.SECOND_FARE;
    } else {
      return PRICING_CONSTANTS.THIRD_FARE;
    }
  }

  // Default base fare
  return PRICING_CONSTANTS.BASE_FARE;
}

/**
 * Helper: Calculate actual pricing with PG fee and tax
 * PG사 수수료와 원천징수세를 반영한 실제 정산 계산
 */
interface ActualPricingBreakdown {
  totalFare: number;           // 이용자 결제액
  pgFee: number;               // PG사 수수료 (3%)
  platformRevenue: number;     // 플랫폼 입금액 (PG 수수료 차감 후)
  serviceFee: number;          // 플랫폼 수수료
  gillerPreTaxEarnings: number; // 길러 세전 수익
  withholdingTax: number;      // 원천징수세 (3.3%)
  gillerNetEarnings: number;   // 길러 실수익
  platformNetEarnings: number; // 플랫폼 실수익
}

function calculateActualPricing(totalFare: number, gillerBonus: number = 0): ActualPricingBreakdown {
  // 1. PG사 수수료 차감
  const pgFee = Math.round(totalFare * PRICING_CONSTANTS.PG_FEE_RATE);
  
  // 2. 플랫폼 입금액
  const platformRevenue = totalFare - pgFee;
  
  // 3. 플랫폼 수수료 차감
  const serviceFee = Math.round(platformRevenue * PRICING_CONSTANTS.SERVICE_FEE_RATE);
  
  // 4. 길러 세전 수익 (보너스 포함)
  const gillerPreTaxEarnings = platformRevenue - serviceFee + gillerBonus;
  
  // 5. 원천징수세 차감
  const withholdingTax = Math.round(gillerPreTaxEarnings * PRICING_CONSTANTS.WITHHOLDING_TAX_RATE);
  
  // 6. 길러 실수익
  const gillerNetEarnings = gillerPreTaxEarnings - withholdingTax;
  
  // 7. 플랫폼 실수익
  const platformNetEarnings = serviceFee;
  
  return {
    totalFare,              // 이용자 결제액
    pgFee,                  // PG사 수수료
    platformRevenue,        // 플랫폼 입금액
    serviceFee,             // 플랫폼 수수료
    gillerPreTaxEarnings,   // 길러 세전 수익
    withholdingTax,         // 원천징수세
    gillerNetEarnings,      // 길러 실수익
    platformNetEarnings,    // 플랫폼 실수익
  };
}

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

    console.log(`🎯 Matching started for request: ${requestId}`);

    try {
      // 1. Get request details
      const requestDoc = await db.collection('requests').doc(requestId).get();

      if (!requestDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const request = requestDoc.data() as DeliveryRequest;

      if (request?.status !== 'pending') {
        console.warn('⏭️ Request not in pending status:', request.status);
        return { success: false, matchesFound: 0 };
      }

      // 2. Fetch active giller routes
      const routesSnapshot = await db
        .collection('routes')
        .where('isActive', '==', true)
        .get();

      if (routesSnapshot.empty) {
        console.warn('⚠️ No active routes found');
        return { success: true, matchesFound: 0 };
      }

      // 3. Get current day of week
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

      // 4. Build giller routes data
      const gillerRoutes: GillerRoute[] = [];

      for (const routeDoc of routesSnapshot.docs) {
        const routeData = routeDoc.data() as RouteData;

        // Filter by day of week
        if (!routeData.daysOfWeek?.includes(dayOfWeek)) {
          continue;
        }

        // Fetch user info for rating and delivery stats
        const userDoc = await db.collection('users').doc(routeData.userId).get();

        if (!userDoc.exists) {
          continue;
        }

        const userData = userDoc.data() as User;

        gillerRoutes.push({
          gillerId: routeData.userId,
          gillerName: userData?.name ?? '익명',
          startStation: routeData.startStation,
          endStation: routeData.endStation,
          departureTime: routeData.departureTime,
          daysOfWeek: routeData.daysOfWeek,
          rating: userData?.rating ?? 3.5,
          totalDeliveries: userData?.gillerInfo?.totalDeliveries ?? 0,
          completedDeliveries: userData?.gillerInfo?.completedDeliveries ?? 0,
        });
      }

      if (gillerRoutes.length === 0) {
        console.warn('⚠️ No gillers available for this route/day');
        return { success: true, matchesFound: 0 };
      }

      console.log(`📊 Found ${gillerRoutes.length} available gillers`);

      // 5. Score gillers based on multiple factors
      const scoredGillers: ScoredGiller[] = gillerRoutes.map((giller): ScoredGiller => {
        // Base score from rating (0-100 scale)
        const ratingScore = (giller.rating / 5.0) * 40;

        // Experience score based on completed deliveries
        const experienceScore = Math.min(giller.completedDeliveries * 0.5, 30);

        // Time match score (prefer departure times close to request time)
        const timeScore = 20; // Simplified for now

        const totalScore = ratingScore + experienceScore + timeScore;

        return {
          giller,
          score: totalScore,
        };
      });

      // Sort by score (descending)
      scoredGillers.sort((a, b) => b.score - a.score);

      // Get top 3
      const top3Gillers = scoredGillers.slice(0, 3);

      console.log(`🏆 Selected top ${top3Gillers.length} gillers`);

      // 6. Create match documents for top 3 guiders
      const batch = db.batch();
      const matches: Array<{ matchId: string; gillerId: string; gillerName: string; score: number }> = [];

      for (const { giller, score } of top3Gillers) {
        const matchRef = db.collection('matches').doc();

        const matchingDetails: MatchingDetails = {
          routeScore: score * 0.5,
          timeScore: score * 0.3,
          ratingScore: score * 0.15,
          responseTimeScore: score * 0.05,
          calculatedAt: new Date(),
        };

        const matchData: Match = {
          requestId,
          gllerId: request.requesterId ?? '',
          gillerId: giller.gillerId,
          gillerName: giller.gillerName,
          gillerRating: giller.rating,
          gillerTotalDeliveries: giller.totalDeliveries,
          matchScore: score,
          matchingDetails,
          pickupStation: request.pickupStation,
          deliveryStation: request.deliveryStation,
          estimatedTravelTime: 30,
          status: 'pending',
          notifiedAt: null,
          fee: request.fee,
        };

        batch.set(matchRef, matchData);

        matches.push({
          matchId: matchRef.id,
          gillerId: giller.gillerId,
          gillerName: giller.gillerName,
          score,
        });

        console.log(`✅ Created match for giller ${giller.gillerName} (score: ${score})`);
      }

      await batch.commit();

      // 7. Update request status
      await requestDoc.ref.update({
        status: 'matched',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`🎉 Matching complete for request ${requestId}`);

      return {
        success: true,
        matchesFound: matches.length,
        matches,
      };
    } catch (error) {
      console.error('❌ Error in matchRequests:', error);
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

    console.log(`✅ Accepting match: ${matchId} by giller: ${gillerId}`);

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
        console.warn('⚠️ Match not in pending status:', match.status);
        return { success: false };
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

      // 5. Reject other matches for this request
      const otherMatchesSnapshot = await db
        .collection('matches')
        .where('requestId', '==', match.requestId)
        .where('status', '==', 'pending')
        .get();

      if (!otherMatchesSnapshot.empty) {
        const batch = db.batch();
        otherMatchesSnapshot.forEach((doc) => {
          if (doc.id !== matchId) {
            batch.update(doc.ref, {
              status: 'rejected',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        });
        await batch.commit();
        console.log(`❌ Rejected ${otherMatchesSnapshot.size} other matches`);
      }

      console.log(`✅ Match accepted: ${matchId}, delivery created: ${deliveryId}`);

      return {
        success: true,
        deliveryId,
      };
    } catch (error) {
      console.error('❌ Error in acceptMatch:', error);
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

    console.log(`❌ Rejecting match: ${matchId} by giller: ${gillerId}, reason: ${reason}`);

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
        console.warn('⚠️ Match not in pending status:', match.status);
        return { success: false };
      }

      // 2. Update match status
      await matchDoc.ref.update({
        status: 'rejected',
        rejectionReason: reason || 'Giller rejected',
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
        console.log('⚠️ No more matches, request reset to pending');
      }

      console.log(`❌ Match rejected: ${matchId}`);

      return { success: true };
    } catch (error) {
      console.error('❌ Error in rejectMatch:', error);
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

    console.log(`🎉 Completing match: ${matchId} by user: ${userId}`);

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
        console.warn('⚠️ Match not in accepted status:', match.status);
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
      const serviceFee = Math.round(totalFare * PRICING_CONSTANTS.SERVICE_FEE_RATE);
      const baseEarnings = totalFare - serviceFee;

      // Get giller level for bonus
      const gillerDoc = await db.collection('users').doc(match.gillerId).get();
      const gillerData = gillerDoc.data();
      const gillerLevel = gillerData?.gillerProfile?.type || 'regular';

      let bonus = 0;
      if (gillerLevel === 'professional') {
        bonus = Math.round(baseEarnings * PRICING_CONSTANTS.PROFESSIONAL_BONUS_RATE);
      } else if (gillerLevel === 'master') {
        bonus = Math.round(baseEarnings * PRICING_CONSTANTS.MASTER_BONUS_RATE);
      }

      const totalEarnings = baseEarnings + bonus;

      // 4. Update delivery status
      await deliveryDoc.ref.update({
        status: 'completed',
        actualPickupTime: actualPickupTime || admin.firestore.FieldValue.serverTimestamp(),
        actualDeliveryTime: actualDeliveryTime || admin.firestore.FieldValue.serverTimestamp(),
        finalEarnings: {
          base: baseEarnings,
          bonus,
          total: totalEarnings,
        },
        rating: rating || null,
        feedback: feedback || null,
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
        console.log(`⭐ Rating saved: ${rating} stars`);
      }

      console.log(`🎉 Match completed: ${matchId}, earnings: ${totalEarnings}원`);

      return {
        success: true,
        finalEarnings: {
          base: baseEarnings,
          bonus,
          total: totalEarnings,
        },
      };
    } catch (error) {
      console.error('❌ Error in completeMatch:', error);
      throw new functions.https.HttpsError('internal', 'Error completing match');
    }
  }
);

// ==================== P3: B2B Scheduled Functions ====================

/**
 * Scheduled Function: Tax Invoice Scheduler
 * 매월 1일 00:00에 실행되어 B2B 계약 기업의 세금계산서를 자동 발행합니다.
 */
export const scheduledTaxInvoice = functions.pubsub
  .schedule('0 0 1 * *')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    console.warn('🧾 [Scheduled Tax Invoice] Triggered at:', new Date().toISOString());
    try {
      const result = await taxInvoiceScheduler();
      console.warn('✅ Tax invoice scheduler completed:', result);
      return null;
    } catch (error) {
      console.error('❌ Tax invoice scheduler error:', error);
      return null;
    }
  });

/**
 * Scheduled Function: Giller Settlement Scheduler
 * 매월 5일 00:00에 실행되어 B2B 길러의 월간 정산을 자동 처리합니다.
 */
export const scheduledGillerSettlement = functions.pubsub
  .schedule('0 0 5 * *')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    console.warn('💰 [Scheduled Giller Settlement] Triggered at:', new Date().toISOString());
    try {
      const result = await gillerSettlementScheduler();
      console.warn('✅ Giller settlement scheduler completed:', result);
      return null;
    } catch (error) {
      console.error('❌ Giller settlement scheduler error:', error);
      return null;
    }
  });
