/**
 * B2B 배송 타입 정의
 * 
 * B2B 배송 요청 및 진행 상태를 관리합니다.
 * 기획 문서: PLANNING_B2B_BUSINESS.md
 */

/**
 * 위치 정보 (공통)
 */
export interface Location {
  /** 역 이름 */
  station: string;
  /** 주소 */
  address: string;
  /** 연락처 */
  contact: string;
}

/**
 * 배송 요금 정보
 */
export interface DeliveryPricing {
  /** 기본 배송비 */
  baseFee: number;
  /** 중량 추가비 (kg당) */
  weightSurcharge: number;
  /** 총 배송비 */
  totalFee: number;
  /** 길러 수익 */
  gillerEarning: number;
}

/**
 * B2B 배송 타입
 */
export type B2BDeliveryType = "on-demand" | "scheduled";

/**
 * B2B 배송 상태
 */
export type B2BDeliveryStatus = 
  | "pending"       // 대기 중 (길러 매칭 전)
  | "matched"       // 매칭 완료
  | "picked_up"     // 픽업 완료
  | "in_transit"    // 이동 중
  | "delivered"     // 배송 완료
  | "cancelled";    // 취소됨

/**
 * B2B 배송 인터페이스
 */
export interface B2BDelivery {
  /** 배송 ID */
  id: string;
  /** 계약 ID */
  contractId: string;
  /** B2B 고객사 ID */
  businessId: string;
  /** 길러 ID (매칭 후) */
  gillerId?: string;
  
  // 배송 정보
  /** 픽업 위치 */
  pickupLocation: Location;
  /** 드롭오프 위치 */
  dropoffLocation: Location;
  /** 예정 시간 */
  scheduledTime: Date;
  /** 무게 (kg) */
  weight: number;
  /** 특이사항 */
  notes?: string;
  
  // 매칭
  /** 배송 타입 */
  type: B2BDeliveryType;
  /** 매칭 시간 */
  matchedAt?: Date;
  /** 수락 시간 */
  acceptedAt?: Date;
  
  // 진행 상태
  /** 배송 상태 */
  status: B2BDeliveryStatus;
  
  // 완료 정보
  /** 픽업 사진 URL */
  pickupPhoto?: string;
  /** 배송 사진 URL */
  deliveryPhoto?: string;
  /** 완료 시간 */
  completedAt?: Date;
  
  // 요금
  /** 배송 요금 */
  pricing: DeliveryPricing;
  
  /** 생성 일시 */
  createdAt: Date;
  /** 업데이트 일시 */
  updatedAt: Date;
}

/**
 * B2B 배송 생성 데이터
 */
export interface CreateB2BDeliveryData {
  /** 계약 ID */
  contractId: string;
  /** 픽업 위치 */
  pickupLocation: Location;
  /** 드롭오프 위치 */
  dropoffLocation: Location;
  /** 예정 시간 */
  scheduledTime: Date;
  /** 무게 (kg) */
  weight: number;
  /** 특이사항 */
  notes?: string;
}

/**
 * 중량 추가비 계산 상수
 */
export const WEIGHT_SURCHARGE_RATE = 200; // 200원/kg

/**
 * 기본 배송비 상수
 */
export const BASE_DELIVERY_FEES = {
  small: 5000,   // 5km 미만
  medium: 7000,  // 5-10km
  large: 9000     // 10km 초과
} as const;

/**
 * B2B 계약 타입
 */
export interface B2BContract {
  /** 계약 ID */
  contractId: string;
  /** B2B 고객사 ID */
  businessId: string;
  /** 고객사명 */
  businessName: string;
  /** 업종 */
  businessType: string;
  /** 등급 (basic, standard, premium) */
  tier: string;
  /** 계약 시작일 */
  startDate: Date;
  /** 계약 종료일 */
  endDate: Date;
  /** 월 이용료 */
  monthlyFee: number;
  /** 월 배송 한도 */
  deliveryLimit: number;
  /** 건당 배송비 */
  pricePerDelivery: number;
  /** 상태 (active, suspended, cancelled) */
  status?: string;
  /** 생성 일시 */
  createdAt?: Date;
  /** 업데이트 일시 */
  updatedAt?: Date;
}

/**
 * B2B 계약 생성 데이터
 */
export interface CreateB2BContractData {
  /** B2B 고객사 ID */
  businessId: string;
  /** 고객사명 */
  businessName: string;
  /** 업종 */
  businessType?: string;
  /** 등급 (basic, standard, premium) */
  tier?: string;
  /** 계약 시작일 */
  startDate: Date;
  /** 계약 종료일 */
  endDate: Date;
  /** 월 이용료 */
  monthlyFee: number;
  /** 월 배송 한도 */
  deliveryLimit: number;
  /** 건당 배송비 */
  pricePerDelivery: number;
}

/**
 * B2B 요청 타입
 */
export interface B2BRequest {
  /** 요청 ID */
  requestId: string;
  /** B2B 고객사 ID */
  businessId: string;
  /** 계약 ID */
  contractId: string;
  /** 픽업 역 정보 */
  pickupStation: {
    stationId: string;
    stationName: string;
  };
  /** 배송 역 정보 */
  deliveryStation: {
    stationId: string;
    stationName: string;
  };
  /** 패키지 정보 */
  packageInfo: {
    size: string;
    weight: string;
    description: string;
  };
  /** 긴급도 */
  urgency: string;
  /** 예정 시간 */
  scheduledTime: Date;
  /** 배정된 길러 ID */
  assignedGillerId?: string;
  /** 상태 (pending, assigned, in_progress, completed, cancelled) */
  status?: string;
  /** 생성 일시 */
  createdAt?: Date;
  /** 업데이트 일시 */
  updatedAt?: Date;
}

/**
 * B2B 요청 생성 데이터
 */
export interface CreateB2BRequestData {
  /** B2B 고객사 ID */
  businessId: string;
  /** 계약 ID */
  contractId: string;
  /** 픽업 역 정보 */
  pickupStation: {
    stationId: string;
    stationName: string;
  };
  /** 배송 역 정보 */
  deliveryStation: {
    stationId: string;
    stationName: string;
  };
  /** 패키지 정보 */
  packageInfo: {
    size: string;
    weight: string;
    description: string;
  };
  /** 긴급도 */
  urgency?: string;
  /** 예정 시간 */
  scheduledTime: Date;
}

/**
 * 세금 계산서 타입
 */
export interface TaxInvoice {
  /** 계산서 ID */
  invoiceId: string;
  /** B2B 고객사 ID */
  businessId: string;
  /** 계약 ID */
  contractId: string;
  /** 대상 월 */
  month: string;
  /** 기간 */
  period: {
    start: Date;
    end: Date;
  };
  /** 총 금액 */
  totalAmount: number;
  /** 배송 건수 */
  deliveryCount: number;
  /** 기본료 */
  baseFee: number;
  /** 배송비 */
  deliveryFees: number;
  /** 부가세 (10%) */
  tax: number;
  /** 생성 일시 */
  createdAt?: Date;
}
