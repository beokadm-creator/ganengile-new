import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateShortId } from '../../utils/id-generator';
import { bootstrapRequestCreationEngine } from '../beta1-engine-service';
import { getPricingPolicyConfig } from '../pricing-policy-config-service';
import type {
  Request,
  CreateRequestData,
  UpdateRequestData,
  RequestFilterOptions,
  StationInfo,
  PackageInfo,
  RequestPricingContext,
} from '../../types/request';
import { PackageSize, PackageWeight, RequestStatus } from '../../types/request';

export type LegacyCreateFeeInfo = {
  totalFee?: number;
  [key: string]: unknown;
};

export type LegacyCreatePackageInfo = {
  size?: PackageInfo['size'];
  weight?: PackageInfo['weight'] | number | string;
  weightKg?: number;
  description?: string;
  imageUrl?: string;
  [key: string]: unknown;
};

export type RequestStatusUpdatePayload = {
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

export type TimestampLike = Timestamp | { toDate?: () => Date; toMillis?: () => number };

export type RequestDocShape = Partial<Request> & {
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
  lockerId?: unknown;
  specialInstructions?: unknown;
  missionProgress?: Request['missionProgress'];
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
};

function toLegacyPackageInfo(packageInfo?: LegacyCreatePackageInfo): PackageInfo {
  const size =
    packageInfo?.size === PackageSize.SMALL || packageInfo?.size === PackageSize.MEDIUM ||
    packageInfo?.size === PackageSize.LARGE || packageInfo?.size === PackageSize.EXTRA_LARGE
      ? packageInfo.size : PackageSize.MEDIUM;

  const weight =
    packageInfo?.weight === PackageWeight.LIGHT || packageInfo?.weight === PackageWeight.MEDIUM ||
    packageInfo?.weight === PackageWeight.HEAVY
      ? packageInfo.weight : PackageWeight.MEDIUM;

  return {
    size,
    weight,
    weightKg: typeof packageInfo?.weightKg === 'number' ? packageInfo.weightKg : undefined,
    description: typeof packageInfo?.description === 'string' ? packageInfo.description : '',
    imageUrl: typeof packageInfo?.imageUrl === 'string' ? packageInfo.imageUrl : undefined,
  };
}

function isTimestampLike(value: unknown): value is Timestamp {
  return typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function';
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readDetailedAddress(value: unknown): Request['pickupAddress'] | undefined {
  if (typeof value !== 'object' || value == null) return undefined;
  const roadAddress = readString((value as any).roadAddress);
  const detailAddress = readString((value as any).detailAddress) ?? '';
  const fullAddress = readString((value as any).fullAddress);
  if (!roadAddress) return undefined;
  return { roadAddress, detailAddress, fullAddress: fullAddress ?? [roadAddress, detailAddress].filter(Boolean).join(' ') };
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

export function normalizeRequestDoc(requestId: string, raw: RequestDocShape): Request {
  const pickupAddress = readDetailedAddress(raw.pickupAddressDetail) ?? readDetailedAddress(raw.pickupAddress);
  const deliveryAddress = readDetailedAddress(raw.deliveryAddressDetail) ?? readDetailedAddress(raw.deliveryAddress);
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
    lockerId: readString(raw.lockerId),
    specialInstructions: readString(raw.specialInstructions),
    selectedPhotoIds,
    packageInfo: { ...raw.packageInfo, imageUrl },
  } as Request;
}

export function buildRequestPricingContext(requestData: CreateRequestData): RequestPricingContext {
  const requestMode = requestData.requestMode === 'reservation' ? 'reservation' : 'immediate';
  let requestedHour = new Date().getHours();
  const departureTime = requestData.preferredTime?.departureTime;
  if (typeof departureTime === 'string') {
    const [hourText] = departureTime.split(':');
    const hour = Number(hourText);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      requestedHour = hour;
    }
  }

  return {
    requestMode,
    weather: requestData.pricingContext?.weather ?? 'clear',
    isPeakTime: requestData.pricingContext?.isPeakTime ?? ((requestedHour >= 7 && requestedHour <= 9) || (requestedHour >= 17 && requestedHour <= 20)),
    isProfessionalPeak: requestData.pricingContext?.isProfessionalPeak ?? false,
    nearbyGillerCount: requestData.pricingContext?.nearbyGillerCount ?? null,
    requestedHour,
    urgencyBucket: requestData.pricingContext?.urgencyBucket ?? (requestData.urgency === 'high' ? 'urgent' : requestData.urgency === 'medium' ? 'fast' : 'normal'),
  };
}

export async function createRequest(requestData: CreateRequestData): Promise<Request>;
export async function createRequest(
  requesterId: string, pickupStation: StationInfo, deliveryStation: StationInfo,
  urgency: string, packageInfo: LegacyCreatePackageInfo, feeInfo: LegacyCreateFeeInfo,
  recipientName: string, recipientPhone: string, preferredTime: Date, deadline: Date
): Promise<Request>;
export async function createRequest(
  requestDataOrUserId: CreateRequestData | string, pickupStation?: StationInfo, deliveryStation?: StationInfo,
  urgency?: string, packageInfo?: LegacyCreatePackageInfo, feeInfo?: LegacyCreateFeeInfo,
  recipientName?: string, recipientPhone?: string, preferredTime?: Date, deadline?: Date
): Promise<Request> {
  if (typeof requestDataOrUserId === 'string') {
    const requestData: CreateRequestData = {
      requesterId: requestDataOrUserId, pickupStation: pickupStation!, deliveryStation: deliveryStation!,
      packageInfo: toLegacyPackageInfo(packageInfo), initialNegotiationFee: feeInfo?.totalFee ?? 0,
      feeBreakdown: feeInfo as CreateRequestData['feeBreakdown'],
      preferredTime: {
        departureTime: preferredTime ? preferredTime.toTimeString().slice(0, 5) : '09:00',
        arrivalTime: deadline ? deadline.toTimeString().slice(0, 5) : undefined,
      },
      deadline: deadline ?? new Date(Date.now() + 86400000), urgency: (urgency as any) ?? 'medium',
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
        requesterId: requestDataOrUserId.requesterId, requestMode: pricingContext.requestMode,
        pickupStation: requestDataOrUserId.pickupStation, deliveryStation: requestDataOrUserId.deliveryStation,
        packageInfo: requestDataOrUserId.packageInfo, initialNegotiationFee: requestDataOrUserId.initialNegotiationFee,
        feeBreakdown: requestDataOrUserId.feeBreakdown, fee: requestDataOrUserId.feeBreakdown,
        pricingPolicyVersion: requestDataOrUserId.pricingPolicyVersion ?? pricingPolicy.version,
        pricingContext, preferredTime: requestDataOrUserId.preferredTime,
        deadline: isTimestampLike(requestDataOrUserId.deadline) ? requestDataOrUserId.deadline : Timestamp.fromDate(requestDataOrUserId.deadline),
        urgency: requestDataOrUserId.urgency ?? 'medium', status: 'pending' as RequestStatus,
        requestDraftId: beta1Bootstrap.requestDraft.requestDraftId, pricingQuoteId: beta1Bootstrap.selectedPricingQuote?.pricingQuoteId,
        createdAt: serverTimestamp() as unknown as Timestamp, updatedAt: serverTimestamp() as unknown as Timestamp,
      };

      const requestId = generateShortId('R');
      const docRef = doc(requestsRef, requestId);
      await setDoc(docRef, newRequest);
      return { requestId: docRef.id, ...newRequest } as Request;
    } catch (error) {
      console.error('Error creating request:', error);
      throw error;
    }
  }
}

export async function getRequestById(requestId: string): Promise<Request | null> {
  try {
    const docSnapshot = await getDoc(doc(db, 'requests', requestId));
    if (!docSnapshot.exists()) return null;
    return normalizeRequestDoc(docSnapshot.id, docSnapshot.data() as RequestDocShape);
  } catch (error) {
    console.error('Error fetching request:', error);
    throw error;
  }
}

export async function getRequestsByRequester(requesterId: string, options?: RequestFilterOptions): Promise<Request[]> {
  try {
    let q = query(collection(db, 'requests'), where('requesterId', '==', requesterId));
    if (options?.status) q = query(q, where('status', '==', options.status));
    if (options?.limit) q = query(q, limit(options.limit));

    const snapshot = await getDocs(q);
    const requests: Request[] = [];
    snapshot.forEach((docSnapshot) => requests.push(normalizeRequestDoc(docSnapshot.id, docSnapshot.data() as RequestDocShape)));
    
    // 안전한 Timestamp 변환 및 정렬
    requests.sort((a, b) => {
      const getMillis = (createdAt: any) => {
        if (!createdAt) return 0;
        if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
        if (typeof createdAt.getTime === 'function') return createdAt.getTime();
        if (createdAt.seconds) return createdAt.seconds * 1000 + (createdAt.nanoseconds || 0) / 1000000;
        if (typeof createdAt === 'number') return createdAt;
        if (typeof createdAt === 'string') return new Date(createdAt).getTime();
        return 0;
      };
      
      return getMillis(b.createdAt) - getMillis(a.createdAt);
    });
    
    return requests;
  } catch (error) {
    console.error('Error fetching requests by requester:', error);
    throw error;
  }
}

export async function getRequestsByGiller(gillerId: string, options?: RequestFilterOptions): Promise<Request[]> {
  try {
    let q = query(collection(db, 'requests'), where('matchedGillerId', '==', gillerId));
    if (options?.status) q = query(q, where('status', '==', options.status));
    q = query(q, orderBy('createdAt', 'desc'));
    if (options?.limit) q = query(q, limit(options.limit));

    const snapshot = await getDocs(q);
    const requests: Request[] = [];
    snapshot.forEach((docSnapshot) => requests.push(normalizeRequestDoc(docSnapshot.id, docSnapshot.data() as RequestDocShape)));
    
    // 안전한 Timestamp 변환 및 정렬 (백업)
    requests.sort((a, b) => {
      const getMillis = (createdAt: any) => {
        if (!createdAt) return 0;
        if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
        if (typeof createdAt.getTime === 'function') return createdAt.getTime();
        if (createdAt.seconds) return createdAt.seconds * 1000 + (createdAt.nanoseconds || 0) / 1000000;
        if (typeof createdAt === 'number') return createdAt;
        if (typeof createdAt === 'string') return new Date(createdAt).getTime();
        return 0;
      };
      return getMillis(b.createdAt) - getMillis(a.createdAt);
    });
    
    return requests;
  } catch (error) {
    console.error('Error fetching requests by giller:', error);
    throw error;
  }
}

export async function getPendingRequests(options?: RequestFilterOptions): Promise<Request[]> {
  try {
    let q = query(collection(db, 'requests'), where('status', '==', 'pending'), orderBy('deadline', 'asc'));
    if (options?.limit) q = query(q, limit(options.limit));

    const snapshot = await getDocs(q);
    const requests: Request[] = [];
    snapshot.forEach((docSnapshot) => requests.push({ requestId: docSnapshot.id, ...docSnapshot.data() } as Request));
    return requests;
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    throw error;
  }
}

async function updateRequestInternal(requestId: string, updateData: UpdateRequestData): Promise<Request> {
  try {
    const dataToUpdate = { ...updateData, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, 'requests', requestId), dataToUpdate as any);
    const updated = await getRequestById(requestId);
    if (!updated) throw new Error('Failed to fetch updated request');
    return updated;
  } catch (error) {
    console.error('Error updating request:', error);
    throw error;
  }
}

export async function updateRequestStatus(
  requestId: string, status: RequestStatus,
  extras?: { matchedGillerId?: string; cancellationReason?: string; cancelledBy?: 'requester' | 'giller' | 'system'; }
): Promise<Request> {
  try {
    const updateData: RequestStatusUpdatePayload = { status, updatedAt: serverTimestamp() };
    if (status === RequestStatus.MATCHED && extras?.matchedGillerId) {
      updateData.matchedGillerId = extras.matchedGillerId; updateData.matchedAt = serverTimestamp();
    } else if (status === RequestStatus.ACCEPTED) updateData.acceptedAt = serverTimestamp();
    else if (status === RequestStatus.IN_TRANSIT) updateData.pickedUpAt = serverTimestamp();
    else if (status === RequestStatus.ARRIVED) updateData.arrivedAt = serverTimestamp();
    else if (status === RequestStatus.DELIVERED) updateData.deliveredAt = serverTimestamp();
    else if (status === RequestStatus.COMPLETED) updateData.requesterConfirmedAt = serverTimestamp();
    else if (status === RequestStatus.CANCELLED) {
      updateData.cancelledAt = serverTimestamp(); updateData.cancellationReason = extras?.cancellationReason;
      updateData.cancelledBy = extras?.cancelledBy; updateData.matchedGillerId = deleteField();
      updateData.matchedAt = deleteField(); updateData.acceptedAt = deleteField(); updateData.primaryDeliveryId = deleteField();
    }

    await updateDoc(doc(db, 'requests', requestId), updateData);
    const updated = await getRequestById(requestId);
    if (!updated) throw new Error('Failed to fetch updated request');
    return updated;
  } catch (error) {
    console.error('Error updating request status:', error);
    throw error;
  }
}

async function cancelRequestInternal(requestId: string, reason: string, cancelledBy: 'requester' | 'giller' | 'system' = 'requester'): Promise<Request> {
  const request = await getRequestById(requestId);
  if (!request) throw new Error('Request not found');
  if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.MATCHED) {
    throw new Error(`Cannot cancel request with status: ${request.status}`);
  }
  return await updateRequestStatus(requestId, RequestStatus.CANCELLED, { cancellationReason: reason, cancelledBy });
}

async function deleteRequestInternal(requestId: string): Promise<void> {
  const request = await getRequestById(requestId);
  if (!request) throw new Error('Request not found');
  if (request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CANCELLED) {
    throw new Error(`Cannot delete request with status: ${request.status}`);
  }
  await deleteDoc(doc(db, 'requests', requestId));
}

function validateRequestData(data: CreateRequestData): void {
  if (!data.requesterId) throw new Error('Requester ID is required');
  if (!data.pickupStation || !data.deliveryStation) throw new Error('Pickup and delivery stations are required');
  if (data.pickupStation.stationId === data.deliveryStation.stationId) throw new Error('Pickup and delivery stations must be different');
  if (!data.packageInfo) throw new Error('Package information is required');
  if (!data.initialNegotiationFee || data.initialNegotiationFee <= 0) throw new Error('Fee must be greater than 0');
  if (!data.deadline) throw new Error('Deadline is required');

  const deadlineTime = isTimestampLike(data.deadline) ? data.deadline.toDate() : data.deadline;
  const now = new Date(Date.now() - 5000);
  if (deadlineTime <= now) throw new Error('Deadline must be in the future');
}

export async function getRequestStats(requesterId: string): Promise<any> {
  try {
    const allRequests = await getRequestsByRequester(requesterId);
    const completedRequests = allRequests.filter((r) => r.status === RequestStatus.COMPLETED).length;
    const cancelledRequests = allRequests.filter((r) => r.status === RequestStatus.CANCELLED).length;
    const inProgressRequests = allRequests.filter((r) => r.status === RequestStatus.MATCHED || r.status === RequestStatus.IN_TRANSIT).length;
    const totalFee = allRequests.reduce((sum, r) => sum + r.initialNegotiationFee, 0);
    const averageFee = allRequests.length > 0 ? totalFee / allRequests.length : 0;
    return { totalRequests: allRequests.length, completedRequests, cancelledRequests, inProgressRequests, averageFee };
  } catch (error) {
    return { totalRequests: 0, completedRequests: 0, cancelledRequests: 0, inProgressRequests: 0, averageFee: 0 };
  }
}

export interface ValidationResult { isValid: boolean; errors: string[]; }

export function validateRequest(userId: string, pickupStation: StationInfo, deliveryStation: StationInfo, packageInfo: LegacyCreatePackageInfo | null | undefined, _fee: LegacyCreateFeeInfo | null | undefined, recipientName: string, recipientPhone: string, _preferredTime?: Date, _deadline?: Date): ValidationResult {
  const errors: string[] = [];
  if (!userId) errors.push('사용자 ID가 필요합니다.');
  if (!pickupStation?.stationId) errors.push('픽업 역 정보가 필요합니다.');
  if (!deliveryStation?.stationId) errors.push('배송 역 정보가 필요합니다.');
  if (pickupStation?.stationId && deliveryStation?.stationId && pickupStation.stationId === deliveryStation.stationId) errors.push('픽업 역과 배송 역이 같을 수 없습니다.');
  if (!recipientName || recipientName.trim().length === 0) errors.push('수신자 이름이 필요합니다.');
  if (!recipientPhone || !/^010-\d{4}-\d{4}$/.test(recipientPhone)) errors.push('수신자 전화번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)');
  if (!packageInfo) errors.push('패키지 정보가 필요합니다.');
  return { isValid: errors.length === 0, errors };
}

export async function getRequest(requestId: string, userId: string): Promise<Request | null> {
  const request = await getRequestById(requestId);
  if (request?.requesterId !== userId) return null;
  return request;
}

export async function getUserRequests(userId: string): Promise<Request[]> {
  return getRequestsByRequester(userId);
}

function isRequestOwnedByUser(request: Request, userId: string): boolean {
  return request.requesterId === userId || (request as any).requesterUserId === userId || (request as any).gllerId === userId;
}

export async function updateRequest(requestId: string, userId: string, updateData: Partial<UpdateRequestData>): Promise<Request | null>;
export async function updateRequest(requestId: string, updateData: UpdateRequestData): Promise<Request>;
export async function updateRequest(requestId: string, userIdOrUpdateData: string | UpdateRequestData, updateData?: Partial<UpdateRequestData>): Promise<Request | null> {
  if (typeof userIdOrUpdateData === 'string') {
    const request = await getRequestById(requestId);
    if (!request || !isRequestOwnedByUser(request, userIdOrUpdateData)) return null;
    return await updateRequestInternal(requestId, updateData!);
  } else {
    return await updateRequestInternal(requestId, userIdOrUpdateData);
  }
}

export async function cancelRequest(requestId: string, userId: string, reason: string): Promise<Request | null>;
export async function cancelRequest(requestId: string, reason: string, cancelledBy?: 'requester' | 'giller' | 'system'): Promise<Request>;
export async function cancelRequest(requestId: string, userIdOrReason: string, reasonOrCancelledBy?: string, cancelledBy?: 'requester' | 'giller' | 'system'): Promise<Request | null> {
  if (typeof reasonOrCancelledBy === 'string') {
    const request = await getRequestById(requestId);
    if (!request || !isRequestOwnedByUser(request, userIdOrReason)) return null;
    return await cancelRequestInternal(requestId, reasonOrCancelledBy, 'requester');
  } else {
    return await cancelRequestInternal(requestId, userIdOrReason, cancelledBy ?? 'requester');
  }
}

export async function deleteRequest(requestId: string, userId?: string): Promise<void | boolean> {
  if (userId !== undefined) {
    try {
      const request = await getRequestById(requestId);
      if (request?.requesterId !== userId) return false;
      await deleteRequestInternal(requestId);
      return true;
    } catch { return false; }
  } else {
    await deleteRequestInternal(requestId);
  }
}
