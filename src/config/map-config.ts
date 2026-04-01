export type SupportedMapProvider = 'naver-static' | 'naver-web' | 'none';

function readEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

const env = process.env as Record<string, string | undefined>;

export const mapConfig = {
  provider: (readEnv(env.EXPO_PUBLIC_MAP_PROVIDER) || 'naver-static') as SupportedMapProvider,
  publicClientId: readEnv(env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID),
  staticMapProxyBaseUrl: readEnv(env.EXPO_PUBLIC_NAVER_STATIC_MAP_PROXY_URL),
  webClientId: readEnv(env.EXPO_PUBLIC_NAVER_MAP_WEB_CLIENT_ID),
  dynamicWebEnabled: readEnv(env.EXPO_PUBLIC_NAVER_WEB_MAP_ENABLED) === 'true',
  enabled: readEnv(env.EXPO_PUBLIC_NAVER_MAP_ENABLED) !== 'false',
};

export function isMapEnabled(): boolean {
  return mapConfig.enabled && mapConfig.provider !== 'none';
}

export function canUseDynamicWebMap(): boolean {
  return (
    mapConfig.enabled &&
    mapConfig.dynamicWebEnabled &&
    mapConfig.provider === 'naver-web' &&
    mapConfig.webClientId.length > 0
  );
}

export function getDefaultFunctionsBaseUrl(): string {
  const projectId = readEnv(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  const region = readEnv(env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION) || 'us-central1';
  if (!projectId) {
    return '';
  }

  return `https://${region}-${projectId}.cloudfunctions.net`;
}

export function getStaticMapProxyUrl(): string {
  const configured = mapConfig.staticMapProxyBaseUrl;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const fallback = getDefaultFunctionsBaseUrl();
  return fallback ? `${fallback}/naverStaticMapProxy` : '';
}

export function getNaverWebSdkUrl(): string {
  if (!mapConfig.webClientId) {
    return '';
  }

  return `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(
    mapConfig.webClientId
  )}`;
}
