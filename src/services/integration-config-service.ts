/**
 * Integration Config Service
 * 관리자가 Firestore에 저장한 테스트모드/라이브 설정을 앱에서 읽는 서비스.
 * API 키 등 민감 정보는 여기 없음 — testMode 플래그만 공개.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface IdentityIntegrationConfig {
  testMode: boolean;
}

export interface PaymentIntegrationConfig {
  testMode: boolean;
}

const CACHE_TTL = 60 * 1000; // 1분 캐시

let identityCache: { data: IdentityIntegrationConfig; expiresAt: number } | null = null;
let paymentCache: { data: PaymentIntegrationConfig; expiresAt: number } | null = null;

/**
 * 본인인증 테스트 모드 여부 조회.
 * 관리자가 OFF로 바꾸면 1분 내 반영.
 */
export async function getIdentityTestMode(): Promise<boolean> {
  if (identityCache && Date.now() < identityCache.expiresAt) {
    return identityCache.data.testMode;
  }

  try {
    const snap = await getDoc(doc(db, 'config_integrations', 'identity'));
    const testMode = snap.exists() ? Boolean(snap.data()?.testMode ?? true) : true;
    identityCache = { data: { testMode }, expiresAt: Date.now() + CACHE_TTL };
    return testMode;
  } catch {
    // 읽기 실패 시 안전하게 테스트 모드 유지
    return true;
  }
}

/**
 * 결제 테스트 모드 여부 조회.
 */
export async function getPaymentTestMode(): Promise<boolean> {
  if (paymentCache && Date.now() < paymentCache.expiresAt) {
    return paymentCache.data.testMode;
  }

  try {
    const snap = await getDoc(doc(db, 'config_integrations', 'payment'));
    const testMode = snap.exists() ? Boolean(snap.data()?.testMode ?? true) : true;
    paymentCache = { data: { testMode }, expiresAt: Date.now() + CACHE_TTL };
    return testMode;
  } catch {
    return true;
  }
}
