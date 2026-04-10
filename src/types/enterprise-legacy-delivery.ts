/**
 * Legacy enterprise-facing B2B delivery type definitions.
 *
 * These types describe the older "business client contract/order" flow.
 * They are not the source of truth for the external partner orchestration model.
 */

/** 공통 위치 정보 */
export interface Location {
  /** 역 이름 */
  station: string;
  /** 주소 */
  address: string;
  /** 연락처 */
  contact?: string;
  latitude?: number;
  longitude?: number;
}

/** 배송 요금 정보 */
export interface DeliveryPricing {
  /** 기본 배송비 */
  baseFee: number;
  /** 무게 추가 요금(kg당) */
  weightSurcharge: number;
  /** 총 배송비 */
  totalFee: number;
  /** 길러 수익 */
  gillerEarning: number;
}

/** Legacy enterprise customer delivery type */
export type EnterpriseLegacyDeliveryType = 'on-demand' | 'scheduled';

/** Legacy enterprise customer delivery status */
export type EnterpriseLegacyDeliveryStatus =
  | 'pending'      // 대기 중
  | 'matched'      // 매칭 완료
  | 'picked_up'    // 픽업 완료
  | 'in_transit'   // 이동 중
  | 'delivered'    // 배송 완료
  | 'cancelled';   // 취소됨

/** Legacy enterprise customer delivery entity */
export interface EnterpriseLegacyDelivery {
  /** 배송 ID */
  id: string;
  /** 계약 ID */
  contractId: string;
  /** Enterprise customer ID */
  businessId: string;
  /** 길러 ID (매칭 후 채움) */
  gillerId?: string;

  /** 픽업 위치 */
  pickupLocation: Location;
  /** 배송 위치 */
  dropoffLocation: Location;
  /** 예정 시간 */
  scheduledTime: Date;
  /** 무게(kg) */
  weight: number;
  /** 특이사항 */
  notes?: string;

  /** 배송 유형 */
  type: EnterpriseLegacyDeliveryType;
  /** 매칭 시간 */
  matchedAt?: Date;
  /** 수락 시간 */
  acceptedAt?: Date;

  /** 배송 상태 */
  status: EnterpriseLegacyDeliveryStatus;

  /** 픽업 사진 URL */
  pickupPhoto?: string;
  /** 배송 사진 URL */
  deliveryPhoto?: string;
  /** 완료 시간 */
  completedAt?: Date;

  /** 배송 요금 */
  pricing: DeliveryPricing;

  /** 생성 시각 */
  createdAt: Date;
  /** 수정 시각 */
  updatedAt: Date;
}

/** Legacy enterprise customer delivery creation data */
export interface CreateEnterpriseLegacyDeliveryData {
  /** 계약 ID */
  contractId: string;
  businessId: string;
  /** 픽업 위치 */
  pickupLocation: Location;
  /** 배송 위치 */
  dropoffLocation: Location;
  /** 예정 시간 */
  scheduledTime: Date;
  /** 무게(kg) */
  weight: number;
  /** 특이사항 */
  notes?: string;
}

/** 무게 추가 요금 계산 상수 */
export const WEIGHT_SURCHARGE_RATE = 200; // 200원/kg

/** 기본 배송비 상수 */
export const BASE_DELIVERY_FEES = {
  small: 5000,   // 5km 미만
  medium: 7000,  // 5-10km
  large: 9000,   // 10km 초과
} as const;

/** Legacy enterprise customer contract */
export interface EnterpriseLegacyContract {
  /** 계약 ID */
  contractId: string;
  /** Enterprise customer ID */
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
  /** 생성 시각 */
  createdAt?: Date;
  /** 수정 시각 */
  updatedAt?: Date;
}

/** Legacy enterprise customer contract creation data */
export interface CreateEnterpriseLegacyContractData {
  /** Enterprise customer ID */
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

/** Legacy enterprise customer request */
export interface EnterpriseLegacyRequest {
  /** 요청 ID */
  requestId: string;
  /** Enterprise customer ID */
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
  /** 생성 시각 */
  createdAt?: Date;
  /** 수정 시각 */
  updatedAt?: Date;
}

/** Legacy enterprise customer request creation data */
export interface CreateEnterpriseLegacyRequestData {
  /** Enterprise customer ID */
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

export type EnterpriseLegacyDeliveryPricing = DeliveryPricing;
export type EnterpriseLegacyLocation = Location;
export type EnterpriseLegacyTaxInvoice = TaxInvoice;

/** 세금계산서 데이터 */
export interface TaxInvoice {
  /** 계산서 ID */
  invoiceId: string;
  /** Enterprise customer ID */
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
  /** 부가세(10%) */
  tax: number;
  /** 생성 시각 */
  createdAt?: Date;
}
