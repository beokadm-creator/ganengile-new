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
import { getPricingPolicyConfig } from './pricing-policy-config-service';
import { getRoutePricingOverride } from './route-pricing-override-service';
import type {
  Request,
  CreateRequestData,
  UpdateRequestData,
  RequestFilterOptions,
  StationInfo,
  PackageInfo,
  RequestPricingContext,
} from '../types/request';
import { PackageSize, PackageWeight, RequestStatus } from '../types/request';

type LegacyCreateFeeInfo = {
  totalFee?: number;
  [key: string]: unknown;
};

type LegacyCreatePackageInfo = {
  size?: PackageInfo['size'];
  weight?: PackageInfo['weight'] | number | string;
  weightKg?: number;
  description?: string;
  imageUrl?: string;
  [key: string]: unknown;
};

type RequestStatusUpdatePayload = {
  status: RequestStatus;
  updatedAt: ReturnType<typeof serverTimestamp>;
  matchedGillerId?: string | ReturnType<typeof deleteField>;
  matchedAt?: ReturnType<typeof serverTimestamp>;
  acceptedAt?: ReturnType<typeof serverTimestamp>;
  pickedUpAt?: ReturnType<typeof serverTimestamp>;
  arrivedAt?: ReturnType<typeof serverTimestamp>;
  deliveredAt?: ReturnType<typeof serverTimestamp>;
  requesterConfirmedAt?: ReturnType<typeof serverTimestamp>;
  cancelledAt?: ReturnType<typeof serverTimestamp>;
  cancellationReason?: string;
  cancelledBy?: 'requester' | 'giller' | 'system';
  primaryDeliveryId?: ReturnType<typeof deleteField>;
};

type FeeSnapshot = {
  totalFee?: number;
  breakdown?: {
    gillerFee?: number;
    platformFee?: number;
  };
  [key: string]: unknown;
};

type TimestampLike = Timestamp | { toDate?: () => Date; toMillis?: () => number };

type RequestDocShape = Partial<Request> & {
  pickupAddress?: Request['pickupAddress'] | string | null;
  deliveryAddress?: Request['deliveryAddress'] | string | null;
  pickupAddressDetail?: Request['pickupAddress'] | null;
  deliveryAddressDetail?: Request['deliveryAddress'] | null;
  selectedPhotoIds?: unknown;
  packageInfo?: Request['packageInfo'] & { imageUrl?: string };
  recipientName?: unknown;
  recipientPhone?: unknown;
  pickupLocationDetail?: unknown;
  storageLocation?: unknown;
  specialInstructions?: unknown;
  missionProgress?: Request['missionProgress'];
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
};

export type RoutePriceInsight = {
  averageFee: number;
  minFee: number;
  maxFee: number;
  sampleCount: number;
  recommendedFee: number;
  routeKey: string;
  averageDynamicAdjustment: number;
  contextSummary: string;
  recommendationReason: string;
  policyVersion: string | null;
  routeOverride: {
    enabled: boolean;
    fixedAdjustment: number;
    multiplier: number;
    minCompletedCount: number;
    applied: boolean;
  } | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildRouteKey(pickupStationId: string, deliveryStationId: string, requestMode?: string): string {
  const mode = requestMode === 'reservation' ? 'reservation' : 'immediate';
  return `${pickupStationId}_${deliveryStationId}_${mode}`;
}

function resolveUrgencyBucket(urgency?: CreateRequestData['urgency']): RequestPricingContext['urgencyBucket'] {
  if (urgency === 'high') {
    return 'urgent';
  }
  if (urgency === 'medium') {
    return 'fast';
  }
  return 'normal';
}

function inferRequestedHour(requestData: CreateRequestData): number {
  const departureTime = requestData.preferredTime?.departureTime;
  if (typeof departureTime === 'string') {
    const [hourText] = departureTime.split(':');
    const hour = Number(hourText);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      return hour;
    }
  }

  return new Date().getHours();
}

function isPeakHour(hour: number): boolean {
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
}

function buildRequestPricingContext(requestData: CreateRequestData): RequestPricingContext {
  const requestMode = requestData.requestMode === 'reservation' ? 'reservation' : 'immediate';
  const requestedHour = inferRequestedHour(requestData);

  return {
    requestMode,
    weather: requestData.pricingContext?.weather ?? 'clear',
    isPeakTime: requestData.pricingContext?.isPeakTime ?? isPeakHour(requestedHour),
    isProfessionalPeak: requestData.pricingContext?.isProfessionalPeak ?? false,
    nearbyGillerCount: requestData.pricingContext?.nearbyGillerCount ?? null,
    requestedHour,
    urgencyBucket: requestData.pricingContext?.urgencyBucket ?? resolveUrgencyBucket(requestData.urgency),
  };
}

function summarizeInsightContext(input: {
  requestMode?: 'immediate' | 'reservation';
  peakSamples: number;
  immediateSamples: number;
  reservationSamples: number;
  sampleCount: number;
  averageDynamicAdjustment: number;
  currentWeather?: 'clear' | 'rain' | 'snow';
  nearbyGillerCount?: number | null;
  isProfessionalPeak?: boolean;
}): { contextSummary: string; recommendationReason: string } {
  const modeLabel = input.requestMode === 'reservation' ? '예약 요청' : '즉시 요청';
  const dominantMode =
    input.immediateSamples >= input.reservationSamples ? '즉시 요청 비중이 높고' : '예약 요청 비중이 높고';
  const peakShare = input.sampleCount > 0 ? input.peakSamples / input.sampleCount : 0;

  const contextSummary =
    input.averageDynamicAdjustment > 0
      ? `${modeLabel} 기준 최근 완료 이력에서 환경 가산이 반영된 구간입니다.`
      : `${modeLabel} 기준 최근 완료 이력을 바탕으로 계산했습니다.`;

  let recommendationReason = `${dominantMode} 최근 완료 요금 흐름을 기준으로 추천 금액을 만들었습니다.`;

  if (peakShare >= 0.4) {
    recommendationReason = `피크 시간대 완료 비중이 높아 ${dominantMode} 추천 금액을 조금 보수적으로 잡았습니다.`;
  } else if (input.averageDynamicAdjustment < 0) {
    recommendationReason = `공급이 넉넉했던 완료 이력이 많아 ${dominantMode} 추천 금액을 완만하게 유지했습니다.`;
  }

  if (input.currentWeather === 'snow') {
    recommendationReason = '눈 오는 상황까지 반영해 추천 금액을 조금 더 높게 잡았습니다.';
  } else if (input.currentWeather === 'rain') {
    recommendationReason = '비 오는 상황을 반영해 추천 금액을 소폭 높게 잡았습니다.';
  } else if (typeof input.nearbyGillerCount === 'number' && input.nearbyGillerCount <= 3) {
    recommendationReason = '주변 길러 수가 적은 편이라 응답 가능성을 높이도록 추천 금액을 조정했습니다.';
  } else if (input.isProfessionalPeak) {
    recommendationReason = '전문 길러 피크 시간대를 반영해 추천 금액을 보수적으로 잡았습니다.';
  }

  return {
    contextSummary,
    recommendationReason,
  };
}

function calculateInsightRecommendation(input: {
  averageFee: number;
  requestMode?: 'immediate' | 'reservation';
  peakSamples: number;
  immediateSamples: number;
  reservationSamples: number;
  sampleCount: number;
  currentWeather?: 'clear' | 'rain' | 'snow';
  nearbyGillerCount?: number | null;
  isProfessionalPeak?: boolean;
  pricingPolicy: Awaited<ReturnType<typeof getPricingPolicyConfig>>;
  routeOverride?: {
    enabled: boolean;
    fixedAdjustment: number;
    multiplier: number;
    minCompletedCount: number;
  } | null;
}): number {
  const { pricingPolicy } = input;
  let multiplier = pricingPolicy.recommendationMultiplier;

  if (input.sampleCount > 0 && input.peakSamples / input.sampleCount >= 0.4) {
    multiplier += pricingPolicy.recommendationRules.peakTimeMultiplier;
  }

  if (input.isProfessionalPeak) {
    multiplier += pricingPolicy.recommendationRules.professionalPeakMultiplier;
  }

  if (input.currentWeather === 'rain') {
    multiplier += pricingPolicy.recommendationRules.rainMultiplier;
  } else if (input.currentWeather === 'snow') {
    multiplier += pricingPolicy.recommendationRules.snowMultiplier;
  }

  if (typeof input.nearbyGillerCount === 'number') {
    if (input.nearbyGillerCount <= pricingPolicy.dynamicRules.lowSupplyThreshold) {
      multiplier += pricingPolicy.recommendationRules.lowSupplyMultiplier;
    } else if (input.nearbyGillerCount >= pricingPolicy.dynamicRules.highSupplyThreshold) {
      multiplier += pricingPolicy.recommendationRules.highSupplyDiscountMultiplier;
    }
  }

  if (input.requestMode === 'reservation') {
    multiplier += pricingPolicy.recommendationRules.reservationDiscountMultiplier;
  }

  multiplier = Math.max(1, Math.min(pricingPolicy.recommendationRules.maxRecommendationMultiplier, multiplier));
  let recommendedFee = Math.max(
    input.averageFee,
    Math.ceil((input.averageFee * multiplier) / pricingPolicy.bidStep) * pricingPolicy.bidStep
  );

  if (
    input.routeOverride?.enabled &&
    input.sampleCount >= input.routeOverride.minCompletedCount
  ) {
    recommendedFee = Math.ceil(
      ((recommendedFee * input.routeOverride.multiplier) + input.routeOverride.fixedAdjustment) /
        pricingPolicy.bidStep
    ) * pricingPolicy.bidStep;
  }

  return recommendedFee;
}

function toLegacyPackageInfo(packageInfo?: LegacyCreatePackageInfo): PackageInfo {
  const size =
    packageInfo?.size === PackageSize.SMALL ||
    packageInfo?.size === PackageSize.MEDIUM ||
    packageInfo?.size === PackageSize.LARGE ||
    packageInfo?.size === PackageSize.EXTRA_LARGE
      ? packageInfo.size
      : PackageSize.MEDIUM;

  const weight =
    packageInfo?.weight === PackageWeight.LIGHT ||
    packageInfo?.weight === PackageWeight.MEDIUM ||
    packageInfo?.weight === PackageWeight.HEAVY
      ? packageInfo.weight
      : PackageWeight.MEDIUM;

  return {
    size,
    weight,
    weightKg: typeof packageInfo?.weightKg === 'number' ? packageInfo.weightKg : undefined,
    description: typeof packageInfo?.description === 'string' ? packageInfo.description : '',
    imageUrl: typeof packageInfo?.imageUrl === 'string' ? packageInfo.imageUrl : undefined,
  };
}

function isTimestampLike(value: unknown): value is Timestamp {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readDetailedAddress(value: unknown): Request['pickupAddress'] | undefined {
  if (typeof value !== 'object' || value == null) {
    return undefined;
  }

  const roadAddress = readString((value as { roadAddress?: unknown }).roadAddress);
  const detailAddress = readString((value as { detailAddress?: unknown }).detailAddress) ?? '';
  const fullAddress = readString((value as { fullAddress?: unknown }).fullAddress);

  if (!roadAddress) {
    return undefined;
  }

  return {
    roadAddress,
    detailAddress,
    fullAddress: fullAddress ?? [roadAddress, detailAddress].filter(Boolean).join(' '),
  };
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function normalizeRequestDoc(requestId: string, raw: RequestDocShape): Request {
  const pickupAddress = readDetailedAddress(raw.pickupAddressDetail) ?? readDetailedAddress(raw.pickupAddress);
  const deliveryAddress =
    readDetailedAddress(raw.deliveryAddressDetail) ?? readDetailedAddress(raw.deliveryAddress);
  const selectedPhotoIds = readStringArray(raw.selectedPhotoIds);
  const imageUrl = raw.packageInfo?.imageUrl ?? selectedPhotoIds?.[0];

  return {
    ...raw,
    requestId,
    pickupAddress,
    deliveryAddress,
    recipientName: readString(raw.recipientName),
    recipientPhone: readString(raw.recipientPhone),
    pickupLocationDetail: readString(raw.pickupLocationDetail),
    storageLocation: readString(raw.storageLocation),
    specialInstructions: readString(raw.specialInstructions),
    selectedPhotoIds,
    packageInfo: {
      ...raw.packageInfo,
      imageUrl,
    },
  } as Request;
}

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
  packageInfo: LegacyCreatePackageInfo,
  feeInfo: LegacyCreateFeeInfo,
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
  packageInfo?: LegacyCreatePackageInfo,
  feeInfo?: LegacyCreateFeeInfo,
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
      packageInfo: toLegacyPackageInfo(packageInfo),
      initialNegotiationFee: feeInfo?.totalFee ?? 0,
      feeBreakdown: feeInfo as CreateRequestData['feeBreakdown'],
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
      const pricingPolicy = await getPricingPolicyConfig();
      const pricingContext = buildRequestPricingContext(requestDataOrUserId);

      const newRequest: Omit<Request, 'requestId'> = {
        requesterId: requestDataOrUserId.requesterId,
        requestMode: pricingContext.requestMode,
        pickupStation: requestDataOrUserId.pickupStation,
        deliveryStation: requestDataOrUserId.deliveryStation,
        packageInfo: requestDataOrUserId.packageInfo,
        initialNegotiationFee: requestDataOrUserId.initialNegotiationFee,
        feeBreakdown: requestDataOrUserId.feeBreakdown,
        // 길러 앱과의 호환성을 위해 fee 필드 추가
        fee: requestDataOrUserId.feeBreakdown,
        pricingPolicyVersion: requestDataOrUserId.pricingPolicyVersion ?? pricingPolicy.version,
        pricingContext,
        preferredTime: requestDataOrUserId.preferredTime,
        deadline: isTimestampLike(requestDataOrUserId.deadline)
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
    return normalizeRequestDoc(docSnapshot.id, data as RequestDocShape);
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
      requests.push(normalizeRequestDoc(docSnapshot.id, data as RequestDocShape));
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
      requests.push(normalizeRequestDoc(docSnapshot.id, data as RequestDocShape));
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

    const dataToUpdate: UpdateRequestData & { updatedAt: ReturnType<typeof serverTimestamp> } = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, dataToUpdate as unknown as Record<string, unknown>);

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

    const updateData: RequestStatusUpdatePayload = {
      status,
      updatedAt: serverTimestamp(),
    };

    // 상태별 추가 정보
    if (status === RequestStatus.MATCHED && extras?.matchedGillerId) {
      updateData.matchedGillerId = extras.matchedGillerId;
      updateData.matchedAt = serverTimestamp();
    } else if (status === RequestStatus.ACCEPTED) {
      updateData.acceptedAt = serverTimestamp();
    } else if (status === RequestStatus.IN_TRANSIT) {
      updateData.pickedUpAt = serverTimestamp();
    } else if (status === RequestStatus.ARRIVED) {
      updateData.arrivedAt = serverTimestamp();
    } else if (status === RequestStatus.DELIVERED) {
      updateData.deliveredAt = serverTimestamp();
    } else if (status === RequestStatus.COMPLETED) {
      updateData.requesterConfirmedAt = serverTimestamp();
    } else if (status === RequestStatus.CANCELLED) {
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

    const currentStatus = request.status as RequestStatus | undefined;
    if (currentStatus !== RequestStatus.PENDING && currentStatus !== RequestStatus.MATCHED) {
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

    const currentStatus = request.status as RequestStatus | undefined;
    if (currentStatus !== RequestStatus.COMPLETED && currentStatus !== RequestStatus.CANCELLED) {
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
  const deadlineTime = isTimestampLike(data.deadline)
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

    const completedRequests = allRequests.filter((r) => r.status === RequestStatus.COMPLETED).length;
    const cancelledRequests = allRequests.filter((r) => r.status === RequestStatus.CANCELLED).length;
    const inProgressRequests = allRequests.filter(
      (r) => r.status === RequestStatus.MATCHED || r.status === RequestStatus.IN_TRANSIT
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
  packageInfo: LegacyCreatePackageInfo | null | undefined,
  _fee: LegacyCreateFeeInfo | null | undefined,
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
  if (pickupStation?.stationId && deliveryStation?.stationId && pickupStation.stationId === deliveryStation.stationId) {
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
  dynamicAdjustment?: number;
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
    const pricingPolicy = await getPricingPolicyConfig();
    const travelTimeData = await getTravelTimeConfig(
      pickupStation.stationId,
      deliveryStation.stationId
    ).catch(e => {
      console.warn('Failed to get travel time config, falling back to distance based estimation:', e);
      return null;
    });

    let stationCount: number;
    let travelTimeMinutes: number;

    if (travelTimeData && typeof travelTimeData.normalTime === 'number') {
      travelTimeMinutes = Math.round(travelTimeData.normalTime / 60);
      stationCount = Math.max(2, Math.round(travelTimeMinutes / 2.5));
    } else {
      // Fallback: estimate from distance using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (deliveryStation.lat - pickupStation.lat) * (Math.PI / 180);
      const dLon = (deliveryStation.lng - pickupStation.lng) * (Math.PI / 180);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(pickupStation.lat * (Math.PI / 180)) * Math.cos(deliveryStation.lat * (Math.PI / 180)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distanceKm = R * c;
      
      stationCount = Math.max(2, Math.round(distanceKm * 1.8)); // from estimateStationCountFromDistanceKm
      travelTimeMinutes = Math.round(stationCount * 2.5);
    }

    // Determine urgency enum
    let urgencyValue: 'normal' | 'fast' | 'urgent' = 'normal';
    if (urgencySurcharge > 0) {
      // Very basic heuristic if external urgency surcharge was passed
      urgencyValue = urgencySurcharge > 5000 ? 'urgent' : 'fast';
    }

    const pricingParams: Phase1PricingParams = {
      stationCount,
      weight,
      packageSize: packageSize as PackageSizeType,
      urgency: urgencyValue,
      manualAdjustment,
    };

    const feeResult = calculatePhase1DeliveryFee(pricingParams, pricingPolicy);

    return {
      baseFee: feeResult.baseFee,
      distanceFee: feeResult.distanceFee,
      sizeFee: feeResult.sizeFee,
      weightFee: feeResult.weightFee,
      urgencySurcharge: feeResult.urgencySurcharge,
      dynamicAdjustment: feeResult.dynamicAdjustment,
      manualAdjustment: feeResult.manualAdjustment,
      serviceFee: feeResult.serviceFee,
      subtotal: feeResult.subtotal,
      vat: feeResult.vat,
      totalFee: feeResult.totalFee,
      estimatedTime: travelTimeMinutes,
      breakdown: feeResult.breakdown,
    };
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    throw new Error('배송 요금을 산출할 수 없습니다. 길찾기 API 장애 또는 정책 로딩에 실패했습니다.');
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
    if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.MATCHED) {
      return { success: false, message: '현재 상태에서는 금액을 변경할 수 없습니다.' };
    }

    const currentFee =
      request.fee?.totalFee ??
      request.initialNegotiationFee ??
      request.feeBreakdown?.totalFee ?? 3000;
    const pricingPolicy = await getPricingPolicyConfig();
    const nextFee = Math.min(pricingPolicy.maxFee, currentFee + amount);

    const feeSnapshot = (request.fee ?? request.feeBreakdown ?? {}) as FeeSnapshot;
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

export async function getRoutePriceInsight(params: {
  pickupStationId: string;
  deliveryStationId: string;
  requestMode?: 'immediate' | 'reservation';
  pricingContext?: Partial<RequestPricingContext>;
}): Promise<RoutePriceInsight | null> {
  try {
    const pricingPolicy = await getPricingPolicyConfig();
    const routeKey = buildRouteKey(params.pickupStationId, params.deliveryStationId, params.requestMode);
    const snapshot = await getDocs(
      query(
        collection(db, 'request_pricing_history'),
        where('routeKey', '==', routeKey),
        limit(30)
      )
    );

    const fees = snapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data() as {
          totalFee?: unknown;
          finalFee?: unknown;
          dynamicAdjustment?: unknown;
          policyVersion?: unknown;
          pricingContext?: {
            isPeakTime?: unknown;
            requestMode?: unknown;
          };
        };
        const feeCandidate = typeof data.finalFee === 'number' ? data.finalFee : data.totalFee;
        if (typeof feeCandidate !== 'number' || feeCandidate <= 0) {
          return null;
        }

        return {
          fee: feeCandidate,
          dynamicAdjustment: typeof data.dynamicAdjustment === 'number' ? data.dynamicAdjustment : 0,
          isPeakTime: Boolean(data.pricingContext?.isPeakTime),
          requestMode: data.pricingContext?.requestMode === 'reservation' ? 'reservation' : 'immediate',
          policyVersion: typeof data.policyVersion === 'string' ? data.policyVersion : null,
        };
      })
      .filter((item): item is {
        fee: number;
        dynamicAdjustment: number;
        isPeakTime: boolean;
        requestMode: 'immediate' | 'reservation';
        policyVersion: string | null;
      } => item !== null);

    if (fees.length === 0) {
      return null;
    }

    const total = fees.reduce((sum, item) => sum + item.fee, 0);
    const averageFee = Math.round(total / fees.length);
    const minFee = Math.min(...fees.map((item) => item.fee));
    const maxFee = Math.max(...fees.map((item) => item.fee));
    const averageDynamicAdjustment = Math.round(
      fees.reduce((sum, item) => sum + item.dynamicAdjustment, 0) / fees.length
    );
    const peakSamples = fees.filter((item) => item.isPeakTime).length;
    const immediateSamples = fees.filter((item) => item.requestMode === 'immediate').length;
    const reservationSamples = fees.length - immediateSamples;
    const routeOverride = await getRoutePricingOverride(routeKey);
    const recommendedFee = calculateInsightRecommendation({
      averageFee,
      requestMode: params.requestMode,
      peakSamples,
      immediateSamples,
      reservationSamples,
      sampleCount: fees.length,
      currentWeather: params.pricingContext?.weather,
      nearbyGillerCount: params.pricingContext?.nearbyGillerCount,
      isProfessionalPeak: params.pricingContext?.isProfessionalPeak,
      pricingPolicy,
      routeOverride,
    });
    const latestPolicyVersion = fees.find((item) => item.policyVersion)?.policyVersion ?? null;
    const { contextSummary, recommendationReason } = summarizeInsightContext({
      requestMode: params.requestMode,
      peakSamples,
      immediateSamples,
      reservationSamples,
      sampleCount: fees.length,
      averageDynamicAdjustment,
      currentWeather: params.pricingContext?.weather,
      nearbyGillerCount: params.pricingContext?.nearbyGillerCount,
      isProfessionalPeak: params.pricingContext?.isProfessionalPeak,
    });

    return {
      averageFee,
      minFee,
      maxFee,
      sampleCount: fees.length,
      recommendedFee,
      routeKey,
      averageDynamicAdjustment,
      contextSummary,
      recommendationReason,
      policyVersion: latestPolicyVersion,
      routeOverride: routeOverride
        ? {
            enabled: routeOverride.enabled,
            fixedAdjustment: routeOverride.fixedAdjustment,
            multiplier: routeOverride.multiplier,
            minCompletedCount: routeOverride.minCompletedCount,
            applied: routeOverride.enabled && fees.length >= routeOverride.minCompletedCount,
          }
        : null,
    };
  } catch (error) {
    console.error('Error fetching route price insight:', error);
    return null;
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
      callback(normalizeRequestDoc(docSnapshot.id, data as RequestDocShape));
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
  } catch (error: unknown) {
    console.error('Error notifying gillers:', error);
    return { success: false, error: getErrorMessage(error, '길러 알림 전송에 실패했습니다.') };
  }
}
