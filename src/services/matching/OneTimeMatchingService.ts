/**
 * One-Time Matching Service (P1 Part 2)
 * 일회성 모드: 현재 위치 기반 매칭
 */

import { DeliveryRequestP1, MatchingResult, MatchingMode } from '../../types/matching';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../core/firebase';

/**
 * 일회성 매칭 서비스
 */
export class OneTimeMatchingService {
  /**
   * 일회성 매칭 실행
   *
   * @param request 배송 요청
   * @returns 매칭 결과
   */
  static async match(request: DeliveryRequestP1): Promise<MatchingResult[]> {
    console.log('🎯 One-time matching started:', request.requestId);

    // 1. 요청 검증
    if (request.matchingMode !== MatchingMode.ONE_TIME) {
      throw new Error('Invalid matching mode for one-time matching');
    }

    if (!request.currentLocation) {
      throw new Error('Current location is required for one-time matching');
    }

    // 2. 현재 위치 근처 역 확인
    const nearbyStation = request.currentLocation.stationId
      ? await this.getStationById(request.currentLocation.stationId)
      : await this.findNearestStation(request.currentLocation.latitude, request.currentLocation.longitude);

    if (!nearbyStation) {
      throw new Error('Nearby station not found');
    }

    // 3. 매칭 가능한 길러 검색
    const availableGillers = await this.findAvailableGillers(
      nearbyStation.id,
      request.deliveryStation.id
    );

    // 4. 매칭 점수 계산
    const results: MatchingResult[] = [];

    for (const giller of availableGillers) {
      const matchResult = await this.calculateMatchScore(giller, request, nearbyStation);
      results.push(matchResult);
    }

    // 5. 점수순 정렬
    results.sort((a, b) => b.totalScore - a.totalScore);

    console.log(`✅ One-time matching completed: ${results.length} gillers found`);
    return results.slice(0, 10); // 상위 10개 반환
  }

  /**
   * 역 ID로 역 정보 조회
   */
  private static async getStationById(stationId: string): Promise<any> {
    const stationRef = doc(db, 'config_stations', stationId);
    const stationDoc = await getDoc(stationRef);

    if (!stationDoc.exists()) {
      return null;
    }

    return stationDoc.data();
  }

  /**
   * 가장 가까운 역 찾기
   */
  private static async findNearestStation(latitude: number, longitude: number): Promise<any> {
    // config_stations에서 가장 가까운 역 찾기
    // 실제로는 Haversine formula로 거리 계산 필요

    const stationsRef = collection(db, 'config_stations');
    const snapshot = await getDocs(stationsRef);

    let nearestStation: any = null;
    let minDistance = Infinity;

    snapshot.forEach(doc => {
      const station = doc.data();
      const distance = this.calculateDistance(
        latitude,
        longitude,
        station.latitude,
        station.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = { id: doc.id, ...station };
      }
    });

    // 1km 이내의 역만 반환
    return minDistance <= 1000 ? nearestStation : null;
  }

  /**
   * 두 좌표 사이의 거리 계산 (Haversine formula, 미터 단위)
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // 지구 반경 (미터)
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 매칭 가능한 길러 검색
   */
  private static async findAvailableGillers(
    pickupStationId: string,
    deliveryStationId: string
  ): Promise<any[]> {
    // routes 컬렉션에서 해당 경로를 가진 길러 찾기
    const routesRef = collection(db, 'routes');
    const q = query(
      routesRef,
      where('stations', 'array-contains', pickupStationId)
    );

    const snapshot = await getDocs(q);
    const gillers: any[] = [];

    snapshot.forEach(doc => {
      const route = doc.data();
      // 목적지도 포함하는지 확인
      if (route.stations.includes(deliveryStationId)) {
        gillers.push({
          id: route.gillerId,
          ...route,
        });
      }
    });

    return gillers;
  }

  /**
   * 매칭 점수 계산
   */
  private static async calculateMatchScore(
    giller: any,
    request: DeliveryRequestP1,
    nearbyStation: any
  ): Promise<MatchingResult> {
    // 점수 계산 로직
    const routeScore = this.calculateRouteScore(giller, request);
    const timeScore = this.calculateTimeScore(giller, request);
    const ratingScore = this.calculateRatingScore(giller);
    const responseTimeScore = this.calculateResponseTimeScore(giller);

    const totalScore = (routeScore + timeScore + ratingScore + responseTimeScore) / 4;

    return {
      gillerId: giller.id,
      gillerName: giller.gillerName || '길러',
      gillerRating: giller.rating || 5.0,
      totalScore,
      scores: {
        routeScore,
        timeScore,
        ratingScore,
        responseTimeScore,
      },
      routeDetails: {
        travelTime: giller.travelTime || 30,
        isExpressAvailable: giller.isExpressAvailable || false,
        transferCount: giller.transferCount || 0,
        congestionLevel: giller.congestionLevel || 'medium',
      },
      reasons: [
        routeScore > 80 ? '경로가 잘 맞습니다' : '경로가 일치합니다',
        timeScore > 80 ? '시간이 적절합니다' : '시간이 맞습니다',
        ratingScore > 80 ? '평점이 높습니다' : '평점이 좋습니다',
      ],
    };
  }

  /**
   * 경로 점수 계산 (0-100)
   */
  private static calculateRouteScore(giller: any, request: DeliveryRequestP1): number {
    // 목적지까지 직행 여부, 환승 횟수 등 고려
    const hasDirectRoute = !giller.transferCount || giller.transferCount === 0;
    return hasDirectRoute ? 100 : Math.max(0, 100 - giller.transferCount * 20);
  }

  /**
   * 시간 점수 계산 (0-100)
   */
  private static calculateTimeScore(giller: any, request: DeliveryRequestP1): number {
    // 이동 시간이 짧을수록 높은 점수
    const travelTime = giller.travelTime || 30;
    return Math.max(0, 100 - travelTime);
  }

  /**
   * 평점 점수 계산 (0-100)
   */
  private static calculateRatingScore(giller: any): number {
    const rating = giller.rating || 5.0;
    return (rating / 5.0) * 100;
  }

  /**
   * 응답 시간 점수 계산 (0-100)
   */
  private static calculateResponseTimeScore(giller: any): number {
    // 평균 응답 시간이 짧을수록 높은 점수
    const avgResponseTime = giller.avgResponseTime || 5;
    return Math.max(0, 100 - avgResponseTime * 10);
  }
}
