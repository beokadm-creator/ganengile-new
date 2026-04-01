type FirestoreDb = import('firebase-admin/firestore').Firestore;

export interface Beta1AIConfig {
  enabled: boolean;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  analysisModel: string;
  pricingModel: string;
  missionModel: string;
  disableThinking: boolean;
  confidenceThreshold: number;
  fallbackMode: string;
  visionPrompt: string;
  pricingPrompt: string;
  missionPrompt: string;
}

export interface Beta1RequestDraftAnalysisInput {
  requesterUserId: string;
  requestMode?: 'immediate' | 'reservation';
  origin: {
    stationId?: string;
    stationName?: string;
  };
  destination: {
    stationId?: string;
    stationName?: string;
  };
  packageDraft?: {
    itemName?: string;
    category?: string;
    description?: string;
    estimatedValue?: number;
    estimatedWeightKg?: number;
    estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
    isFragile?: boolean;
    isPerishable?: boolean;
  };
  recipient?: {
    name?: string;
    phone?: string;
  };
  preferredSchedule?: {
    pickupTime?: string;
    arrivalTime?: string;
  };
}

export interface Beta1RequestDraftAnalysisResult {
  provider: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  confidence: number;
  result: {
    itemName?: string;
    category?: string;
    description?: string;
    estimatedValue?: number;
    estimatedWeightKg?: number;
    estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
    riskFlags: string[];
    handlingNotes: string[];
  };
}

export interface Beta1PricingQuoteInput {
  requesterUserId: string;
  requestMode?: 'immediate' | 'reservation';
  pickupStation: {
    stationId?: string;
    stationName?: string;
    line?: string;
  };
  deliveryStation: {
    stationId?: string;
    stationName?: string;
    line?: string;
  };
  packageDraft?: {
    description?: string;
    estimatedValue?: number;
    estimatedWeightKg?: number;
    estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
  };
  preferredPickupTime?: string;
  preferredArrivalTime?: string;
  urgency?: 'low' | 'medium' | 'high';
  directParticipationMode?: 'none' | 'requester_to_station' | 'locker_assisted';
  basePricing: {
    publicPrice: number;
    depositAmount: number;
    baseFee: number;
    distanceFee: number;
    weightFee: number;
    sizeFee: number;
    urgencySurcharge: number;
    publicFare: number;
    serviceFee: number;
    vat: number;
  };
}

export interface Beta1PricingQuoteSuggestion {
  quoteType: 'fastest' | 'balanced' | 'lowest_price' | 'locker_included';
  speedLabel: string;
  headline: string;
  recommendationReason: string;
  etaMinutes: number;
  includesLocker: boolean;
  includesAddressPickup: boolean;
  includesAddressDropoff: boolean;
  pricing: {
    publicPrice: number;
    depositAmount: number;
    baseFee: number;
    distanceFee: number;
    weightFee: number;
    sizeFee: number;
    urgencySurcharge: number;
    publicFare: number;
    lockerFee: number;
    addressPickupFee: number;
    addressDropoffFee: number;
    serviceFee: number;
    vat: number;
  };
}

export interface Beta1PricingQuoteResult {
  provider: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  recommendedQuoteType: Beta1PricingQuoteSuggestion['quoteType'];
  quotes: Beta1PricingQuoteSuggestion[];
}

export interface Beta1MissionPlanInput {
  requestId: string;
  deliveryId: string;
  assignedGillerUserId?: string;
  pickupStation: {
    stationId?: string;
    stationName?: string;
  };
  deliveryStation: {
    stationId?: string;
    stationName?: string;
  };
  requestContext?: {
    itemDescription?: string;
    itemValue?: number;
    urgency?: string;
    requestMode?: 'immediate' | 'reservation';
    preferredPickupTime?: string;
    preferredArrivalTime?: string;
  };
}

export interface Beta1MissionPlanResult {
  provider: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  actorSelection: {
    interventionLevel: 'assist' | 'recommend' | 'guarded_execute' | 'human_review' | 'disallowed';
    selectedActorType: 'requester' | 'giller' | 'external_partner' | 'locker';
    selectedPartnerId?: string;
    selectionReason: string;
    fallbackActorTypes: Array<'requester' | 'giller' | 'external_partner' | 'locker'>;
    fallbackPartnerIds: string[];
    manualReviewRequired: boolean;
    riskFlags: string[];
  };
  bundleStrategy: 'single_actor' | 'multi_actor' | 'locker_assisted' | 'partner_fallback';
  missionSummary: string;
}

interface ZaiChatResult {
  ok: boolean;
  latencyMs: number;
  content?: string;
}

function readMessageContent(content: unknown): string | undefined {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return undefined;
  }

  return (
    content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        const record = part as Record<string, unknown>;
        if (typeof record.text === 'string') return record.text;
        if (typeof record.content === 'string') return record.content;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim() || undefined
  );
}

const DEFAULT_AI_CONFIG: Beta1AIConfig = {
  enabled: false,
  provider: 'zai',
  apiKey: '',
  baseUrl: 'https://api.z.ai/api/coding/paas/v4',
  model: 'glm-4.7',
  analysisModel: 'glm-4.7',
  pricingModel: 'glm-4.7',
  missionModel: 'glm-4.7',
  disableThinking: true,
  confidenceThreshold: 0.75,
  fallbackMode: 'manual',
  visionPrompt: 'Analyze the request draft and return JSON only.',
  pricingPrompt: 'Suggest pricing quote cards and return JSON only.',
  missionPrompt: 'Suggest mission planning and actor selection in JSON only.',
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function toCodingBaseUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.replace('/api/paas/v4/chat/completions', '/api/coding/paas/v4/chat/completions');
}

function shouldRetryWithCodingBase(config: Beta1AIConfig, responseJson: Record<string, unknown>): boolean {
  if ((config.provider ?? 'zai') !== 'zai') return false;
  const normalized = normalizeBaseUrl(config.baseUrl);
  if (!normalized.includes('/api/paas/v4/chat/completions')) return false;
  const error = responseJson.error as Record<string, unknown> | undefined;
  const code = typeof error?.code === 'string' ? error.code : '';
  return code === '1113';
}

function extractJsonPayload(content?: string): string | null {
  if (!content) {
    return null;
  }

  const fenced = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstObject = content.indexOf('{');
  const lastObject = content.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    return content.slice(firstObject, lastObject + 1).trim();
  }

  const firstArray = content.indexOf('[');
  const lastArray = content.lastIndexOf(']');
  if (firstArray >= 0 && lastArray > firstArray) {
    return content.slice(firstArray, lastArray + 1).trim();
  }

  return null;
}

function parseJson<T>(content?: string): T | null {
  const payload = extractJsonPayload(content);
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

async function getAIConfig(db: FirestoreDb): Promise<Beta1AIConfig> {
  const snap = await db.collection('admin_settings').doc('ai').get();
  const data = (snap.data() ?? {}) as Record<string, unknown>;

  return {
    enabled: Boolean(data.enabled ?? DEFAULT_AI_CONFIG.enabled),
    provider: asString(data.provider, DEFAULT_AI_CONFIG.provider),
    apiKey: asString(data.apiKey, DEFAULT_AI_CONFIG.apiKey),
    baseUrl: asString(data.baseUrl, DEFAULT_AI_CONFIG.baseUrl),
    model: asString(data.model, DEFAULT_AI_CONFIG.model),
    analysisModel: asString(data.analysisModel, asString(data.model, DEFAULT_AI_CONFIG.analysisModel)),
    pricingModel: asString(data.pricingModel, asString(data.model, DEFAULT_AI_CONFIG.pricingModel)),
    missionModel: asString(data.missionModel, asString(data.model, DEFAULT_AI_CONFIG.missionModel)),
    disableThinking: Boolean(data.disableThinking ?? DEFAULT_AI_CONFIG.disableThinking),
    confidenceThreshold: asNumber(data.confidenceThreshold, DEFAULT_AI_CONFIG.confidenceThreshold),
    fallbackMode: asString(data.fallbackMode, DEFAULT_AI_CONFIG.fallbackMode),
    visionPrompt: asString(data.visionPrompt, DEFAULT_AI_CONFIG.visionPrompt),
    pricingPrompt: asString(data.pricingPrompt, DEFAULT_AI_CONFIG.pricingPrompt),
    missionPrompt: asString(data.missionPrompt, DEFAULT_AI_CONFIG.missionPrompt),
  };
}

async function runZaiChatCompletion(config: Beta1AIConfig, model: string, prompt: string, maxTokens: number): Promise<ZaiChatResult> {
  async function perform(resolvedBaseUrl: string): Promise<{ result: ZaiChatResult; json?: Record<string, unknown> }> {
  const startedAt = Date.now();
  const fetchFn = (globalThis as { fetch?: (input: string, init?: Record<string, unknown>) => Promise<{
    ok: boolean;
    json(): Promise<unknown>;
  }> }).fetch;
  if (!fetchFn) {
    throw new Error('Fetch is not available in this runtime.');
  }

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.1,
  };

  if ((config.provider ?? 'zai') === 'zai') {
    requestBody.thinking = {
      type: config.disableThinking === false ? 'enabled' : 'disabled',
    };
  }

  const response = await fetchFn(resolvedBaseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const latencyMs = Date.now() - startedAt;
  const json = (await response.json()) as Record<string, unknown>;
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const firstChoice = (choices[0] ?? {}) as Record<string, unknown>;
  const message = (firstChoice.message ?? {}) as Record<string, unknown>;

  if (!response.ok) {
      return {
        result: {
          ok: false,
          latencyMs,
          content: undefined,
        },
        json,
      };
  }

    return {
      result: {
        ok: true,
        latencyMs,
        content: readMessageContent(message.content),
      },
      json,
    };
  }

  const primary = await perform(normalizeBaseUrl(config.baseUrl));
  if (!primary.result.ok && primary.json && shouldRetryWithCodingBase(config, primary.json)) {
    const retried = await perform(toCodingBaseUrl(config.baseUrl));
    if (retried.result.ok) {
      return retried.result;
    }
  }

  if (!primary.result.ok) {
    throw new Error(asString((primary.json?.error as Record<string, unknown> | undefined)?.message, 'AI request failed.'));
  }

  return primary.result;
}

function buildAnalysisFallback(input: Beta1RequestDraftAnalysisInput, config: Beta1AIConfig): Beta1RequestDraftAnalysisResult {
  const description = input.packageDraft?.description?.trim() || `${input.origin.stationName || '출발역'}에서 ${input.destination.stationName || '도착역'}까지 보내는 물품`;
  const riskFlags: string[] = [];
  const handlingNotes: string[] = [];
  const reservationMode = isReservationMode(input.requestMode);

  if (input.packageDraft?.isFragile) {
    riskFlags.push('fragile_item');
    handlingNotes.push('fragile_handle_with_care');
  }
  if (input.packageDraft?.isPerishable) {
    riskFlags.push('perishable_item');
    handlingNotes.push('same_day_recommended');
  }
  if ((input.packageDraft?.estimatedValue ?? 0) >= 150000) {
    riskFlags.push('high_value_item');
    handlingNotes.push('deposit_review_recommended');
  }
  if (reservationMode) {
    handlingNotes.push('reservation_window_preferred');
    if (input.preferredSchedule?.pickupTime) {
      handlingNotes.push('respect_reserved_pickup_time');
    }
  } else {
    riskFlags.push('tight_sla_candidate');
    handlingNotes.push('fast_match_priority');
  }

  return {
    provider: config.provider,
    model: config.analysisModel,
    latencyMs: 0,
    fallbackUsed: true,
    confidence: 0.62,
    result: {
      itemName: input.packageDraft?.itemName || '배송 물품',
      category: input.packageDraft?.category || '일반',
      description,
      estimatedValue: input.packageDraft?.estimatedValue,
      estimatedWeightKg: input.packageDraft?.estimatedWeightKg,
      estimatedSize: input.packageDraft?.estimatedSize || 'medium',
      riskFlags: Array.from(new Set(riskFlags)),
      handlingNotes,
    },
  };
}

function clampCurrency(value: number): number {
  return Math.max(0, Math.round(value));
}

function isReservationMode(value?: string): boolean {
  return value === 'reservation';
}

function buildPricingFallback(input: Beta1PricingQuoteInput, config: Beta1AIConfig): Beta1PricingQuoteResult {
  const base = input.basePricing;
  const deposit = base.depositAmount || Math.round(input.packageDraft?.estimatedValue ?? 0);
  const reservationMode = isReservationMode(input.requestMode);
  const urgencyBonus = input.urgency === 'high' ? 1200 : input.urgency === 'medium' ? 400 : 0;
  const lockerPreferred = input.directParticipationMode === 'locker_assisted';

  const quotes: Beta1PricingQuoteSuggestion[] = [
    {
      quoteType: 'fastest',
      speedLabel: '가장 빠르게',
      headline: '즉시 수락과 빠른 이동 우선으로 미션을 엽니다.',
      recommendationReason: '빠른 배차와 주소 대응 여지를 남겨 ETA를 줄입니다.',
      etaMinutes: 65,
      includesLocker: false,
      includesAddressPickup: true,
      includesAddressDropoff: true,
      pricing: {
        publicPrice: clampCurrency(base.publicPrice + 2200 + urgencyBonus),
        depositAmount: deposit,
        baseFee: base.baseFee,
        distanceFee: base.distanceFee,
        weightFee: base.weightFee,
        sizeFee: base.sizeFee,
        urgencySurcharge: clampCurrency(base.urgencySurcharge + urgencyBonus),
        publicFare: base.publicFare,
        lockerFee: 0,
        addressPickupFee: 900,
        addressDropoffFee: 900,
        serviceFee: base.serviceFee,
        vat: base.vat,
      },
    },
    {
      quoteType: 'balanced',
      speedLabel: '추천 균형형',
      headline: '성공률과 가격 균형이 가장 좋은 기본안입니다.',
      recommendationReason: '현재 경로 기준으로 성공률과 가격 균형이 가장 안정적입니다.',
      etaMinutes: 90,
      includesLocker: lockerPreferred,
      includesAddressPickup: false,
      includesAddressDropoff: true,
      pricing: {
        publicPrice: clampCurrency(base.publicPrice + Math.round(urgencyBonus * 0.5)),
        depositAmount: deposit,
        baseFee: base.baseFee,
        distanceFee: base.distanceFee,
        weightFee: base.weightFee,
        sizeFee: base.sizeFee,
        urgencySurcharge: clampCurrency(base.urgencySurcharge + Math.round(urgencyBonus * 0.5)),
        publicFare: base.publicFare,
        lockerFee: lockerPreferred ? 1000 : 0,
        addressPickupFee: 0,
        addressDropoffFee: 700,
        serviceFee: base.serviceFee,
        vat: base.vat,
      },
    },
    {
      quoteType: 'lowest_price',
      speedLabel: '가장 저렴하게',
      headline: '사용자 직접 참여와 역 중심 인계를 우선 적용합니다.',
      recommendationReason: '직접 참여 범위와 역 인계를 활용하면 총액을 가장 낮출 수 있습니다.',
      etaMinutes: 120,
      includesLocker: true,
      includesAddressPickup: false,
      includesAddressDropoff: false,
      pricing: {
        publicPrice: clampCurrency(base.publicPrice - 1300),
        depositAmount: clampCurrency(deposit),
        baseFee: base.baseFee,
        distanceFee: clampCurrency(base.distanceFee - 200),
        weightFee: base.weightFee,
        sizeFee: base.sizeFee,
        urgencySurcharge: base.urgencySurcharge,
        publicFare: base.publicFare,
        lockerFee: 700,
        addressPickupFee: 0,
        addressDropoffFee: 0,
        serviceFee: clampCurrency(base.serviceFee - 150),
        vat: base.vat,
      },
    },
    {
      quoteType: 'locker_included',
      speedLabel: '사물함 우선',
      headline: '사물함이나 거점을 끼워 실패 리스크를 낮춥니다.',
      recommendationReason: '대면 인계 실패 리스크가 있는 구간에서 안정성이 높습니다.',
      etaMinutes: 100,
      includesLocker: true,
      includesAddressPickup: false,
      includesAddressDropoff: true,
      pricing: {
        publicPrice: clampCurrency(base.publicPrice + 500),
        depositAmount: deposit,
        baseFee: base.baseFee,
        distanceFee: base.distanceFee,
        weightFee: base.weightFee,
        sizeFee: base.sizeFee,
        urgencySurcharge: base.urgencySurcharge,
        publicFare: base.publicFare,
        lockerFee: 1200,
        addressPickupFee: 0,
        addressDropoffFee: 600,
        serviceFee: base.serviceFee,
        vat: base.vat,
      },
    },
  ];

  if (reservationMode) {
    const fastest = quotes.find((quote) => quote.quoteType === 'fastest');
    if (fastest) {
      fastest.speedLabel = '예약 우선 배정';
      fastest.headline = '예약 요청이지만 빠른 배정 가능성을 열어둡니다.';
      fastest.recommendationReason = '예약 시간대를 지키면서도 빠른 actor를 먼저 검토합니다.';
      fastest.etaMinutes = 90;
      fastest.pricing.publicPrice = clampCurrency(base.publicPrice + 900);
      fastest.pricing.urgencySurcharge = clampCurrency(Math.max(0, base.urgencySurcharge));
    }

    const balanced = quotes.find((quote) => quote.quoteType === 'balanced');
    if (balanced) {
      balanced.speedLabel = '예약 균형형';
      balanced.headline = '동선 안정성과 시간대 적합성을 함께 맞춥니다.';
      balanced.recommendationReason = '예약 요청에서는 시간대 합의와 leg 안정성이 더 중요합니다.';
      balanced.etaMinutes = 110;
      balanced.pricing.publicPrice = clampCurrency(base.publicPrice - 200);
      balanced.pricing.urgencySurcharge = clampCurrency(Math.max(0, base.urgencySurcharge));
    }

    const lowPrice = quotes.find((quote) => quote.quoteType === 'lowest_price');
    if (lowPrice) {
      lowPrice.headline = '여유 시간대와 직접 참여를 활용해 비용을 낮춥니다.';
      lowPrice.recommendationReason = '급하지 않을수록 예약 전환의 비용 절감 효과가 커집니다.';
      lowPrice.etaMinutes = 150;
      lowPrice.pricing.publicPrice = clampCurrency(base.publicPrice - 1500);
      lowPrice.pricing.depositAmount = clampCurrency(deposit);
      lowPrice.pricing.urgencySurcharge = 0;
    }

    const locker = quotes.find((quote) => quote.quoteType === 'locker_included');
    if (locker) {
      locker.speedLabel = '예약 거점형';
      locker.headline = '사물함과 거점 중심으로 예약 실패 리스크를 줄입니다.';
      locker.recommendationReason = '예약형에서는 거점 연계가 시간 약속 유지에 유리합니다.';
      locker.etaMinutes = 115;
      locker.pricing.publicPrice = clampCurrency(base.publicPrice + 200);
      locker.pricing.urgencySurcharge = 0;
    }
  }

  return {
    provider: config.provider,
    model: config.pricingModel,
    latencyMs: 0,
    fallbackUsed: true,
    recommendedQuoteType: reservationMode ? 'balanced' : 'fastest',
    quotes,
  };
}

function buildMissionFallback(input: Beta1MissionPlanInput, config: Beta1AIConfig): Beta1MissionPlanResult {
  const assigned = Boolean(input.assignedGillerUserId);
  const reservationMode = isReservationMode(input.requestContext?.requestMode);
  return {
    provider: config.provider,
    model: config.missionModel,
    latencyMs: 0,
    fallbackUsed: true,
    actorSelection: {
      interventionLevel: assigned ? 'guarded_execute' : reservationMode ? 'recommend' : 'guarded_execute',
      selectedActorType: assigned ? 'giller' : reservationMode ? 'giller' : 'external_partner',
      selectionReason: assigned
        ? '이미 길러가 수락한 배송이므로 기본 actor를 길러로 유지합니다.'
        : reservationMode
          ? '예약형 요청이라 시간대에 맞는 길러와 거점 조합을 먼저 검토합니다.'
          : '아직 수락자가 없어서 외부 파트너 fallback을 함께 검토합니다.',
      fallbackActorTypes: assigned
        ? ['locker', 'external_partner', 'requester']
        : reservationMode
          ? ['locker', 'external_partner', 'requester']
          : ['giller', 'locker', 'requester'],
      fallbackPartnerIds: ['partner-a', 'partner-b'],
      manualReviewRequired: !assigned && !reservationMode && input.requestContext?.urgency === 'high',
      riskFlags: reservationMode
        ? ['reserved_window']
        : input.requestContext?.urgency === 'high'
          ? ['tight_sla']
          : [],
    },
    bundleStrategy: assigned ? 'single_actor' : reservationMode ? 'locker_assisted' : 'partner_fallback',
    missionSummary: reservationMode
      ? `${input.pickupStation.stationName || '출발역'}에서 ${input.deliveryStation.stationName || '도착역'}까지 예약 시간대를 지키는 leg와 handover를 우선 설계합니다.`
      : `${input.pickupStation.stationName || '출발역'}에서 ${input.deliveryStation.stationName || '도착역'}까지 단일 레그 중심으로 먼저 실행합니다.`,
  };
}

export async function executeRequestDraftAnalysis(
  db: FirestoreDb,
  input: Beta1RequestDraftAnalysisInput
): Promise<Beta1RequestDraftAnalysisResult> {
  const config = await getAIConfig(db);
  if (!config.enabled || !config.apiKey) {
    return buildAnalysisFallback(input, config);
  }

  const prompt = [
    config.visionPrompt,
    'Return JSON only with keys: confidence, itemName, category, description, estimatedValue, estimatedWeightKg, estimatedSize, riskFlags, handlingNotes.',
    'If requestMode is reservation, prioritize reserved time reliability and route stability. If requestMode is immediate, prioritize fast matching and SLA risk.',
    JSON.stringify(input),
  ].join('\n\n');

  try {
    const response = await runZaiChatCompletion(config, config.analysisModel, prompt, 400);
    const parsed = parseJson<Record<string, unknown>>(response.content);
    if (!parsed) {
      return {
        ...buildAnalysisFallback(input, config),
        model: config.analysisModel,
        latencyMs: response.latencyMs,
      };
    }

    return {
      provider: config.provider,
      model: config.analysisModel,
      latencyMs: response.latencyMs,
      fallbackUsed: false,
      confidence: Math.max(0, Math.min(1, asNumber(parsed.confidence, config.confidenceThreshold))),
      result: {
        itemName: asString(parsed.itemName, input.packageDraft?.itemName),
        category: asString(parsed.category, input.packageDraft?.category || '일반'),
        description: asString(parsed.description, input.packageDraft?.description || ''),
        estimatedValue: asNumber(parsed.estimatedValue, input.packageDraft?.estimatedValue ?? 0) || input.packageDraft?.estimatedValue,
        estimatedWeightKg: asNumber(parsed.estimatedWeightKg, input.packageDraft?.estimatedWeightKg ?? 0) || input.packageDraft?.estimatedWeightKg,
        estimatedSize: ['small', 'medium', 'large', 'xl'].includes(asString(parsed.estimatedSize))
          ? (parsed.estimatedSize as 'small' | 'medium' | 'large' | 'xl')
          : (input.packageDraft?.estimatedSize || 'medium'),
        riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags.map((flag) => asString(flag)).filter(Boolean) : [],
        handlingNotes: Array.isArray(parsed.handlingNotes) ? parsed.handlingNotes.map((note) => asString(note)).filter(Boolean) : [],
      },
    };
  } catch {
    return buildAnalysisFallback(input, config);
  }
}

export async function executePricingQuoteGeneration(
  db: FirestoreDb,
  input: Beta1PricingQuoteInput
): Promise<Beta1PricingQuoteResult> {
  const config = await getAIConfig(db);
  if (!config.enabled || !config.apiKey) {
    return buildPricingFallback(input, config);
  }

  const prompt = [
    config.pricingPrompt,
    'Return JSON only with keys: recommendedQuoteType, quotes.',
    'Each quote must include quoteType, speedLabel, headline, recommendationReason, etaMinutes, includesLocker, includesAddressPickup, includesAddressDropoff, pricing.',
    'For reservation requests prefer balanced or locker-assisted options when they improve schedule reliability. For immediate requests prefer fastest when SLA is tight.',
    JSON.stringify(input),
  ].join('\n\n');

  try {
    const response = await runZaiChatCompletion(config, config.pricingModel, prompt, 900);
    const parsed = parseJson<Record<string, unknown>>(response.content);
    const quoteList = Array.isArray(parsed?.quotes) ? parsed?.quotes : null;
    if (!quoteList || quoteList.length === 0) {
      return {
        ...buildPricingFallback(input, config),
        model: config.pricingModel,
        latencyMs: response.latencyMs,
      };
    }

    const fallback = buildPricingFallback(input, config);
    const byType = new Map(fallback.quotes.map((quote) => [quote.quoteType, quote]));
    const quotes = quoteList
      .map((item) => {
        const raw = item as Record<string, unknown>;
        const quoteType = asString(raw.quoteType) as Beta1PricingQuoteSuggestion['quoteType'];
        const fallbackQuote = byType.get(quoteType);
        if (!fallbackQuote) {
          return null;
        }
        const pricing = (raw.pricing ?? {}) as Record<string, unknown>;
        return {
          quoteType,
          speedLabel: asString(raw.speedLabel, fallbackQuote.speedLabel),
          headline: asString(raw.headline, fallbackQuote.headline),
          recommendationReason: asString(raw.recommendationReason, fallbackQuote.recommendationReason),
          etaMinutes: Math.max(20, asNumber(raw.etaMinutes, fallbackQuote.etaMinutes)),
          includesLocker: Boolean(raw.includesLocker ?? fallbackQuote.includesLocker),
          includesAddressPickup: Boolean(raw.includesAddressPickup ?? fallbackQuote.includesAddressPickup),
          includesAddressDropoff: Boolean(raw.includesAddressDropoff ?? fallbackQuote.includesAddressDropoff),
          pricing: {
            publicPrice: clampCurrency(asNumber(pricing.publicPrice, fallbackQuote.pricing.publicPrice)),
            depositAmount: clampCurrency(asNumber(pricing.depositAmount, fallbackQuote.pricing.depositAmount)),
            baseFee: clampCurrency(asNumber(pricing.baseFee, fallbackQuote.pricing.baseFee)),
            distanceFee: clampCurrency(asNumber(pricing.distanceFee, fallbackQuote.pricing.distanceFee)),
            weightFee: clampCurrency(asNumber(pricing.weightFee, fallbackQuote.pricing.weightFee)),
            sizeFee: clampCurrency(asNumber(pricing.sizeFee, fallbackQuote.pricing.sizeFee)),
            urgencySurcharge: clampCurrency(asNumber(pricing.urgencySurcharge, fallbackQuote.pricing.urgencySurcharge)),
            publicFare: clampCurrency(asNumber(pricing.publicFare, fallbackQuote.pricing.publicFare)),
            lockerFee: clampCurrency(asNumber(pricing.lockerFee, fallbackQuote.pricing.lockerFee)),
            addressPickupFee: clampCurrency(asNumber(pricing.addressPickupFee, fallbackQuote.pricing.addressPickupFee)),
            addressDropoffFee: clampCurrency(asNumber(pricing.addressDropoffFee, fallbackQuote.pricing.addressDropoffFee)),
            serviceFee: clampCurrency(asNumber(pricing.serviceFee, fallbackQuote.pricing.serviceFee)),
            vat: clampCurrency(asNumber(pricing.vat, fallbackQuote.pricing.vat)),
          },
        } satisfies Beta1PricingQuoteSuggestion;
      })
      .filter((item): item is Beta1PricingQuoteSuggestion => Boolean(item));

    if (quotes.length === 0) {
      return {
        ...fallback,
        model: config.pricingModel,
        latencyMs: response.latencyMs,
      };
    }

    return {
      provider: config.provider,
      model: config.pricingModel,
      latencyMs: response.latencyMs,
      fallbackUsed: false,
      recommendedQuoteType: (asString(parsed?.recommendedQuoteType, 'balanced') as Beta1PricingQuoteSuggestion['quoteType']),
      quotes,
    };
  } catch {
    return buildPricingFallback(input, config);
  }
}

export async function executeMissionPlanning(
  db: FirestoreDb,
  input: Beta1MissionPlanInput
): Promise<Beta1MissionPlanResult> {
  const config = await getAIConfig(db);
  if (!config.enabled || !config.apiKey) {
    return buildMissionFallback(input, config);
  }

  const prompt = [
    config.missionPrompt,
    'Return JSON only with keys: actorSelection, bundleStrategy, missionSummary.',
    'For reservation requests prioritize reliable giller or locker-assisted execution over partner rush. For immediate requests prioritize SLA recovery and partner fallback when needed.',
    JSON.stringify(input),
  ].join('\n\n');

  try {
    const response = await runZaiChatCompletion(config, config.missionModel, prompt, 500);
    const parsed = parseJson<Record<string, unknown>>(response.content);
    const actor = (parsed?.actorSelection ?? {}) as Record<string, unknown>;
    const fallback = buildMissionFallback(input, config);

    return {
      provider: config.provider,
      model: config.missionModel,
      latencyMs: response.latencyMs,
      fallbackUsed: false,
      actorSelection: {
        interventionLevel: (
          ['assist', 'recommend', 'guarded_execute', 'human_review', 'disallowed'].includes(asString(actor.interventionLevel))
            ? asString(actor.interventionLevel)
            : fallback.actorSelection.interventionLevel
        ) as Beta1MissionPlanResult['actorSelection']['interventionLevel'],
        selectedActorType: (
          ['requester', 'giller', 'external_partner', 'locker'].includes(asString(actor.selectedActorType))
            ? asString(actor.selectedActorType)
            : fallback.actorSelection.selectedActorType
        ) as Beta1MissionPlanResult['actorSelection']['selectedActorType'],
        selectedPartnerId: asString(actor.selectedPartnerId) || fallback.actorSelection.selectedPartnerId,
        selectionReason: asString(actor.selectionReason, fallback.actorSelection.selectionReason),
        fallbackActorTypes: Array.isArray(actor.fallbackActorTypes)
          ? actor.fallbackActorTypes
              .map((value) => asString(value))
              .filter((value): value is Beta1MissionPlanResult['actorSelection']['fallbackActorTypes'][number] =>
                ['requester', 'giller', 'external_partner', 'locker'].includes(value)
              )
          : fallback.actorSelection.fallbackActorTypes,
        fallbackPartnerIds: Array.isArray(actor.fallbackPartnerIds)
          ? actor.fallbackPartnerIds.map((value) => asString(value)).filter(Boolean)
          : fallback.actorSelection.fallbackPartnerIds,
        manualReviewRequired: Boolean(actor.manualReviewRequired ?? fallback.actorSelection.manualReviewRequired),
        riskFlags: Array.isArray(actor.riskFlags)
          ? actor.riskFlags.map((value) => asString(value)).filter(Boolean)
          : fallback.actorSelection.riskFlags,
      },
      bundleStrategy: (
        ['single_actor', 'multi_actor', 'locker_assisted', 'partner_fallback'].includes(asString(parsed?.bundleStrategy))
          ? asString(parsed?.bundleStrategy)
          : fallback.bundleStrategy
      ) as Beta1MissionPlanResult['bundleStrategy'],
      missionSummary: asString(parsed?.missionSummary, fallback.missionSummary),
    };
  } catch {
    return buildMissionFallback(input, config);
  }
}
