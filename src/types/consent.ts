/**
 * Consent & Terms Types
 * 온보딩 동의 항목 관리 (한국 법령 기반)
 *
 * Firestore collection: consentTemplates
 * 사용자 동의 이력: users/{uid}.consentHistory
 */

import { Timestamp } from 'firebase/firestore';

// ─── 동의 항목 식별자 ───────────────────────────────────────
export enum ConsentKey {
  /** 서비스 이용약관 (전자상거래법 §26) */
  SERVICE_TERMS = 'service_terms',
  /** 개인정보 수집 및 이용 동의 (개인정보보호법 §15) */
  PRIVACY_COLLECTION = 'privacy_collection',
  /** 개인정보처리방침 (개인정보보호법 §30) */
  PRIVACY_POLICY = 'privacy_policy',
  /** 제3자 정보제공 동의 (개인정보보호법 §17) */
  THIRD_PARTY_SHARING = 'third_party_sharing',
  /** 위치정보 서비스 이용약관 (위치정보법 §6) */
  LOCATION_TERMS = 'location_terms',
  /** 만 14세 이상 확인 (정보통신망법 §44의5) */
  AGE_CONFIRMATION = 'age_confirmation',
  /** 마케팅 정보 수신 동의 (정보통신망법 §50) - 선택 */
  MARKETING = 'marketing',
  /** 광고성 정보 수신 동의 (정보통신망법 §50) - 선택 */
  ADVERTISING = 'advertising',
  /** 야간 광고성 정보 수신 동의 (정보통신망법 §50의2) - 선택 */
  NIGHTTIME_ADS = 'nighttime_ads',
}

// ─── 동의 카테고리 ─────────────────────────────────────────
export enum ConsentCategory {
  REQUIRED = 'required',
  OPTIONAL = 'optional',
}

// ─── 동의 항목 법적 근거 ──────────────────────────────────
export const CONSENT_LEGAL_BASIS: Record<ConsentKey, { law: string; article: string }> = {
  [ConsentKey.SERVICE_TERMS]: { law: '전자상거래법', article: '§26' },
  [ConsentKey.PRIVACY_COLLECTION]: { law: '개인정보보호법', article: '§15, §22' },
  [ConsentKey.PRIVACY_POLICY]: { law: '개인정보보호법', article: '§30' },
  [ConsentKey.THIRD_PARTY_SHARING]: { law: '개인정보보호법', article: '§17' },
  [ConsentKey.LOCATION_TERMS]: { law: '위치정보법', article: '§6' },
  [ConsentKey.AGE_CONFIRMATION]: { law: '정보통신망법', article: '§44의5' },
  [ConsentKey.MARKETING]: { law: '정보통신망법', article: '§50' },
  [ConsentKey.ADVERTISING]: { law: '정보통신망법', article: '§50' },
  [ConsentKey.NIGHTTIME_ADS]: { law: '정보통신망법', article: '§50의2' },
};

// ─── Firestore: consentTemplates 문서 ──────────────────────
export interface ConsentTemplate {
  /** Firestore document ID = ConsentKey */
  id: string;
  key: ConsentKey;
  title: string;
  description: string;
  content: string;
  version: string;
  category: ConsentCategory;
  sortOrder: number;
  effectiveDate: Timestamp | string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

// ─── Firestore: consentTemplates 하위 버전 이력 ────────────
export interface ConsentTemplateVersion {
  version: string;
  content: string;
  effectiveDate: Timestamp | string;
  createdAt: Timestamp | string;
  createdBy: string;
  changeNote: string;
}

// ─── 사용자 동의 기록 ─────────────────────────────────────
export interface ConsentRecord {
  templateId: string;
  key: ConsentKey;
  version: string;
  agreedAt: Timestamp | string;
  withdrawnAt?: Timestamp | string;
  /** 동의 당시 제목 스냅샷 */
  title: string;
}

// ─── 온보딩용 표시 항목 (앱에서 사용) ─────────────────────
export interface ConsentDisplayItem {
  templateId: string;
  key: ConsentKey;
  title: string;
  description: string;
  content: string;
  version: string;
  category: ConsentCategory;
  sortOrder: number;
  isRequired: boolean;
}

// ─── 관리자용 폼 데이터 ──────────────────────────────────
export interface ConsentTemplateFormData {
  key: ConsentKey;
  title: string;
  description: string;
  content: string;
  version: string;
  category: ConsentCategory;
  sortOrder: number;
  effectiveDate: string;
  changeNote?: string;
}

// ─── 헬퍼 ─────────────────────────────────────────────────
export function isConsentRequired(category: ConsentCategory): boolean {
  return category === ConsentCategory.REQUIRED;
}

/** 필수 동의 항목 목록 반환 */
export function getRequiredConsentKeys(): ConsentKey[] {
  return [
    ConsentKey.SERVICE_TERMS,
    ConsentKey.PRIVACY_COLLECTION,
    ConsentKey.PRIVACY_POLICY,
    ConsentKey.THIRD_PARTY_SHARING,
    ConsentKey.LOCATION_TERMS,
    ConsentKey.AGE_CONFIRMATION,
  ];
}

/** 선택 동의 항목 목록 반환 */
export function getOptionalConsentKeys(): ConsentKey[] {
  return [
    ConsentKey.MARKETING,
    ConsentKey.ADVERTISING,
    ConsentKey.NIGHTTIME_ADS,
  ];
}

/** 카테고리별 정렬된 전체 항목 키 */
export function getAllConsentKeysSorted(): ConsentKey[] {
  return [
    ...getRequiredConsentKeys(),
    ...getOptionalConsentKeys(),
  ];
}
