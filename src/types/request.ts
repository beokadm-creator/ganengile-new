/**
 * Request Types
 * 배송 요청 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 요청 상태
 */
export enum RequestStatus {
  PENDING = 'pending',           // 매칭 대기 중
  MATCHED = 'matched',           // 길러 매칭됨
  IN_PROGRESS = 'in_progress',   // 배송 중
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

/**
 * 배송 요청
 */
export interface Request {
  requestId: string;

  // 요청자 정보
  requesterId: string;

  // 역 정보
  pickupStation: StationInfo;
  deliveryStation: StationInfo;

  // 패키지 정보
  packageInfo: PackageInfo;

  // 배송비
  fee: number;

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
  pickedUpAt?: Timestamp;
  deliveredAt?: Timestamp;

  // 평가 정보
  gillerRating?: number;
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
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  packageInfo: PackageInfo;
  fee: number;
  preferredTime?: {
    departureTime: string;
    arrivalTime?: string;
  };
  deadline: Date;
  urgency?: 'low' | 'medium' | 'high';
  pickupLocationDetail?: string;    // 만날 장소 상세 (예: 1번 출구, 편의점 앞)
  storageLocation?: string;          // 보관 위치 (예: 역사물 보관함, 사물함)
  specialInstructions?: string;      // 특이사항 (예: 비가 오면 우산 필요함)
  specialRequests?: string[];        // 특별 요청 사항 배열
}

/**
 * 배송 요청 업데이트 데이터
 */
export interface UpdateRequestData {
  status?: RequestStatus;
  matchedGillerId?: string;
  gillerRating?: number;
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
