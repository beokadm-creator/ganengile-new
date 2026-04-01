import { getDefaultFunctionsBaseUrl } from '../config/map-config';

const DEFAULT_PAGE = 1;
const DEFAULT_COUNT = 10;

export interface RoadAddressSearchItem {
  roadAddress: string;
  roadAddressPart1: string;
  roadAddressPart2: string;
  jibunAddress: string;
  zipCode: string;
  buildingName: string;
  siNm: string;
  sggNm: string;
  emdNm: string;
  admCd: string;
  rnMgtSn: string;
  bdMgtSn: string;
}

interface JusoCommonResponse {
  errorCode?: string;
  errorMessage?: string;
  totalCount?: string;
}

interface JusoItemResponse {
  roadAddr?: string;
  roadAddrPart1?: string;
  roadAddrPart2?: string;
  jibunAddr?: string;
  zipNo?: string;
  bdNm?: string;
  siNm?: string;
  sggNm?: string;
  emdNm?: string;
  admCd?: string;
  rnMgtSn?: string;
  bdMgtSn?: string;
}

interface JusoSearchResponse {
  results?: {
    common?: JusoCommonResponse;
    juso?: JusoItemResponse[];
  };
}

function getProxyUrl(): string {
  const configured = String(process.env.EXPO_PUBLIC_JUSO_SEARCH_PROXY_URL ?? '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const base = getDefaultFunctionsBaseUrl();
  return base ? `${base}/jusoAddressSearchProxy` : '';
}

function normalizeAddressItem(item: JusoItemResponse): RoadAddressSearchItem {
  return {
    roadAddress: item.roadAddr?.trim() ?? '',
    roadAddressPart1: item.roadAddrPart1?.trim() ?? '',
    roadAddressPart2: item.roadAddrPart2?.trim() ?? '',
    jibunAddress: item.jibunAddr?.trim() ?? '',
    zipCode: item.zipNo?.trim() ?? '',
    buildingName: item.bdNm?.trim() ?? '',
    siNm: item.siNm?.trim() ?? '',
    sggNm: item.sggNm?.trim() ?? '',
    emdNm: item.emdNm?.trim() ?? '',
    admCd: item.admCd?.trim() ?? '',
    rnMgtSn: item.rnMgtSn?.trim() ?? '',
    bdMgtSn: item.bdMgtSn?.trim() ?? '',
  };
}

export async function searchRoadAddresses(
  keyword: string,
  options?: {
    currentPage?: number;
    countPerPage?: number;
  }
): Promise<RoadAddressSearchItem[]> {
  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword.length < 2) {
    return [];
  }

  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    throw new Error('주소 검색 프록시 URL이 설정되지 않았습니다.');
  }

  const currentPage = options?.currentPage ?? DEFAULT_PAGE;
  const countPerPage = options?.countPerPage ?? DEFAULT_COUNT;
  const requestUrl = new URL(proxyUrl);
  requestUrl.searchParams.set('keyword', trimmedKeyword);
  requestUrl.searchParams.set('currentPage', String(currentPage));
  requestUrl.searchParams.set('countPerPage', String(countPerPage));

  const response = await fetch(requestUrl.toString());
  if (!response.ok) {
    throw new Error('도로명 주소 검색에 실패했습니다.');
  }

  const payload = (await response.json()) as JusoSearchResponse;
  const common = payload.results?.common;
  if (common?.errorCode && common.errorCode !== '0') {
    throw new Error(common.errorMessage || '주소 검색 중 오류가 발생했습니다.');
  }

  return (payload.results?.juso ?? []).map(normalizeAddressItem);
}
