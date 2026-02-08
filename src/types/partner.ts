/**
 * Location-Based Partner Types (위치기반파트너)
 * 역사 주변 가게/상점 파트너 타입 정의
 */

import { Timestamp } from 'firebase/firestore';
import { StationInfo } from './request';

/**
 * 파트너 시설 타입
 */
export enum PartnerFacilityType {
  BAKERY = 'bakery',         // 빵집
  CAFE = 'cafe',             // 카페
  CONVENIENCE_STORE = 'convenience_store', // 편의점
  RESTAURANT = 'restaurant', // 식당
  STATIONERY = 'stationery', // 문구점
  FLORIST = 'florist',       // 꽃집
  OTHER = 'other',           // 기타
}

/**
 * 보관함 유형
 */
export enum StorageType {
  LOCKER = 'locker',         // 개인 보관함 ( locker )
  COUNTER = 'counter',       // 카운터 보관
  REFRIGERATED = 'refrigerated', // 냉장 보관
  ROOM_TEMPERATURE = 'room_temperature', // 상온 보관
}

/**
 * 파트너 등급
 */
export enum PartnerTier {
  BASIC = 'basic',           // 기본
  PREFERRED = 'preferred',   // 우선
  PREMIUM = 'premium',       // 프리미엄
}

/**
 * 위치기반파트너 (Firestore 문서)
 */
export interface LocationBasedPartner {
  partnerId: string;

  // 기본 정보
  businessName: string;      // 상점명
  facilityType: PartnerFacilityType; // 시설 타입
  tier: PartnerTier;         // 파트너 등급

  // 위치 정보
  stationId: string;         // 인근 역 ID
  stationName: string;       // 역 이름
  distanceToStation: number; // 역까지 거리 (m)
  address: string;           // 주소
  latitude: number;
  longitude: number;

  // 보관 시설
  storage: {
    type: StorageType;       // 보관함 유형
    capacity: number;        // 수용 가능 개수
    availableCount: number;  // 현재 사용 가능 개수
    dimensions?: {           // 보관함 크기 (선택)
      width: number;         // cm
      height: number;        // cm
      depth: number;         // cm
    };
    features: {
      hasClimateControl: boolean;  // 온습도 조절
      hasCCTV: boolean;           // CCTV
      hasInsurance: boolean;       // 보험 가입
    };
  };

  // 운영 시간
  operatingHours: {
    weekdays: { open: string; close: string }; // 월-금
    weekends: { open: string; close: string }; // 토-일
    isHolidayOpen: boolean;     // 공휴일 운영 여부
  };

  // 연락처
  contact: {
    phone: string;
    email?: string;
    ownerName: string;
  };

  // 상태
  isActive: boolean;         // 활성화 여부
  isVerified: boolean;       // 검증 완료 여부

  // 수수료
  commission: {
    storageFee: number;      // 보관료 (원/시간)
    gillerCommission: number; // 길러 커미션 (%)
    platformFee: number;     // 플랫폼 수수료 (%)
  };

  // 평점
  rating: {
    average: number;         // 평균 평점
    count: number;           // 평가 수
    recentReviews: string[]; // 최근 리뷰
  };

  // 통계
  stats: {
    totalStorageCount: number;    // 총 보관 횟수
    monthlyStorageCount: number;  // 월간 보관 횟수
    totalEarnings: number;        // 총 수익
    monthlyEarnings: number;      // 월간 수익
  };

  // 생성/업데이트 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 보관 요청 (Firestore 문서)
 */
export interface StorageRequest {
  requestId: string;

  // 요청자 정보
  gllerId: string;           // 이용자 ID
  gllerName: string;

  // 길러 정보
  gillerId: string;
  gillerName: string;

  // 파트너 정보
  partnerId: string;
  businessName: string;

  // 물건 정보
  item: {
    type: string;            // 물건 종류
    size: 'small' | 'medium' | 'large'; // 크기
    weight?: number;         // 무게 (kg)
    description?: string;    // 설명
    photos?: string[];       // 사진 URLs
  };

  // 보관 정보
  storage: {
    startTime: Date;        // 보관 시작 시간
    endTime: Date;          // 보관 종료 시간
    duration: number;       // 보관 시간 (분)
    type: StorageType;      // 보관 타입
    lockerNumber?: string;  // 보관함 번호 (할당 시)
  };

  // 상태
  status: 'pending' | 'confirmed' | 'in_storage' | 'picked_up' | 'cancelled' | 'expired';

  // 비용
  fee: {
    storageFee: number;     // 보관료
    platformFee: number;    // 플랫폼 수수료
    totalFee: number;       // 총 비용
    paid: boolean;          // 결제 여부
  };

  // 시간 정보
  createdAt: Timestamp;
  confirmedAt?: Timestamp;
  startedAt?: Timestamp;
  pickedUpAt?: Timestamp;
  cancelledAt?: Timestamp;
}

/**
 * 파트너 신청 (Firestore 문서)
 */
export interface PartnerApplication {
  applicationId: string;

  // 신청자 정보
  userId: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;

  // 사업자 정보
  businessRegistration: {
    number: string;         // 사업자등록번호
    documentUrl: string;    // 서류 URL
  };

  // 위치 정보
  stationId: string;
  address: string;
  latitude: number;
  longitude: number;

  // 시설 정보
  facilityType: PartnerFacilityType;
  storage: {
    type: StorageType;
    capacity: number;
    dimensions?: {
      width: number;
      height: number;
      depth: number;
    };
    features: {
      hasClimateControl: boolean;
      hasCCTV: boolean;
      hasInsurance: boolean;
    };
  };

  // 운영 시간
  operatingHours: {
    weekdays: { open: string; close: string };
    weekends: { open: string; close: string };
    isHolidayOpen: boolean;
  };

  // 희망 수수료
  desiredCommission: {
    storageFee: number;
    gillerCommission: number;
  };

  // 상태
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  rejectionReason?: string;

  // 검증 정보
  verification?: {
    verifiedAt?: Timestamp;
    verifiedBy?: string;    // 검증자 ID
    notes?: string;
  };

  // 생성/업데이트 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 파트너 검색 필터
 */
export interface PartnerSearchFilter {
  stationId?: string;
  facilityType?: PartnerFacilityType;
  tier?: PartnerTier;
  isActive?: boolean;
  minRating?: number;
  hasAvailableStorage?: boolean;
}

/**
 * 파트너 통계
 */
export interface PartnerStatistics {
  totalPartners: number;
  activePartners: number;
  totalStorageRequests: number;
  monthlyStorageRequests: number;
  averageRating: number;
  totalRevenue: number;
  monthlyRevenue: number;
}
