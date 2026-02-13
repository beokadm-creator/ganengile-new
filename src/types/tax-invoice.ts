/**
 * 세금계산서 타입 정의
 * 
 * B2B 고객사에게 발행하는 세금계산서 정보를 관리합니다.
 * 기획 문서: PLANNING_B2B_BUSINESS.md
 */

/**
 * 공급받는자 (B2B 고객사) 정보
 */
export interface TaxInvoiceRecipient {
  /** 회사명 */
  companyName: string;
  /** 사업자등록번호 */
  businessNumber: string;
  /** 대표자명 */
  ceo: string;
  /** 주소 */
  address: string;
  /** 연락처 */
  contact: string;
  /** 이메일 */
  email: string;
}

/**
 * 공급자 (플랫폼) 정보
 */
export interface TaxInvoiceSupplier {
  /** 회사명 */
  companyName: "가는길에 주식회사";
  /** 사업자등록번호 */
  businessNumber: "123-45-67890";
  /** 대표자명 */
  ceo: "김아론";
  /** 주소 */
  address: string;
  /** 연락처 */
  contact: string;
  /** 이메일 */
  email: string;
}

/**
 * 세금계산서 상세 내역
 */
export interface TaxInvoiceItems {
  /** 구독료 */
  subscriptionFee: number;
  /** 배송 건수 */
  deliveryCount: number;
  /** 배송비 */
  deliveryFee: number;
  /** 총액 (부가세 제외) */
  totalAmount: number;
  /** 부가세 (10%) */
  tax: number;
}

/**
 * 세금계산서 상태
 */
export type TaxInvoiceStatus = 
  | "issued"    // 발행됨
  | "sent"      // 발송됨
  | "paid"      // 결제완료
  | "overdue";  // 연체됨

/**
 * 세금계산서 정산 기간
 */
export interface SettlementPeriod {
  /** 정산 기간 시작 */
  start: Date;
  /** 정산 기간 종료 */
  end: Date;
}

/**
 * 세금계산서 인터페이스
 */
export interface TaxInvoice {
  /** 세금계산서 ID */
  invoiceId: string;
  /** 계약 ID */
  contractId: string;
  /** B2B 고객사 ID */
  businessId: string;
  
  // 발행 정보
  /** 발행일 */
  issueDate: Date;
  /** 정산 기간 */
  period: SettlementPeriod;
  
  // 상세 내역
  /** 상세 내역 */
  items: TaxInvoiceItems;
  
  // 공급받는자
  /** 공급받는자 */
  recipient: TaxInvoiceRecipient;
  
  // 공급자
  /** 공급자 */
  supplier: TaxInvoiceSupplier;
  
  // 상태
  /** 세금계산서 상태 */
  status: TaxInvoiceStatus;
  
  // 세금계산서 PDF
  /** PDF URL */
  pdfUrl: string;
}

/**
 * 부가세율
 */
export const TAX_RATE = 0.1; // 10%

/**
 * 플랫폼 기본 정보 (실제 환경 설정 필요)
 */
export const PLATFORM_INFO: TaxInvoiceSupplier = {
  companyName: "가는길에 주식회사",
  businessNumber: "123-45-67890",
  ceo: "김아론",
  address: "서울시 강남구 테헤란로 123 (실제 주소 필요)",
  contact: "02-1234-5678",
  email: "b2b@ganengile.com"
};
