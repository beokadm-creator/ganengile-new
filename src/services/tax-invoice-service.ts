import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  TaxInvoice,
  TaxInvoiceItems,
  TaxInvoiceRecipient,
  SettlementPeriod,
  TaxInvoiceStatus,
} from '../types/tax-invoice';
import { PLATFORM_INFO } from '../types/tax-invoice';
import { getPricingPolicyConfig } from './pricing-policy-config-service';

const INVOICE_COLLECTION = 'tax_invoices';

type IssueTaxInvoiceInput = {
  businessNumber: string;
  companyName: string;
  ceoName: string;
  address: string;
  contact: string;
  email?: string;
  period: {
    startDate?: Date;
    endDate?: Date;
  };
  amount: number;
  tax: number;
  totalAmount: number;
};

type FirestoreTaxInvoiceDoc = DocumentData & {
  invoiceId?: string;
  contractId?: string;
  businessId?: string;
  issueDate?: Date | Timestamp | null;
  period?: {
    start?: Date | Timestamp | null;
    end?: Date | Timestamp | null;
  };
  items?: Partial<TaxInvoiceItems>;
  recipient?: Partial<TaxInvoiceRecipient>;
  supplier?: Partial<typeof PLATFORM_INFO>;
  status?: TaxInvoiceStatus;
  pdfUrl?: string;
  documentText?: string;
  sentAt?: Date | Timestamp | null;
  updatedAt?: Date | Timestamp | null;
  manualReviewRequired?: boolean;
};

export type TaxInvoiceDocument = TaxInvoice & {
  documentText?: string;
  sentAt?: Date;
  updatedAt?: Date;
  manualReviewRequired?: boolean;
};

function toDate(value: Date | Timestamp | null | undefined, fallback: Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  return fallback;
}

function buildRecipient(data: IssueTaxInvoiceInput): TaxInvoiceRecipient {
  return {
    companyName: data.companyName,
    businessNumber: data.businessNumber,
    ceo: data.ceoName,
    address: data.address,
    contact: data.contact,
    email: data.email ?? 'billing@customer.local',
  };
}

function buildItems(data: IssueTaxInvoiceInput, vatRate: number): TaxInvoiceItems {
  const amount = data.amount;
  const tax = data.tax > 0 ? data.tax : Math.round(amount * vatRate);

  return {
    subscriptionFee: amount,
    deliveryCount: 0,
    deliveryFee: 0,
    totalAmount: amount,
    tax,
  };
}

function buildDocumentText(invoice: TaxInvoiceDocument): string {
  return [
    '가는길에 B2B 세금계산서',
    `계산서 ID: ${invoice.invoiceId}`,
    `발행일: ${invoice.issueDate.toLocaleDateString('ko-KR')}`,
    `정산 기간: ${invoice.period.start.toLocaleDateString('ko-KR')} ~ ${invoice.period.end.toLocaleDateString('ko-KR')}`,
    `공급받는자: ${invoice.recipient.companyName}`,
    `사업자등록번호: ${invoice.recipient.businessNumber}`,
    `대표자: ${invoice.recipient.ceo}`,
    `주소: ${invoice.recipient.address}`,
    `연락처: ${invoice.recipient.contact}`,
    `공급가액: ${invoice.items.totalAmount.toLocaleString('ko-KR')}원`,
    `부가세: ${invoice.items.tax.toLocaleString('ko-KR')}원`,
    `합계: ${(invoice.items.totalAmount + invoice.items.tax).toLocaleString('ko-KR')}원`,
    '현재 단계: 운영 검토용 문서 생성 완료',
  ].join('\n');
}

function mapInvoiceDocument(invoiceId: string, raw: FirestoreTaxInvoiceDoc): TaxInvoiceDocument {
  const now = new Date();
  const issueDate = toDate(raw.issueDate, now);
  const period: SettlementPeriod = {
    start: toDate(raw.period?.start, now),
    end: toDate(raw.period?.end, now),
  };

  return {
    invoiceId,
    contractId: typeof raw.contractId === 'string' ? raw.contractId : `manual-${raw.businessId ?? 'unknown'}`,
    businessId: typeof raw.businessId === 'string' ? raw.businessId : '',
    issueDate,
    period,
    items: {
      subscriptionFee: typeof raw.items?.subscriptionFee === 'number' ? raw.items.subscriptionFee : 0,
      deliveryCount: typeof raw.items?.deliveryCount === 'number' ? raw.items.deliveryCount : 0,
      deliveryFee: typeof raw.items?.deliveryFee === 'number' ? raw.items.deliveryFee : 0,
      totalAmount: typeof raw.items?.totalAmount === 'number' ? raw.items.totalAmount : 0,
      tax: typeof raw.items?.tax === 'number' ? raw.items.tax : 0,
    },
    recipient: {
      companyName: raw.recipient?.companyName ?? '',
      businessNumber: raw.recipient?.businessNumber ?? '',
      ceo: raw.recipient?.ceo ?? '',
      address: raw.recipient?.address ?? '',
      contact: raw.recipient?.contact ?? '',
      email: raw.recipient?.email ?? 'billing@customer.local',
    },
    supplier: {
      companyName: raw.supplier?.companyName ?? PLATFORM_INFO.companyName,
      businessNumber: raw.supplier?.businessNumber ?? PLATFORM_INFO.businessNumber,
      ceo: raw.supplier?.ceo ?? PLATFORM_INFO.ceo,
      address: raw.supplier?.address ?? PLATFORM_INFO.address,
      contact: raw.supplier?.contact ?? PLATFORM_INFO.contact,
      email: raw.supplier?.email ?? PLATFORM_INFO.email,
    },
    status: raw.status ?? 'issued',
    pdfUrl: raw.pdfUrl ?? '',
    documentText: raw.documentText,
    sentAt: raw.sentAt ? toDate(raw.sentAt, issueDate) : undefined,
    updatedAt: raw.updatedAt ? toDate(raw.updatedAt, issueDate) : undefined,
    manualReviewRequired: raw.manualReviewRequired ?? true,
  };
}

export class TaxInvoiceService {
  async issueTaxInvoice(businessId: string, data: IssueTaxInvoiceInput): Promise<string> {
    const pricingPolicy = await getPricingPolicyConfig();
    const period: SettlementPeriod = {
      start: data.period.startDate ?? new Date(),
      end: data.period.endDate ?? new Date(),
    };

    const baseDocument = {
      contractId: `manual-${businessId}`,
      businessId,
      issueDate: new Date(),
      period,
      items: buildItems(data, pricingPolicy.vatRate),
      recipient: buildRecipient(data),
      supplier: PLATFORM_INFO,
      status: 'issued' as TaxInvoiceStatus,
      pdfUrl: '',
      manualReviewRequired: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, INVOICE_COLLECTION), baseDocument);
    const invoiceId = docRef.id;
    const finalDocument = mapInvoiceDocument(invoiceId, {
      invoiceId,
      contractId: baseDocument.contractId,
      businessId: baseDocument.businessId,
      issueDate: baseDocument.issueDate,
      period: {
        start: period.start,
        end: period.end,
      },
      items: baseDocument.items,
      recipient: baseDocument.recipient,
      supplier: baseDocument.supplier,
      status: baseDocument.status,
      pdfUrl: baseDocument.pdfUrl,
      manualReviewRequired: baseDocument.manualReviewRequired,
      documentText: '',
      updatedAt: new Date(),
    });

    await updateDoc(docRef, {
      invoiceId,
      documentText: buildDocumentText(finalDocument),
      updatedAt: serverTimestamp(),
    });

    return invoiceId;
  }

  async getInvoice(invoiceId: string): Promise<TaxInvoiceDocument | null> {
    const invoiceDoc = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
    if (!invoiceDoc.exists()) {
      return null;
    }

    return mapInvoiceDocument(invoiceId, invoiceDoc.data() as FirestoreTaxInvoiceDoc);
  }

  async getBusinessInvoices(businessId: string, status?: TaxInvoiceStatus): Promise<TaxInvoiceDocument[]> {
    let invoiceQuery = query(collection(db, INVOICE_COLLECTION), where('businessId', '==', businessId));

    if (status) {
      invoiceQuery = query(invoiceQuery, where('status', '==', status));
    }

    const querySnapshot = await getDocs(invoiceQuery);
    return querySnapshot.docs.map((invoiceDoc) => mapInvoiceDocument(invoiceDoc.id, invoiceDoc.data() as FirestoreTaxInvoiceDoc));
  }

  async updateInvoiceStatus(invoiceId: string, status: TaxInvoiceStatus): Promise<void> {
    await updateDoc(doc(db, INVOICE_COLLECTION, invoiceId), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === 'sent' ? { sentAt: serverTimestamp() } : {}),
    });
  }

  async markAsPaid(invoiceId: string): Promise<void> {
    await this.updateInvoiceStatus(invoiceId, 'paid');
  }

  async markOverdueInvoices(): Promise<void> {
    const invoiceQuery = query(collection(db, INVOICE_COLLECTION), where('status', '==', 'issued'));
    const querySnapshot = await getDocs(invoiceQuery);
    const now = Date.now();

    for (const invoiceDoc of querySnapshot.docs) {
      const invoice = invoiceDoc.data() as FirestoreTaxInvoiceDoc;
      const issueDate = toDate(invoice.issueDate, new Date(now));
      const daysSinceIssue = Math.floor((now - issueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceIssue >= 7) {
        await this.updateInvoiceStatus(invoiceDoc.id, 'overdue');
      }
    }
  }

  async calculateInvoiceItems(params: { subscriptionFee: number; deliveryCount: number; perDeliveryFee: number }): Promise<TaxInvoiceItems> {
    const pricingPolicy = await getPricingPolicyConfig();
    const deliveryFee = params.deliveryCount * params.perDeliveryFee;
    const subtotal = params.subscriptionFee + deliveryFee;
    const tax = Math.round(subtotal * pricingPolicy.vatRate);

    return {
      subscriptionFee: params.subscriptionFee,
      deliveryCount: params.deliveryCount,
      deliveryFee,
      totalAmount: subtotal,
      tax,
    };
  }

  async getUnpaidInvoices(): Promise<TaxInvoiceDocument[]> {
    const invoiceQuery = query(collection(db, INVOICE_COLLECTION), where('status', 'in', ['issued', 'overdue']));
    const querySnapshot = await getDocs(invoiceQuery);
    return querySnapshot.docs.map((invoiceDoc) => mapInvoiceDocument(invoiceDoc.id, invoiceDoc.data() as FirestoreTaxInvoiceDoc));
  }

  async resendInvoice(invoiceId: string): Promise<void> {
    await this.updateInvoiceStatus(invoiceId, 'sent');
  }

  async calculateRefund(invoiceId: string): Promise<number> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) {
      return 0;
    }

    return invoice.items.totalAmount + invoice.items.tax;
  }
}

export const taxInvoiceService = new TaxInvoiceService();
