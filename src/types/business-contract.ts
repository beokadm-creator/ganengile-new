/**
 * B2B 계약 타입 정의
 * 
 * B2B 고객사와의 계약 정보를 관리합니다.
 * 기획 문서: PLANNING_B2B_BUSINESS.md
 */

/**
 * 계약 위치 정보
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
 * 계약 기간
 */
export interface ContractDuration {
  /** 계약 시작일 */
  start: Date;
  /** 계약 종료일 */
  end: Date;
  /** 최소 계약 기간 (월) */
  minDuration: number;
  /** 자동 갱신 여부 */
  autoRenew: boolean;
}

/**
 * 배송 설정
 */
export interface DeliverySettings {
  /** 배송 빈도 */
  frequency: "daily" | "weekly" | "biweekly";
  /** 선호 요일 (weekly/biweekly인 경우) */
  preferredDays?: string[];
  /** 선호 시간 (HH:mm 형식) */
  preferredTime: string;
  /** 픽업 위치 */
  pickupLocation: Location;
  /** 드롭오프 위치 */
  dropoffLocation: Location;
  /** 배송 지침 */
  instructions?: string;
}

/**
 * 결제 정보
 */
export interface BillingInfo {
  /** 결제 방식 */
  method: "card" | "invoice" | "transfer";
  /** 결제 주기 */
  cycle: "monthly" | "quarterly";
  /** 계좌 번호 (세금계산서 발행용) */
  accountNumber?: string;
}

/**
 * B2B 계약 상태
 */
export type ContractStatus = "pending" | "active" | "suspended" | "cancelled";

/**
 * 구독 티어
 */
export type SubscriptionTier = "basic" | "standard" | "premium";

/**
 * B2B 계약 인터페이스
 */
export interface BusinessContract {
  /** 계약 ID */
  id: string;
  /** B2B 고객사 ID */
  businessId: string;
  /** 구독 티어 */
  tier: SubscriptionTier;
  
  /** 계약 기간 */
  duration: ContractDuration;
  
  /** 배송 설정 */
  deliverySettings: DeliverySettings;
  
  /** 결제 정보 */
  billing: BillingInfo;
  
  /** 계약 상태 */
  status: ContractStatus;
  
  /** 승인자 ID (관리자) */
  approvedBy?: string;
  /** 승인 일시 */
  approvedAt?: Date;
  
  /** 생성 일시 */
  createdAt: Date;
  /** 업데이트 일시 */
  updatedAt: Date;
}

/**
 * 구독 티어별 상세 정보
 */
export const SUBSCRIPTION_TIERS = {
  basic: {
    pricing: {
      monthly: 50000,
      perDelivery: 3000
    },
    features: {
      maxDeliveries: 20,
      priority: "low" as const,
      support: "email" as const,
      insurance: false,
      analytics: false
    },
    idealFor: ["소규모 카페", "개인 식당"]
  },
  standard: {
    pricing: {
      monthly: 150000,
      perDelivery: 2500
    },
    features: {
      maxDeliveries: 100,
      priority: "medium" as const,
      support: "phone" as const,
      insurance: true,
      analytics: true
    },
    idealFor: ["프랜차이즈 카페", "중소기업"]
  },
  premium: {
    pricing: {
      monthly: 500000,
      perDelivery: 2000
    },
    features: {
      maxDeliveries: 500,
      priority: "high" as const,
      support: "dedicated" as const,
      insurance: true,
      analytics: true
    },
    idealFor: ["대형 프랜차이즈", "다점포 운영"]
  }
} as const;
