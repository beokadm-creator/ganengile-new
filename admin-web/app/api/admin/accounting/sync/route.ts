import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { year, month } = await req.json();

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const docId = `${year}-${String(month).padStart(2, '0')}`;

     

    let totalGrossRevenue = 0;
    let totalRevenueDiscount = 0;
    let totalLiabilityOffset = 0;
    let totalCashCollected = 0;
    let totalGillerGrossPayout = 0;
    let totalGillerWithholdingTax = 0;
    let totalGillerNetPayout = 0;

    // 1. Payments 집계
    const paymentsSnap = await db.collection('payments')
      .where('createdAt', '>=', startOfMonth)
      .where('createdAt', '<=', endOfMonth)
      .get();

    for (const doc of paymentsSnap.docs) {
      const d = doc.data();
      if (d.type === 'request_fee' && d.status !== 'failed') {
        const acc = d.metadata?.accounting;
        if (acc) {
          totalGrossRevenue += acc.originalGrossAmount || 0;
          totalRevenueDiscount += acc.revenueDiscountAmount || 0;
          totalLiabilityOffset += acc.liabilityOffsetAmount || 0;
          totalCashCollected += acc.actualCashPaymentRequired || 0;
        } else {
          totalGrossRevenue += d.amount || 0;
          totalCashCollected += d.amount || 0;
        }
      } else if (d.type === 'giller_earning' && d.status === 'completed') {
        totalGillerGrossPayout += d.amount || 0;
        totalGillerWithholdingTax += d.tax || 0;
        totalGillerNetPayout += d.netAmount || 0;
      }
    }

    // 2. Partner Settlements 집계
    let totalPartnerGrossPayout = 0;
    let totalPartnerCommission = 0;
    let totalPartnerVat = 0;
    let totalPartnerNetPayout = 0;

    const partnerSnap = await db.collection('partner_settlements')
      .where('periodStart', '>=', startOfMonth.toISOString().split('T')[0])
      .where('periodStart', '<=', endOfMonth.toISOString().split('T')[0])
      .get();

    for (const doc of partnerSnap.docs) {
      const d = doc.data();
      totalPartnerGrossPayout += d.grossAmount || 0;
      totalPartnerCommission += d.commissionAmount || 0;
      totalPartnerVat += d.taxAmount || 0;
      totalPartnerNetPayout += d.netAmount || 0;
    }

    // 3. 통계 문서 덮어쓰기
    await db.collection('accounting_stats_monthly').doc(docId).set({
      period: { year, month },
      totalGrossRevenue,
      totalRevenueDiscount,
      totalLiabilityOffset,
      totalCashCollected,
      totalGillerGrossPayout,
      totalGillerWithholdingTax,
      totalGillerNetPayout,
      totalPartnerGrossPayout,
      totalPartnerCommission,
      totalPartnerVat,
      totalPartnerNetPayout,
      updatedAt: new Date(),
      isBackfilled: true,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}