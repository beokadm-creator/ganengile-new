import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();
     

    // Fetch summaries from partner_dispatches and partner_settlements
    
    // 1. 이번 달 배송 통계
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const deliveriesQuery = await db.collection('partner_dispatches')
      .where('createdAt', '>=', startOfMonth)
      .get();
      
    let completedDeliveriesThisMonth = 0;
    
    deliveriesQuery.forEach((doc: any) => {
      const data = doc.data();
      if (data.status === 'completed' || data.status === 'delivered') {
        completedDeliveriesThisMonth++;
      }
    });

    // 2. 파트너 통계
    const partnersQuery = await db.collection('delivery_partners').where('status', '==', 'active').get();
    const activePartners = partnersQuery.size;

    // 3. 최근 정산금
    const settlementsQuery = await db.collection('partner_settlements')
      .orderBy('periodEnd', 'desc')
      .limit(1)
      .get();
      
    let thisMonthSettlement = 0;
    if (!settlementsQuery.empty) {
      const latestSettlement = settlementsQuery.docs[0].data();
      thisMonthSettlement = latestSettlement.totalAmount || 0;
    }

    // 4. 최근 디스패치 목록 (최대 10개)
    const recentDispatches: any[] = [];
    deliveriesQuery.docs.slice(0, 10).forEach((doc: any) => {
      recentDispatches.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        activePartners,
        totalDeliveriesThisMonth: deliveriesQuery.size,
        completedDeliveriesThisMonth,
        thisMonthSettlement,
        recentDispatches,
      }
    });
  } catch (error: unknown) {
    console.error('B2B Dashboard API Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
