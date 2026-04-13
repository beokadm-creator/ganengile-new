/**
 * Consent types for admin-web
 * Mirrors src/types/consent.ts for use within the Next.js admin app
 */

export enum ConsentKey {
  SERVICE_TERMS = 'service_terms',
  PRIVACY_COLLECTION = 'privacy_collection',
  PRIVACY_POLICY = 'privacy_policy',
  THIRD_PARTY_SHARING = 'third_party_sharing',
  LOCATION_TERMS = 'location_terms',
  AGE_CONFIRMATION = 'age_confirmation',
  MARKETING = 'marketing',
  ADVERTISING = 'advertising',
  NIGHTTIME_ADS = 'nighttime_ads',
  TAX_COLLECTION = 'tax_collection',
}

export enum ConsentCategory {
  REQUIRED = 'required',
  OPTIONAL = 'optional',
}

export const CONSENT_KEY_LABELS: Record<ConsentKey, string> = {
  [ConsentKey.SERVICE_TERMS]: '서비스 이용약관',
  [ConsentKey.PRIVACY_COLLECTION]: '개인정보 수집 및 이용 동의',
  [ConsentKey.PRIVACY_POLICY]: '개인정보처리방침',
  [ConsentKey.THIRD_PARTY_SHARING]: '제3자 정보제공 동의',
  [ConsentKey.LOCATION_TERMS]: '위치정보 서비스 이용약관',
  [ConsentKey.AGE_CONFIRMATION]: '만 14세 이상 확인',
  [ConsentKey.MARKETING]: '마케팅 정보 수신 동의',
  [ConsentKey.ADVERTISING]: '광고성 정보 수신 동의',
  [ConsentKey.NIGHTTIME_ADS]: '야간 광고성 정보 수신 동의',
  [ConsentKey.TAX_COLLECTION]: '고유식별정보 수집 및 이용 동의 (세금 신고용)',
};

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
  [ConsentKey.TAX_COLLECTION]: { law: '소득세법', article: '§164' },
};

/** Serialized consent template returned by API */
export interface ConsentTemplateItem {
  id: string;
  key: string;
  title: string;
  description: string;
  content: string;
  version: string;
  category: 'required' | 'optional';
  sortOrder: number;
  effectiveDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Serialized consent template version */
export interface ConsentVersionItem {
  id: string;
  version: string;
  content: string;
  title: string;
  description: string;
  effectiveDate: string | null;
  createdAt: string | null;
  createdBy: string;
  changeNote: string;
}

/** Form data for create/update */
export interface ConsentFormData {
  key: string;
  title: string;
  description: string;
  content: string;
  version: string;
  category: 'required' | 'optional';
  sortOrder: number;
  effectiveDate: string;
  changeNote?: string;
}
