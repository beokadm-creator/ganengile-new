/**
 * B2B 정산 타입 정의
 * 
 * B2B 길러에 대한 월간 정산 정보를 관리합니다.
 * 기획 문서: PLANNING_B2B_BUSINESS.md
 */

/**
 * 정산 기간
 */
export interface SettlementPeriod {
  /** 정산 시작일 */
  start: Date;
  /** 정산 종료일 */
  end: Date;
}

/**
 * 이체 정보
 */
export interface TransferInfo {
  /** 계좌 번호 */
  accountNumber: string;
  /** 은행명 */
  bank: string;
  /** 이체 일시 */
  transferredAt?: Date;
  /** 거래 ID */
  transactionId?: string;
}

/**
 * B2B 정산 상태
 */
export type B2BSettlementStatus = 
  | "pending_payment"  // 지급 대기 중
  | "paid"            // 지급 완료
  | "failed";         // 지급 실패

/**
 * B2B 정산 인터페이스
 */
export interface B2BSettlement {
  /** 정산 ID */
  id: string;
  /** 길러 ID */
  gillerId: string;
  
  // 정산 기간
  /** 정산 기간 */
  period: SettlementPeriod;
  
  // 배송 현황
  /** B2B 배송 건수 */
  b2bDeliveries: number;
  /** 배송 수익 (B2B 배송비 총액) */
  deliveryEarnings: number;
  
  // 보너스
  /** 월 보너스 (등급별) */
  monthlyBonus: number;
  /** 총 정산 금액 */
  totalSettlement: number;
  
  // 상태
  /** 정산 상태 */
  status: B2BSettlementStatus;
  
  // 이체 정보
  /** 이체 정보 */
  transferInfo?: TransferInfo;
  
  /** 생성 일시 */
  createdAt: Date;
}

/**
 * 정산 생성 데이터
 */
export interface CreateB2BSettlementData {
  /** 길러 ID */
  gillerId: string;
  /** 정산 기간 시작 */
  periodStart: Date;
  /** 정산 기간 종료 */
  periodEnd: Date;
  /** 월 보너스 */
  monthlyBonus: number;
}

/**
 * 정산 집계 요약
 */
export interface SettlementSummary {
  /** 기간 */
  period: SettlementPeriod;
  /** B2B 배송 건수 */
  b2bDeliveries: number;
  /** 배송 수익 */
  deliveryEarnings: number;
  /** 월 보너스 */
  monthlyBonus: number;
  /** 총 정산 금액 */
  totalSettlement: number;
}

/**
 * 정산 상태별 한글명
 */
export const SETTLEMENT_STATUS_LABELS: Record<B2BSettlementStatus, string> = {
  pending_payment: "지급 대기",
  paid: "지급 완료",
  failed: "지급 실패"
} as const;

/**
 * 정산 주기 (월간)
 */
export const SETTLEMENT_CYCLE_DAYS = 5; // 매월 5일

/**
 * B2B 길러 등급별 월 보너스 (만원 → 원 변환 필요)
 */
export const TIER_MONTHLY_BONUSES: Record<B2BGillerTier, number> = {
  silver: 100000,    // 10만원
  gold: 200000,      // 20만원
  platinum: 300000   // 30만원
} as const;
