import { db, doc, getDoc, getDocs, query, where, collection } from './config-utils';
import type { CongestionData, AlgorithmParams } from './config-utils';
import {
  cache,
  convertDocument,
  asRecord,
  readString,
  readNumber,
  readBoolean,
  readStringArray,
  readDate,
  isRecord,
  isPermissionDeniedError,
  normalizeCongestionTimeSlots,
  normalizeCongestionSections,
  normalizeAlgorithmWeights,
  normalizeTimeEfficiency,
  normalizeRouteConvenience,
  normalizeGillerReliability,
  normalizeScoring,
  normalizeLimits,
  normalizePriorities,
  normalizeFeatures,
  getFallbackCongestionConfigs,
} from './config-utils';

export interface PolicyConfig {
  policyId: string;
  title: string;
  content: string[];
  effectiveDate: string;
  isActive: boolean;
  priority?: number;
  version?: string;
  category?: string;
  summary?: string;
  required?: boolean;
  targetFlow?: string;
}

export interface RecipientContactPrivacyConfig {
  safeNumberEnabled: boolean;
  providerName: string;
  policyTitle: string;
  policyEffectiveDate: string;
  thirdPartyConsentRequired: boolean;
  guidance: string;
}

function convertCongestionData(data: unknown, docId?: string): CongestionData {
  const source = asRecord(data);
  return {
    congestionId: readString(source.congestionId, docId ?? ''),
    lineId: readString(source.lineId),
    lineName: readString(source.lineName),
    timeSlots: normalizeCongestionTimeSlots(source.timeSlots),
    sections: normalizeCongestionSections(source.sections),
    dataSource: readString(source.dataSource),
    lastUpdated: readDate(source.lastUpdated),
    isValid: readBoolean(source.isValid, true),
    createdAt: readDate(source.createdAt),
    updatedAt: readDate(source.updatedAt),
  };
}

export async function getCongestionConfig(lineId: string): Promise<CongestionData | null> {
  const cacheKey = `congestion:${lineId}`;
  const cached = cache.get<CongestionData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_congestion'),
      where('lineId', '==', lineId),
      where('isValid', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const congestion = convertDocument(snapshot.docs[0], convertCongestionData);
    cache.set(cacheKey, congestion);
    return congestion;
  } catch (error) {
    console.error(`Error fetching congestion config for line ${lineId}:`, error);
    throw error;
  }
}

export async function getAllCongestionConfigs(): Promise<CongestionData[]> {
  const cacheKey = 'congestion:all';
  const cached = cache.get<CongestionData[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_congestion'),
      where('isValid', '==', true)
    );

    const snapshot = await getDocs(q);
    const congestionConfigs: CongestionData[] = [];

    snapshot.forEach((docSnapshot) => {
      congestionConfigs.push(convertDocument(docSnapshot, convertCongestionData));
    });

    const finalCongestionConfigs = congestionConfigs.length > 0 ? congestionConfigs : getFallbackCongestionConfigs();
    cache.set(cacheKey, finalCongestionConfigs);
    return finalCongestionConfigs;
  } catch (error) {
    console.error('Error fetching all congestion configs, using fallback dataset:', error);
    const fallbackCongestionConfigs = getFallbackCongestionConfigs();
    cache.set(cacheKey, fallbackCongestionConfigs);
    return fallbackCongestionConfigs;
  }
}

function convertAlgorithmParams(data: unknown, docId?: string): AlgorithmParams {
  const source = asRecord(data);
  return {
    paramId: readString(source.paramId, docId ?? ''),
    version: readString(source.version),
    weights: normalizeAlgorithmWeights(source.weights),
    timeEfficiency: normalizeTimeEfficiency(source.timeEfficiency),
    routeConvenience: normalizeRouteConvenience(source.routeConvenience),
    gillerReliability: normalizeGillerReliability(source.gillerReliability),
    scoring: normalizeScoring(source.scoring),
    limits: normalizeLimits(source.limits),
    priorities: normalizePriorities(source.priorities),
    features: normalizeFeatures(source.features),
    isActive: readBoolean(source.isActive, true),
    description: readString(source.description),
    createdBy: readString(source.createdBy),
    createdAt: readDate(source.createdAt),
    updatedAt: readDate(source.updatedAt),
  };
}

export async function getAlgorithmParams(paramId: string = 'matching-weights-v1'): Promise<AlgorithmParams | null> {
  const cacheKey = `algorithmParams:${paramId}`;
  const cached = cache.get<AlgorithmParams>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const docRef = doc(db, 'config_algorithm_params', paramId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      return null;
    }

    const params = convertDocument(docSnapshot, convertAlgorithmParams);
    cache.set(cacheKey, params);
    return params;
  } catch (error) {
    console.error(`Error fetching algorithm params for ${paramId}:`, error);
    throw error;
  }
}

export async function getActiveAlgorithmParams(): Promise<AlgorithmParams | null> {
  const cacheKey = 'algorithmParams:active';
  const cached = cache.get<AlgorithmParams>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_algorithm_params'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const params = convertDocument(snapshot.docs[0], convertAlgorithmParams);
    cache.set(cacheKey, params);
    return params;
  } catch (error) {
    console.error('Error fetching active algorithm params:', error);
    throw error;
  }
}

export function clearConfigCache(): void {
  cache.clear();
}

export function clearCongestionCache(): void {
  cache.clearPattern('^congestion');
}

export function clearAlgorithmParamsCache(): void {
  cache.clearPattern('^algorithmParams');
}

function convertPolicyConfig(data: unknown, docId?: string): PolicyConfig {
  const source = asRecord(data);
  return {
    policyId: readString(source.policyId, docId ?? ''),
    title: readString(source.title, '정책'),
    content: readStringArray(source.content),
    effectiveDate: readString(source.effectiveDate),
    isActive: source.isActive !== false,
    priority: readNumber(source.priority, 999),
    version: typeof source.version === 'string' ? source.version : undefined,
    category: typeof source.category === 'string' ? source.category : undefined,
    summary: typeof source.summary === 'string' ? source.summary : undefined,
    required: typeof source.required === 'boolean' ? source.required : undefined,
    targetFlow: typeof source.targetFlow === 'string' ? source.targetFlow : undefined,
  };
}

function comparePolicyOrder(a: PolicyConfig, b: PolicyConfig): number {
  const dateA = Date.parse(a.effectiveDate ?? '');
  const dateB = Date.parse(b.effectiveDate ?? '');
  const hasDateA = Number.isFinite(dateA);
  const hasDateB = Number.isFinite(dateB);

  if (hasDateA && hasDateB && dateA !== dateB) {
    return dateB - dateA;
  }

  if (hasDateA !== hasDateB) {
    return hasDateA ? -1 : 1;
  }

  return (a.priority ?? 999) - (b.priority ?? 999);
}

export async function getPolicyConfigs(): Promise<PolicyConfig[]> {
  const cacheKey = 'policies:all';
  const cached = cache.get<PolicyConfig[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'config_policies'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const policies: PolicyConfig[] = [];

    snapshot.forEach((docSnapshot) => {
      policies.push(convertDocument(docSnapshot, convertPolicyConfig));
    });

    policies.sort(comparePolicyOrder);
    cache.set(cacheKey, policies);
    return policies;
  } catch (error) {
    console.error('Error fetching policy configs:', error);
    throw error;
  }
}

export async function getPolicyHistoryConfigs(): Promise<PolicyConfig[]> {
  const cacheKey = 'policies:history';
  const cached = cache.get<PolicyConfig[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const snapshot = await getDocs(collection(db, 'config_policies'));
    const policies = snapshot.docs.map((docSnapshot) =>
      convertDocument(docSnapshot, convertPolicyConfig)
    );

    policies.sort(comparePolicyOrder);
    cache.set(cacheKey, policies);
    return policies;
  } catch (error) {
    console.error('Error fetching policy history configs:', error);
    throw error;
  }
}

export async function getRecipientContactPrivacyConfig(): Promise<RecipientContactPrivacyConfig> {
  const cacheKey = 'config:recipient-contact-privacy';
  const cached = cache.get<RecipientContactPrivacyConfig>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const configSnapshot = await getDoc(doc(db, 'config_operational', 'recipient_contact_privacy'));
    const data = configSnapshot.data() as Record<string, unknown> | undefined;

    const resolved: RecipientContactPrivacyConfig = {
      safeNumberEnabled: data?.safeNumberEnabled === true,
      providerName:
        typeof data?.providerName === 'string' && data.providerName.trim().length > 0
          ? data.providerName
          : '관리자 설정 대기',
      policyTitle:
        typeof data?.policyTitle === 'string' && data.policyTitle.trim().length > 0
          ? data.policyTitle
          : '수령인 연락처 보호 정책',
      policyEffectiveDate:
        typeof data?.policyEffectiveDate === 'string' && data.policyEffectiveDate.trim().length > 0
          ? data.policyEffectiveDate
          : '',
      thirdPartyConsentRequired: data?.thirdPartyConsentRequired !== false,
      guidance:
        typeof data?.guidance === 'string' && data.guidance.trim().length > 0
          ? data.guidance
          : '수령인 연락처는 관리자 정책에 따라 안심번호로 전환되어 전달되며, 제3자 정보 제공 동의가 함께 기록됩니다.',
    };

    cache.set(cacheKey, resolved);
    return resolved;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn('Using fallback recipient contact privacy config because access was denied.');
    } else {
      console.warn('Using fallback recipient contact privacy config:', error);
    }
    const fallback: RecipientContactPrivacyConfig = {
      safeNumberEnabled: false,
      providerName: '관리자 설정 대기',
      policyTitle: '수령인 연락처 보호 정책',
      policyEffectiveDate: '',
      thirdPartyConsentRequired: true,
      guidance:
        '수령인 연락처는 관리자 정책에 따라 안심번호로 전환되어 전달되며, 제3자 정보 제공 동의가 함께 기록됩니다.',
    };
    cache.set(cacheKey, fallback);
    return fallback;
  }
}
