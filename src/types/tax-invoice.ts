import { SettlementPeriod } from './b2b-settlement';

/**
 * 세금계산서 타입 정의
 */

/**
 * 세금계산서 상태
 */
export type TaxInvoiceStatus = 
  | "issued"
  | "sent"
  | "paid"
  | "overdue";

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
  subscriptionFee: number;
  deliveryCount: number;
  deliveryFee: number;
  totalAmount: number;
  tax: number;
}

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
