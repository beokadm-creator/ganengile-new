import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import {
  DEFAULT_SHARED_PRICING_POLICY,
  normalizeSharedPricingPolicy,
  type SharedPricingPolicyConfig,
} from '../../../../../shared/pricing-config';

const PRIVATE_DOC_PATH = ['admin_settings', 'pricing_policy'] as const;
const PUBLIC_DOC_PATH = ['config_pricing', 'default'] as const;

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).get();
  const item = normalizeSharedPricingPolicy(
    snap.exists ? (snap.data() as Partial<SharedPricingPolicyConfig>) : DEFAULT_SHARED_PRICING_POLICY
  );

  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as Partial<SharedPricingPolicyConfig>;
  const normalized = normalizeSharedPricingPolicy(body);
  const payload = {
    ...normalized,
    updatedAt: new Date(),
  };

  const db = getAdminDb();
  await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).set(payload, { merge: true });
  await db.collection(PUBLIC_DOC_PATH[0]).doc(PUBLIC_DOC_PATH[1]).set(payload, { merge: true });

  return NextResponse.json({
    ok: true,
    item: payload,
  });
}
