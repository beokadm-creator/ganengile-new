import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const adminDb = getAdminDb();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Fetch from b2bSettlements
    const settlementsRef = adminDb.collection('b2bSettlements')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(100);

    const snapshot = await settlementsRef.get();

    const items: Record<string, any>[] = snapshot.docs.map(doc => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        settledAt: data.settledAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Summary calculation
    const summary = {
      totalGrossAmount: 0,
      totalCommissionAmount: 0,
      totalTaxAmount: 0,
      totalNetAmount: 0,
    };

    items.forEach(item => {
      summary.totalGrossAmount += (item.grossAmount || 0);
      summary.totalCommissionAmount += (item.commissionAmount || 0);
      summary.totalTaxAmount += (item.taxAmount || 0);
      summary.totalNetAmount += (item.netAmount || 0);
    });

    return NextResponse.json({
      success: true,
      items,
      summary,
    });
  } catch (error: unknown) {
    console.error('B2B Settlements API Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
