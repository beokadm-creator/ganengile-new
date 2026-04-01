import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

type UnknownRecord = Record<string, unknown>;

const TAX_POLICY = {
  businessIncomeRate: 0.03,
  localIncomeTaxRate: 0.003,
  combinedWithholdingRate: 0.033,
  combinedWithholdingPercentLabel: '3.3%',
  annualFilingWindow: '5월 1일 ~ 5월 31일',
  withholdingRemitDueRule: '원천세 신고·납부는 일반적으로 지급월 다음 달 10일까지 진행합니다.',
  simpleStatementDueRule: '사업소득 간이지급명세서는 지급월 다음 달 말일까지 제출합니다.',
  caution:
    '실제 신고 주체와 제출 책임, 인적용역 해당 여부는 운영 정책과 세무 검토를 함께 확인해야 합니다.',
};

function getDb(): Firestore {
  return getAdminDb() as unknown as Firestore;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const [settlementsSnap, paymentConfigSnap, bankConfigSnap] = await Promise.all([
    db.collection('settlements').orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('config_integrations').doc('payment').get(),
    db.collection('config_integrations').doc('bank').get(),
  ]);

  const settlementDocs = settlementsSnap.docs
    .map((doc) => ({ id: doc.id, raw: (doc.data() as UnknownRecord) ?? {} }))
    .filter((item) => (status ? item.raw.status === status : true));

  const requestIds = new Set<string>();
  const paymentIds = new Set<string>();
  const gillerIds = new Set<string>();

  settlementDocs.forEach(({ raw }) => {
    if (typeof raw.requestId === 'string' && raw.requestId) requestIds.add(raw.requestId);
    if (typeof raw.earningPaymentId === 'string' && raw.earningPaymentId) paymentIds.add(raw.earningPaymentId);
    if (typeof raw.gillerId === 'string' && raw.gillerId) gillerIds.add(raw.gillerId);
  });

  const [requestEntries, paymentEntries, gillerEntries] = await Promise.all([
    Promise.all(
      Array.from(requestIds).map(async (requestId) => {
        const snap = await db.collection('requests').doc(requestId).get();
        return [requestId, snap.exists ? ((snap.data() as UnknownRecord) ?? {}) : null] as const;
      })
    ),
    Promise.all(
      Array.from(paymentIds).map(async (paymentId) => {
        const snap = await db.collection('payments').doc(paymentId).get();
        return [paymentId, snap.exists ? ((snap.data() as UnknownRecord) ?? {}) : null] as const;
      })
    ),
    Promise.all(
      Array.from(gillerIds).map(async (gillerId) => {
        const userSnap = await db.collection('users').doc(gillerId).get();
        return [gillerId, userSnap.exists ? ((userSnap.data() as UnknownRecord) ?? {}) : null] as const;
      })
    ),
  ]);

  const requestMap = new Map(requestEntries);
  const paymentMap = new Map(paymentEntries);
  const gillerMap = new Map(gillerEntries);
  const paymentConfig = paymentConfigSnap.exists ? ((paymentConfigSnap.data() as UnknownRecord) ?? {}) : {};
  const bankConfig = bankConfigSnap.exists ? ((bankConfigSnap.data() as UnknownRecord) ?? {}) : {};

  const items = settlementDocs.map(({ id, raw }) => {
    const request = typeof raw.requestId === 'string' ? requestMap.get(raw.requestId) ?? null : null;
    const payment =
      typeof raw.earningPaymentId === 'string' ? paymentMap.get(raw.earningPaymentId) ?? null : null;
    const giller = typeof raw.gillerId === 'string' ? gillerMap.get(raw.gillerId) ?? null : null;
    const feeBreakdown =
      (request?.feeBreakdown as UnknownRecord | undefined) ??
      (request?.fee as UnknownRecord | undefined) ??
      null;

    const customerPaidAmount =
      asNumber(raw.customerPaidAmount) ??
      asNumber(feeBreakdown?.totalFee) ??
      asNumber(request?.initialNegotiationFee);

    const publicFareAmount = asNumber(raw.publicFareAmount) ?? asNumber(feeBreakdown?.publicFare);
    const vatAmount = asNumber(raw.vatAmount) ?? asNumber(feeBreakdown?.vat);

    const feeSupplyAmount =
      asNumber(raw.feeSupplyAmount) ??
      (typeof customerPaidAmount === 'number'
        ? Math.max(0, customerPaidAmount - (vatAmount ?? 0) - (publicFareAmount ?? 0))
        : null);

    const platformFeeAmount =
      asNumber(raw.platformFeeAmount) ??
      asNumber(payment?.fee) ??
      asNumber((feeBreakdown?.breakdown as UnknownRecord | undefined)?.platformFee);

    const gillerGrossAmount =
      asNumber(raw.gillerGrossAmount) ??
      asNumber(payment?.amount) ??
      asNumber((feeBreakdown?.breakdown as UnknownRecord | undefined)?.gillerFee);

    const gillerWithholdingTaxAmount =
      asNumber(raw.gillerWithholdingTaxAmount) ?? asNumber(payment?.tax);

    const gillerNetAmount =
      asNumber(raw.gillerNetAmount) ??
      asNumber(payment?.netAmount) ??
      (typeof gillerGrossAmount === 'number' && typeof gillerWithholdingTaxAmount === 'number'
        ? Math.max(0, gillerGrossAmount - gillerWithholdingTaxAmount)
        : null);

    const expectedWithholdingTaxAmount =
      typeof gillerGrossAmount === 'number'
        ? Math.round(gillerGrossAmount * TAX_POLICY.combinedWithholdingRate)
        : null;

    const taxDifference =
      typeof expectedWithholdingTaxAmount === 'number' && typeof gillerWithholdingTaxAmount === 'number'
        ? gillerWithholdingTaxAmount - expectedWithholdingTaxAmount
        : null;

    const withholdingReviewStatus =
      typeof taxDifference === 'number'
        ? Math.abs(taxDifference) <= 1
          ? 'ok'
          : 'review'
        : 'missing';

    const identityStatus =
      typeof (giller?.gillerInfo as UnknownRecord | undefined)?.identityVerificationStatus === 'string'
        ? ((giller?.gillerInfo as UnknownRecord).identityVerificationStatus as string)
        : giller?.isVerified
          ? 'approved'
          : 'not_submitted';

    const bankStatus =
      typeof ((giller?.gillerInfo as UnknownRecord | undefined)?.bankAccount as UnknownRecord | undefined)
        ?.verificationStatus === 'string'
        ? ((((giller?.gillerInfo as UnknownRecord | undefined)?.bankAccount as UnknownRecord)
            .verificationStatus) as string)
        : 'not_submitted';

    return {
      id,
      ...raw,
      customerPaidAmount,
      publicFareAmount,
      vatAmount,
      feeSupplyAmount,
      platformFeeAmount,
      gillerGrossAmount,
      gillerWithholdingTaxAmount,
      gillerNetAmount,
      expectedWithholdingTaxAmount,
      taxDifference,
      withholdingReviewStatus,
      gillerIdentityStatus: identityStatus,
      gillerBankVerificationStatus: bankStatus,
      gillerTotalEarnings: asNumber(giller?.totalEarnings),
      gillerTotalTaxWithheld: asNumber(giller?.totalTaxWithheld),
      paymentConfigLiveReady: Boolean(paymentConfig.liveReady ?? false),
      paymentConfigTestMode: Boolean(paymentConfig.testMode ?? true),
      paymentProvider:
        typeof paymentConfig.provider === 'string' ? paymentConfig.provider : 'tosspayments',
      paymentStatusMessage:
        typeof paymentConfig.statusMessage === 'string'
          ? paymentConfig.statusMessage
          : 'PG 준비 전에는 테스트 모드와 운영 수동 검토를 함께 진행합니다.',
      bankConfigLiveReady: Boolean(bankConfig.liveReady ?? false),
      bankConfigTestMode: Boolean(bankConfig.testMode ?? true),
      geo:
        request?.pickupStation && request?.deliveryStation
          ? {
              pickup: request.pickupStation,
              dropoff: request.deliveryStation,
            }
          : null,
    };
  });

  const summary = items.reduce(
    (acc, item) => {
      acc.totalCustomerPaid += item.customerPaidAmount ?? 0;
      acc.totalPlatformFee += item.platformFeeAmount ?? 0;
      acc.totalGrossSettlement += item.gillerGrossAmount ?? 0;
      acc.totalWithholdingTax += item.gillerWithholdingTaxAmount ?? 0;
      acc.totalNetSettlement += item.gillerNetAmount ?? 0;
      if (item.withholdingReviewStatus === 'review') acc.taxReviewCount += 1;
      if (item.withholdingReviewStatus === 'missing') acc.taxMissingCount += 1;
      return acc;
    },
    {
      totalCustomerPaid: 0,
      totalPlatformFee: 0,
      totalGrossSettlement: 0,
      totalWithholdingTax: 0,
      totalNetSettlement: 0,
      taxReviewCount: 0,
      taxMissingCount: 0,
    }
  );

  return NextResponse.json({
    items,
    summary,
    taxPolicy: TAX_POLICY,
    integration: {
      paymentLiveReady: Boolean(paymentConfig.liveReady ?? false),
      paymentTestMode: Boolean(paymentConfig.testMode ?? true),
      paymentProvider:
        typeof paymentConfig.provider === 'string' ? paymentConfig.provider : 'tosspayments',
      paymentStatusMessage:
        typeof paymentConfig.statusMessage === 'string'
          ? paymentConfig.statusMessage
          : 'PG 준비 전에는 테스트 모드와 운영 수동 검토를 함께 진행합니다.',
      bankLiveReady: Boolean(bankConfig.liveReady ?? false),
      bankTestMode: Boolean(bankConfig.testMode ?? true),
    },
  });
}
