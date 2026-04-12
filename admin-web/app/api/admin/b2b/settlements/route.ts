import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminDb = getAdminDb();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    let items: Record<string, any>[] = [];

    try {
      // Fetch from partner_settlements with order
      const settlementsRef = adminDb.collection('partner_settlements')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(100);

      const snapshot = await settlementsRef.get();
      items = snapshot.docs.map(doc => {
        const data = doc.data() as Record<string, any>;
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          settledAt: data.settledAt?.toDate?.()?.toISOString() || null,
        };
      });
    } catch (dbError: any) {
      // Handle missing index error by falling back to client-side sort
      if (dbError.message?.includes('FAILED_PRECONDITION') && dbError.message?.includes('requires an index')) {
        console.warn('B2B Settlements: Missing index for status + createdAt, falling back to client-side sort');
        
        const fallbackRef = adminDb.collection('partner_settlements')
          .where('status', '==', status)
          .limit(100);
          
        const snapshot = await fallbackRef.get();
        items = snapshot.docs.map(doc => {
          const data = doc.data() as Record<string, any>;
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            settledAt: data.settledAt?.toDate?.()?.toISOString() || null,
          };
        }).sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
      } else {
        throw dbError;
      }
    }

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
