import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { FieldValue } from 'firebase-admin/firestore';

const VALID_COLLECTIONS = ['lockers', 'non_subway_lockers'] as const;
const VALID_STATUSES = ['available', 'occupied', 'maintenance'] as const;

function validateCollection(collection: string | null): string {
  if (!collection || !VALID_COLLECTIONS.includes(collection as typeof VALID_COLLECTIONS[number])) {
    return 'lockers';
  }
  return collection;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lockerId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { lockerId } = await params;
  const { searchParams } = new URL(req.url);
  const collection = validateCollection(searchParams.get('collection'));

  try {
     
    const doc = await db.collection(collection).doc(lockerId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch locker';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ lockerId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { lockerId } = await params;
  const { searchParams } = new URL(req.url);
  const collection = validateCollection(searchParams.get('collection'));

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.pricing !== undefined && typeof body.pricing === 'object' && body.pricing !== null) {
      const pricing = body.pricing as Record<string, unknown>;
      const pricingUpdate: Record<string, unknown> = {};
      if (typeof pricing.base === 'number') pricingUpdate.base = pricing.base;
      if (typeof pricing.baseDuration === 'number') pricingUpdate.baseDuration = pricing.baseDuration;
      if (typeof pricing.extension === 'number') pricingUpdate.extension = pricing.extension;
      if (typeof pricing.maxDuration === 'number') pricingUpdate.maxDuration = pricing.maxDuration;
      updates.pricing = pricingUpdate;
    }

    if (body.availability !== undefined && typeof body.availability === 'object' && body.availability !== null) {
      const availability = body.availability as Record<string, unknown>;
      const availabilityUpdate: Record<string, unknown> = {};
      if (typeof availability.total === 'number') availabilityUpdate.total = availability.total;
      if (typeof availability.occupied === 'number') availabilityUpdate.occupied = availability.occupied;
      if (typeof availability.available === 'number') availabilityUpdate.available = availability.available;
      updates.availability = availabilityUpdate;
    }

    if (body.location !== undefined && typeof body.location === 'object' && body.location !== null) {
      const location = body.location as Record<string, unknown>;
      const locationUpdate: Record<string, unknown> = {};
      if (typeof location.section === 'string') locationUpdate.section = location.section;
      if (typeof location.floor === 'number') locationUpdate.floor = location.floor;
      if (typeof location.stationName === 'string') locationUpdate.stationName = location.stationName;
      if (typeof location.line === 'string') locationUpdate.line = location.line;
      updates.location = locationUpdate;
    }

     
    await db.collection(collection).doc(lockerId).update(updates);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update locker';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ lockerId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { lockerId } = await params;
  const { searchParams } = new URL(req.url);
  const collection = validateCollection(searchParams.get('collection'));

  try {
     
    await db.collection(collection).doc(lockerId).delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete locker';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
