/**
 * Request Types
 * 배송 요청 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

export type RequestPricingWeather = 'clear' | 'rain' | 'snow';
export type RequestPricingUrgencyBucket = 'normal' | 'fast' | 'urgent';

export interface RequestPricingContext {
  requestMode: 'immediate' | 'reservation';
  weather: RequestPricingWeather;
  isPeakTime: boolean;
  isProfessionalPeak: boolean;
  nearbyGillerCount?: number | null;
  requestedHour: number;
  urgencyBucket: RequestPricingUrgencyBucket;
}

/**
 * 요청 상태
 */
export enum RequestStatus {
  PENDING = 'pending',           // 매칭 대기 중
  MATCHED = 'matched',           // 길러 매칭됨
  ACCEPTED = 'accepted',         // 길러 수락
  IN_TRANSIT = 'in_transit',     // 배송 중
  ARRIVED = 'arrived',           // 도착 완료
  AT_LOCKER = 'at_locker',       // 사물함 보관 완료
  DELIVERED = 'delivered',       // 전달 완료 (수령 확인 대기)
  COMPLETED = 'completed',       // 배송 완료
  CANCELLED = 'cancelled',       // 취소됨
}

/**
 * 패키지 크기
 */
export enum PackageSize {
  SMALL = 'small',       // 소형 (가로x세로x높이 30cm 이하)
  MEDIUM = 'medium',     // 중형 (가로x세로x높이 50cm 이하)
  LARGE = 'large',       // 대형 (가로x세로x높이 70cm 이하)
  EXTRA_LARGE = 'xl',    // 특대형 (그 이상)
}

/**
 * 패키지 무게
 */
export enum PackageWeight {
  LIGHT = 'light',       // 경량 (1kg 이하)
  MEDIUM = 'medium',     // 중량 (1~5kg)
  HEAVY = 'extra',       // 중량 (5kg 이상)
}

/**
 * 패키지 정보
 */
export interface PackageInfo {
  size: PackageSize;
  weight: PackageWeight;
  weightKg?: number;    // 입력한 실제 무게(kg)
  description: string;  // 내역물 설명
  imageUrl?: string;    // 물품 사진 (선택)
}

/**
 * 역 정보 (공통)
 */
export interface StationInfo {
  id: string; // stationId의 별칭 (호환성)
  stationId: string;
  stationName: string;
  line: string;
  lineCode: string;
  lat: number;
  lng: number;
}

export interface DetailedAddress {
  roadAddress: string;
  detailAddress: string;
  fullAddress: string;
}

/**
 * 배송 요청
 */
export interface Request {
  requestId: string;
  requestDraftId?: string;
  pricingQuoteId?: string;
  primaryDeliveryId?: string;
  beta1RequestStatus?: string;
  requestMode?: 'immediate' | 'reservation';
  sourceRequestId?: string | null;
  pricingPolicyVersion?: string;
  pricingContext?: RequestPricingContext;
  missionProgress?: {
    acceptedMissionCount: number;
    totalMissionCount: number;
    partiallyMatched: boolean;
    lastBundleId?: string;
    lastMatchedAt?: Timestamp;
    rewardBoostAmount?: number;
  };

  // 요청자 정보
  requesterId: string;

  // 역 정보
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  pickupAddress?: DetailedAddress;
  deliveryAddress?: DetailedAddress;
  recipientName?: string;
  recipientPhone?: string;
  selectedPhotoIds?: string[];
  pickupLocationDetail?: string;
  storageLocation?: string;
  lockerId?: string;
  reservationId?: string;
  specialInstructions?: string;

  // 패키지 정보
  packageInfo: PackageInfo;

  // 물건 가치 및 보증금
  itemValue?: number;
  depositAmount?: number;
  selectedCouponId?: string | null;

  initialNegotiationFee: number;

  feeBreakdown?: {
    baseFee: number;
    distanceFee: number;
    sizeFee: number;
    weightFee: number;
    urgencySurcharge: number;
    publicFare?: number;
    dynamicAdjustment?: number;
    manualAdjustment: number;
    serviceFee: number;
    vat: number;
    totalFee: number;
  };
  fee?: {
    baseFee: number;
    distanceFee: number;
    sizeFee: number;
    weightFee: number;
    urgencySurcharge: number;
    publicFare?: number;
    dynamicAdjustment?: number;
    manualAdjustment: number;
    serviceFee: number;
    vat: number;
    totalFee: number;
    breakdown?: {
      gillerFee: number;
      platformFee: number;
    };
  };

  // 희망 배송 시간
  preferredTime?: {
    departureTime: string;  // HH:mm format
    arrivalTime?: string;   // HH:mm format (선택)
  };

  // 마감 기한
  deadline: Timestamp;

  // 긴급도
  urgency?: 'low' | 'medium' | 'high';

  // 현재 상태
  status: RequestStatus;

  // 특별 요청 사항
  specialRequests?: string[];

  // 매칭 정보
  matchedGillerId?: string;
  matchedAt?: Timestamp;

  // 배송 정보
  acceptedAt?: Timestamp;
  pickedUpAt?: Timestamp;
  arrivedAt?: Timestamp;
  deliveredAt?: Timestamp;
  requesterConfirmedAt?: Timestamp;
  requesterConfirmedBy?: string;

  // 평가 정보
  gillerRating?: number;
  requesterRating?: number;
  /** @deprecated Use requesterRating */
  gllerRating?: number;

  // 취소 정보
  cancelledAt?: Timestamp;
  cancellationReason?: string;
  cancelledBy?: 'requester' | 'giller' | 'system';

  // 생성/업데이트 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 배송 요청 생성 데이터
 */
export interface CreateRequestData {
  requesterId: string;
  requestMode?: 'immediate' | 'reservation';
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  pickupAddress?: DetailedAddress;
  deliveryAddress?: DetailedAddress;
  packageInfo: PackageInfo;
  initialNegotiationFee: number;
  feeBreakdown?: {
    baseFee: number;
    distanceFee: number;
    sizeFee: number;
    weightFee: number;
    urgencySurcharge: number;
    dynamicAdjustment?: number;
    manualAdjustment: number;
    serviceFee: number;
    vat: number;
    totalFee: number;
  };
  fee?: {
    baseFee: number;
    distanceFee: number;
    sizeFee: number;
    weightFee: number;
    urgencySurcharge: number;
    dynamicAdjustment?: number;
    manualAdjustment: number;
    serviceFee: number;
    vat: number;
    totalFee: number;
    breakdown?: {
      gillerFee: number;
      platformFee: number;
    };
  };
  itemValue?: number;
  selectedCouponId?: string | null;
  pricingPolicyVersion?: string;
  pricingContext?: RequestPricingContext;
  preferredTime?: {
    departureTime: string;
    arrivalTime?: string;
  };
  deadline: Date;
  urgency?: 'low' | 'medium' | 'high';
  pickupLocationDetail?: string;
  storageLocation?: string;
  specialInstructions?: string;
  specialRequests?: string[];
}

/**
 * 배송 요청 업데이트 데이터
 */
export interface UpdateRequestData {
  status?: RequestStatus;
  pricingQuoteId?: string;
  primaryDeliveryId?: string;
  matchedGillerId?: string;
  gillerRating?: number;
  requesterRating?: number;
  /** @deprecated Use requesterRating */
  gllerRating?: number;
  specialRequests?: string[];
  cancellationReason?: string;
  cancelledBy?: 'requester' | 'giller' | 'system';
}

/**
 * 요청 필터 옵션
 */
export interface RequestFilterOptions {
  status?: RequestStatus;
  requesterId?: string;
  gillerId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}
