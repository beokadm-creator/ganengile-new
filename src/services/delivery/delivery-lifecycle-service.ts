import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteField,
  query,
  where,
  serverTimestamp,
  runTransaction,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { planMissionExecutionWithAI } from '../beta1-ai-service';
import { uploadPickupPhoto, uploadDeliveryPhoto } from '../storage-service';
import { DepositService } from '../DepositService';
import { createPenaltyService } from '../penalty-service';
import {
  calculatePhase1DeliveryFee,
  type DeliveryFeeBreakdown,
  type PackageSizeType,
} from '../pricing-service';
import { getPricingPolicyConfig } from '../pricing-policy-config-service';
import { sendRequestExecutionNotification } from '../matching-notification';
import type { DeliveryStatus, DeliveryRequest } from '../../types/delivery';
import { ActorSelectionActorType } from '../../types/beta1';
import { getReservationByRequestId, cancelLockerReservation } from '../locker-service';

// ============================================================================
// Helper Functions & Types
// ============================================================================

function toPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return null;
}

function toFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

type CancellationActor = 'requester' | 'giller' | 'system';

type DeliveryCancellationResult = {
  success: boolean;
  message: string;
  penaltyApplied?: boolean;
  depositStatus?: 'unchanged' | 'refunded' | 'deducted' | 'failed' | 'not_found';
  requestStatus?: 'pending' | 'cancelled' | 'unchanged';
};

type LegacyFeeInput = {
  totalFee?: number | null;
  deliveryFee?: number | null;
  baseFee?: number | null;
  vat?: number | null;
  publicFare?: number | null;
  serviceFee?: number | null;
  stationCount?: number | null;
  manualAdjustment?: number | null;
  dynamicAdjustment?: number | null;
  breakdown?: DeliveryFeeBreakdown['breakdown'] | null;
};

type DeliveryRequestLike = {
  status?: string;
  beta1RequestStatus?: string;
  requestDraftId?: string | null;
  missionProgress?: {
    totalMissionCount?: number | null;
  } | null;
  requesterId?: string;
  gllerId?: string;
  pickupStation?: DeliveryRequest['pickupStation'];
  deliveryStation?: DeliveryRequest['deliveryStation'];
  deliveryType?: string;
  packageInfo?: DeliveryRequest['packageInfo'];
  fee?: LegacyFeeInput;
  feeBreakdown?: LegacyFeeInput;
  initialNegotiationFee?: number;
  totalFee?: number;
  stationCount?: number;
  weight?: number;
  urgency?: 'normal' | 'fast' | 'urgent';
  itemValue?: number;
  requestMode?: string;
  manualAdjustment?: number;
  dynamicAdjustment?: number;
  pricingPolicyVersion?: string | null;
  preferredTime?: {
    departureTime?: string;
    arrivalTime?: string;
  };
  recipientName?: string;
  receiverName?: string;
  recipientPhone?: string;
  receiverPhone?: string;
  recipientVerificationCode?: string;
  verificationCode?: string;
  recipientCode?: string;
};

function isMissionBoardManagedRequest(request: DeliveryRequestLike | undefined): boolean {
  if (!request) {
    return false;
  }
  if (typeof request.beta1RequestStatus === 'string' && request.beta1RequestStatus.length > 0) {
    return true;
  }
  if (typeof request.requestDraftId === 'string' && request.requestDraftId.length > 0) {
    return true;
  }
  const totalMissionCount = request.missionProgress?.totalMissionCount;
  return typeof totalMissionCount === 'number' && totalMissionCount > 0;
}

type NormalizedConfirmedFee = {
  totalFee: number;
  deliveryFee: number;
  vat: number;
  breakdown?: DeliveryFeeBreakdown['breakdown'];
  publicFare?: number;
};

type DeliveryTrackingEvent = {
  type: string;
  timestamp: Date;
  description: string;
  actorId?: string;
  location?: unknown;
};

type DeliveryTrackingPayload = {
  events?: DeliveryTrackingEvent[];
};

type DeliveryDocLike = {
  deliveryId?: string;
  requestId?: string;
  requesterId?: string;
  gillerId?: string;
  gllerId?: string;
  status?: string;
  lockerId?: string;
  pickupLockerId?: string | null;
  dropoffLockerId?: string | null;
  reservationId?: string;
  fee?: LegacyFeeInput;
  recipientInfo?: {
    verificationCode?: string;
  };
  requesterConfirmedAt?: Date | { toDate?: () => Date; toMillis?: () => number } | null;
  tracking?: DeliveryTrackingPayload;
  createdAt?: {
    toMillis?: () => number;
  };
  pickupVerificationCode?: string;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error != null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

function getTrackingEvents(delivery: DeliveryDocLike): DeliveryTrackingEvent[] {
  return Array.isArray(delivery.tracking?.events) ? delivery.tracking.events : [];
}

function toDeliveryDoc(value: unknown, deliveryId?: string): DeliveryDocLike | null {
  if (typeof value !== 'object' || value == null) {
    return null;
  }
  return {
    ...(value as DeliveryDocLike),
    deliveryId,
  };
}

function toActorSelectionType(value: unknown): ActorSelectionActorType {
  switch (value) {
    case ActorSelectionActorType.GILLER:
    case 'giller':
      return ActorSelectionActorType.GILLER;
    case ActorSelectionActorType.EXTERNAL_PARTNER:
    case 'external_partner':
      return ActorSelectionActorType.EXTERNAL_PARTNER;
    case ActorSelectionActorType.LOCKER:
    case 'locker':
      return ActorSelectionActorType.LOCKER;
    case ActorSelectionActorType.REQUESTER:
    case 'requester':
      return ActorSelectionActorType.REQUESTER;
    default:
      return ActorSelectionActorType.GILLER;
  }
}

function toActorSelectionTypes(values: unknown[] | undefined): ActorSelectionActorType[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [
      ActorSelectionActorType.LOCKER,
      ActorSelectionActorType.EXTERNAL_PARTNER,
      ActorSelectionActorType.REQUESTER,
    ];
  }
  return values.map((value) => toActorSelectionType(value));
}

function isPrePickupStatus(status: unknown): boolean {
  return status === 'accepted';
}

function isPostPickupStatus(status: unknown): boolean {
  return status === 'in_transit' || status === 'arrived' || status === 'at_locker' || status === 'delivered';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toLegacyFeeInput(value: unknown): LegacyFeeInput | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    totalFee: toPositiveNumber(value.totalFee),
    deliveryFee: toPositiveNumber(value.deliveryFee),
    baseFee: toPositiveNumber(value.baseFee),
    vat: toPositiveNumber(value.vat),
    publicFare: toPositiveNumber(value.publicFare),
    serviceFee: toPositiveNumber(value.serviceFee),
    stationCount: toPositiveNumber(value.stationCount),
    breakdown: isRecord(value.breakdown)
      ? {
          gillerFee: toPositiveNumber(value.breakdown.gillerFee) ?? 0,
          platformFee: toPositiveNumber(value.breakdown.platformFee) ?? 0,
        }
      : undefined,
  };
}

function normalizeConfirmedFee(request: DeliveryRequestLike): NormalizedConfirmedFee | null {
  const rawFee = toLegacyFeeInput(request.fee ?? request.feeBreakdown);

  if (rawFee) {
    const totalFee = rawFee.totalFee ?? request.initialNegotiationFee ?? 0;
    const deliveryFee = rawFee.deliveryFee ?? rawFee.baseFee ?? 0;

    if (totalFee > 0) {
      return {
        totalFee,
        deliveryFee,
        vat: rawFee.vat ?? 0,
        breakdown:
          rawFee.breakdown ??
          (totalFee > 0
            ? {
                gillerFee: Math.floor(totalFee * 0.9),
                platformFee: totalFee - Math.floor(totalFee * 0.9),
              }
            : undefined),
        publicFare: rawFee.publicFare ?? undefined,
      };
    }
  }

  const totalAmount = request.initialNegotiationFee ?? request.totalFee ?? 0;
  if (totalAmount > 0) {
    return {
      totalFee: totalAmount,
      deliveryFee: Math.floor(totalAmount / 1.1),
      vat: totalAmount - Math.floor(totalAmount / 1.1),
      breakdown: {
        gillerFee: Math.floor(totalAmount * 0.9),
        platformFee: totalAmount - Math.floor(totalAmount * 0.9),
      },
    };
  }

  return null;
}

export interface PickupVerificationData {
  deliveryId: string;
  gillerId: string;
  qrCodeData?: string;
  verificationCode: string;
  photoUri: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface DeliveryCompletionData {
  deliveryId: string;
  gillerId: string;
  verificationCode: string;
  photoUri?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

/**
 * Local helper to fetch delivery by requestId
 */
async function getDeliveryByRequestId(requestId: string): Promise<DeliveryDocLike | null> {
  try {
    const q = query(
      collection(db, 'deliveries'),
      where('requestId', '==', requestId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return toDeliveryDoc(docSnap.data(), docSnap.id);
  } catch (error) {
    console.error('Error fetching delivery by request ID:', error);
    return null;
  }
}

// ============================================================================
// Delivery Lifecycle Functions
// ============================================================================

async function cancelAllReservations(requestId: string) {
  try {
    const reservations = await getReservationByRequestId(requestId);
    for (const res of reservations) {
      if (res.status === 'pending' || res.status === 'pending_allocation' || res.status === 'active') {
        await cancelLockerReservation(res.reservationId);
      }
    }
  } catch(e) {
    console.error('Failed to cancel reservations', e);
  }
}

export const deliveryLifecycleService = {
  async gillerAcceptRequest(
    requestId: string,
    gillerId: string
  ): Promise<{ success: boolean; message: string; deliveryId?: string }> {
    try {
      const requestRef = doc(db, 'requests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        return { success: false, message: '요청을 찾을 수 없습니다.' };
      }

      const request = requestDoc.data() as DeliveryRequestLike | undefined;
      if (!request) {
        return { success: false, message: '요청 데이터를 찾을 수 없습니다.' };
      }

      if (isMissionBoardManagedRequest(request)) {
        return { success: false, message: '이 요청은 미션 보드에서 수락해야 합니다.' };
      }

      if (request.status === 'accepted') {
        const existingDelivery = await getDeliveryByRequestId(requestId);
        if (existingDelivery) {
          return { success: false, message: '이미 수락된 요청입니다.' };
        }
        console.warn('Recovering accepted request without delivery:', requestId);
      } else if (request.status !== 'matched' && request.status !== 'pending') {
        return { success: false, message: '수락할 수 없는 요청입니다.' };
      }

      let confirmedFee = normalizeConfirmedFee(request);

      if (!confirmedFee?.totalFee || confirmedFee.totalFee <= 0) {
        const rawWeight = toPositiveNumber(
          request?.packageInfo?.weightKg,
          request?.packageInfo?.weight,
          request?.weight
        ) ?? 1;
        const stationCount = toPositiveNumber(
          request?.stationCount,
          request?.fee?.stationCount,
          request?.feeBreakdown?.stationCount
        ) ?? 5;
        const packageSize = (request?.packageInfo?.size ?? 'small') as PackageSizeType;
        const urgency = request?.urgency ?? 'normal';
        const publicFare = toPositiveNumber(
          request?.fee?.publicFare,
          request?.feeBreakdown?.publicFare
        ) ?? 0;
        const manualAdjustment = toFiniteNumber(
          request?.fee?.manualAdjustment,
          request?.feeBreakdown?.manualAdjustment,
          request?.manualAdjustment
        ) ?? 0;
        const dynamicAdjustment = toFiniteNumber(
          request?.fee?.dynamicAdjustment,
          request?.feeBreakdown?.dynamicAdjustment,
          request?.dynamicAdjustment
        ) ?? 0;

        const pricingPolicy = await getPricingPolicyConfig();
        const fallbackFeeAdjusted = calculatePhase1DeliveryFee({
          stationCount,
          weight: rawWeight,
          packageSize,
          urgency,
          publicFare,
          manualAdjustment: manualAdjustment + dynamicAdjustment,
        }, pricingPolicy);

        confirmedFee = {
          totalFee: fallbackFeeAdjusted.totalFee,
          deliveryFee: fallbackFeeAdjusted.baseFee + fallbackFeeAdjusted.distanceFee + fallbackFeeAdjusted.weightFee + fallbackFeeAdjusted.sizeFee,
          vat: fallbackFeeAdjusted.vat,
          breakdown: fallbackFeeAdjusted.breakdown,
          publicFare: fallbackFeeAdjusted.publicFare,
        };
      }

      if (!confirmedFee?.totalFee || confirmedFee.totalFee <= 0) {
        console.error('Invalid fee information found for request:', requestId, request);
        return { success: false, message: '배송 요금 정보가 유효하지 않아 수락할 수 없습니다. 고객센터에 문의해주세요.' };
      }

      if (!request.pickupStation || !request.deliveryStation) {
        return { success: false, message: '출발지 또는 도착지 정보가 없어 배송을 생성할 수 없습니다.' };
      }

      const fallbackPickupCode = Math.floor(1000 + Math.random() * 9000).toString();
      const fallbackRecipientCode = Math.floor(100000 + Math.random() * 900000).toString();

      const recipientName = request.recipientName ?? request.receiverName ?? '수령인';
      const recipientPhone = request.recipientPhone ?? request.receiverPhone ?? '';
      const recipientVerificationCode =
        request.recipientVerificationCode ?? request.verificationCode ?? request.recipientCode ?? fallbackRecipientCode;

      const deliveryRef = doc(collection(db, 'deliveries'));
      const deliveryData = {
        requestId,
        gllerId: request.requesterId ?? request.gllerId,
        gillerId,
        pickupStation: request.pickupStation,
        deliveryStation: request.deliveryStation,
        deliveryType: request.deliveryType ?? 'standard',
        lockerId: (request as Record<string, unknown>).lockerId as string | undefined || undefined,
        reservationId: (request as Record<string, unknown>).reservationId as string | undefined || undefined,
        packageInfo: request.packageInfo,
        fee: confirmedFee,
        pricingPolicyVersion: request.pricingPolicyVersion ?? null,
        pickupVerificationCode: request.verificationCode ?? fallbackPickupCode,
        recipientInfo: {
          name: recipientName,
          phone: recipientPhone,
          verificationCode: recipientVerificationCode,
        },
        status: 'accepted' as DeliveryStatus,
        tracking: {
          events: [
            {
              type: 'accepted',
              timestamp: new Date(),
              description: '길러가 배송을 수락했습니다',
              actorId: gillerId,
            },
          ],
          progress: 20,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists()) {
          throw new Error('요청을 찾을 수 없습니다.');
        }
        
        const currentRequest = requestSnap.data() as DeliveryRequestLike;
        if (currentRequest.status !== 'matched' && currentRequest.status !== 'pending' && currentRequest.status !== 'accepted') {
          throw new Error('수락할 수 없는 상태입니다.');
        }

        transaction.set(deliveryRef, deliveryData);
        transaction.update(requestRef, {
          status: 'accepted',
          matchedGillerId: gillerId,
          primaryDeliveryId: deliveryRef.id,
          fee: {
            totalFee: confirmedFee.totalFee,
            deliveryFee: confirmedFee.deliveryFee ?? 0,
            vat: confirmedFee.vat ?? 0,
            publicFare: confirmedFee.publicFare ?? 0,
            breakdown: confirmedFee.breakdown ?? null,
          },
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      try {
        // AI 동기화 및 오케스트레이션 로직은 Cloud Functions 등 별도의 백엔드 이벤트 트리거로 분리하여
        // 클라이언트 서비스 간의 직접적인 순환 참조를 제거합니다.
        // 현재는 수락 성공 이벤트 로그만 남깁니다.
        console.info(`Delivery ${deliveryRef.id} accepted by giller ${gillerId}. AI sync should be handled via backend triggers.`);
      } catch (syncError) {
        console.error(`AI sync failed for delivery ${deliveryRef.id}. Rolling back acceptance:`, syncError);
        
        // 보상 트랜잭션 (롤백): AI 동기화 실패 시 배송 수락을 취소하고 다시 매칭 대기 상태로 돌림
        await runTransaction(db, async (rollbackTransaction) => {
          rollbackTransaction.delete(deliveryRef);
          rollbackTransaction.update(requestRef, {
            status: 'pending',
            matchedGillerId: deleteField(),
            primaryDeliveryId: deleteField(),
            fee: deleteField(),
            acceptedAt: deleteField(),
            updatedAt: serverTimestamp(),
          });
        });

        return { success: false, message: '배송 동기화에 실패하여 수락이 취소되었습니다. 다시 시도해주세요.' };
      }

      return {
        success: true,
        message: '배송을 수락했습니다.',
        deliveryId: deliveryRef.id,
      };
    } catch (error) {
      console.error('Error accepting request:', error);
      return { success: false, message: '수락에 실패했습니다.' };
    }
  },

  async gillerCancelAcceptance(
    requestId: string,
    gillerId: string
  ): Promise<DeliveryCancellationResult> {
    try {
      const requestRef = doc(db, 'requests', requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        return { success: false, message: '요청을 찾을 수 없습니다.' };
      }

      const request = requestSnap.data() as Record<string, unknown>;
      if (request.status !== 'accepted') {
        return { success: false, message: '수락 취소가 가능한 상태가 아닙니다.' };
      }
      if (request.matchedGillerId !== gillerId) {
        return { success: false, message: '본인이 수락한 요청만 취소할 수 있습니다.' };
      }

      const penaltyService = createPenaltyService(gillerId);
      try {
        await penaltyService.applyCancellationPenalty(false, requestId);
      } catch (error) {
        console.error('Failed to apply pre-pickup cancellation penalty:', error);
        return { success: false, message: '패널티 적용에 실패하여 취소할 수 없습니다. 다시 시도해주세요.' };
      }

      let depositStatus: DeliveryCancellationResult['depositStatus'] = 'not_found';
      const depositsSnap = await getDocs(
        query(
          collection(db, 'deposits'),
          where('requestId', '==', requestId),
          where('status', '==', 'paid')
        )
      );

      if (!depositsSnap.empty) {
        const depositDoc = depositsSnap.docs[0];
        const refundResult = await DepositService.refundDeposit(depositDoc.id);
        if (!refundResult.success) {
          console.error(`Failed to refund deposit ${depositDoc.id} during giller cancellation:`, refundResult.error);
          depositStatus = 'failed';
        } else {
          depositStatus = 'refunded';
        }
      }

      const deliveriesQ = query(collection(db, 'deliveries'), where('requestId', '==', requestId));
      const deliveriesSnap = await getDocs(deliveriesQ);
      for (const deliveryDoc of deliveriesSnap.docs) {
        const deliveryData = deliveryDoc.data() as Record<string, unknown>;
        if (deliveryData.gillerId !== gillerId) continue;
        await updateDoc(doc(db, 'deliveries', deliveryDoc.id), {
          status: 'cancelled',
          cancellationReason: 'giller_cancelled_before_pickup',
          cancelledBy: 'giller',
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await updateDoc(requestRef, {
        status: 'pending',
        matchedGillerId: deleteField(),
        primaryDeliveryId: deleteField(),
        acceptedAt: deleteField(),
        cancellationReason: 'giller_cancelled_before_pickup',
        cancelledBy: 'giller',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        message: '배송 수락이 취소되었습니다. 패널티가 부과되었으며 보증금이 환불되었습니다.',
        requestStatus: 'pending',
        depositStatus,
        penaltyApplied: true,
      };
    } catch (error) {
      console.error('Error cancelling acceptance:', error);
      return { success: false, message: '수락 취소 처리에 실패했습니다.' };
    }
  },

  async cancelDeliveryFlow(args: {
    requestId: string;
    actorId: string;
    actorType: CancellationActor;
    reason: string;
  }): Promise<DeliveryCancellationResult> {
    try {
      const requestRef = doc(db, 'requests', args.requestId);
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) {
        return { success: false, message: '요청 정보를 찾을 수 없습니다.' };
      }

      const delivery = await getDeliveryByRequestId(args.requestId);

      if (!delivery) {
        await cancelAllReservations(args.requestId);
        await updateDoc(requestRef, {
          status: 'cancelled',
          matchedGillerId: deleteField(),
          matchedAt: deleteField(),
          acceptedAt: deleteField(),
          primaryDeliveryId: deleteField(),
          cancellationReason: args.reason,
          cancelledBy: args.actorType,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return {
          success: true,
          message: '배송 생성 전 요청이 취소되었습니다.',
          requestStatus: 'cancelled',
          depositStatus: 'not_found',
        };
      }

      if (!delivery.deliveryId) {
        return { success: false, message: '배송 식별자가 없어 취소할 수 없습니다.' };
      }

      const deliveryRef = doc(db, 'deliveries', delivery.deliveryId);
      const deliveryStatus = delivery.status;
      const deposit = await DepositService.getDepositByRequestId(args.requestId);

      if (args.actorType === 'requester') {
        if (!isPrePickupStatus(deliveryStatus)) {
          return {
            success: false,
            message: '배송이 이미 진행 중이면 취소 대신 채팅 또는 분쟁 접수로 조정해야 합니다.',
            depositStatus: deposit ? 'unchanged' : 'not_found',
          };
        }

        let depositStatus: DeliveryCancellationResult['depositStatus'] = deposit ? 'unchanged' : 'not_found';
        if (deposit?.depositId) {
          const refundResult = await DepositService.refundDeposit(deposit.depositId);
          depositStatus = refundResult.success ? 'refunded' : 'failed';
        }

        await updateDoc(deliveryRef, {
          status: 'cancelled',
          cancellationReason: args.reason,
          cancelledBy: args.actorType,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await cancelAllReservations(args.requestId);

        await updateDoc(requestRef, {
          status: 'cancelled',
          matchedGillerId: deleteField(),
          matchedAt: deleteField(),
          acceptedAt: deleteField(),
          primaryDeliveryId: deleteField(),
          cancellationReason: args.reason,
          cancelledBy: args.actorType,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return {
          success: true,
          message: '수락된 배송이 취소되었고 보증금 환불도 함께 처리되었습니다.',
          requestStatus: 'cancelled',
          depositStatus,
        };
      }

      if (args.actorType === 'giller') {
        const penaltyService = createPenaltyService(args.actorId);

        if (isPrePickupStatus(deliveryStatus)) {
          try {
            await penaltyService.applyCancellationPenalty(false, args.requestId);
          } catch (error) {
            console.error('Failed to apply pre-pickup cancellation penalty:', error);
            return { success: false, message: '패널티 적용에 실패하여 취소할 수 없습니다. 다시 시도해주세요.', requestStatus: 'unchanged', depositStatus: 'unchanged' };
          }

          let depositStatus: DeliveryCancellationResult['depositStatus'] = deposit ? 'unchanged' : 'not_found';
          if (deposit?.depositId) {
            const refundResult = await DepositService.refundDeposit(deposit.depositId);
            depositStatus = refundResult.success ? 'refunded' : 'failed';
          }

          await updateDoc(deliveryRef, {
            status: 'cancelled',
            cancellationReason: args.reason,
            cancelledBy: args.actorType,
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await updateDoc(requestRef, {
            status: 'pending',
            matchedGillerId: deleteField(),
            acceptedAt: deleteField(),
            primaryDeliveryId: deleteField(),
            cancellationReason: args.reason,
            cancelledBy: args.actorType,
            updatedAt: serverTimestamp(),
          });

          return {
            success: true,
            message: '길러 수락이 취소되어 요청이 다시 매칭 대기로 돌아갔습니다.',
            requestStatus: 'pending',
            depositStatus,
            penaltyApplied: true,
          };
        }

        if (isPostPickupStatus(deliveryStatus)) {
          try {
            await penaltyService.applyCancellationPenalty(true, args.requestId);
          } catch (error) {
            console.error('Failed to apply post-pickup cancellation penalty:', error);
            return { success: false, message: '패널티 적용에 실패하여 취소할 수 없습니다. 다시 시도해주세요.', requestStatus: 'unchanged', depositStatus: 'unchanged' };
          }

          let depositStatus: DeliveryCancellationResult['depositStatus'] = deposit ? 'unchanged' : 'not_found';
          if (deposit?.depositId) {
            const deductionResult = await DepositService.deductCompensation(deposit.depositId);
            depositStatus = deductionResult.success ? 'deducted' : 'failed';
          }

          await updateDoc(deliveryRef, {
            status: 'cancelled',
            cancellationReason: args.reason,
            cancelledBy: args.actorType,
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await cancelAllReservations(args.requestId);
          await updateDoc(requestRef, {
            status: 'cancelled',
            matchedGillerId: deleteField(),
            matchedAt: deleteField(),
            acceptedAt: deleteField(),
            primaryDeliveryId: deleteField(),
            cancellationReason: args.reason,
            cancelledBy: args.actorType,
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          return {
            success: true,
            message: '진행 중 취소가 반영되었고 패널티와 보증금 차감이 함께 처리되었습니다.',
            requestStatus: 'cancelled',
            depositStatus,
            penaltyApplied: true,
          };
        }

        return {
          success: false,
          message: '이미 완료되거나 취소된 배송은 취소할 수 없습니다.',
          requestStatus: 'unchanged',
          depositStatus: deposit ? 'unchanged' : 'not_found',
        };
      }

      let depositStatus: DeliveryCancellationResult['depositStatus'] = deposit ? 'unchanged' : 'not_found';
      if (deposit?.depositId && (args.actorType === 'system' || (args.actorType as string) === 'admin')) {
        const refundResult = await DepositService.refundDeposit(deposit.depositId);
        depositStatus = refundResult.success ? 'refunded' : 'failed';
      }

      await updateDoc(deliveryRef, {
        status: 'cancelled',
        cancellationReason: args.reason,
        cancelledBy: args.actorType,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await cancelAllReservations(args.requestId);
      await updateDoc(requestRef, {
        status: 'cancelled',
        matchedGillerId: deleteField(),
        matchedAt: deleteField(),
        acceptedAt: deleteField(),
        primaryDeliveryId: deleteField(),
        cancellationReason: args.reason,
        cancelledBy: args.actorType,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        message: '취소가 반영되었습니다.',
        requestStatus: 'cancelled',
        depositStatus,
      };
    } catch (error) {
      console.error('Error cancelling delivery flow:', error);
      return { success: false, message: '취소 처리 중 오류가 발생했습니다.' };
    }
  },

  async verifyPickup(data: PickupVerificationData): Promise<{ success: boolean; message: string }> {
    try {
      const deliveryRef = doc(db, 'deliveries', data.deliveryId);
      const deliveryDoc = await getDoc(deliveryRef);

      if (!deliveryDoc.exists()) {
        return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
      }

      const delivery = toDeliveryDoc(deliveryDoc.data(), data.deliveryId);
      if (!delivery) {
        return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
      }

      if (delivery.status !== 'accepted') {
        return { success: false, message: '픽업 인증을 할 수 없는 상태입니다.' };
      }

      if (data.verificationCode !== delivery.pickupVerificationCode) {
        return { success: false, message: '픽업 인증 코드가 올바르지 않습니다.' };
      }

      let photoUrl = '';
      if (data.photoUri) {
        try {
          photoUrl = await uploadPickupPhoto(data.deliveryId, data.photoUri);
        } catch (error) {
          console.error('Error uploading photo:', error);
          return { success: false, message: toErrorMessage(error, '사진 업로드에 실패했습니다.') };
        }
      }

      await updateDoc(deliveryRef, {
        status: 'in_transit' as DeliveryStatus,
        'tracking.actualPickupTime': serverTimestamp(),
        pickupPhotos: [photoUrl],
        pickupVerificationCode: data.verificationCode,
        pickupLocation: data.location,
        'tracking.events': [
          ...getTrackingEvents(delivery),
          {
            type: 'picked_up',
            timestamp: new Date(),
            description: '물품을 수령했습니다',
            actorId: data.gillerId,
            location: data.location,
          },
        ],
        'tracking.progress': 50,
        updatedAt: serverTimestamp(),
      });

      if (delivery.requestId) {
        const requestRef = doc(db, 'requests', delivery.requestId);
        await updateDoc(requestRef, {
          status: 'in_transit' as DeliveryStatus,
          pickedUpAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (delivery.requesterId) {
          await sendRequestExecutionNotification(
            delivery.requesterId,
            delivery.requestId,
            'picked_up',
            '물건 인수가 확인되었습니다',
            '길러가 인수 확인을 마쳤습니다.'
          );
        }
      }

      return { success: true, message: '픽업이 완료되었습니다.' };
    } catch (error) {
      console.error('Error verifying pickup:', error);
      return { success: false, message: '픽업 인증에 실패했습니다.' };
    }
  },

  async updateGillerLocation(
    deliveryId: string,
    location: { latitude: number; longitude: number; accuracy?: number | null; speed?: number | null; heading?: number | null }
  ): Promise<void> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);
      const snapshotPoint = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: typeof location.accuracy === 'number' ? location.accuracy : 0,
        speed: typeof location.speed === 'number' ? location.speed : null,
        heading: typeof location.heading === 'number' ? location.heading : null,
        timestamp: new Date(),
      };

      await updateDoc(deliveryRef, {
        'tracking.courierLocation': {
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          timestamp: snapshotPoint.timestamp,
          accuracy: snapshotPoint.accuracy,
          speed: snapshotPoint.speed,
          heading: snapshotPoint.heading,
        },
        'tracking.locationHistory': arrayUnion(snapshotPoint),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  },

  async completeDelivery(data: DeliveryCompletionData): Promise<{ success: boolean; message: string }> {
    try {
      const deliveryRef = doc(db, 'deliveries', data.deliveryId);
      const deliveryDoc = await getDoc(deliveryRef);

      if (!deliveryDoc.exists()) {
        return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
      }

      const delivery = toDeliveryDoc(deliveryDoc.data(), data.deliveryId);
      if (!delivery) {
        return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
      }

      if (delivery.status !== 'arrived' && delivery.status !== 'in_transit') {
        return { success: false, message: '배송 완료를 할 수 없는 상태입니다.' };
      }

      if (data.verificationCode !== delivery.recipientInfo?.verificationCode) {
        return { success: false, message: '인증 코드가 올바르지 않습니다.' };
      }

      let photoUrl = '';
      if (data.photoUri) {
        try {
          photoUrl = await uploadDeliveryPhoto(data.deliveryId, data.photoUri);
        } catch (error) {
          console.error('Error uploading photo:', error);
        }
      }

      await updateDoc(deliveryRef, {
        status: 'delivered' as DeliveryStatus,
        'tracking.actualDeliveryTime': serverTimestamp(),
        deliveryPhotos: photoUrl ? [photoUrl] : [],
        deliveryLocation: data.location,
        completionNote: data.notes,
        deliveredAt: serverTimestamp(),
        'tracking.events': [
          ...getTrackingEvents(delivery),
          {
            type: 'delivered',
            timestamp: new Date(),
            description: '배송이 완료되었습니다 (수령 확인 대기)',
            actorId: data.gillerId,
            location: data.location,
          },
        ],
        'tracking.progress': 90,
        updatedAt: serverTimestamp(),
      });

      if (delivery.requestId) {
        const requestRef = doc(db, 'requests', delivery.requestId);
        await updateDoc(requestRef, {
          status: 'delivered' as DeliveryStatus,
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (delivery.requesterId) {
          await sendRequestExecutionNotification(
            delivery.requesterId,
            delivery.requestId,
            'delivered',
            '전달 완료가 등록되었습니다',
            '사진과 인증 정보가 함께 기록되었습니다.'
          );
        }
      }

      return { success: true, message: '배송 전달이 완료되었습니다. 수령자 확인을 기다립니다.' };
    } catch (error) {
      console.error('Error completing delivery:', error);
      return { success: false, message: '배송 완료에 실패했습니다.' };
    }
  },

  async markAsArrived(deliveryId: string): Promise<{ success: boolean; message: string }> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);
      const deliveryDoc = await getDoc(deliveryRef);

      if (!deliveryDoc.exists()) {
        return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
      }

      const delivery = toDeliveryDoc(deliveryDoc.data(), deliveryId);
      if (!delivery) {
        return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
      }

      if (delivery.status !== 'in_transit') {
        return { success: false, message: '도착 처리를 할 수 없는 상태입니다.' };
      }

      await updateDoc(deliveryRef, {
        status: 'arrived' as DeliveryStatus,
        'tracking.events': [
          ...getTrackingEvents(delivery),
          {
            type: 'arrived',
            timestamp: new Date(),
            description: '목적지에 도착했습니다',
          },
        ],
        'tracking.progress': 80,
        updatedAt: serverTimestamp(),
      });

      if (delivery.requestId) {
        const requestRef = doc(db, 'requests', delivery.requestId);
        await updateDoc(requestRef, {
          status: 'arrived' as DeliveryStatus,
          arrivedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (delivery.requesterId) {
          await sendRequestExecutionNotification(
            delivery.requesterId,
            delivery.requestId,
            'arrived',
            '목적지 도착이 확인되었습니다',
            '이제 전달 마무리를 진행합니다.'
          );
        }
      }

      return { success: true, message: '목적지에 도착했습니다.' };
    } catch (error) {
      console.error('Error marking as arrived:', error);
      return { success: false, message: '도착 처리에 실패했습니다.' };
    }
  },

  async markAsDroppedAtLocker(
    deliveryId: string,
    gillerId: string,
    lockerId: string,
    reservationId: string,
    lockerCredentials?: {
      lockerNumber?: string;
      password?: string;
      qrCodeUrl?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);
      const deliveryDoc = await getDoc(deliveryRef);

      if (!deliveryDoc.exists()) {
        return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
      }

      const delivery = toDeliveryDoc(deliveryDoc.data(), deliveryId);
      if (!delivery) {
        return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
      }

      // 레거시 gllerId 속성 호환
      if ((delivery.gillerId ?? delivery.gllerId) !== gillerId) {
        return { success: false, message: '권한이 없습니다.' };
      }

      const credentialsData = lockerCredentials ? {
        ...lockerCredentials,
        savedAt: new Date()
      } : null;

      const updateData: Record<string, unknown> = {
        status: 'at_locker' as DeliveryStatus,
        lockerId,
        dropoffLockerId: lockerId,
        reservationId,
        'tracking.events': [
          ...getTrackingEvents(delivery),
          {
            type: 'dropped_at_locker',
            timestamp: new Date(),
            description: '사물함에 물품을 보관했습니다',
            actorId: gillerId,
          },
        ],
        'tracking.progress': 60,
        updatedAt: serverTimestamp(),
      };

      if (credentialsData) {
        updateData.lockerCredentials = credentialsData;
        updateData.dropoffLockerCredentials = credentialsData;
      }

      await updateDoc(deliveryRef, updateData);

      if (delivery.requestId) {
        const requestRef = doc(db, 'requests', delivery.requestId);
        const reqUpdateData: Record<string, unknown> = {
          status: 'at_locker' as DeliveryStatus,
          lockerId,
          dropoffLockerId: lockerId,
          reservationId,
          updatedAt: serverTimestamp(),
        };
        if (credentialsData) {
          reqUpdateData.dropoffLockerCredentials = credentialsData;
        }
        await updateDoc(requestRef, reqUpdateData);
      }

      return { success: true, message: '사물함 인계가 완료되었습니다.' };
    } catch (error) {
      console.error('Error marking as dropped at locker:', error);
      return { success: false, message: '사물함 인계 처리에 실패했습니다.' };
    }
  },

  async markAsRequesterDroppedAtLocker(
    requestId: string,
    lockerId: string,
    reservationId: string,
    lockerCredentials?: {
      lockerNumber?: string;
      password?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const requestRef = doc(db, 'requests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        return { success: false, message: '요청 정보를 찾을 수 없습니다.' };
      }

      const credentialsData = lockerCredentials ? {
        ...lockerCredentials,
        savedAt: new Date()
      } : null;

      const reqUpdateData: Record<string, unknown> = {
        status: 'at_locker' as DeliveryStatus,
        lockerId: lockerId,
        pickupLockerId: lockerId,
        reservationId,
        updatedAt: serverTimestamp(),
      };
      
      if (credentialsData) {
        reqUpdateData.pickupLockerCredentials = credentialsData;
      }
      
      await updateDoc(requestRef, reqUpdateData);

      // If delivery already exists, update it too
      const delivery = await getDeliveryByRequestId(requestId);
      if (delivery && delivery.deliveryId) {
        const deliveryRef = doc(db, 'deliveries', delivery.deliveryId);
        const delUpdateData: Record<string, unknown> = {
          status: 'at_locker' as DeliveryStatus,
          lockerId,
          pickupLockerId: lockerId,
          updatedAt: serverTimestamp(),
        };
        
        if (credentialsData) {
          delUpdateData.pickupLockerCredentials = credentialsData;
        }
        
        await updateDoc(deliveryRef, delUpdateData);
      }

      return { success: true, message: '사물함 인계가 완료되었습니다.' };
    } catch (error) {
      console.error('Error marking requester dropoff at locker:', error);
      return { success: false, message: '사물함 인계 처리에 실패했습니다.' };
    }
  },
};
