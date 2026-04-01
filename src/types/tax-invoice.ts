import type { SettlementPeriod } from './b2b-settlement';

export type TaxInvoiceStatus = 'issued' | 'sent' | 'paid' | 'overdue';

export interface TaxInvoiceRecipient {
  companyName: string;
  businessNumber: string;
  ceo: string;
  address: string;
  contact: string;
  email: string;
}

export interface TaxInvoiceSupplier {
  companyName: string;
  businessNumber: string;
  ceo: string;
  address: string;
  contact: string;
  email: string;
}

export interface TaxInvoiceItems {
  subscriptionFee: number;
  deliveryCount: number;
  deliveryFee: number;
  totalAmount: number;
  tax: number;
}

export interface TaxInvoice {
  invoiceId: string;
  contractId: string;
  businessId: string;
  issueDate: Date;
  period: SettlementPeriod;
  items: TaxInvoiceItems;
  recipient: TaxInvoiceRecipient;
  supplier: TaxInvoiceSupplier;
  status: TaxInvoiceStatus;
  pdfUrl: string;
}

export const TAX_RATE = 0.1;

export const PLATFORM_INFO: TaxInvoiceSupplier = {
  companyName: '가는길에 주식회사',
  businessNumber: '123-45-67890',
  ceo: '김가온',
  address: '서울특별시 강남구 테헤란로 123',
  contact: '02-1234-5678',
  email: 'b2b@ganengile.com',
};
