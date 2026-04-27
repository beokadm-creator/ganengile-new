import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
  }

   
  const snap = await db.collection('requests').doc(requestId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = snap.data();
  const settlementSnap = await db.collection('settlements').doc(requestId).get();
  const settlement = settlementSnap.exists ? settlementSnap.data() : null;
  const earningPaymentId = settlement?.earningPaymentId ?? null;
  const earningPaymentSnap =
    earningPaymentId
      ? await db.collection('payments').doc(earningPaymentId).get()
      : null;
  const earningPayment = earningPaymentSnap?.exists ? earningPaymentSnap.data() : null;

  return NextResponse.json({
    id: snap.id,
    pickupStation: data?.pickupStation ?? null,
    deliveryStation: data?.deliveryStation ?? null,
    packageInfo: data?.packageInfo ?? null,
    urgency: data?.urgency ?? null,
    itemValue: data?.itemValue ?? null,
    initialNegotiationFee: data?.initialNegotiationFee ?? null,
    feeBreakdown: data?.feeBreakdown ?? null,
    settlement: settlement
      ? {
          status: settlement.status ?? null,
          settlementVersion: settlement.settlementVersion ?? null,
          customerPaidAmount: settlement.customerPaidAmount ?? null,
          feeSupplyAmount: settlement.feeSupplyAmount ?? null,
          vatAmount: settlement.vatAmount ?? null,
          publicFareAmount: settlement.publicFareAmount ?? null,
          platformServiceFeeAmount: settlement.platformServiceFeeAmount ?? null,
          platformFeeAmount: settlement.platformFeeAmount ?? null,
          gillerGrossAmount: settlement.gillerGrossAmount ?? null,
          gillerWithholdingTaxAmount: settlement.gillerWithholdingTaxAmount ?? null,
          gillerNetAmount: settlement.gillerNetAmount ?? null,
          refundStatus: settlement.refundStatus ?? null,
        }
      : null,
    earningPayment: earningPayment
      ? {
          amount: earningPayment.amount ?? null,
          fee: earningPayment.fee ?? null,
          tax: earningPayment.tax ?? null,
          netAmount: earningPayment.netAmount ?? null,
          status: earningPayment.status ?? null,
          metadata: earningPayment.metadata ?? null,
        }
      : null,
    createdAt: data?.createdAt ?? null,
  });
}
