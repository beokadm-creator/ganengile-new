import { getNaverGeocodeProxyUrl } from '../config/map-config';

export interface GeocodedAddress {
  roadAddress: string;
  jibunAddress?: string;
  latitude: number;
  longitude: number;
}

interface GeocodeProxyResponse {
  ok?: boolean;
  address?: {
    roadAddress?: string;
    jibunAddress?: string;
    latitude?: number;
    longitude?: number;
  };
  message?: string;
}

export async function geocodeRoadAddress(roadAddress: string): Promise<GeocodedAddress | null> {
  const query = roadAddress.trim();
  if (!query) {
    return null;
  }

  const proxyUrl = getNaverGeocodeProxyUrl();
  if (!proxyUrl) {
    throw new Error('주소 좌표 프록시 URL이 아직 설정되지 않았습니다.');
  }

  const requestUrl = new URL(proxyUrl);
  requestUrl.searchParams.set('query', query);

  const response = await fetch(requestUrl.toString());
  const payload = (await response.json().catch(() => ({}))) as GeocodeProxyResponse;

  if (!response.ok) {
    throw new Error(payload.message || '주소 좌표를 찾지 못했습니다.');
  }

  if (!payload.ok || !payload.address?.latitude || !payload.address?.longitude) {
    return null;
  }

  return {
    roadAddress: payload.address.roadAddress || query,
    jibunAddress: payload.address.jibunAddress,
    latitude: payload.address.latitude,
    longitude: payload.address.longitude,
  };
}
