import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  DEFAULT_SHARED_PRICING_POLICY,
  normalizeSharedPricingPolicy,
  type SharedPricingPolicyConfig,
} from '../../shared/pricing-config';

const CACHE_TTL = 60 * 1000;

let pricingPolicyCache: { data: SharedPricingPolicyConfig; expiresAt: number } | null = null;

export async function getPricingPolicyConfig(): Promise<SharedPricingPolicyConfig> {
  if (pricingPolicyCache && Date.now() < pricingPolicyCache.expiresAt) {
    return pricingPolicyCache.data;
  }

  try {
    const snap = await getDoc(doc(db, 'config_pricing', 'default'));
    const config = normalizeSharedPricingPolicy(snap.exists() ? (snap.data() as Partial<SharedPricingPolicyConfig>) : DEFAULT_SHARED_PRICING_POLICY);
    pricingPolicyCache = { data: config, expiresAt: Date.now() + CACHE_TTL };
    return config;
  } catch (error) {
    console.error('[pricing-policy-config] load failed:', error);
    return DEFAULT_SHARED_PRICING_POLICY;
  }
}

export function clearPricingPolicyConfigCache() {
  pricingPolicyCache = null;
}
