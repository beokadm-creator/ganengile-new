import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import {
  normalizeRoutePricingOverride,
  type RoutePricingOverrideConfig,
} from '../../../../../shared/route-pricing-override';

const COLLECTION = 'config_route_pricing_overrides';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

   
  const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(100).get();
  const items = snap.docs.map((doc: any) => ({
    id: doc.id,
    ...normalizeRoutePricingOverride(doc.data() as Partial<RoutePricingOverrideConfig>),
    updatedAt: doc.data().updatedAt ?? null,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = normalizeRoutePricingOverride((await req.json()) as Partial<RoutePricingOverrideConfig>);
  if (!body.routeKey) {
    return NextResponse.json({ error: 'routeKey is required' }, { status: 400 });
  }

   
  await db.collection(COLLECTION).doc(body.routeKey).set({
    ...body,
    updatedAt: new Date(),
    createdAt: new Date(),
  }, { merge: true });

  return NextResponse.json({ ok: true, item: body });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = normalizeRoutePricingOverride((await req.json()) as Partial<RoutePricingOverrideConfig>);
  if (!body.routeKey) {
    return NextResponse.json({ error: 'routeKey is required' }, { status: 400 });
  }

   
  await db.collection(COLLECTION).doc(body.routeKey).set({
    ...body,
    updatedAt: new Date(),
  }, { merge: true });

  return NextResponse.json({ ok: true, item: body });
}
