/**
 * * Consent Service
 * Firestore consentTemplates 컬렉션에서 동의 항목을 로드하고
 * 사용자 동의 이력을 저장하는 서비스 계층.
 */

import {
  Timestamp,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';

import type { QueryDocumentSnapshot } from 'firebase/firestore';

import { db } from './firebase';
import {
  ConsentCategory,
  ConsentKey,
  type ConsentDisplayItem,
  type ConsentRecord,
} from '../types/consent';

// ─── Firestore 조회 ──────────────────────────────────────

/**
 * Firestore `consentTemplates` 컬렉션에서 활성 동의 템플릿릿을 모두 가져온다.
 * 정렬 기준: `sortOrder` 오름차순.
 */
export async function fetchConsentTemplates(): Promise<ConsentDisplayItem[]> {
  const snapshot = await getDocs(
    query(collection(db, 'consentTemplates'), orderBy('sortOrder', 'asc'))
  );

  const items: ConsentDisplayItem[] = [];
  snapshot.forEach((docSnap: QueryDocumentSnapshot) => {
    const data = docSnap.data();
    items.push({
      templateId: docSnap.id,
      key: data.key as ConsentKey,
      title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      content: typeof data.content === 'string' ? data.content : '',
      version: typeof data.version === 'string' ? data.version : '1.0.0',
      category: data.category === 'optional' ? ConsentCategory.OPTIONAL : ConsentCategory.REQUIRED,
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
      isRequired: data.category !== 'optional',
    });
  });

  return items;
}

// ─── 사용자 동의 이력 저장 ────────────────────────────────

/**
 * `users/{uid}` 문서에 `consentHistory` 배열을 업데이트한다.
 * 기존 필드는 유지하며 병합된다.
 */
export async function saveConsentHistory(
  uid: string,
  records: ConsentRecord[],
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    consentHistory: records,
    updatedAt: Timestamp.now(),
  });
}

// ─── 필수 동의 검증 ──────────────────────────────────────

/**
 * 모든 필수(category === required) 동의 항목이 true인지 확인한다.
 */
export function checkRequiredConsents(
  consents: Record<string, boolean>,
  templates: ConsentDisplayItem[],
): boolean {
  return templates
    .filter((t) => t.isRequired)
    .every((t) => consents[t.key] === true);
}

// ─── 폴백 (Firestore 로드 실패 시 최소 항목) ─────────────

const FALLBACK_ITEMS: Array<{
  key: ConsentKey;
  title: string;
  description: string;
  required: boolean;
}> = [
  {
    key: ConsentKey.SERVICE_TERMS,
    title: '서비스 이용약관',
    description: '서비스 이용에 필요한 기본 약관입니다.',
    required: true,
  },
  {
    key: ConsentKey.PRIVACY_COLLECTION,
    title: '개인정보 수집 및 이용 동의',
    description: '주문, 정산, 본인 확인에 필요한 개인정보 처리 안내입니다.',
    required: true,
  },
  {
    key: ConsentKey.PRIVACY_POLICY,
    title: '개인정보처리방침',
    description: '개인정보 처리 방침에 대한 안내입니다.',
    required: true,
  },
  {
    key: ConsentKey.THIRD_PARTY_SHARING,
    title: '제3자 정보제공 동의',
    description: '배송 파트너, 결제 PG 등에 대한 정보 제공 안내입니다.',
    required: true,
  },
  {
    key: ConsentKey.LOCATION_TERMS,
    title: '위치정보 서비스 이용약관',
    description: '배송 경로 및 매칭에 위치 정보 사용에 대한 안내입니다.',
    required: true,
  },
  {
    key: ConsentKey.AGE_CONFIRMATION,
    title: '만 14세 이상 확인',
    description: '만 14세 미만은 법정대리인 동의가 필요합니다.',
    required: true,
  },
  {
    key: ConsentKey.MARKETING,
    title: '마케팅 정보 수신 동의',
    description: '이벤트와 혜택 소식을 받습니다.',
    required: false,
  },
  {
    key: ConsentKey.ADVERTISING,
    title: '광고성 정보 수신 동의',
    description: '광고성 알림을 수신합니다.',
    required: false,
  },
  {
    key: ConsentKey.NIGHTTIME_ADS,
    title: '야간 광고성 정보 수신 동의',
    description: '21:00~08:00 광고성 알림을 수신합니다.',
    required: false,
  },
];

/**
 * Firestore 로드 실패 시 사용할 기본 동의 항목을 반환한다.
 */
export function getFallbackConsentItems(): ConsentDisplayItem[] {
  return FALLBACK_ITEMS.map((item, index) => ({
    templateId: item.key,
    key: item.key,
    title: item.title,
    description: item.description,
    content: '',
    version: 'fallback',
    category: item.required ? ConsentCategory.REQUIRED : ConsentCategory.OPTIONAL,
    sortOrder: index,
    isRequired: item.required,
  }));
}
