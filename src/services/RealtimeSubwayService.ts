import { getAllStations } from './config-service';

export interface ArrivalInfo {
  stationId: string;
  stationName: string;
  lineNumber: string;
  trainLine: string;
  arrivalTime: number;
  destination: string;
  currentLocation: string;
  congestionLevel: 'low' | 'medium' | 'high';
}

interface SeoulArrivalItem {
  statnId: string;
  statnNm: string;
  subwayNm: string;
  arvlMsg2: string;
  trainLineNm: string;
  btrainSttus: string;
  barvlDt: string;
}

interface SeoulApiResponse {
  realtimeArrivalList?: SeoulArrivalItem[];
  errorMessage?: {
    code: string;
    message: string;
  };
}

export class RealtimeSubwayService {
  private readonly SEOUL_API_BASE = 'http://swopenAPI.seoul.go.kr/api/subway';

  async getSeoulArrivalInfo(stationNameOrId: string): Promise<ArrivalInfo[]> {
    const apiKey =
      (process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY as string | undefined) ??
      (process.env.SEOUL_SUBWAY_API_KEY as string | undefined);
    const stationName = await this.resolveStationName(stationNameOrId);

    if (!apiKey || !stationName) {
      return this.getPredictedArrivalInfo(stationNameOrId, stationName);
    }

    try {
      const encodedStationName = encodeURIComponent(stationName);
      const url = `${this.SEOUL_API_BASE}/${apiKey}/json/realtimeStationArrival/0/8/${encodedStationName}`;
      const response = await fetch(url);
      const rawText = await response.text();
      const data = JSON.parse(rawText) as SeoulApiResponse;

      if (data.errorMessage) {
        throw new Error(data.errorMessage.message);
      }

      const arrivals = (data.realtimeArrivalList ?? [])
        .filter((item) => item.btrainSttus === '진입' || item.btrainSttus === '도착' || item.btrainSttus === '출발')
        .map((item) => this.parseSeoulApiData(item));

      return arrivals.length > 0 ? arrivals : this.getPredictedArrivalInfo(stationNameOrId, stationName);
    } catch (error) {
      console.error('Seoul subway realtime API failed:', error);
      return this.getPredictedArrivalInfo(stationNameOrId, stationName);
    }
  }

  async getArrivalInfo(stationId: string, region: string): Promise<ArrivalInfo[]> {
    if (region === 'seoul' || region === 'incheon' || region === 'gyeonggi') {
      return this.getSeoulArrivalInfo(stationId);
    }

    return this.getPredictedArrivalInfo(stationId);
  }

  async getRouteTime(
    fromStationId: string,
    _toStationId: string,
    fromRegion: string
  ): Promise<{ minutes: number; hasDelay: boolean }> {
    try {
      const arrivalInfo = await this.getArrivalInfo(fromStationId, fromRegion);

      if (arrivalInfo.length === 0) {
        return { minutes: -1, hasDelay: false };
      }

      const firstTrain = arrivalInfo[0];
      let baseTime = firstTrain.arrivalTime;

      if (firstTrain.congestionLevel === 'high') {
        baseTime += 3;
      } else if (firstTrain.congestionLevel === 'medium') {
        baseTime += 1;
      }

      return {
        minutes: baseTime,
        hasDelay: firstTrain.currentLocation.includes('지연'),
      };
    } catch (error) {
      console.error('Failed to calculate route time:', error);
      return { minutes: -1, hasDelay: false };
    }
  }

  async getCongestionInfo(
    stationId: string,
    region: string
  ): Promise<{ level: 'low' | 'medium' | 'high'; percentage: number }> {
    try {
      const arrivalInfo = await this.getArrivalInfo(stationId, region);
      if (arrivalInfo.length === 0) {
        return { level: 'medium', percentage: 50 };
      }

      const average = arrivalInfo.reduce((sum, item) => {
        return sum + this.getCongestionScore(item.congestionLevel);
      }, 0) / arrivalInfo.length;

      return {
        level: this.getCongestionLevel(average),
        percentage: Math.round(average),
      };
    } catch (error) {
      console.error('[RealtimeSubwayService] 혼잡도 계산 실패:', error);
      return { level: 'medium', percentage: 50 };
    }
  }

  private parseSeoulApiData(item: SeoulArrivalItem): ArrivalInfo {
    const message = item.arvlMsg2 ?? '';
    const arrivalTime = this.extractArrivalMinutes(message, item.barvlDt);

    return {
      stationId: item.statnId,
      stationName: item.statnNm,
      lineNumber: this.extractLineNumber(item.subwayNm),
      trainLine: item.trainLineNm,
      arrivalTime,
      destination: this.extractDestination(message, item.trainLineNm),
      currentLocation: item.btrainSttus ?? '접근 중',
      congestionLevel: this.inferCongestionLevel(message),
    };
  }

  private extractArrivalMinutes(message: string, fallbackSeconds?: string): number {
    const minuteMatch = message.match(/(\d+)분/);
    if (minuteMatch) {
      return Number(minuteMatch[1]);
    }

    const secondValue = Number(fallbackSeconds ?? 0);
    if (Number.isFinite(secondValue) && secondValue > 0) {
      return Math.max(1, Math.round(secondValue / 60));
    }

    return 5;
  }

  private inferCongestionLevel(message: string): 'low' | 'medium' | 'high' {
    if (message.includes('혼잡') || message.includes('붐빔')) {
      return 'high';
    }
    if (message.includes('여유') || message.includes('원활')) {
      return 'low';
    }
    return 'medium';
  }

  private extractLineNumber(subwayName: string): string {
    const match = subwayName.match(/(\d+)호선/);
    return match ? match[1] : '1';
  }

  private extractDestination(message: string, trainLine: string): string {
    const arrowMatch = trainLine.match(/-(.+)$/);
    if (arrowMatch) {
      return arrowMatch[1].trim();
    }

    const towardMatch = message.match(/([가-힣A-Za-z0-9]+)\s*방면/);
    if (towardMatch) {
      return towardMatch[1];
    }

    return '종점';
  }

  private getCongestionScore(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low':
        return 30;
      case 'medium':
        return 55;
      case 'high':
        return 80;
      default:
        return 55;
    }
  }

  private getCongestionLevel(score: number): 'low' | 'medium' | 'high' {
    if (score <= 33) {
      return 'low';
    }
    if (score <= 66) {
      return 'medium';
    }
    return 'high';
  }

  private async resolveStationName(stationIdOrName: string): Promise<string | null> {
    const stations = await getAllStations();
    const match = stations.find(
      (station) =>
        station.stationId === stationIdOrName || station.stationName === stationIdOrName
    );

    return match?.stationName ?? (stationIdOrName.trim() ?? null);
  }

  private getPredictedArrivalInfo(stationId: string, stationName: string | null = null): ArrivalInfo[] {
    const resolvedStationName = stationName ?? stationId;
    const seed = Array.from(stationId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const firstArrival = (seed % 4) + 2;
    const secondArrival = firstArrival + 4;

    return [
      {
        stationId,
        stationName: resolvedStationName,
        lineNumber: '1',
        trainLine: '일반 열차',
        arrivalTime: firstArrival,
        destination: '도심 방면',
        currentLocation: '진입 중',
        congestionLevel: seed % 3 === 0 ? 'high' : 'medium',
      },
      {
        stationId,
        stationName: resolvedStationName,
        lineNumber: '1',
        trainLine: '일반 열차',
        arrivalTime: secondArrival,
        destination: '외곽 방면',
        currentLocation: '이전 역 출발',
        congestionLevel: 'low',
      },
    ];
  }
}

export const realtimeSubwayService = new RealtimeSubwayService();
