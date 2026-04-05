/**
 * Request Service
 * 배송 요청 (Request) CRUD 서비스
 */

/* eslint-disable no-redeclare */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { bootstrapRequestCreationEngine } from './beta1-engine-service';
import { getTravelTimeConfig } from './config-service';
import { processMatchingForRequest } from './matching-service';
import {
  calculatePhase1DeliveryFee,
  PRICING_POLICY,
  type Phase1PricingParams,
  type PackageSizeType,
} from './pricing-service';
import type {
  Request,
  CreateRequestData,
  UpdateRequestData,
  RequestFilterOptions,
  StationInfo,
} from '../types/request';
import { RequestStatus } from '../types/request';

/**
 * 배송 요청 생성
 * @param requestData 요청 데이터
 * @returns 생성된 요청
 */
export async function createRequest(requestData: CreateRequestData): Promise<Request>;

export async function createRequest(
  requesterId: string,
  pickupStation: StationInfo,
  deliveryStation: StationInfo,
  urgency: string,
  packageInfo: any,
  feeInfo: any,
  recipientName: string,
  recipientPhone: string,
  preferredTime: Date,
  deadline: Date
): Promise<Request>;

export async function createRequest(
  requestDataOrUserId: CreateRequestData | string,
  pickupStation?: StationInfo,
  deliveryStation?: StationInfo,
  urgency?: string,
  packageInfo?: any,
  feeInfo?: any,
  recipientName?: string,
  recipientPhone?: string,
  preferredTime?: Date,
  deadline?: Date
): Promise<Request> {
  if (typeof requestDataOrUserId === 'string') {
    const requestData: CreateRequestData = {
      requesterId: requestDataOrUserId,
      pickupStation: pickupStation!,
      deliveryStation: deliveryStation!,
      packageInfo: packageInfo,
      initialNegotiationFee: feeInfo?.totalFee ?? 0,
      feeBreakdown: feeInfo,
      preferredTime: {
        departureTime: preferredTime ? preferredTime.toTimeString().slice(0, 5) : '09:00',
        arrivalTime: deadline ? deadline.toTimeString().slice(0, 5) : undefined,
      },
      deadline: deadline ?? new Date(Date.now() + 86400000),
      urgency: (urgency as 'low' | 'medium' | 'high') ?? 'medium',
    };
    return await createRequest(requestData);
  } else {
    try {
      validateRequestData(requestDataOrUserId);

      const requestsRef = collection(db, 'requests');
      const beta1Bootstrap = await bootstrapRequestCreationEngine(requestDataOrUserId);

      const newRequest: Omit<Request, 'requestId'> = {
        requesterId: requestDataOrUserId.requesterId,
        pickupStation: requestDataOrUserId.pickupStation,
        deliveryStation: requestDataOrUserId.deliveryStation,
        packageInfo: requestDataOrUserId.packageInfo,
        initialNegotiationFee: requestDataOrUserId.initialNegotiationFee,
        feeBreakdown: requestDataOrUserId.feeBreakdown,
        // 길러 앱과의 호환성을 위해 fee 필드 추가
        fee: requestDataOrUserId.feeBreakdown,
        preferredTime: requestDataOrUserId.preferredTime,
        deadline: requestDataOrUserId.deadline instanceof Timestamp
          ? requestDataOrUserId.deadline
          : Timestamp.fromDate(requestDataOrUserId.deadline),
        urgency: requestDataOrUserId.urgency ?? 'medium',
        status: 'pending' as RequestStatus,
        requestDraftId: beta1Bootstrap.requestDraft.requestDraftId,
        pricingQuoteId: beta1Bootstrap.selectedPricingQuote?.pricingQuoteId,
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      };

      const docRef = await addDoc(requestsRef, newRequest);

      // Request created

      return {
        requestId: docRef.id,
        ...newRequest,
      } as Request;
    } catch (error) {
      console.error('Error creating request:', error);
      throw error;
    }
  }
}

/**
 * 요청 ID로 배송 요청 조회
 * @param requestId 요청 ID
 * @returns 요청 데이터 또는 null
 */
export async function getRequestById(requestId: string): Promise<Request | null> {
  try {
    const docRef = doc(db, 'requests', requestId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      return null;
    }

    const data = docSnapshot.data();
    return {
      requestId: docSnapshot.id,
      ...data,
    } as Request;
  } catch (error) {
    console.error('Error fetching request:', error);
    throw error;
  }
}

/**
 * 사용자(요청자)의 배송 요청 목록 조회
 * @param requesterId 요청자 ID
 * @param options 필터 옵션
 * @returns 요청 목록
 */
export async function getRequestsByRequester(
  requesterId: string,
  options?: RequestFilterOptions
): Promise<Request[]> {
  try {
    let q = query(
      collection(db, 'requests'),
      where('requesterId', '==', requesterId)
    );

    // 상태 필터
    if (options?.status) {
      q = query(q, where('status', '==', options.status));
    }

    // limit
    if (options?.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    const requests: Request[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      requests.push({
        requestId: docSnapshot.id,
        ...data,
      } as Request);
    });

    // 정렬은 클라이언트 측에서 수행 (인덱스 불필요)
    requests.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() ?? 0;
      const bTime = b.createdAt?.toMillis() ?? 0;
      return bTime - aTime; // 내림차순
    });

    return requests;
  } catch (error) {
    console.error('Error fetching requests by requester:', error);
    throw error;
  }
}

/**
 * 길러의 매칭된 배송 요청 목록 조회
 * @param gillerId 길러 ID
 * @param options 필터 옵션
 * @returns 요청 목록
 */
export async function getRequestsByGiller(
  gillerId: string,
  options?: RequestFilterOptions
): Promise<Request[]> {
  try {
    let q = query(
      collection(db, 'requests'),
      where('matchedGillerId', '==', gillerId)
    );

    // 상태 필터
    if (options?.status) {
      q = query(q, where('status', '==', options.status));
    }

    // 정렬 (최신순)
    q = query(q, orderBy('createdAt', 'desc'));

    // limit
    if (options?.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    const requests: Request[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      requests.push({
        requestId: docSnapshot.id,
        ...data,
      } as Request);
    });

    return requests;
  } catch (error) {
    console.error('Error fetching requests by giller:', error);
    throw error;
  }
}

/**
 * 대기 중인 배송 요청 목록 조회 (매칭용)
 * @param options 필터 옵션
 * @returns 요청 목록
 */
export async function getPendingRequests(options?: RequestFilterOptions): Promise<Request[]> {
  try {
    let q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending')
    );

    // 정렬 (마감일 기준 오름차순)
    q = query(q, orderBy('deadline', 'asc'));

    // limit
    if (options?.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    const requests: Request[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      requests.push({
        requestId: docSnapshot.id,
        ...data,
      } as Request);
    });

    return requests;
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    throw error;
  }
}

/**
 * 배송 요청 업데이트 (내부 함수)
 */
async function updateRequestInternal(
  requestId: string,
  updateData: UpdateRequestData
): Promise<Request> {
  try {
    const docRef = doc(db, 'requests', requestId);

    const dataToUpdate: any = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, dataToUpdate);

    // Request updated

    const updated = await getRequestById(requestId);
    if (!updated) {
      throw new Error('Failed to fetch updated request');
    }

    return updated;
  } catch (error) {
    console.error('Error updating request:', error);
    throw error;
  }
}

/**
 * 배송 요청 상태 변경
 * @param requestId 요청 ID
 * @param status 새 상태
 * @param 추가 정보 (예: 매칭된 길러 ID)
 * @returns 업데이트된 요청
 */
export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  extras?: {
    matchedGillerId?: string;
    cancellationReason?: string;
    cancelledBy?: 'requester' | 'giller' | 'system';
  }
): Promise<Request> {
  try {
    const docRef = doc(db, 'requests', requestId);

    const updateData: any = {
      status,
      updatedAt: serverTimestamp(),
    };

    // 상태별 추가 정보
    if (status === 'matched' && extras?.matchedGillerId) {
      updateData.matchedGillerId = extras.matchedGillerId;
      updateData.matchedAt = serverTimestamp();
    } else if (status === 'accepted') {
      updateData.acceptedAt = serverTimestamp();
    } else if (status === 'in_transit') {
      updateData.pickedUpAt = serverTimestamp();
    } else if (status === 'arrived') {
      updateData.arrivedAt = serverTimestamp();
    } else if (status === 'delivered') {
      updateData.deliveredAt = serverTimestamp();
    } else if (status === 'completed') {
      updateData.requesterConfirmedAt = serverTimestamp();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = serverTimestamp();
      updateData.cancellationReason = extras?.cancellationReason;
      updateData.cancelledBy = extras?.cancelledBy;
      updateData.matchedGillerId = deleteField();
      updateData.matchedAt = deleteField();
      updateData.acceptedAt = deleteField();
      updateData.primaryDeliveryId = deleteField();
    }

    await updateDoc(docRef, updateData);

    // Request status updated

    const updated = await getRequestById(requestId);
    if (!updated) {
      throw new Error('Failed to fetch updated request');
    }

    return updated;
  } catch (error) {
    console.error('Error updating request status:', error);
    throw error;
  }
}

/**
 * 배송 요청 취소 (내부 함수)
 */
async function cancelRequestInternal(
  requestId: string,
  reason: string,
  cancelledBy: 'requester' | 'giller' | 'system' = 'requester'
): Promise<Request> {
  try {
    const request = await getRequestById(requestId);

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending' && request.status !== 'matched') {
      throw new Error(`Cannot cancel request with status: ${request.status}`);
    }

    return await updateRequestStatus(requestId, RequestStatus.CANCELLED, {
      cancellationReason: reason,
      cancelledBy,
    });
  } catch (error) {
    console.error('Error cancelling request:', error);
    throw error;
  }
}

/**
 * 배송 요청 삭제 (내부 함수)
 */
async function deleteRequestInternal(requestId: string): Promise<void> {
  try {
    const request = await getRequestById(requestId);

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'completed' && request.status !== 'cancelled') {
      throw new Error(`Cannot delete request with status: ${request.status}`);
    }

    await deleteDoc(doc(db, 'requests', requestId));

    // Request deleted
  } catch (error) {
    console.error('Error deleting request:', error);
    throw error;
  }
}

/**
 * 요청 데이터 유효성 검사
 * @param data 요청 데이터
 */
function validateRequestData(data: CreateRequestData): void {
  if (!data.requesterId) {
    throw new Error('Requester ID is required');
  }

  if (!data.pickupStation || !data.deliveryStation) {
    throw new Error('Pickup and delivery stations are required');
  }

  if (data.pickupStation.stationId === data.deliveryStation.stationId) {
    throw new Error('Pickup and delivery stations must be different');
  }

  if (!data.packageInfo) {
    throw new Error('Package information is required');
  }

  if (!data.initialNegotiationFee || data.initialNegotiationFee <= 0) {
    throw new Error('Fee must be greater than 0');
  }

  if (!data.deadline) {
    throw new Error('Deadline is required');
  }

  // 마감일은 미래여야 함
  const deadlineTime = data.deadline instanceof Timestamp
    ? data.deadline.toDate()
    : data.deadline;

  // Use current time with a small buffer (5 seconds) to account for processing delays
  const now = new Date(Date.now() - 5000);

  if (deadlineTime <= now) {
    console.error('Deadline validation failed:', {
      deadline: deadlineTime,
      now: now,
      deadlineMillis: deadlineTime.getTime(),
      nowMillis: now.getTime()
    });
    throw new Error('Deadline must be in the future');
  }
}

/**
 * 요청 통계 조회
 * @param requesterId 요청자 ID
 * @returns 통계
 */
export async function getRequestStats(requesterId: string): Promise<{
  totalRequests: number;
  completedRequests: number;
  cancelledRequests: number;
  inProgressRequests: number;
  averageFee: number;
}> {
  try {
    const allRequests = await getRequestsByRequester(requesterId);

    const completedRequests = allRequests.filter((r) => r.status === 'completed').length;
    const cancelledRequests = allRequests.filter((r) => r.status === 'cancelled').length;
    const inProgressRequests = allRequests.filter(
      (r) => r.status === 'matched' || r.status === 'in_transit'
    ).length;

    const totalFee = allRequests.reduce((sum, r) => sum + r.initialNegotiationFee, 0);
    const averageFee = allRequests.length > 0 ? totalFee / allRequests.length : 0;

    return {
      totalRequests: allRequests.length,
      completedRequests,
      cancelledRequests,
      inProgressRequests,
      averageFee,
    };
  } catch (error) {
    console.error('Error fetching request stats:', error);
    return {
      totalRequests: 0,
      completedRequests: 0,
      cancelledRequests: 0,
      inProgressRequests: 0,
      averageFee: 0,
    };
  }
}

/**
 * 요청 데이터 유효성 검사 (공개 API)
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateRequest(
  userId: string,
  pickupStation: StationInfo,
  deliveryStation: StationInfo,
  packageInfo: any,
  fee: any,
  recipientName: string,
  recipientPhone: string,
  _preferredTime?: Date,
  _deadline?: Date
): ValidationResult {
  const errors: string[] = [];

  // 사용자 ID 확인
  if (!userId) {
    errors.push('사용자 ID가 필요합니다.');
  }

  // 픽업/배송 역 확인
  if (!pickupStation?.stationId) {
    errors.push('픽업 역 정보가 필요합니다.');
  }

  if (!deliveryStation?.stationId) {
    errors.push('배송 역 정보가 필요합니다.');
  }

  // 픽업과 배송 역이 같은지 확인
  // if (pickupStation?.stationId === deliveryStation?.stationId) {
  //   throw new Error('Pickup and delivery stations must be different');
  // }

  // 수신자 정보 확인
  if (!recipientName || recipientName.trim().length === 0) {
    errors.push('수신자 이름이 필요합니다.');
  }

  // 전화번호 형식 확인 (010-XXXX-XXXX)
  const phonePattern = /^010-\d{4}-\d{4}$/;
  if (!recipientPhone || !phonePattern.test(recipientPhone)) {
    errors.push('수신자 전화번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)');
  }

  // 패키지 정보 확인
  if (!packageInfo) {
    errors.push('패키지 정보가 필요합니다.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 배송비 계산 (1단계: 지하철 to 지하철)
 * @param pickupStation 픽업 역
 * @param deliveryStation 배송 역
 * @param packageSize 패키지 크기
 * @param weight 무게 (kg)
 * @param urgencySurcharge 긴급 추가 요금 (기본값: 0)
 * @param manualAdjustment 수동 조정 금액 (기본값: 0)
 * @returns 배송비 정보
 */
export async function calculateDeliveryFee(
  pickupStation: StationInfo,
  deliveryStation: StationInfo,
  packageSize: 'small' | 'medium' | 'large' | 'xl',
  weight: number,
  urgencySurcharge: number = 0,
  manualAdjustment: number = 0
): Promise<{
  baseFee: number;
  distanceFee: number;
  sizeFee: number;
  weightFee: number;
  urgencySurcharge: number;
  manualAdjustment: number;
  serviceFee: number;
  subtotal: number;
  vat: number;
  totalFee: number;
  estimatedTime: number;
  breakdown?:{
    gillerFee: number;
    platformFee: number;
  };
}> {
  try{
    const travelTimeData = await getTravelTimeConfig(
      pickupStation.stationId,
      deliveryStation.stationId
    );

    const travelTimeSeconds = travelTimeData?.normalTime ?? 1800;
    const travelTimeMinutes = Math.round(travelTimeSeconds / 60);

    const stationCount = Math.max(2, Math.round(travelTimeMinutes / 2.5));

    const pricingParams: Phase1PricingParams = {
      stationCount,
      weight,
      packageSize: packageSize as PackageSizeType,
      urgency: 'normal',
    };

    const feeResult = calculatePhase1DeliveryFee(pricingParams);

    const subtotal = feeResult.baseFee + feeResult.distanceFee + feeResult.weightFee +
                     feeResult.sizeFee + feeResult.serviceFee + urgencySurcharge + manualAdjustment;
    const vat = Math.round(subtotal * 0.1);
    let totalFee = subtotal + vat;

    if (totalFee < PRICING_POLICY.MIN_FEE) totalFee = PRICING_POLICY.MIN_FEE;
    if (totalFee > PRICING_POLICY.MAX_FEE) totalFee = PRICING_POLICY.MAX_FEE;

    const platformFee = Math.round(totalFee * PRICING_POLICY.PLATFORM_FEE_RATE);
    const gillerFee = totalFee - platformFee;

    return {
      baseFee: feeResult.baseFee,
      distanceFee: feeResult.distanceFee,
      sizeFee: feeResult.sizeFee,
      weightFee: feeResult.weightFee,
      urgencySurcharge,
      manualAdjustment,
      serviceFee: feeResult.serviceFee,
      subtotal,
      vat,
      totalFee,
      estimatedTime: travelTimeMinutes,
      breakdown: {
        gillerFee,
        platformFee,
      },
    };
  } catch (error) {
    console.error('Error calculating delivery fee:', error);

    const stationCount = 5;
    const pricingParams: Phase1PricingParams = {
      stationCount,
      weight,
      packageSize: packageSize as PackageSizeType,
      urgency: 'normal',
    };

    const feeResult = calculatePhase1DeliveryFee(pricingParams);

    return {
      baseFee: feeResult.baseFee,
      distanceFee: feeResult.distanceFee,
      sizeFee: feeResult.sizeFee,
      weightFee: feeResult.weightFee,
      urgencySurcharge,
      manualAdjustment,
      serviceFee: feeResult.serviceFee,
      subtotal: feeResult.subtotal,
      vat: feeResult.vat,
      totalFee: feeResult.totalFee,
      estimatedTime: 30,
      breakdown: feeResult.breakdown,
    };
  }
}

export async function getRequest(requestId: string, userId: string): Promise<Request | null> {
  const request = await getRequestById(requestId);
  if (!request) return null;
  if (request.requesterId !== userId) return null;
  return request;
}

/**
 * 사용자의 배송 요청 목록 조회 (테스트 호환)
 */
export async function getUserRequests(userId: string): Promise<Request[]> {
  return getRequestsByRequester(userId);
}

function isRequestOwnedByUser(request: Request, userId: string): boolean {
  return (
    request.requesterId === userId ||
    (request as Request & { requesterUserId?: string }).requesterUserId === userId ||
    (request as Request & { gllerId?: string }).gllerId === userId
  );
}

export async function updateRequest(
  requestId: string,
  userId: string,
  updateData: Partial<UpdateRequestData>
): Promise<Request | null>;

export async function updateRequest(
  requestId: string,
  updateData: UpdateRequestData
): Promise<Request>;

export async function updateRequest(
  requestId: string,
  userIdOrUpdateData: string | UpdateRequestData,
  updateData?: Partial<UpdateRequestData>
): Promise<Request | null> {
  if (typeof userIdOrUpdateData === 'string') {
    const request = await getRequestById(requestId);
    if (!request) return null;
    if (!isRequestOwnedByUser(request, userIdOrUpdateData)) return null;
    return await updateRequestInternal(requestId, updateData!);
  } else {
    return await updateRequestInternal(requestId, userIdOrUpdateData);
  }
}

export async function cancelRequest(
  requestId: string,
  userId: string,
  reason: string
): Promise<Request | null>;

export async function cancelRequest(
  requestId: string,
  reason: string,
  cancelledBy?: 'requester' | 'giller' | 'system'
): Promise<Request>;

export async function cancelRequest(
  requestId: string,
  userIdOrReason: string,
  reasonOrCancelledBy?: string,
  cancelledBy?: 'requester' | 'giller' | 'system'
): Promise<Request | null> {
  if (typeof reasonOrCancelledBy === 'string') {
    const request = await getRequestById(requestId);
    if (!request) return null;
    if (!isRequestOwnedByUser(request, userIdOrReason)) return null;
    return await cancelRequestInternal(requestId, reasonOrCancelledBy, 'requester');
  } else {
    const resolvedCancelledBy: 'requester' | 'giller' | 'system' = cancelledBy ?? 'requester';
    return await cancelRequestInternal(requestId, userIdOrReason, resolvedCancelledBy);
  }
}

/**
 * 매칭 지연 시 이용자가 제안 금액을 빠르게 상향
 */
export async function increaseRequestBid(
  requestId: string,
  requesterId: string,
  amount: number = 500
): Promise<{ success: boolean; newFee?: number; message?: string }> {
  try {
    const request = await getRequestById(requestId);
    if (!request) {
      return { success: false, message: '요청을 찾을 수 없습니다.' };
    }
    if (request.requesterId !== requesterId) {
      return { success: false, message: '요청자만 금액을 변경할 수 있습니다.' };
    }
    if (request.status !== 'pending' && request.status !== 'matched') {
      return { success: false, message: '현재 상태에서는 금액을 변경할 수 없습니다.' };
    }

    const currentFee =
      request.fee?.totalFee ??
      request.initialNegotiationFee ??
      request.feeBreakdown?.totalFee ?? 3000;
    const nextFee = Math.min(PRICING_POLICY.MAX_FEE, currentFee + amount);

    const feeSnapshot = (request.fee || request.feeBreakdown || {}) as Record<string, unknown>;
    const nextFeeSnapshot = {
      ...feeSnapshot,
      totalFee: nextFee,
      breakdown: feeSnapshot.breakdown ?? {
        gillerFee: Math.round(nextFee * 0.9),
        platformFee: nextFee - Math.round(nextFee * 0.9),
      },
    };

    await updateDoc(doc(db, 'requests', requestId), {
      initialNegotiationFee: nextFee,
      fee: nextFeeSnapshot,
      feeBreakdown: nextFeeSnapshot,
      bidUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 금액 상향 시 매칭 재시도 알림
    void notifyGillers(requestId);

    return { success: true, newFee: nextFee };
  } catch (error) {
    console.error('Error increasing request bid:', error);
    return { success: false, message: '금액 상향에 실패했습니다.' };
  }
}

export async function deleteRequest(requestId: string, userId?: string): Promise<void | boolean> {
  if (userId !== undefined) {
    try {
      const request = await getRequestById(requestId);
      if (!request) return false;
      if (request.requesterId !== userId) return false;
      await deleteRequestInternal(requestId);
      return true;
    } catch (error) {
      console.error('[request-service] 요청 삭제 실패:', error);
      return false;
    }
  } else {
    await deleteRequestInternal(requestId);
  }
}

/**
 * 요청 상태 실시간 감시
 * @param requestId 요청 ID
 * @param callback 상태 변경 콜백
 * @returns 구독 해제 함수
 */
export function subscribeToRequest(
  requestId: string,
  callback: (request: Request | null) => void
): () => void {
  const docRef = doc(db, 'requests', requestId);

  const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      callback({
        requestId: docSnapshot.id,
        ...data,
      } as Request);
    } else {
      callback(null);
    }
  }, (error) => {
    const errorCode = typeof error === 'object' && error != null && 'code' in error
      ? (error as { code?: unknown }).code
      : null;
    const code = errorCode !== null && (typeof errorCode === 'string' || typeof errorCode === 'number')
      ? String(errorCode)
      : '';

    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      console.warn('Request subscription denied by Firestore rules.');
    } else {
      console.error('Error listening to request:', error);
    }
    callback(null);
  });

  return unsubscribe;
}

/**
 * 길러들에게 푸시 알림 전송
 * @param requestId 요청 ID
 * @returns 전송 결과
 */
export async function notifyGillers(requestId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const request = await getRequestById(requestId);
    if (!request) {
      return { success: false, error: '요청을 찾을 수 없습니다.' };
    }

    const matchCount = await processMatchingForRequest(requestId);
    if (matchCount === 0) {
      return { success: false, error: '매칭 가능한 길러가 없습니다.' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error notifying gillers:', error);
    return { success: false, error: error.message };
  }
}
