/**
 * Request Service
 * 배송 요청 (Request) CRUD 서비스
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTravelTimeConfig } from './config-service';
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
      fee: feeInfo?.totalFee || 0,
      preferredTime: {
        departureTime: preferredTime ? preferredTime.toTimeString().slice(0, 5) : '09:00',
        arrivalTime: deadline ? deadline.toTimeString().slice(0, 5) : undefined,
      },
      deadline: deadline || new Date(Date.now() + 86400000),
      urgency: (urgency as any) || 'medium',
    };
    return await createRequest(requestData);
  } else {
    try {
      validateRequestData(requestDataOrUserId);

      const requestsRef = collection(db, 'requests');

      const newRequest: Omit<Request, 'requestId'> = {
        requesterId: requestDataOrUserId.requesterId,
        pickupStation: requestDataOrUserId.pickupStation,
        deliveryStation: requestDataOrUserId.deliveryStation,
        packageInfo: requestDataOrUserId.packageInfo,
        fee: requestDataOrUserId.fee,
        preferredTime: requestDataOrUserId.preferredTime,
        deadline: requestDataOrUserId.deadline instanceof Timestamp
          ? requestDataOrUserId.deadline
          : Timestamp.fromDate(requestDataOrUserId.deadline),
        urgency: requestDataOrUserId.urgency || 'medium',
        status: 'pending' as RequestStatus,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      const docRef = await addDoc(requestsRef, newRequest);

      console.log('✅ Request created:', docRef.id);

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

    console.log('✅ Request updated:', requestId);

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
    } else if (status === 'in_progress') {
      updateData.pickedUpAt = serverTimestamp();
    } else if (status === 'completed') {
      updateData.deliveredAt = serverTimestamp();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = serverTimestamp();
      updateData.cancellationReason = extras?.cancellationReason;
      updateData.cancelledBy = extras?.cancelledBy;
    }

    await updateDoc(docRef, updateData);

    console.log(`✅ Request status updated to ${status}:`, requestId);

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

    console.log('✅ Request deleted:', requestId);
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

  if (!data.fee || data.fee <= 0) {
    throw new Error('Fee must be greater than 0');
  }

  if (!data.deadline) {
    throw new Error('Deadline is required');
  }

  // 마감일은 미래여야 함
  const deadlineTime = data.deadline instanceof Timestamp
    ? data.deadline.toDate()
    : data.deadline;

  if (deadlineTime <= new Date()) {
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
      (r) => r.status === 'matched' || r.status === 'in_progress'
    ).length;

    const totalFee = allRequests.reduce((sum, r) => sum + r.fee, 0);
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
  preferredTime?: Date,
  deadline?: Date
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
  if (pickupStation?.stationId === deliveryStation?.stationId) {
    errors.push('픽업 역과 배송 역이 같을 수 없습니다.');
  }

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
 * 배송비 계산
 * @param pickupStation 픽업 역
 * @param deliveryStation 배송 역
 * @param packageSize 패키지 크기
 * @param weight 무게 (kg)
 * @returns 배송비 정보
 */
export async function calculateDeliveryFee(
  pickupStation: StationInfo,
  deliveryStation: StationInfo,
  packageSize: 'small' | 'medium' | 'large' | 'xl',
  weight: number
): Promise<{
  baseFee: number;
  distanceFee: number;
  sizeFee: number;
  weightFee: number;
  serviceFee: number;
  vat: number;
  totalFee: number;
  estimatedTime: number; // 분
}> {
  try {
    // 1. 기본 요금 (3,000원)
    const baseFee = 3000;

    // 2. 거리 요금 (Travel Time 기반)
    const travelTimeData = await getTravelTimeConfig(
      pickupStation.stationId,
      deliveryStation.stationId
    );

    const travelTimeSeconds = travelTimeData?.normalTime ?? 1800; // 기본 30분
    const travelTimeMinutes = Math.round(travelTimeSeconds / 60);
    const distanceFee = Math.ceil(travelTimeMinutes / 10) * 500;

    // 3. 크기 요금
    const sizeFees: Record<string, number> = {
      small: 0,
      medium: 500,
      large: 1000,
      xl: 1500,
    };
    const sizeFee = sizeFees[packageSize] || 0;

    // 4. 무게 요금 (1kg 초과시 1kg당 300원)
    const weightFee = weight > 1 ? Math.ceil(weight - 1) * 300 : 0;

    // 5. 서비스 요금
    const serviceFee = 0;

    // 부가세 (10%)
    const subtotal = baseFee + distanceFee + sizeFee + weightFee + serviceFee;
    const vat = Math.round(subtotal * 0.1);

    // 총합
    const totalFee = subtotal + vat;

    return {
      baseFee,
      distanceFee,
      sizeFee,
      weightFee,
      serviceFee,
      vat,
      totalFee,
      estimatedTime: travelTimeMinutes,
    };
  } catch (error) {
    console.error('Error calculating delivery fee:', error);

    // 에러 시 기본값 반환
    const baseFee = 3000;
    const distanceFee = 1500;
    const sizeFee = 500;
    const weightFee = 300;
    const serviceFee = 0;
    const subtotal = baseFee + distanceFee + sizeFee + weightFee + serviceFee;
    const vat = Math.round(subtotal * 0.1);
    return {
      baseFee,
      distanceFee,
      sizeFee,
      weightFee,
      serviceFee,
      vat,
      totalFee: subtotal + vat,
      estimatedTime: 30,
    };
  }
}

/**
 * 요청 ID로 배송 요청 조회 (테스트 호환)
 * userId 검증 포함
 */
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
    if (request.requesterId !== userIdOrUpdateData) return null;
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
    if (request.requesterId !== userIdOrReason) return null;
    return await cancelRequestInternal(requestId, reasonOrCancelledBy, 'requester');
  } else {
    return await cancelRequestInternal(requestId, userIdOrReason, reasonOrCancelledBy as any || 'requester');
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
    } catch {
      return false;
    }
  } else {
    await deleteRequestInternal(requestId);
  }
}
