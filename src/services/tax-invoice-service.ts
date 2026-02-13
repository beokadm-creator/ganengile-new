/**
 * 세금계산서 서비스
 * 
 * B2B 고객사에게 세금계산서 발행 및 관리
 */
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { 
  TaxInvoice,
  TaxInvoiceStatus,
  TaxInvoiceItems,
  TaxInvoiceRecipient,
  SettlementPeriod,
  PLATFORM_INFO,
  TAX_RATE
} from '../types/tax-invoice';
import type { SubscriptionTier } from '../types/business-contract';
import { SUBSCRIPTION_TIERS } from '../types/business-contract';

const INVOICE_COLLECTION = 'tax_invoices';
const CONTRACT_COLLECTION = 'business_contracts';
const DELIVERY_COLLECTION = 'b2b_deliveries';

/**
 * 세금계산서 서비스
 */
export class TaxInvoiceService {
  /**
   * 월간 세금계산서 생성 (매월 1일 실행)
   */
  static async generateMonthlyInvoices(): Promise<void> {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. 활성화된 계약 조회
    const contracts = await this.getActiveContracts();

    for (const contractDoc of contracts) {
      const contract = contractDoc.data();
      if (contract.status !== 'active') continue;

      const contractId = contractDoc.id;

      // 2. 배송 건수 집계
      const deliveryCount = await this.countDeliveries(contractId, lastMonth, thisMonth);

      // 3. 요금 계산
      const tier = SUBSCRIPTION_TIERS[contract.tier];
      const subscriptionFee = tier.pricing.monthly;
      const deliveryFee = deliveryCount * tier.pricing.perDelivery;
      const subtotal = subscriptionFee + deliveryFee;
      const tax = Math.round(subtotal * TAX_RATE);
      const totalAmount = subtotal + tax;

      // 4. 세금계산서 생성
      const invoiceData: Omit<TaxInvoice, 'invoiceId' | 'issueDate' | 'status' | 'pdfUrl'> = {
        contractId,
        businessId: contract.businessId,
        period: {
          start: lastMonth,
          end: thisMonth
        },
        items: {
          subscriptionFee,
          deliveryCount,
          deliveryFee,
          totalAmount: subtotal,
          tax
        },
        recipient: await this.getBusinessInfo(contract.businessId),
        supplier: PLATFORM_INFO,
        status: 'issued' as TaxInvoiceStatus
      };

      const docRef = await addDoc(collection(db, INVOICE_COLLECTION), invoiceData);
      const invoiceId = docRef.id;

      // 5. 발행일, 상태 업데이트
      await updateDoc(docRef, {
        invoiceId,
        issueDate: now,
        status: 'issued'
      });

      // 6. PDF 생성 (TODO: PDF 라이브러리 사용)
      await this.generateInvoicePDF(invoiceId);

      // 7. 이메일 발송 (TODO: SendGrid/Mailgun 사용)
      await this.sendInvoiceEmail(
        contract.businessId,
        invoiceId,
        totalAmount
      );
    }
  }

  /**
   * 활성화된 계약 조회
   */
  private static async getActiveContracts(): Promise<any[]> {
    const q = query(
      collection(db, CONTRACT_COLLECTION),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * 배송 건수 집계
   */
  private static async countDeliveries(
    contractId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const q = query(
      collection(db, DELIVERY_COLLECTION),
      where('contractId', '==', contractId),
      where('completedAt', '>=', startDate),
      where('completedAt', '<', endDate)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  }

  /**
   * B2B 고객사 정보 조회
   */
  private static async getBusinessInfo(businessId: string): Promise<TaxInvoiceRecipient> {
    // TODO: users 컬렉션에서 B2B 고객사 정보 조회
    // 임시: 더미 데이터
    return {
      companyName: '샘플 기업',
      businessNumber: '123-45-67890',
      ceo: '김샘플',
      address: '서울시 강남구...',
      contact: '02-1234-5678',
      email: 'sample@company.com'
    };
  }

  /**
   * 세금계산서 PDF 생성
   */
  private static async generateInvoicePDF(invoiceId: string): Promise<string> {
    // TODO: PDF 라이브러리 (pdfkit, jsPDF 등) 사용
    // 임시: 더미 URL
    const pdfUrl = `https://storage.googleapis.com/invoices/${invoiceId}.pdf`;
    
    // PDF URL 저장
    const invoiceRef = doc(db, INVOICE_COLLECTION, invoiceId);
    await updateDoc(invoiceRef, { pdfUrl });
    
    return pdfUrl;
  }

  /**
   * 세금계산서 이메일 발송
   */
  private static async sendInvoiceEmail(
    businessId: string,
    invoiceId: string,
    amount: number
  ): Promise<void> {
    // TODO: SendGrid/Mailgun 사용하여 이메일 발송
    console.log(`세금계산서 발송: ${businessId}, ${invoiceId}, ${amount}원`);
  }

  /**
   * 세금계산서 조회
   */
  static async getInvoice(invoiceId: string): Promise<TaxInvoice | null> {
    const invoiceDoc = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
    if (!invoiceDoc.exists()) {
      return null;
    }
    return {
      invoiceId,
      ...invoiceDoc.data()
    } as TaxInvoice;
  }

  /**
   * B2B 고객사 세금계산서 목록
   */
  static async getBusinessInvoices(
    businessId: string,
    status?: TaxInvoiceStatus
  ): Promise<TaxInvoice[]> {
    let q = query(
      collection(db, INVOICE_COLLECTION),
      where('businessId', '==', businessId)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      invoiceId: doc.id,
      ...doc.data()
    } as TaxInvoice));
  }

  /**
   * 세금계산서 상태 업데이트
   */
  static async updateInvoiceStatus(
    invoiceId: string,
    status: TaxInvoiceStatus
  ): Promise<void> {
    const invoiceRef = doc(db, INVOICE_COLLECTION, invoiceId);
    await updateDoc(invoiceRef, { 
      status,
      updatedAt: new Date()
    });
  }

  /**
   * 결제 완료 처리
   */
  static async markAsPaid(invoiceId: string): Promise<void> {
    await this.updateInvoiceStatus(invoiceId, 'paid');
    
    // TODO: 결제 기록 저장
    console.log(`세금계산서 결제 완료: ${invoiceId}`);
  }

  /**
   * 연체 처리 (매월 10일 자동 실행)
   */
  static async markOverdueInvoices(): Promise<void> {
    const q = query(
      collection(db, INVOICE_COLLECTION),
      where('status', '==', 'issued')
    );

    const querySnapshot = await getDocs(q);
    const now = new Date();

    for (const doc of querySnapshot.docs) {
      const invoice = doc.data() as TaxInvoice;
      const issueDate = new Date(invoice.issueDate);
      const daysSinceIssue = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

      // 발행일로부터 7일 경과 시 연체 처리
      if (daysSinceIssue >= 7) {
        await this.updateInvoiceStatus(doc.id, 'overdue');
      }
    }
  }

  /**
   * 상세 내역 계산
   */
  static calculateInvoiceItems(params: {
    subscriptionFee: number;
    deliveryCount: number;
    perDeliveryFee: number;
  }): TaxInvoiceItems {
    const { subscriptionFee, deliveryCount, perDeliveryFee } = params;
    const deliveryFee = deliveryCount * perDeliveryFee;
    const subtotal = subscriptionFee + deliveryFee;
    const tax = Math.round(subtotal * TAX_RATE);
    const totalAmount = subtotal + tax;

    return {
      subscriptionFee,
      deliveryCount,
      deliveryFee,
      totalAmount: subtotal,
      tax
    };
  }

  /**
   * 미결제 내역 조회 (관리자 전용)
   */
  static async getUnpaidInvoices(): Promise<TaxInvoice[]> {
    const q = query(
      collection(db, INVOICE_COLLECTION),
      where('status', 'in', ['issued', 'overdue'])
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      invoiceId: doc.id,
      ...doc.data()
    } as TaxInvoice));
  }

  /**
   * 세금계산서 재발송
   */
  static async resendInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) return;

    await this.sendInvoiceEmail(
      invoice.businessId,
      invoiceId,
      invoice.items.totalAmount
    );
  }

  /**
   * 환불 계산 (환불 정책에 따름)
   */
  static async calculateRefund(invoiceId: string): Promise<number> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) return 0;

    // TODO: 환불 정책 구현
    return invoice.items.totalAmount;
  }
}
