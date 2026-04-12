import { getApps } from 'firebase/app';

export type SupportedMapProvider = 'naver-static' | 'naver-web' | 'none';

function readEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const mapConfig = {
  provider: (readEnv(process.env.EXPO_PUBLIC_MAP_PROVIDER) || 'naver-static') as SupportedMapProvider,
  publicClientId: readEnv(process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID),
  staticMapProxyBaseUrl: readEnv(process.env.EXPO_PUBLIC_NAVER_STATIC_MAP_PROXY_URL),
  geocodeProxyBaseUrl: readEnv(process.env.EXPO_PUBLIC_NAVER_GEOCODE_PROXY_URL),
  reverseGeocodeProxyBaseUrl: readEnv(process.env.EXPO_PUBLIC_NAVER_REVERSE_GEOCODE_PROXY_URL),
  directionsProxyBaseUrl: readEnv(process.env.EXPO_PUBLIC_NAVER_DIRECTIONS_PROXY_URL),
  webClientId: readEnv(process.env.EXPO_PUBLIC_NAVER_MAP_WEB_CLIENT_ID),
  dynamicWebEnabled: readEnv(process.env.EXPO_PUBLIC_NAVER_WEB_MAP_ENABLED) === 'true',
  enabled: readEnv(process.env.EXPO_PUBLIC_NAVER_MAP_ENABLED) !== 'false',
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
  const firebaseProjectId =
    getApps()[0]?.options.projectId && typeof getApps()[0]?.options.projectId === 'string'
      ? getApps()[0]?.options.projectId
      : '';
  // Use process.env directly so Expo's bundler inlines EXPO_PUBLIC_* at build time.
  // Indirect access via the `env` variable prevents inlining on web.
  // Use || instead of ?? so empty-string fallbacks actually cascade.
  const projectId =
    readEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) ||
    readEnv(firebaseProjectId);
  const region = readEnv(process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION) || 'us-central1';
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

export function getNaverGeocodeProxyUrl(): string {
  const configured = mapConfig.geocodeProxyBaseUrl;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const fallback = getDefaultFunctionsBaseUrl();
  return fallback ? `${fallback}/naverGeocodeProxy` : '';
}

export function getNaverReverseGeocodeProxyUrl(): string {
  const configured = mapConfig.reverseGeocodeProxyBaseUrl;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const fallback = getDefaultFunctionsBaseUrl();
  return fallback ? `${fallback}/naverReverseGeocodeProxy` : '';
}

export function getNaverDirectionsProxyUrl(): string {
  const configured = mapConfig.directionsProxyBaseUrl;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const fallback = getDefaultFunctionsBaseUrl();
  return fallback ? `${fallback}/naverDirectionsProxy` : '';
}

export function getNaverWebSdkUrl(): string {
  if (!mapConfig.webClientId) {
    return '';
  }

  return `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(
    mapConfig.webClientId
  )}`;
}
