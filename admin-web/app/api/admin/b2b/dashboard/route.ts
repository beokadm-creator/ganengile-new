import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();
    const adminDb = getAdminDb();

    // Fetch summaries from partner_dispatches and partner_settlements
    
    // 1. Total Partner Dispatches this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const deliveriesQuery = await adminDb.collection('partner_dispatches')
      .where('createdAt', '>=', startOfMonth)
      .get();
      
    const totalDeliveriesThisMonth = deliveriesQuery.size;
    let completedDeliveriesThisMonth = 0;
    
    deliveriesQuery.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed' || data.status === 'delivered') {
        completedDeliveriesThisMonth++;
      }
    });

    // 2. Active Partners Count
    const partnersQuery = await adminDb.collection('delivery_partners').where('status', '==', 'active').get();
    const activePartnersCount = partnersQuery.size;

    // 3. Current Pending Settlements
    const settlementsQuery = await adminDb.collection('partner_settlements')
      .where('status', 'in', ['pending', 'processing'])
      .get();
      
    let pendingSettlementAmount = 0;
    settlementsQuery.forEach(doc => {
      const data = doc.data();
      pendingSettlementAmount += (data.netAmount || 0);
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalDeliveriesThisMonth,
        completedDeliveriesThisMonth,
        activePartnersCount,
        pendingSettlementAmount
      }
    });
  } catch (error: unknown) {
    console.error('B2B Dashboard API Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
