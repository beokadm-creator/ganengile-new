// @ts-nocheck
/**
 * Tax Invoice Scheduler
 *
 * 매월 1일 00:00에 실행되어 레거시 기업 계약의 세금계산서를 자동 발행합니다.
 *
 * 실행 일정: "0 0 1 * *" (매월 1일 00:00, Asia/Seoul)
 */

import * as admin from 'firebase-admin';
import { getFunctionsPricingPolicyConfig } from '../pricing-policy-config';

interface PlatformInfo {
  name: string;
  registrationNumber: string;
  ceo: string;
  address: string;
  contact: string;
}

const DEFAULT_PLATFORM_INFO: PlatformInfo = {
  name: '가는길에',
  registrationNumber: '',
  ceo: '',
  address: '',
  contact: '',
};

async function getPlatformInfo(db: admin.firestore.Firestore): Promise<PlatformInfo> {
  try {
    const snap = await db.doc('config/platform_info').get();
    if (snap.exists) {
      const data = snap.data() as Partial<PlatformInfo>;
      return { ...DEFAULT_PLATFORM_INFO, ...data };
    }
  } catch (error) {
    console.warn('⚠️ Failed to load platform_info config, using defaults:', error);
  }
  return DEFAULT_PLATFORM_INFO;
}

/**
 * 매월 1일 세금계산서 발행 스케줄러
 *
 * 1. 활성 레거시 기업 계약 조회 (status: 'active')
 * 2. 전월 배송 집계 (prevMonth: year, month)
 * 3. 세금계산서 생성 (TaxInvoice)
 * 4. PDF 생성 및 이메일 발송
 */
export const taxInvoiceScheduler = async (): Promise<{
  processed: number;
  invoicesGenerated: number;
  errors: string[];
}> => {
  console.warn('🧾 [Tax Invoice Scheduler] Started at:', new Date().toISOString());

  const db = admin.firestore();
  const now = new Date();
  const timeZone = 'Asia/Seoul';

  // 한국 시간 기준 전월 계산
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone }));
  const prevMonth = new Date(koreaTime.getFullYear(), koreaTime.getMonth() - 1, 1);

  const year = prevMonth.getFullYear();
  const month = prevMonth.getMonth() + 1; // 1-12

  console.warn(`📅 Target period: ${year}년 ${month}월`);

  const errors: string[] = [];

  try {
    const pricingPolicy = await getFunctionsPricingPolicyConfig();
    // 1. 활성 레거시 기업 계약 조회
    const contractsSnapshot = await db
      .collection('businessContracts')
      .where('status', '==', 'active')
      .get();

    console.warn(`📊 Found ${contractsSnapshot.size} active contracts`);

    if (contractsSnapshot.empty) {
      console.warn('⚠️ No active enterprise legacy contracts found');
      return { processed: 0, invoicesGenerated: 0, errors: [] };
    }

    // 2. 각 계약별 세금계산서 생성
    const batch = db.batch();
    let invoicesGenerated = 0;

    for (const contractDoc of contractsSnapshot.docs) {
      const contract = contractDoc.data() as BusinessContract;
      const contractId = contractDoc.id;

      try {
        // 2-1. 전월 배송 집계
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const deliveriesSnapshot = await db
          .collection('b2bDeliveries')
          .where('contractId', '==', contractId)
          .where('status', '==', 'completed')
          .where('completedAt', '>=', startOfMonth)
          .where('completedAt', '<=', endOfMonth)
          .get();

        const deliveries = deliveriesSnapshot.docs.map((doc) => doc.data() as Record<string, any>);

        if (deliveries.length === 0) {
          console.warn(`⏭️ No deliveries for contract ${contractId} in ${year}-${month}`);
          continue;
        }

        // 2-2. 금액 집계
        const totalDeliveries = deliveries.length;
        
        let sumTotalFee = 0;
        let sumDynamicAdjustment = 0;

        for (const d of deliveries) {
          // 새 요금 정책의 totalFee 사용. 없으면 기존 fee.total 폴백
          const totalFee = d.fee?.totalFee ?? d.fee?.total ?? 0;
          sumTotalFee += totalFee;
          
          // 동적 요금(할증/할인) 별도 합산
          sumDynamicAdjustment += d.fee?.dynamicAdjustment ?? 0;
        }

        // totalFee는 부가세가 이미 포함된 최종 금액이므로 역산하여 공급가액(subtotal)과 세액(tax)을 구함
        // totalFee = subtotal * (1 + vatRate)
        const subtotal = Math.round(sumTotalFee / (1 + pricingPolicy.vatRate));
        const tax = sumTotalFee - subtotal;
        const totalAmount = sumTotalFee;

        console.warn(`💰 Contract ${contractId}: ${totalDeliveries} deliveries, ${subtotal}원 (tax: ${tax}원)`);

        // 2-3. 세금계산서 생성
        const invoiceRef = db.collection('taxInvoices').doc();

        // 명세서 상세 항목 구성 (기본 배송비와 동적 할증 분리)
        const items = [];
        
        // 동적 요금을 제외한 기본 배송비 공급가액
        const baseSubtotal = subtotal - sumDynamicAdjustment;
        items.push({
          description: '크라우드 배송 대행 기본 수수료',
          quantity: totalDeliveries,
          unitPrice: Math.round(baseSubtotal / totalDeliveries),
          amount: baseSubtotal,
          tax: Math.round(baseSubtotal * pricingPolicy.vatRate),
          supply: baseSubtotal,
        });

        // 동적 할증/할인이 존재할 경우 별도 표기
        if (sumDynamicAdjustment !== 0) {
          items.push({
            description: '배송 환경 및 피크타임 동적 할증/할인',
            quantity: 1, // 전체 합산액이므로 1건으로 표기
            unitPrice: sumDynamicAdjustment,
            amount: sumDynamicAdjustment,
            tax: Math.round(sumDynamicAdjustment * pricingPolicy.vatRate),
            supply: sumDynamicAdjustment,
          });
        }

        const invoice: TaxInvoice = {
          invoiceNumber: `TAX-${year}${String(month).padStart(2, '0')}-${String(invoicesGenerated + 1).padStart(4, '0')}`,
          contractId,
          companyId: contract.companyId,
          issuer: await getPlatformInfo(db),
          recipient: {
            name: contract.companyName,
            registrationNumber: contract.companyRegistrationNumber,
            ceo: contract.companyCeo,
            address: contract.companyAddress,
            contact: contract.companyContact,
          },
          period: {
            year,
            month,
            start: startOfMonth,
            end: endOfMonth,
          },
          items,
          totals: {
            subtotal,
            tax,
            totalAmount,
          },
          status: 'issued',
          pdfUrl: null, // TODO: PDF 생성
          sentAt: null,
          issuedAt: admin.firestore.Timestamp.now(),
          createdAt: admin.firestore.Timestamp.now(),
        };

        batch.set(invoiceRef, invoice);
        invoicesGenerated++;

        console.warn(`✅ Invoice created: ${invoice.invoiceNumber}`);

        // TODO: 2-4. PDF 생성 (제미나이 디자인 전문가가 생성한 템플릿 사용)
        // const pdfUrl = await generateTaxInvoicePDF(invoice);
        // batch.update(invoiceRef, { pdfUrl });

        // TODO: 2-5. 이메일 발송
        // await sendTaxInvoiceEmail(contract.companyEmail, invoice, pdfUrl);
        // batch.update(invoiceRef, { sentAt: admin.firestore.Timestamp.now() });

      } catch (error) {
        const errMsg = `Error processing contract ${contractDoc.id}: ${error}`;
        console.error(errMsg);
        errors.push(errMsg);
      }
    }

    // 3. Batch commit
    if (invoicesGenerated > 0) {
      await batch.commit();
      console.warn(`🎉 Tax invoice scheduler completed: ${invoicesGenerated} invoices generated`);
    }

    return {
      processed: contractsSnapshot.size,
      invoicesGenerated,
      errors,
    };
  } catch (error) {
    console.error('❌ Tax invoice scheduler error:', error);
    throw error;
  }
};
