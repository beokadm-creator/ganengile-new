import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface IntegrationProviderPublicConfig {
  enabled: boolean;
  label?: string;
  liveReady?: boolean;
  startUrl?: string;
  callbackUrl?: string;
  clientId?: string;
  redirectUri?: string;
}

export interface IdentityIntegrationConfig {
  enabled: boolean;
  testMode: boolean;
  allowTestBypass: boolean;
  requiredForGillerUpgrade: boolean;
  liveReady: boolean;
  providers: {
    pass: IntegrationProviderPublicConfig;
    kakao: IntegrationProviderPublicConfig;
  };
}

export interface BankIntegrationConfig {
  enabled: boolean;
  testMode: boolean;
  allowTestBypass: boolean;
  provider: string;
  verificationMode: string;
  liveReady: boolean;
  requiresAccountHolderMatch: boolean;
  manualReviewFallback: boolean;
  statusMessage: string;
}

export interface PaymentIntegrationConfig {
  enabled: boolean;
  testMode: boolean;
  allowTestBypass: boolean;
  provider: string;
  liveReady: boolean;
  clientKey: string;
  bankVerificationRequired: boolean;
  manualSettlementReview: boolean;
  escrowEnabled: boolean;
  statusMessage: string;
}

export interface AIAutoFillFieldsConfig {
  itemName: boolean;
  category: boolean;
  description: boolean;
  estimatedValue: boolean;
  estimatedWeight: boolean;
  estimatedSize: boolean;
  depositSuggestion: boolean;
  startingPriceSuggestion: boolean;
}

export interface AIIntegrationConfig {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  analysisModel: string;
  pricingModel: string;
  missionModel: string;
  confidenceThreshold: number;
  fallbackMode: string;
  disableThinking: boolean;
  autoFillFields: AIAutoFillFieldsConfig;
}

export interface SafeNumberIntegrationConfig {
  enabled: boolean;
  testMode: boolean;
  allowTestBypass: boolean;
  provider: string;
  liveReady: boolean;
  statusMessage: string;
}

const CACHE_TTL = 60 * 1000;

let identityCache: { data: IdentityIntegrationConfig; expiresAt: number } | null = null;
let bankCache: { data: BankIntegrationConfig; expiresAt: number } | null = null;
let paymentCache: { data: PaymentIntegrationConfig; expiresAt: number } | null = null;
let aiCache: { data: AIIntegrationConfig; expiresAt: number } | null = null;
let safeNumberCache: { data: SafeNumberIntegrationConfig; expiresAt: number } | null = null;

function getDefaultIdentityIntegrationConfig(): IdentityIntegrationConfig {
  return {
    enabled: true,
    testMode: true,
    allowTestBypass: true,
    requiredForGillerUpgrade: true,
    liveReady: false,
    providers: {
      pass: {
        enabled: true,
        label: 'PASS',
        liveReady: false,
      },
      kakao: {
        enabled: true,
        label: 'Kakao',
        liveReady: false,
      },
    },
  };
}

function getDefaultBankIntegrationConfig(): BankIntegrationConfig {
  return {
    enabled: true,
    testMode: true,
    allowTestBypass: true,
    provider: 'manual_review',
    verificationMode: 'manual_review',
    liveReady: false,
    requiresAccountHolderMatch: true,
    manualReviewFallback: true,
    statusMessage: 'API key가 준비되기 전에는 테스트 모드 또는 운영 수동 검토로 계좌를 확인합니다.',
  };
}

function _getDefaultPaymentIntegrationConfig(): PaymentIntegrationConfig {
  return {
    enabled: true,
    testMode: true,
    allowTestBypass: true,
    provider: 'tosspayments',
    liveReady: false,
    clientKey: '',
    bankVerificationRequired: true,
    manualSettlementReview: true,
    escrowEnabled: true,
    statusMessage: 'PG 키가 준비되기 전에는 테스트 모드로 결제를 우회하고 운영이 최종 정산을 검토합니다.',
  };
}

export async function getIdentityTestMode(): Promise<boolean> {
  const config = await getIdentityIntegrationConfig();
  return config.testMode;
}

export async function getIdentityIntegrationConfig(): Promise<IdentityIntegrationConfig> {
  if (identityCache && Date.now() < identityCache.expiresAt) {
    return identityCache.data;
  }

  const fallback = getDefaultIdentityIntegrationConfig();

  try {
    const snap = await getDoc(doc(db, 'config_integrations', 'identity'));
    const data = snap.exists() ? snap.data() : {};
    const config: IdentityIntegrationConfig = {
      enabled: Boolean(data?.enabled ?? fallback.enabled),
      testMode: Boolean(data?.testMode ?? fallback.testMode),
      allowTestBypass: Boolean(data?.allowTestBypass ?? fallback.allowTestBypass),
      requiredForGillerUpgrade: Boolean(
        data?.requiredForGillerUpgrade ?? fallback.requiredForGillerUpgrade
      ),
      liveReady: Boolean(data?.liveReady ?? fallback.liveReady),
      providers: {
        pass: {
          enabled: Boolean(data?.providers?.pass?.enabled ?? fallback.providers.pass.enabled),
          label: String(data?.providers?.pass?.label ?? fallback.providers.pass.label),
          liveReady: Boolean(data?.providers?.pass?.liveReady ?? fallback.providers.pass.liveReady),
          startUrl:
            typeof data?.providers?.pass?.startUrl === 'string'
              ? data.providers.pass.startUrl
              : fallback.providers.pass.startUrl,
          callbackUrl:
            typeof data?.providers?.pass?.callbackUrl === 'string'
              ? data.providers.pass.callbackUrl
              : fallback.providers.pass.callbackUrl,
        },
        kakao: {
          enabled: Boolean(data?.providers?.kakao?.enabled ?? fallback.providers.kakao.enabled),
          label: String(data?.providers?.kakao?.label ?? fallback.providers.kakao.label),
          liveReady: Boolean(
            data?.providers?.kakao?.liveReady ?? fallback.providers.kakao.liveReady
          ),
          startUrl:
            typeof data?.providers?.kakao?.startUrl === 'string'
              ? data.providers.kakao.startUrl
              : fallback.providers.kakao.startUrl,
          callbackUrl:
            typeof data?.providers?.kakao?.callbackUrl === 'string'
              ? data.providers.kakao.callbackUrl
              : fallback.providers.kakao.callbackUrl,
          clientId:
            typeof data?.providers?.kakao?.clientId === 'string'
              ? data.providers.kakao.clientId
              : fallback.providers.kakao.clientId,
          redirectUri:
            typeof data?.providers?.kakao?.redirectUri === 'string'
              ? data.providers.kakao.redirectUri
              : fallback.providers.kakao.redirectUri,
        },
      },
    };
    identityCache = { data: config, expiresAt: Date.now() + CACHE_TTL };
    return config;
  } catch (error) {
    console.error('[integration-config] 은행 설정 로드 실패:', error);
    return fallback;
  }
}

export async function getSafeNumberIntegrationConfig(): Promise<SafeNumberIntegrationConfig> {
  if (safeNumberCache && Date.now() < safeNumberCache.expiresAt) {
    return safeNumberCache.data;
  }

  const fallback: SafeNumberIntegrationConfig = {
    enabled: true,
    testMode: true,
    allowTestBypass: true,
    provider: '050-sejong',
    liveReady: false,
    statusMessage: '안심번호 서비스 점검 중입니다.',
  };

  try {
    const snap = await getDoc(doc(db, 'config_integrations', 'safe_number'));
    const data = snap.exists() ? snap.data() : {};
    
    const config: SafeNumberIntegrationConfig = {
      enabled: Boolean(data?.enabled ?? fallback.enabled),
      testMode: Boolean(data?.testMode ?? fallback.testMode),
      allowTestBypass: Boolean(data?.allowTestBypass ?? fallback.allowTestBypass),
      provider: String(data?.provider ?? fallback.provider),
      liveReady: Boolean(data?.liveReady ?? fallback.liveReady),
      statusMessage: String(data?.statusMessage ?? fallback.statusMessage),
    };
    safeNumberCache = { data: config, expiresAt: Date.now() + CACHE_TTL };
    return config;
  } catch (error) {
    console.error('[integration-config] 안심번호 설정 로드 실패:', error);
    return fallback;
  }
}

export async function getBankIntegrationConfig(): Promise<BankIntegrationConfig> {
  if (bankCache && Date.now() < bankCache.expiresAt) {
    return bankCache.data;
  }

  const fallback = getDefaultBankIntegrationConfig();

  try {
    const snap = await getDoc(doc(db, 'config_integrations', 'bank'));
    const data = snap.exists() ? snap.data() : {};
    const config: BankIntegrationConfig = {
      enabled: Boolean(data?.enabled ?? fallback.enabled),
      testMode: Boolean(data?.testMode ?? fallback.testMode),
      allowTestBypass: Boolean(data?.allowTestBypass ?? fallback.allowTestBypass),
      provider: String(data?.provider ?? fallback.provider),
      verificationMode: String(data?.verificationMode ?? fallback.verificationMode),
      liveReady: Boolean(data?.liveReady ?? fallback.liveReady),
      requiresAccountHolderMatch: Boolean(
        data?.requiresAccountHolderMatch ?? fallback.requiresAccountHolderMatch
      ),
      manualReviewFallback: Boolean(
        data?.manualReviewFallback ?? fallback.manualReviewFallback
      ),
      statusMessage: String(data?.statusMessage ?? fallback.statusMessage),
    };
    bankCache = { data: config, expiresAt: Date.now() + CACHE_TTL };
    return config;
  } catch (error) {
    console.error('[integration-config] 결제 설정 로드 실패:', error);
    return fallback;
  }
}

export async function getPaymentIntegrationConfig(): Promise<PaymentIntegrationConfig> {
  if (paymentCache && Date.now() < paymentCache.expiresAt) {
    return paymentCache.data;
  }

  const fallback = _getDefaultPaymentIntegrationConfig();

  try {
    const snap = await getDoc(doc(db, 'config_integrations', 'payment'));
    const data = snap.exists() ? snap.data() : {};
    const config: PaymentIntegrationConfig = {
      enabled: Boolean(data?.enabled ?? fallback.enabled),
      testMode: Boolean(data?.testMode ?? fallback.testMode),
      allowTestBypass: Boolean(data?.allowTestBypass ?? fallback.allowTestBypass),
      provider: String(data?.provider ?? fallback.provider),
      liveReady: Boolean(data?.liveReady ?? fallback.liveReady),
      clientKey: String(data?.clientKey ?? fallback.clientKey),
      bankVerificationRequired: Boolean(
        data?.bankVerificationRequired ?? fallback.bankVerificationRequired
      ),
      manualSettlementReview: Boolean(
        data?.manualSettlementReview ?? fallback.manualSettlementReview
      ),
      escrowEnabled: Boolean(data?.escrowEnabled ?? fallback.escrowEnabled),
      statusMessage: String(data?.statusMessage ?? fallback.statusMessage),
    };
    paymentCache = { data: config, expiresAt: Date.now() + CACHE_TTL };
    return config;
  } catch (error) {
    console.error('[integration-config] 결제 설정 로드 실패:', error);
    return fallback;
  }
}

export async function getAIIntegrationConfig(): Promise<AIIntegrationConfig> {
  if (aiCache && Date.now() < aiCache.expiresAt) {
    return aiCache.data;
  }

  const fallback: AIIntegrationConfig = {
    enabled: false,
    provider: 'zai',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    model: 'glm-4.7',
    analysisModel: 'glm-4.7',
    pricingModel: 'glm-4.7',
    missionModel: 'glm-4.7',
    confidenceThreshold: 0.75,
    fallbackMode: 'manual',
    disableThinking: true,
    autoFillFields: {
      itemName: true,
      category: true,
      description: true,
      estimatedValue: true,
      estimatedWeight: true,
      estimatedSize: true,
      depositSuggestion: true,
      startingPriceSuggestion: true,
    },
  };

  try {
    const snap = await getDoc(doc(db, 'config_integrations', 'ai'));
    const data = snap.exists() ? snap.data() : {};
    const config: AIIntegrationConfig = {
      enabled: Boolean(data?.enabled ?? fallback.enabled),
      provider: String(data?.provider ?? fallback.provider),
      baseUrl: String(data?.baseUrl ?? fallback.baseUrl),
      model: String(data?.model ?? fallback.model),
      analysisModel: String(data?.analysisModel ?? data?.model ?? fallback.analysisModel),
      pricingModel: String(data?.pricingModel ?? data?.model ?? fallback.pricingModel),
      missionModel: String(data?.missionModel ?? data?.model ?? fallback.missionModel),
      confidenceThreshold: Number(data?.confidenceThreshold ?? fallback.confidenceThreshold),
      fallbackMode: String(data?.fallbackMode ?? fallback.fallbackMode),
      disableThinking: Boolean(data?.disableThinking ?? fallback.disableThinking),
      autoFillFields: {
        ...fallback.autoFillFields,
        ...(data?.autoFillFields ?? {}),
      },
    };
    aiCache = { data: config, expiresAt: Date.now() + CACHE_TTL };
    return config;
  } catch (error) {
    console.error('[integration-config] AI 설정 로드 실패:', error);
    return fallback;
  }
}
