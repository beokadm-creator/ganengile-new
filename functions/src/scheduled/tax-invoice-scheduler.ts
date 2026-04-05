// @ts-nocheck
/**
 * Tax Invoice Scheduler
 *
 * 매월 1일 00:00에 실행되어 B2B 계약 기업의 세금계산서를 자동 발행합니다.
 *
 * 실행 일정: "0 0 1 * *" (매월 1일 00:00, Asia/Seoul)
 */

import * as admin from 'firebase-admin';

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
 * 플랫폼 사업자 정보를 Firestore config/platform_info에서 로드합니다.
 * 문서가 없으면 기본값을 반환합니다.
 */
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
 * 1. 활성 B2B 계약 조회 (status: 'active')
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
    // 1. 활성 B2B 계약 조회
    const contractsSnapshot = await db
      .collection('businessContracts')
      .where('status', '==', 'active')
      .get();

    console.warn(`📊 Found ${contractsSnapshot.size} active contracts`);

    if (contractsSnapshot.empty) {
      console.warn('⚠️ No active B2B contracts found');
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

        const deliveries = deliveriesSnapshot.docs.map((doc) => doc.data() as B2BDelivery);

        if (deliveries.length === 0) {
          console.warn(`⏭️ No deliveries for contract ${contractId} in ${year}-${month}`);
          continue;
        }

        // 2-2. 금액 집계
        const totalDeliveries = deliveries.length;
        const subtotal = deliveries.reduce((sum, d) => sum + (d.fee?.total ?? 0), 0);
        const tax = Math.round(subtotal * 0.1); // 부가세 10%
        const totalAmount = subtotal + tax;

        console.warn(`💰 Contract ${contractId}: ${totalDeliveries} deliveries, ${subtotal}원 (tax: ${tax}원)`);

        // 2-3. 세금계산서 생성
        const invoiceRef = db.collection('taxInvoices').doc();

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
          items: [
            {
              description: '크라우드 배송 대행 수수료',
              quantity: totalDeliveries,
              unitPrice: Math.round(subtotal / totalDeliveries),
              amount: subtotal,
              tax,
              supply: subtotal,
            },
          ],
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
