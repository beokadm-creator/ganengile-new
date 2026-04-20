/**
 * Cloud Functions for 媛?붽만??
 * FCM ?몄떆 ?뚮┝, ?먮룞 留ㅼ묶 ??
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  DeliveryRequest,
  TriggerMatchingData,
  TriggerMatchingResult,
} from './types';
import { fareCacheScheduler } from './scheduled/fare-cache-scheduler';
export { onNotificationCreated } from './notifications';
export { onRatingCreated } from './ratings';
export { tossWebhook } from './webhooks/toss-webhook';
export { partnerWebhook } from './webhooks/partner-webhook';
export { matchRequests, acceptMatch, rejectMatch, completeMatch } from './callables/matching';
import { createMatchesForRequest } from './callables/matching';
import { syncConfigStationsFromSeoulApi } from './station-sync';

// Initialize Firebase Admin (shared-admin.ts also guards this)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ==================== CI Verification APIs (PASS / Kakao) ====================
export { startCiVerificationSession, ciMock, issueKakaoCustomToken, ciVerificationCallback, completeCiVerificationTest } from './callables/ci-verification';

// ==================== Naver proxy ====================
export { naverStaticMapProxy, naverGeocodeProxy, naverReverseGeocodeProxy, naverDirectionsProxy, jusoAddressSearchProxy } from './callables/naver-proxy';

export { confirmDeliveryReceipt } from './callables/delivery';

// ==================== FCM Notification Functions ====================

export { onRequestCreated, onRequestStatusChanged } from './triggers/request-triggers';

export { sendMatchFoundNotification, cleanupOldNotifications, onChatMessageCreated } from './triggers/notification-triggers';

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
      console.error('Error triggering matching:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Error triggering matching');
    });
});

export { saveFCMToken } from './callables/fcm';

export { beta1AnalyzeRequestDraft, beta1GeneratePricingQuotes, beta1PlanMissionExecution } from './callables/beta1';

export { sendPushNotification } from './callables/fcm';

// ==================== P1: Professional Giller System ====================

export { reviewPromotion } from './callables/promotion';

export { onDeliveryCompleted } from './triggers/delivery-triggers';

export { calculateDeliveryRate, calculateDeliveryPricing } from './callables/pricing';

// ==================== P3: B2B Scheduled Functions Removed ====================

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

export { triggerFareCacheSync } from './callables/fare-cache';

export { requestPhoneOtp, confirmPhoneOtp } from './callables/otp';

export * from './triggers/accounting-stats-trigger';

export { syncConfigStationsFromSeoulApi };

export { registerTaxInfo } from './callables/tax';
