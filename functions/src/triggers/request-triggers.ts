import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared-admin';
import { createMatchesForRequest } from '../callables/matching';
import type { DeliveryRequest, User } from '../types';
import { sendFCM } from './notification-triggers';
import { FdsService } from '../services/fds-service';
import { NHNAlimtalkService } from '../services/nhn-alimtalk-service';
import { getFunctionsPricingPolicyConfig } from '../pricing-policy-config';

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

/**
 * Cloud Function: Trigger matching when a new delivery request is created
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
 * Cloud Function: Handle request status changes
 * - 'accepted': Send notification to gller
 * - 'completed': Store pricing history, create giller earning, send notification
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

        const deliveryDoc = await db.collection('deliveries').doc(matchedDeliveryId).get();
        const deliveryData = deliveryDoc.data() as RequestAcceptedDeliveryDoc | undefined;
        const gillerName = deliveryDoc.exists ? (deliveryData?.gillerName ?? '길러') : '길러';

        const title = '배송 요청이 수락되었습니다.';
        const body = `${gillerName}님이 배송을 수락했습니다.`;

        let notificationSent = false;

        if (fcmToken) {
          try {
            await sendFCM(fcmToken, title, body, {
              type: 'request_accepted',
              requestId: context.params.requestId,
              deliveryId: matchedDeliveryId,
              screen: 'RequestDetail',
            });
            notificationSent = true;
            console.warn('App Push sent to Gller:', gllerId);
          } catch (error) {
            console.error('App Push failed for Gller:', error);
          }
        } else {
          console.warn('No FCM token for Gller:', gllerId);
        }

        // Fallback to NHN Alimtalk if FCM is not available or failed
        if (!notificationSent && gller?.phoneNumber) {
          const alimtalkSuccess = await NHNAlimtalkService.sendAlimtalk({
            recipientNo: gller.phoneNumber,
            templateCode: (await db.collection('system_settings').doc('nhn_alimtalk').get()).data()?.templates?.requestAccepted || 'REQUEST_ACCEPTED_V1',
            templateParams: {
              gillerName,
            }
          });
          if (alimtalkSuccess) {
            console.warn('NHN Alimtalk sent as fallback to Gller:', gllerId);
          }
        }

        console.warn('Request accepted notification process completed:', context.params.requestId);
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

      // 1. 길러 수익 레코드 생성 (플랫폼 수수료율 15% + 원천징수세율 3.3%)
      if (gillerId) {
        try {
          const totalFee: number = after.fee?.totalFee ?? 0;
          const requesterId: string = typeof after.requesterId === 'string' ? after.requesterId : '';

          if (totalFee > 0) {
            // FDS 자전거래 사후 체크
            const fdsResult = await FdsService.checkSelfMatching(requesterId, gillerId);
            let paymentStatus = 'completed';
            let description = '배송 완료 수익';
            
            if (fdsResult.isFraud) {
              console.error(`[FDS Flag] Request ${requestId} payment flagged for fraud: ${fdsResult.reason}`);
              paymentStatus = 'held'; // 관리자 승인 필요 상태로 보류
              description = `배송 완료 수익 (어뷰징 의심 보류: ${fdsResult.reason})`;
            }

            const pricingPolicy = await getFunctionsPricingPolicyConfig();
            const PLATFORM_FEE_RATE = pricingPolicy.platformFeeRate;
            const TAX_RATE = pricingPolicy.withholdingTaxRate;

            const platformFee = Math.round(totalFee * PLATFORM_FEE_RATE);
            const afterFee = totalFee - platformFee;
            const tax = Math.round(afterFee * TAX_RATE);
            const netAmount = afterFee - tax;

            // payments 컬렉션에 수익 레코드 생성
            const paymentRef = db.collection('payments').doc();
            await paymentRef.set({
              paymentId: paymentRef.id,
              userId: gillerId,
              type: 'giller_earning',
              amount: totalFee,
              fee: platformFee,
              tax,
              netAmount,
              status: paymentStatus,
              requestId,
              description,
              metadata: {
                platformFeeRate: PLATFORM_FEE_RATE,
                taxRate: TAX_RATE,
                taxWithheld: tax,
                isTaxable: true,
                fdsResult: fdsResult.isFraud ? fdsResult : null,
              },
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              completedAt: paymentStatus === 'completed' ? admin.firestore.FieldValue.serverTimestamp() : null,
            });

            if (paymentStatus === 'completed') {
              // 길러 사용자 문서 업데이트
              await db.collection('users').doc(gillerId).update({
                totalEarnings: admin.firestore.FieldValue.increment(netAmount),
                totalTaxWithheld: admin.firestore.FieldValue.increment(tax),
                earningsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.warn(`??Giller earning created for ${gillerId}: ${netAmount}??net (fee: ${platformFee}?? tax: ${tax}??`);
            } else {
              console.warn(`??Giller earning held for ${gillerId} due to FDS.`);
            }
          } else {
            console.warn(`?좑툘 No fee info for request ${requestId}, skipping earning creation`);
          }
        } catch (error) {
          console.error('Error creating giller earning:', error);
          // 수익 생성 실패해도 알림은 계속 전송
        }
      }

      // 2. 이용자(gller)에게 배송 완료 FCM 알림 전송
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

        const gillerName = after.gillerName ?? '길러';
        const title = '배송이 완료되었습니다.';
        const body = `${gillerName}님이 배송을 완료했습니다.`;

        let notificationSent = false;

        if (fcmToken) {
          try {
            await sendFCM(fcmToken, title, body, {
              type: 'delivery_completed',
              requestId,
              screen: 'RequestDetail',
            });
            notificationSent = true;
            console.warn('App Push sent to Gller:', gllerId);
          } catch (error) {
            console.error('App Push failed for Gller:', error);
          }
        } else {
          console.warn('No FCM token for Gller:', gllerId);
        }

        // Fallback to NHN Alimtalk if FCM is not available or failed
        if (!notificationSent && gller?.phoneNumber) {
          const alimtalkSuccess = await NHNAlimtalkService.sendAlimtalk({
            recipientNo: gller.phoneNumber,
            templateCode: (await db.collection('system_settings').doc('nhn_alimtalk').get()).data()?.templates?.deliveryCompleted || 'DELIVERY_COMPLETED_V1',
            templateParams: {
              gillerName,
            }
          });
          if (alimtalkSuccess) {
            console.warn('NHN Alimtalk sent as fallback to Gller:', gllerId);
          }
        }

        console.warn('Delivery completed notification process completed:', requestId);
        return null;
      } catch (error) {
        console.error('??Error sending delivery completed notification:', error);
        return null;
      }
    }

    return null;
  });
