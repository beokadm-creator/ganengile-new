import { getStationConfig } from './config-service';

const KRIC_SERVICE_KEY = String(process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY ?? '');
const KRIC_RAIL_OPR_ISTT_CD = String(process.env.EXPO_PUBLIC_KRIC_RAIL_OPR_ISTT_CD ?? 'S1');
// 엔드포인트는 환경변수로 빼두어, 나중에 정확한 URL이 확인되면 .env.local 에서 덮어쓸 수 있도록 합니다.
// (일반적으로 KRIC 환승 정보 API는 stationTransfer 또는 stationTransit 형태를 띕니다)
const KRIC_TRANSFER_API_URL = String(process.env.EXPO_PUBLIC_KRIC_TRANSFER_API_URL ?? 'https://openapi.kric.go.kr/openapi/convenientInfo/stationTransfer');

export interface KricTransferInfo {
  chtnDst: string; // 환승거리
  chtnLn: string; // 환승선
  clsLocCont: string; // 종료위치내용
  lnCd: string; // 선코드
  railOprIsttCd: string; // 철도운영기관코드
  stLocCont: string; // 시작위치내용
  stinCd: string; // 역코드
}

/**
 * 역사별 환승 정보를 KRIC API에서 조회합니다.
 * @param stationId 조회할 역 ID
 * @returns KricTransferInfo 배열
 */
export async function fetchKricTransferInfo(stationId: string): Promise<KricTransferInfo[]> {
  if (!KRIC_SERVICE_KEY || !stationId) {
    console.warn('KRIC_SERVICE_KEY가 없거나 stationId가 제공되지 않았습니다. 빈 배열을 반환합니다.');
    return [];
  }

  try {
    const stationConfig = await getStationConfig(stationId);
    const lineCode = stationConfig?.kric?.lineCode ?? stationConfig?.lines?.[0]?.lineCode ?? '';
    const stationCode = stationConfig?.kric?.stationCode ?? stationId;
    const railCode = stationConfig?.kric?.railOprIsttCd ?? KRIC_RAIL_OPR_ISTT_CD;

    if (!lineCode || !stationCode) {
      console.warn('해당 역의 KRIC lineCode 또는 stationCode가 없어 환승 정보 조회를 건너뜁니다.');
      return [];
    }

    const url = new URL(KRIC_TRANSFER_API_URL);
    url.searchParams.set('serviceKey', KRIC_SERVICE_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('railOprIsttCd', railCode);
    url.searchParams.set('lnCd', lineCode);
    url.searchParams.set('stinCd', stationCode);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`KRIC 환승 정보 API 호출 실패: ${response.status}`);
      return [];
    }

    const payload = await response.json();
    const rawItems =
      payload?.response?.body?.items?.item ??
      payload?.body?.items?.item ??
      payload?.items ??
      payload?.item ??
      [];

    const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

    return items.map((item: any) => ({
      chtnDst: item.chtnDst ?? '',
      chtnLn: item.chtnLn ?? '',
      clsLocCont: item.clsLocCont ?? '',
      lnCd: item.lnCd ?? '',
      railOprIsttCd: item.railOprIsttCd ?? '',
      stLocCont: item.stLocCont ?? '',
      stinCd: item.stinCd ?? '',
    }));
  } catch (error) {
    console.error('KRIC 환승 정보 API 요청 중 오류 발생:', error);
    return [];
  }
}
