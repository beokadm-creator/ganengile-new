/**
 * Real-time Subway Service
 * 공공데이터포털 API 기반 실시간 지하철 정보
 */

import { getAllStations } from './config-service';

interface ArrivalInfo {
  stationId: string;
  stationName: string;
  lineNumber: string;
  trainLine: string;
  arrivalTime: number; // 분
  destination: string;
  currentLocation: string;
  congestionLevel: 'low' | 'medium' | 'high';
}

interface ApiResponse {
  realtimeArrivalList?: Array<{
    statnId: string;
    statnNm: string;
    subwayNm: string;
    arvlMsg2: string;
    trainLineNm: string;
    btrainSttus: string;
    barvlDt: string;
  }>;
  errorMessage?: {
    code: string;
    message: string;
  };
}

export class RealtimeSubwayService {
  private readonly SEOUL_API_BASE = 'http://swopenAPI.seoul.go.kr/api/subway';
  private readonly KORAIL_API_BASE = 'http://openapi.korail.go.kr';

  /**
   * 서울교통공사 실시간 도착 정보
   */
  async getSeoulArrivalInfo(stationId: string): Promise<ArrivalInfo[]> {
    const apiKey = process.env.SEOUL_SUBWAY_API_KEY;
    
    if (!apiKey) {
      console.warn('서울 지하철 API 키가 없습니다. .env 파일에 SEOUL_SUBWAY_API_KEY를 추가하세요.');
      return this.getMockArrivalInfo(stationId);
    }

    try {
      const url = `${this.SEOUL_API_BASE}/${apiKey}/json/realtimeStationArrival/0/5/${stationId}`;
      const response = await fetch(url);
      const data: ApiResponse = await response.json();

      if (data.errorMessage) {
        throw new Error(data.errorMessage.message);
      }

      if (!data.realtimeArrivalList || data.realtimeArrivalList.length === 0) {
        return [];
      }

      return data.realtimeArrivalList
        .filter(item => item.btrainSttus === '진입' || item.btrainSttus === '도착')
        .map(item => this.parseSeoulApiData(item));
    } catch (error) {
      console.error('서울 지하철 API 오류:', error);
      // API 오류 시 모의 데이터 반환
      return this.getMockArrivalInfo(stationId);
    }
  }

  /**
   * 한국철도공사 수도권 전철 실시간 정보
   */
  async getKorailArrivalInfo(stationId: string): Promise<ArrivalInfo[]> {
    const apiKey = process.env.KORAIL_API_KEY;
    
    if (!apiKey) {
      console.warn('한국철도공사 API 키가 없습니다. .env 파일에 KORAIL_API_KEY를 추가하세요.');
      return this.getMockArrivalInfo(stationId);
    }

    try {
      const url = `${this.KORAIL_API_BASE}/api/realtimeStationArrival`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          stationId,
        }),
      });
      const data = await response.json();

      // 한국철도공사 API 파싱
      return this.parseKorailApiData(data);
    } catch (error) {
      console.error('한국철도공사 API 오류:', error);
      return this.getMockArrivalInfo(stationId);
    }
  }

  /**
   * 역별 실시간 도착 정보 (자동 선택)
   */
  async getArrivalInfo(stationId: string, region: string): Promise<ArrivalInfo[]> {
    // 서울/인천/경기 지역에 따라 API 선택
    if (region === 'seoul' || region === 'incheon') {
      return await this.getSeoulArrivalInfo(stationId);
    } else if (region === 'gyeonggi') {
      return await this.getKorailArrivalInfo(stationId);
    } else {
      // 기본값: 모의 데이터
      return this.getMockArrivalInfo(stationId);
    }
  }

  /**
   * 특정 경로의 실시간 소요 시간
   */
  async getRouteTime(
    fromStationId: string,
    toStationId: string,
    fromRegion: string
  ): Promise<{ minutes: number; hasDelay: boolean }> {
    try {
      const arrivalInfo = await this.getArrivalInfo(fromStationId, fromRegion);
      
      if (arrivalInfo.length === 0) {
        return { minutes: -1, hasDelay: false };
      }

      // 첫 번째 도착 열차 기준
      const firstTrain = arrivalInfo[0];
      
      // 실제 도착 시간 계산 (혼잡도 고려)
      let baseTime = firstTrain.arrivalTime;
      
      // 혼잡도에 따른 지연 시간 추가
      if (firstTrain.congestionLevel === 'high') {
        baseTime += 3;
      } else if (firstTrain.congestionLevel === 'medium') {
        baseTime += 1;
      }

      return {
        minutes: baseTime,
        hasDelay: firstTrain.currentLocation.includes('지연')
      };
    } catch (error) {
      console.error('경로 시간 계산 오류:', error);
      return { minutes: -1, hasDelay: false };
    }
  }

  /**
   * 혼잡도 정보
   */
  async getCongestionInfo(stationId: string, region: string): Promise<{
    level: 'low' | 'medium' | 'high';
    percentage: number;
  }> {
    try {
      const arrivalInfo = await this.getArrivalInfo(stationId, region);
      
      if (arrivalInfo.length === 0) {
        return { level: 'medium', percentage: 50 };
      }

      // 도착 정보에서 혼잡도 추출
      const avgCongestion = arrivalInfo.reduce((sum, info) => {
        const score = this.getCongestionScore(info.congestionLevel);
        return sum + score;
      }, 0) / arrivalInfo.length;

      return {
        level: this.getCongestionLevel(avgCongestion),
        percentage: Math.round(avgCongestion)
      };
    } catch (error) {
      return { level: 'medium', percentage: 50 };
    }
  }

  /**
   * 서울 API 데이터 파싱
   */
  private parseSeoulApiData(item: any): ArrivalInfo {
    const arvlMsg2 = item.arvlMsg2 || '';
    const timeMatch = arvlMsg2.match(/(\d+)분/);
    const arrivalTime = timeMatch ? parseInt(timeMatch[1]) : 5;

    // 혼잡도 추정 (도착 메시지 기반)
    let congestionLevel: 'low' | 'medium' | 'high' = 'medium';
    if (arvlMsg2.includes('혼잡')) {
      congestionLevel = 'high';
    } else if (arvlMsg2.includes('여유')) {
      congestionLevel = 'low';
    }

    return {
      stationId: item.statnId,
      stationName: item.statnNm,
      lineNumber: this.extractLineNumber(item.subwayNm),
      trainLine: item.trainLineNm,
      arrivalTime,
      destination: this.extractDestination(arvlMsg2),
      currentLocation: item.btrainSttus || '진입',
      congestionLevel
    };
  }

  /**
   * 한국철도공사 API 데이터 파싱
   */
  private parseKorailApiData(data: any): ArrivalInfo[] {
    // 한국철도공사 API 형식에 맞게 파싱
    // 실제 API 응답 구조에 따라 수정 필요
    return [];
  }

  /**
   * 노선 번호 추출
   */
  private extractLineNumber(subwayNm: string): string {
    const match = subwayNm.match(/(\d+)호선/);
    return match ? match[1] : '1';
  }

  /**
   * 목적지 추출
   */
  private extractDestination(arvlMsg2: string): string {
    const match = arvlMsg2.match(/(.+)행/);
    return match ? match[1] : '종점';
  }

  /**
   * 혼잡도 점수화
   */
  private getCongestionScore(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low': return 30;
      case 'medium': return 50;
      case 'high': return 80;
      default: return 50;
    }
  }

  /**
   * 혼잡도 레벨 변환
   */
  private getCongestionLevel(score: number): 'low' | 'medium' | 'high' {
    if (score <= 33) return 'low';
    if (score <= 66) return 'medium';
    return 'high';
  }

  /**
   * 모의 도착 정보 (API 키 없을 때)
   */
  private getMockArrivalInfo(stationId: string): ArrivalInfo[] {
    return [
      {
        stationId,
        stationName: '테스트역',
        lineNumber: '1',
        trainLine: '1호선',
        arrivalTime: Math.floor(Math.random() * 5) + 2,
        destination: '소요산방면',
        currentLocation: '진입',
        congestionLevel: 'medium'
      },
      {
        stationId,
        stationName: '테스트역',
        lineNumber: '1',
        trainLine: '1호선',
        arrivalTime: Math.floor(Math.random() * 5) + 8,
        destination: '인천방면',
        currentLocation: '도착',
        congestionLevel: 'low'
      }
    ];
  }
}

// 싱글톤 인스턴스
export const realtimeSubwayService = new RealtimeSubwayService();
