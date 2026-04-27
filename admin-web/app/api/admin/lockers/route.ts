import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import type { Query } from 'firebase-admin/firestore';

const VALID_COLLECTIONS = ['lockers', 'non_subway_lockers'] as const;

function validateCollection(collection: string | null): string {
  if (!collection || !VALID_COLLECTIONS.includes(collection as typeof VALID_COLLECTIONS[number])) {
    return 'lockers';
  }
  return collection;
}

interface LockerStats {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  avgBaseFee: number;
  totalCapacity: number;
  totalAvailable: number;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

   
  const { searchParams } = new URL(req.url);
  const collection = validateCollection(searchParams.get('collection'));
  const search = (searchParams.get('search') ?? '').toLowerCase();
  const statusFilter = searchParams.get('status') ?? '';
  const operatorFilter = searchParams.get('operator') ?? '';
  const limit = Math.min(Number(searchParams.get('limit') ?? '200'), 500);

  try {
    let query: Query = db.collection(collection);

    if (statusFilter) {
      query = query.where('status', '==', statusFilter);
    }

    if (operatorFilter) {
      query = query.where('operator', '==', operatorFilter);
    }

    const snap = await query.orderBy('updatedAt', 'desc').limit(limit).get();

    let items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown>));

    if (search) {
      items = items.filter((item) => {
        const stationName = (item.location as Record<string, unknown> | undefined)?.stationName as string | undefined;
        const section = (item.location as Record<string, unknown> | undefined)?.section as string | undefined;
        const lockerId = (item.lockerId as string | undefined) ?? '';
        return (
          (stationName?.toLowerCase().includes(search) ?? false) ||
          (section?.toLowerCase().includes(search) ?? false) ||
          lockerId.toLowerCase().includes(search)
        );
      });
    }

    const stats: LockerStats = {
      total: items.length,
      available: 0,
      occupied: 0,
      maintenance: 0,
      avgBaseFee: 0,
      totalCapacity: 0,
      totalAvailable: 0,
    };

    let totalBaseFee = 0;
    let feeCount = 0;

    for (const item of items) {
      const status = item.status as string | undefined;
      if (status === 'available') stats.available++;
      else if (status === 'occupied') stats.occupied++;
      else if (status === 'maintenance') stats.maintenance++;

      const pricing = item.pricing as Record<string, unknown> | undefined;
      if (pricing && typeof pricing.base === 'number') {
        totalBaseFee += pricing.base;
        feeCount++;
      }

      const availability = item.availability as Record<string, unknown> | undefined;
      if (availability) {
        if (typeof availability.total === 'number') stats.totalCapacity += availability.total;
        if (typeof availability.available === 'number') stats.totalAvailable += availability.available;
      }
    }

    stats.avgBaseFee = feeCount > 0 ? Math.round(totalBaseFee / feeCount) : 0;

    return NextResponse.json({ items, stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch lockers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
