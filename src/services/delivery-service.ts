/**
 * Delivery Service
 * Handles delivery flow: accept → pickup → in_transit → arrived → completed → rating
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteField,
  query,
  where,
  serverTimestamp,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { bootstrapAcceptedDeliveryPlan } from './beta1-engine-service';
import { bundleMissionsForDelivery, persistActorSelectionDecision } from './beta1-orchestration-service';
import { planMissionExecutionWithAI } from './beta1-ai-service';
import { uploadPickupPhoto, uploadDeliveryPhoto } from './storage-service';
import { DepositService } from './DepositService';
import { createPenaltyService } from './penalty-service';
import { calculatePhase1DeliveryFee, type PackageSizeType } from './pricing-service';
import {
  createGillerEarning,
  getGillerEarningForRequest,
  getPayment,
  hasGillerEarningForRequest,
} from './payment-service';
import type { DeliveryStatus, DeliveryRequest } from '../types/delivery';
import { ActorSelectionActorType } from '../types/beta1';

function toPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
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
  requestStatus?: 'pending' | 'cancelled';
};

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
  return status === 'in_transit' || status === 'arrived' || status === 'at_locker';
}

/**
 * Pickup verification data
 */
export interface PickupVerificationData {
  deliveryId: string;
  gillerId: string;
  qrCodeData?: string;
  verificationCode: string; // 4-digit code
  photoUri: string; // Photo as base64 or file URI
  location: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Delivery completion data
 */
export interface DeliveryCompletionData {
  deliveryId: string;
  gillerId: string;
  verificationCode: string; // Recipient's 6-digit code
  photoUri?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

/**
 * Requester confirmation data
 */
export interface RequesterConfirmationData {
  deliveryId: string;
  requesterId: string;
  photoUri?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

/**
 * Giller accepts a delivery request
 * Updates request status from 'matched' to 'accepted'
 */
export async function gillerAcceptRequest(
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
    if (!request) {
      return { success: false, message: '요청 데이터를 찾을 수 없습니다.' };
    }

    if (request.status === 'accepted') {
      const existingDelivery = await getDeliveryByRequestId(requestId);
      if (existingDelivery) {
        return { success: false, message: '이미 수락된 요청입니다.' };
      }
      // 과거 실패 케이스(요청은 accepted인데 delivery 미생성)는 복구 허용
      console.warn('Recovering accepted request without delivery:', requestId);
    } else if (request.status !== 'matched' && request.status !== 'pending') {
      return { success: false, message: '수락할 수 없는 요청입니다.' };
    }

    // Extract fee information from various possible fields (for compatibility)
    const rawFee = request.fee || request.feeBreakdown;
    let confirmedFee: any = null;

    if (rawFee && typeof rawFee === 'object') {
      confirmedFee = {
        totalFee: rawFee.totalFee || request.initialNegotiationFee || 0,
        deliveryFee: rawFee.deliveryFee || rawFee.baseFee || 0,
        vat: rawFee.vat || 0,
        breakdown: rawFee.breakdown || (rawFee.totalFee ? {
          gillerFee: Math.floor(rawFee.totalFee * 0.9),
          platformFee: rawFee.totalFee - Math.floor(rawFee.totalFee * 0.9),
        } : undefined)
      };
    } else if (request.initialNegotiationFee || request.totalFee) {
      const totalAmount = request.initialNegotiationFee || request.totalFee;
      confirmedFee = {
        totalFee: totalAmount,
        deliveryFee: Math.floor(totalAmount / 1.1),
        vat: totalAmount - Math.floor(totalAmount / 1.1),
        breakdown: {
          gillerFee: Math.floor(totalAmount * 0.9),
          platformFee: totalAmount - Math.floor(totalAmount * 0.9),
        }
      };
    }

    // 실시간 운임 미반영 등으로 금액이 0인 요청은 최소 계산식으로 보정
    if (!confirmedFee?.totalFee || confirmedFee.totalFee <= 0) {
      const rawWeight = toPositiveNumber(
        request?.packageInfo?.weightKg,
        request?.packageInfo?.weight,
        request?.weight
      ) || 1;
      const stationCount = toPositiveNumber(
        request?.stationCount,
        request?.fee?.stationCount,
        request?.feeBreakdown?.stationCount
      ) || 5;
      const packageSize = (request?.packageInfo?.size || 'small') as PackageSizeType;
      const urgency = request?.urgency || 'normal';
      const publicFare = toPositiveNumber(
        request?.fee?.publicFare,
        request?.feeBreakdown?.publicFare
      ) || 0;

      const fallbackFee = calculatePhase1DeliveryFee({
        stationCount,
        weight: rawWeight,
        packageSize,
        urgency,
        publicFare,
      });

      confirmedFee = {
        totalFee: fallbackFee.totalFee,
        deliveryFee: fallbackFee.baseFee + fallbackFee.distanceFee + fallbackFee.weightFee + fallbackFee.sizeFee,
        vat: fallbackFee.vat,
        breakdown: fallbackFee.breakdown,
        publicFare: fallbackFee.publicFare,
      };
    }

    // Block if no valid fee information is found
    if (!confirmedFee?.totalFee || confirmedFee.totalFee <= 0) {
      console.error('Invalid fee information found for request:', requestId, request);
      return { success: false, message: '배송 요금 정보가 유효하지 않아 수락할 수 없습니다. 고객센터에 문의해주세요.' };
    }

    const recipientName = request.recipientName || request.receiverName || '수령인';
    const recipientPhone = request.recipientPhone || request.receiverPhone || '';
    const recipientVerificationCode =
      request.recipientVerificationCode ||
      request.verificationCode ||
      request.recipientCode ||
      '000000';

    // Create delivery document
    const deliveryData = {
      requestId,
      gllerId: request.requesterId || request.gllerId,
      gillerId,
      pickupStation: request.pickupStation,
      deliveryStation: request.deliveryStation,
      deliveryType: request.deliveryType || 'standard',
      packageInfo: request.packageInfo,
      fee: confirmedFee,
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

    const deliveryRef = await addDoc(collection(db, 'deliveries'), deliveryData);
    await bootstrapAcceptedDeliveryPlan({
      deliveryId: deliveryRef.id,
      requestId,
      requesterUserId: request.requesterId || request.gllerId,
      assignedGillerUserId: gillerId,
      pickupStation: request.pickupStation,
      deliveryStation: request.deliveryStation,
      deadline: request.deadline?.toDate?.() || request.deadline,
      currentReward: confirmedFee?.breakdown?.gillerFee || confirmedFee?.totalFee,
    });
    const missionPlan = await planMissionExecutionWithAI({
      requestId,
      deliveryId: deliveryRef.id,
      assignedGillerUserId: gillerId,
      pickupStation: request.pickupStation,
      deliveryStation: request.deliveryStation,
      requestContext: {
        itemDescription: request.packageInfo?.description,
        itemValue: request.itemValue,
        urgency: request.urgency,
        requestMode: request.requestMode,
        preferredPickupTime: request.preferredTime?.departureTime,
        preferredArrivalTime: request.preferredTime?.arrivalTime,
      },
    }).catch(() => null);
    await persistActorSelectionDecision({
      requestId,
      deliveryId: deliveryRef.id,
      interventionLevel: missionPlan?.actorSelection.interventionLevel ?? 'guarded_execute',
      selectedActorType: toActorSelectionType(missionPlan?.actorSelection.selectedActorType),
      selectionReason: '길러가 직접 수락한 미션이므로 사람 actor를 우선 확정합니다.',
      selectedPartnerId: missionPlan?.actorSelection.selectedPartnerId,
      fallbackActorTypes: toActorSelectionTypes(missionPlan?.actorSelection.fallbackActorTypes),
      fallbackPartnerIds: missionPlan?.actorSelection.fallbackPartnerIds ?? ['partner-a', 'partner-b'],
      manualReviewRequired: missionPlan?.actorSelection.manualReviewRequired ?? false,
      riskFlags: missionPlan?.actorSelection.riskFlags ?? [],
    });
    await bundleMissionsForDelivery(deliveryRef.id).catch(() => []);

    // Update request status + fee snapshot (delivery 생성 성공 후 반영)
    await updateDoc(requestRef, {
      status: 'accepted',
      matchedGillerId: gillerId,
      primaryDeliveryId: deliveryRef.id,
      fee: {
        totalFee: confirmedFee.totalFee,
        deliveryFee: confirmedFee.deliveryFee || 0,
        vat: confirmedFee.vat || 0,
        publicFare: confirmedFee.publicFare || 0,
        breakdown: confirmedFee.breakdown || null,
      },
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      message: '배송을 수락했습니다.',
      deliveryId: deliveryRef.id,
    };
  } catch (error) {
    console.error('Error accepting request:', error);
    return { success: false, message: '수락에 실패했습니다.' };
  }
}

/**
 * 길러가 수락을 취소하고 요청을 다시 매칭 대기로 되돌림
 * (픽업 시작 전 단계에서만 허용)
 */
export async function gillerCancelAcceptance(
  requestId: string,
  gillerId: string
): Promise<{ success: boolean; message: string }> {
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
    await penaltyService.applyCancellationPenalty(false, requestId).catch((error) => {
      console.warn('Failed to apply pre-pickup cancellation penalty:', error);
    });

    // 관련 delivery를 취소 상태로 변경
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

    return { success: true, message: '수락이 취소되었고 패널티가 반영된 뒤 다시 매칭 대기 상태로 전환되었습니다.' };
  } catch (error) {
    console.error('Error cancelling acceptance:', error);
    return { success: false, message: '수락 취소 처리에 실패했습니다.' };
  }
}

export async function cancelDeliveryFlow(args: {
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
        await penaltyService.applyCancellationPenalty(false, args.requestId).catch((error) => {
          console.error('Failed to apply pre-pickup cancellation penalty:', error);
        });

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
          depositStatus: deposit ? 'unchanged' : 'not_found',
          penaltyApplied: true,
        };
      }

      if (isPostPickupStatus(deliveryStatus)) {
        await penaltyService.applyCancellationPenalty(true, args.requestId).catch((error) => {
          console.error('Failed to apply post-pickup cancellation penalty:', error);
        });

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
    }

    await updateDoc(deliveryRef, {
      status: 'cancelled',
      cancellationReason: args.reason,
      cancelledBy: args.actorType,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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
      depositStatus: deposit ? 'unchanged' : 'not_found',
    };
  } catch (error) {
    console.error('Error cancelling delivery flow:', error);
    return { success: false, message: '취소 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * Verify pickup (QR code + 4-digit code + photo)
 * Updates delivery status from 'accepted' to 'in_transit'
 */
export async function verifyPickup(data: PickupVerificationData): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', data.deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();
    if (!delivery) {
      return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
    }

    if (delivery.status !== 'accepted') {
      return { success: false, message: '픽업 인증을 할 수 없는 상태입니다.' };
    }

    // Verify 4-digit code (would be generated when request is created)
    // For now, accept any 4-digit code
    if (data.verificationCode?.length !== 4) {
      return { success: false, message: '인증 코드가 올바르지 않습니다.' };
    }

    // Upload photo
    let photoUrl = '';
    if (data.photoUri) {
      try {
        photoUrl = await uploadPickupPhoto(data.deliveryId, data.photoUri);
      } catch (error: any) {
        console.error('Error uploading photo:', error);
        return { success: false, message: error.message || '사진 업로드에 실패했습니다.' };
      }
    }

    // Update delivery status
    await updateDoc(deliveryRef, {
      status: 'in_transit' as DeliveryStatus,
      'tracking.actualPickupTime': serverTimestamp(),
      pickupPhotos: [photoUrl],
      pickupVerificationCode: data.verificationCode,
      pickupLocation: data.location,
      'tracking.events': [
        ...delivery.tracking.events,
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

    // Also update request status
    if (delivery.requestId) {
      const requestRef = doc(db, 'requests', delivery.requestId);
      await updateDoc(requestRef, {
        status: 'in_transit' as DeliveryStatus,
        pickedUpAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, message: '픽업이 완료되었습니다.' };
  } catch (error) {
    console.error('Error verifying pickup:', error);
    return { success: false, message: '픽업 인증에 실패했습니다.' };
  }
}

/**
 * Update giller location during delivery
 */
export async function updateGillerLocation(
  deliveryId: string,
  location: { latitude: number; longitude: number }
): Promise<void> {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);

    await updateDoc(deliveryRef, {
      'tracking.courierLocation': {
        location,
        timestamp: new Date(),
        accuracy: 10, // meters
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating location:', error);
  }
}

/**
 * Complete delivery (verify recipient + optional photo)
 * Updates delivery status from 'arrived' to 'completed'
 */
export async function completeDelivery(data: DeliveryCompletionData): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', data.deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();
    if (!delivery) {
      return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
    }

    if (delivery.status !== 'arrived' && delivery.status !== 'in_transit') {
      return { success: false, message: '배송 완료를 할 수 없는 상태입니다.' };
    }

    // Verify recipient's 6-digit code
    if (data.verificationCode !== delivery.recipientInfo.verificationCode) {
      return { success: false, message: '인증 코드가 올바르지 않습니다.' };
    }

    // Upload delivery photo if provided
    let photoUrl = '';
    if (data.photoUri) {
      try {
        photoUrl = await uploadDeliveryPhoto(data.deliveryId, data.photoUri);
      } catch (error: any) {
        console.error('Error uploading photo:', error);
        // Continue without photo (optional)
      }
    }

    // Update delivery status
    await updateDoc(deliveryRef, {
      status: 'delivered' as DeliveryStatus,
      'tracking.actualDeliveryTime': serverTimestamp(),
      deliveryPhotos: photoUrl ? [photoUrl] : [],
      deliveryLocation: data.location,
      completionNote: data.notes,
      deliveredAt: serverTimestamp(),
      'tracking.events': [
        ...delivery.tracking.events,
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

    // Also update request status
    if (delivery.requestId) {
      const requestRef = doc(db, 'requests', delivery.requestId);
      await updateDoc(requestRef, {
        status: 'delivered' as DeliveryStatus,
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, message: '배송 전달이 완료되었습니다. 수령자 확인을 기다립니다.' };
  } catch (error) {
    console.error('Error completing delivery:', error);
    return { success: false, message: '배송 완료에 실패했습니다.' };
  }
}

/**
 * Requester confirms delivery after receiving the item
 * Finalizes settlement: refund deposit and create giller earning
 */
export async function confirmDeliveryByRequester(
  data: RequesterConfirmationData
): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', data.deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists()) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();
    if (!delivery) {
      return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
    }

    if (delivery.status === 'cancelled') {
      return { success: false, message: '취소된 배송은 확인할 수 없습니다.' };
    }

    const requestId = delivery.requestId;
    if (!requestId) {
      return { success: false, message: '요청 정보를 찾을 수 없습니다.' };
    }

    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);
    if (!requestDoc.exists()) {
      return { success: false, message: '요청 정보를 찾을 수 없습니다.' };
    }
    const request = requestDoc.data();

    const requesterId = request?.requesterId || delivery.gllerId;
    if (requesterId && requesterId !== data.requesterId) {
      return { success: false, message: '권한이 없습니다.' };
    }

    const confirmableStatuses = new Set(['delivered', 'at_locker', 'completed']);
    if (!confirmableStatuses.has(delivery.status)) {
      return { success: false, message: '수령 확인 대기 상태가 아닙니다.' };
    }

    let photoUrl = '';
    if (data.photoUri) {
      try {
        photoUrl = await uploadDeliveryPhoto(data.deliveryId, data.photoUri);
      } catch (error: any) {
        console.error('Error uploading confirmation photo:', error);
      }
    }

    if (delivery.requesterConfirmedAt) {
      return { success: true, message: '이미 수령 확인이 완료되었습니다.' };
    }

    const settlementRef = doc(db, 'settlements', requestId);
    const trackingEvents = Array.isArray(delivery.tracking?.events) ? delivery.tracking.events : [];

    const txResult = await runTransaction(db, async (tx) => {
      const settlementSnap = await tx.get(settlementRef);
      if (settlementSnap.exists() && settlementSnap.data()?.status === 'completed') {
        return { alreadyCompleted: true };
      }

      const now = serverTimestamp();

      if (!settlementSnap.exists()) {
        tx.set(settlementRef, {
          requestId,
          deliveryId: data.deliveryId,
          gillerId: delivery.gillerId,
          requesterId: data.requesterId,
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

      tx.update(deliveryRef, {
        status: 'completed' as DeliveryStatus,
        requesterConfirmedAt: now,
        requesterConfirmedBy: data.requesterId,
        confirmationPhotos: photoUrl ? [photoUrl] : [],
        confirmationNote: data.notes,
        'tracking.events': [
          ...trackingEvents,
          {
            type: 'confirmed_by_requester',
            timestamp: new Date(),
            description: '수령자가 배송을 확인했습니다',
            actorId: data.requesterId,
            location: data.location,
          },
        ],
        'tracking.progress': 100,
        updatedAt: now,
      });

      tx.update(requestRef, {
        status: 'completed' as DeliveryStatus,
        requesterConfirmedAt: now,
        requesterConfirmedBy: data.requesterId,
        updatedAt: now,
      });

      return { alreadyCompleted: false };
    });

    if (txResult.alreadyCompleted) {
      return { success: true, message: '이미 수령 확인이 완료되었습니다.' };
    }

    // Settlement: refund deposit and create earning (idempotent checks)
    const feeSource = (request?.fee || request?.feeBreakdown || delivery?.fee || null);
    const feeAmount =
      delivery?.fee?.totalFee ||
      request?.fee?.totalFee ||
      request?.initialNegotiationFee ||
      0;

    let refundStatus: 'refunded' | 'skipped' | 'failed' = 'skipped';
    let depositId: string | undefined;
    let depositAmount: number | undefined;
    let earningPaymentId: string | undefined;
    let earningPayment: Awaited<ReturnType<typeof getPayment>> | null = null;

    try {
      if (requestId) {
        const deposit = await DepositService.getDepositByRequestId(requestId);
        if (deposit) {
          depositId = deposit.depositId;
          depositAmount = deposit.depositAmount;
          if (deposit.status === 'paid') {
            const refundResult = await DepositService.refundDeposit(deposit.depositId);
            refundStatus = refundResult.success ? 'refunded' : 'failed';
          } else {
            refundStatus = 'skipped';
          }
        }
      }

      const customerPaidAmount = toPositiveNumber(
        feeSource?.totalFee,
        request?.initialNegotiationFee,
        feeAmount
      ) ?? 0;
      const publicFareAmount = toPositiveNumber(feeSource?.publicFare) ?? 0;
      const vatAmount = toPositiveNumber(feeSource?.vat) ?? 0;
      const feeSupplyAmount = Math.max(0, customerPaidAmount - vatAmount - publicFareAmount);
      const platformServiceFeeAmount = toPositiveNumber(feeSource?.serviceFee) ?? 0;
      const platformFeeAmount =
        toPositiveNumber(feeSource?.breakdown?.platformFee) ??
        Math.round(customerPaidAmount * 0.1);
      const gillerGrossAmount =
        toPositiveNumber(feeSource?.breakdown?.gillerFee) ??
        Math.max(0, customerPaidAmount - platformFeeAmount);

      if (delivery.gillerId && gillerGrossAmount > 0) {
        const alreadyEarned = await hasGillerEarningForRequest(delivery.gillerId, requestId);
        if (!alreadyEarned) {
          earningPaymentId = await createGillerEarning(
            delivery.gillerId,
            requestId,
            gillerGrossAmount,
            true,
            {
              platformFeeAlreadyDeducted: true,
              platformFeeAmount,
            }
          );
          earningPayment = await getPayment(earningPaymentId);
        } else {
          earningPayment = await getGillerEarningForRequest(delivery.gillerId, requestId);
          earningPaymentId = earningPayment?.paymentId;
        }
      }
      const gillerWithholdingTaxAmount = toPositiveNumber(earningPayment?.tax) ?? Math.round(gillerGrossAmount * 0.033);
      const gillerNetAmount = toPositiveNumber(earningPayment?.netAmount) ?? Math.max(0, gillerGrossAmount - gillerWithholdingTaxAmount);

      await updateDoc(settlementRef, {
        status: 'completed',
        depositId: depositId ?? null,
        depositAmount: depositAmount ?? null,
        refundStatus,
        earningPaymentId: earningPaymentId ?? null,
        earningAmount: gillerGrossAmount || null,
        customerPaidAmount,
        publicFareAmount,
        vatAmount,
        feeSupplyAmount,
        platformServiceFeeAmount,
        platformFeeAmount,
        gillerGrossAmount,
        gillerWithholdingTaxAmount,
        gillerNetAmount,
        settlementVersion: 2,
        pricingSnapshot: feeSource
          ? {
              totalFee: feeSource.totalFee ?? null,
              publicFare: feeSource.publicFare ?? null,
              vat: feeSource.vat ?? null,
              serviceFee: feeSource.serviceFee ?? null,
              breakdown: feeSource.breakdown ?? null,
            }
          : null,
        settledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      await updateDoc(settlementRef, {
        status: 'failed',
        depositId: depositId ?? null,
        depositAmount: depositAmount ?? null,
        refundStatus,
        earningPaymentId: earningPaymentId ?? null,
        earningAmount: feeAmount || null,
        errorMessage: error?.message || '정산 처리 실패',
        updatedAt: serverTimestamp(),
      });
      return { success: false, message: '정산 처리에 실패했습니다.' };
    }

    return { success: true, message: '수령 확인이 완료되었습니다.' };
  } catch (error) {
    console.error('Error confirming delivery:', error);
    return { success: false, message: '수령 확인에 실패했습니다.' };
  }
}

/**
 * Mark delivery as arrived at destination station
 */
export async function markAsArrived(deliveryId: string): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();
    if (!delivery) {
      return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
    }

    if (delivery.status !== 'in_transit') {
      return { success: false, message: '도착 처리를 할 수 없는 상태입니다.' };
    }

    await updateDoc(deliveryRef, {
      status: 'arrived' as DeliveryStatus,
      'tracking.events': [
        ...delivery.tracking.events,
        {
          type: 'arrived',
          timestamp: new Date(),
          description: '목적지에 도착했습니다',
        },
      ],
      'tracking.progress': 80,
      updatedAt: serverTimestamp(),
    });

    return { success: true, message: '목적지에 도착했습니다.' };
  } catch (error) {
    console.error('Error marking as arrived:', error);
    return { success: false, message: '도착 처리에 실패했습니다.' };
  }
}

/**
 * Get delivery by ID
 */
export async function getDeliveryById(deliveryId: string): Promise<DeliveryRequest | null> {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return null;
    }

    return {
      deliveryId,
      ...deliveryDoc.data(),
    } as any;
  } catch (error) {
    console.error('Error fetching delivery:', error);
    return null;
  }
}

/**
 * Get delivery by request ID
 */
export async function getDeliveryByRequestId(requestId: string): Promise<Record<string, any> | null> {
  try {
    const q = query(
      collection(db, 'deliveries'),
      where('requestId', '==', requestId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      deliveryId: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    console.error('Error fetching delivery by request ID:', error);
    return null;
  }
}

/**
 * Get giller's active deliveries
 */
export async function getGillerDeliveries(gillerId: string, status?: DeliveryStatus): Promise<any[]> {
  try {
    const q = query(collection(db, 'deliveries'), where('gillerId', '==', gillerId));
    const snapshot = await getDocs(q);
    const deliveries: any[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as any;
      if (status && data?.status !== status) return;
      deliveries.push({
        deliveryId: docSnapshot.id,
        ...data,
      });
    });

    deliveries.sort((a, b) => {
      const aMs = a?.createdAt?.toMillis?.() || 0;
      const bMs = b?.createdAt?.toMillis?.() || 0;
      return bMs - aMs;
    });
    return deliveries;
  } catch (error) {
    console.error('Error fetching giller deliveries:', error);
    return [];
  }
}

/**
 * Get gller's active deliveries
 */
export async function getGllerDeliveries(gllerId: string, status?: DeliveryStatus): Promise<any[]> {
  try {
    const q = query(collection(db, 'deliveries'), where('gllerId', '==', gllerId));
    const snapshot = await getDocs(q);
    const deliveries: any[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as any;
      if (status && data?.status !== status) return;
      deliveries.push({
        deliveryId: docSnapshot.id,
        ...data,
      });
    });

    deliveries.sort((a, b) => {
      const aMs = a?.createdAt?.toMillis?.() || 0;
      const bMs = b?.createdAt?.toMillis?.() || 0;
      return bMs - aMs;
    });
    return deliveries;
  } catch (error) {
    console.error('Error fetching gller deliveries:', error);
    return [];
  }
}

/**
 * Mark delivery as dropped at locker
 * 길러가 사물함에 물품을 보관한 후 호출
 * @param deliveryId 배송 ID
 * @param gillerId 길러 ID
 * @param lockerId 사물함 ID
 * @param reservationId 예약 ID
 * @returns 성공 여부
 */
export async function markAsDroppedAtLocker(
  deliveryId: string,
  gillerId: string,
  lockerId: string,
  reservationId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    const deliveryDoc = await getDoc(deliveryRef);

    if (!deliveryDoc.exists) {
      return { success: false, message: '배송 정보를 찾을 수 없습니다.' };
    }

    const delivery = deliveryDoc.data();
    if (!delivery) {
      return { success: false, message: '배송 데이터를 찾을 수 없습니다.' };
    }

    if (delivery.gillerId !== gillerId) {
      return { success: false, message: '권한이 없습니다.' };
    }

    // 배송 상태 업데이트
    await updateDoc(deliveryRef, {
      status: 'at_locker' as DeliveryStatus,
      lockerId,
      reservationId,
      'tracking.events': [
        ...delivery.tracking.events,
        {
          type: 'dropped_at_locker',
          timestamp: new Date(),
          description: '사물함에 물품을 보관했습니다',
          actorId: gillerId,
        },
      ],
      'tracking.progress': 60,
      updatedAt: serverTimestamp(),
    });

    // 요청 상태도 업데이트
    if (delivery.requestId) {
      const requestRef = doc(db, 'requests', delivery.requestId);
      await updateDoc(requestRef, {
        status: 'at_locker' as DeliveryStatus,
        lockerId,
        reservationId,
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, message: '사물함 인계가 완료되었습니다.' };
  } catch (error) {
    console.error('Error marking as dropped at locker:', error);
    return { success: false, message: '사물함 인계 처리에 실패했습니다.' };
  }
}

/**
 * requestId 기반으로 delivery 문서를 실시간 구독
 * delivery가 아직 생성되지 않은 경우(pending/matched) null을 콜백으로 전달
 */
export function subscribeToDeliveryByRequestId(
  requestId: string,
  callback: (delivery: Record<string, any> | null) => void
): () => void {
  const q = query(collection(db, 'deliveries'), where('requestId', '==', requestId));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        const docSnap = snapshot.docs[0];
        callback({ deliveryId: docSnap.id, ...docSnap.data() });
      }
    },
    (error) => {
      console.error('Error subscribing to delivery:', error);
      callback(null);
    }
  );

  return unsubscribe;
}
