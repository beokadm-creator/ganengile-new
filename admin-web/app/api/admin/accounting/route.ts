import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get('year');
  const monthStr = searchParams.get('month');

  if (!yearStr || !monthStr) {
    return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const docId = `${year}-${String(month).padStart(2, '0')}`;

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const db = getAdminDb();

  try {
    // 최적화: 미리 집계된 통계 문서 확인
    const statsDoc = await db.collection('accounting_stats_monthly').doc(docId).get();
    if (statsDoc.exists) {
      const stats = statsDoc.data()!;
      return NextResponse.json({
        period: { year, month },
        revenue: {
          grossRevenue: stats.totalGrossRevenue || 0,
          revenueDiscount: stats.totalRevenueDiscount || 0,
          liabilityOffset: stats.totalLiabilityOffset || 0,
          cashCollected: stats.totalCashCollected || 0,
        },
        gillerSettlement: {
          grossPayout: stats.totalGillerGrossPayout || 0,
          withholdingTax: stats.totalGillerWithholdingTax || 0,
          netPayout: stats.totalGillerNetPayout || 0,
        },
        partnerSettlement: {
          grossPayout: stats.totalPartnerGrossPayout || 0,
          commission: stats.totalPartnerCommission || 0,
          vat: stats.totalPartnerVat || 0,
          netPayout: stats.totalPartnerNetPayout || 0,
        }
      });
    }

    // 만약 집계 문서가 없다면 (레거시 데이터 등) 기존 방식대로 수기 합산
    const paymentsSnap = await db.collection('payments')
      .where('createdAt', '>=', startOfMonth)
      .where('createdAt', '<=', endOfMonth)
      .get();

    let totalGrossRevenue = 0;
    let totalRevenueDiscount = 0;
    let totalLiabilityOffset = 0;
    let totalCashCollected = 0;

    let totalGillerGrossPayout = 0;
    let totalGillerWithholdingTax = 0;
    let totalGillerNetPayout = 0;

    for (const doc of paymentsSnap.docs) {
      const data = doc.data();
      if (data.type === 'request_fee' && data.status !== 'failed') {
        const accounting = data.metadata?.accounting;
        if (accounting) {
          totalGrossRevenue += accounting.originalGrossAmount || 0;
          totalRevenueDiscount += accounting.revenueDiscountAmount || 0;
          totalLiabilityOffset += accounting.liabilityOffsetAmount || 0;
          totalCashCollected += accounting.actualCashPaymentRequired || 0;
        } else {
          // Fallback for older data
          totalGrossRevenue += data.amount || 0;
          totalCashCollected += data.amount || 0;
        }
      } else if (data.type === 'giller_earning' && data.status === 'completed') {
        totalGillerGrossPayout += data.amount || 0;
        totalGillerWithholdingTax += data.tax || 0;
        totalGillerNetPayout += data.netAmount || 0;
      }
    }

    // 2. B2B 파트너(전문 배송업체) 정산 내역 (월간 주기)
    const partnerSettlementsSnap = await db.collection('partner_settlements')
      .where('periodStart', '>=', startOfMonth.toISOString().split('T')[0])
      .where('periodStart', '<=', endOfMonth.toISOString().split('T')[0])
      .get();

    let totalPartnerGrossPayout = 0; // 공급가액
    let totalPartnerCommission = 0;  // 플랫폼 수수료 매출
    let totalPartnerVat = 0;         // 매입부가세(10%)
    let totalPartnerNetPayout = 0;   // 실 지급액

    for (const doc of partnerSettlementsSnap.docs) {
      const data = doc.data();
      totalPartnerGrossPayout += data.grossAmount || 0;
      totalPartnerCommission += data.commissionAmount || 0;
      totalPartnerVat += data.taxAmount || 0;
      totalPartnerNetPayout += data.netAmount || 0;
    }

    return NextResponse.json({
      period: { year, month },
      revenue: {
        grossRevenue: totalGrossRevenue,
        revenueDiscount: totalRevenueDiscount, // 쿠폰
        liabilityOffset: totalLiabilityOffset, // 포인트
        cashCollected: totalCashCollected,     // PG 입금
      },
      gillerSettlement: {
        grossPayout: totalGillerGrossPayout,
        withholdingTax: totalGillerWithholdingTax, // 3.3%
        netPayout: totalGillerNetPayout,
      },
      partnerSettlement: {
        grossPayout: totalPartnerGrossPayout,
        commission: totalPartnerCommission,
        vat: totalPartnerVat, // 10%
        netPayout: totalPartnerNetPayout,
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}