import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  DEFAULT_SHARED_PRICING_POLICY,
  normalizeSharedPricingPolicy,
  type SharedPricingPolicyConfig,
} from '../../shared/pricing-config';

let pricingPolicyCache: SharedPricingPolicyConfig | null = null;
let isListening = false;

export async function getPricingPolicyConfig(): Promise<SharedPricingPolicyConfig> {
  // If cache is loaded and we are listening for real-time updates, return the cache immediately.
  if (pricingPolicyCache && isListening) {
    return pricingPolicyCache;
  }

  try {
    const docRef = doc(db, 'config_pricing', 'default');
    
    // Set up real-time listener if not already listening
    if (!isListening) {
      onSnapshot(
        docRef,
        (snap) => {
          pricingPolicyCache = normalizeSharedPricingPolicy(
            snap.exists() ? (snap.data() as Partial<SharedPricingPolicyConfig>) : DEFAULT_SHARED_PRICING_POLICY
          );
        },
        (error) => {
          console.error('[pricing-policy-config] realtime listener failed:', error);
          isListening = false;
        }
      );
      isListening = true;
    }

    // Await the first load if cache is still null
    if (!pricingPolicyCache) {
      const snap = await getDoc(docRef);
      pricingPolicyCache = normalizeSharedPricingPolicy(
        snap.exists() ? (snap.data() as Partial<SharedPricingPolicyConfig>) : DEFAULT_SHARED_PRICING_POLICY
      );
    }
    
    return pricingPolicyCache;
  } catch (error) {
    console.error('[pricing-policy-config] load failed:', error);
    return pricingPolicyCache ?? DEFAULT_SHARED_PRICING_POLICY;
  }
}

export function clearPricingPolicyConfigCache() {
  pricingPolicyCache = null;
  // Note: For full cleanup, we would need to unsubscribe the onSnapshot listener,
  // but since this is an app-level singleton configuration, keeping the listener alive is generally fine.
}
