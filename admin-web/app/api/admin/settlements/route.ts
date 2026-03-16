import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let ref = db.collection('settlements').orderBy('createdAt', 'desc').limit(100);
  if (status) {
    ref = ref.where('status', '==', status);
  }

  const snap = await ref.get();
  const requestIds = new Set<string>();
  const paymentIds = new Set<string>();

  for (const row of snap.docs) {
    const data = row.data() as any;
    if (data?.requestId) requestIds.add(data.requestId);
    if (data?.earningPaymentId) paymentIds.add(data.earningPaymentId);
  }

  const requestMap = new Map<string, any>();
  await Promise.all(
    Array.from(requestIds).map(async (requestId) => {
      try {
        const requestSnap = await db.collection('requests').doc(requestId).get();
        if (requestSnap.exists) {
          requestMap.set(requestId, requestSnap.data() as any);
        }
      } catch {
        // noop
      }
    })
  );

  const paymentMap = new Map<string, any>();
  await Promise.all(
    Array.from(paymentIds).map(async (paymentId) => {
      try {
        const paymentSnap = await db.collection('payments').doc(paymentId).get();
        if (paymentSnap.exists) {
          paymentMap.set(paymentId, paymentSnap.data() as any);
        }
      } catch {
        // noop
      }
    })
  );

  const items = snap.docs.map((doc) => {
    const raw = doc.data() as any;
    const request = raw?.requestId ? requestMap.get(raw.requestId) : null;
    const payment = raw?.earningPaymentId ? paymentMap.get(raw.earningPaymentId) : null;
    const feeBreakdown = request?.feeBreakdown || request?.fee || null;

    const customerPaidAmount =
      raw?.customerPaidAmount ??
      feeBreakdown?.totalFee ??
      request?.initialNegotiationFee ??
      null;

    const publicFareAmount =
      raw?.publicFareAmount ??
      feeBreakdown?.publicFare ??
      null;

    const vatAmount =
      raw?.vatAmount ??
      feeBreakdown?.vat ??
      null;

    const feeSupplyAmount =
      raw?.feeSupplyAmount ??
      (typeof customerPaidAmount === 'number'
        ? Math.max(0, customerPaidAmount - (vatAmount || 0) - (publicFareAmount || 0))
        : null);

    const platformServiceFeeAmount =
      raw?.platformServiceFeeAmount ??
      feeBreakdown?.serviceFee ??
      null;

    const platformFeeAmount =
      raw?.platformFeeAmount ??
      payment?.fee ??
      feeBreakdown?.breakdown?.platformFee ??
      null;

    const gillerGrossAmount =
      raw?.gillerGrossAmount ??
      payment?.amount ??
      feeBreakdown?.breakdown?.gillerFee ??
      null;

    const gillerWithholdingTaxAmount =
      raw?.gillerWithholdingTaxAmount ??
      payment?.tax ??
      null;

    const gillerNetAmount =
      raw?.gillerNetAmount ??
      payment?.netAmount ??
      (typeof gillerGrossAmount === 'number'
        ? Math.max(0, gillerGrossAmount - (gillerWithholdingTaxAmount || 0))
        : null);

    return {
      id: doc.id,
      ...raw,
      customerPaidAmount,
      publicFareAmount,
      vatAmount,
      feeSupplyAmount,
      platformServiceFeeAmount,
      platformFeeAmount,
      gillerGrossAmount,
      gillerWithholdingTaxAmount,
      gillerNetAmount,
    };
  });

  return NextResponse.json({ items });
}
