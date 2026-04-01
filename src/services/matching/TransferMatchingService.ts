/**
 * Transfer Matching Service (P1 Part 2)
 * 환승 매칭: 환승역 찾기, 경로 계산
 */

import { DeliveryRequestP1, MatchingResult, TransferRoute, TransferStation } from '../../types/matching';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';

/**
 * 환승 매칭 서비스
 */
export class TransferMatchingService {
  /**
   * 환승 경로 찾기
   *
   * @param request 배송 요청
   * @returns 환승 경로
   */
  static async findTransferRoute(request: DeliveryRequestP1): Promise<TransferRoute[]> {
    console.log('🔄 Transfer matching started:', request.requestId);

    // 1. 선호 환승역이 있으면 해당 역 확인
    const preferredTransferStations: TransferStation[] = [];

    if (request.preferredTransferStation) {
      const station = await this.getTransferStation(request.preferredTransferStation);
      if (station) {
        preferredTransferStations.push(station);
      }
    }

    // 2. 가능한 모든 환승역 찾기
    const allTransferStations = await this.findAllTransferStations(
      request.pickupStation.lineCode,
      request.deliveryStation.lineCode
    );

    // 3. 경로 계산
    const routes: TransferRoute[] = [];

    // 선호 환승역 경로 먼저 추가
    for (const transferStation of preferredTransferStations) {
      const route = await this.calculateTransferRoute(
        request.pickupStation,
        transferStation,
        request.deliveryStation
      );
      if (route) {
        routes.push(route);
      }
    }

    // 다른 환승역 경로 추가
    for (const transferStation of allTransferStations) {
      // 이미 계산된 역은 건너뜀
      if (preferredTransferStations.some(s => s.stationId === transferStation.stationId)) {
        continue;
      }

      const route = await this.calculateTransferRoute(
        request.pickupStation,
        transferStation,
        request.deliveryStation
      );
      if (route) {
        routes.push(route);
      }
    }

    // 4. 총 이동 시간 기준 정렬
    routes.sort((a, b) => a.totalTravelTime - b.totalTravelTime);

    console.log(`✅ Transfer matching completed: ${routes.length} routes found`);
    return routes.slice(0, 5); // 상위 5개 반환
  }

  /**
   * 환승 경로 매칭
   *
   * @param request 배송 요청
   * @param transferRoute 환승 경로
   * @returns 매칭 결과
   */
  static async matchWithTransfer(
    request: DeliveryRequestP1,
    transferRoute: TransferRoute
  ): Promise<MatchingResult[]> {
    console.log('🔄 Matching with transfer route:', transferRoute.transferStation.stationName);

    // 1. 환승역까지 매칭 가능한 길러 찾기
    const gillersToTransfer = await this.findGillersToStation(
      request.pickupStation.id,
      transferRoute.transferStation.stationId
    );

    // 2. 환승역에서 목적지까지 매칭 가능한 길러 찾기
    const gillersFromTransfer = await this.findGillersToStation(
      transferRoute.transferStation.stationId,
      request.deliveryStation.id
    );

    // 3. 매칭 점수 계산
    const results: MatchingResult[] = [];

    for (const giller of [...gillersToTransfer, ...gillersFromTransfer]) {
      const matchResult = await this.calculateTransferMatchScore(
        giller,
        request,
        transferRoute
      );
      results.push(matchResult);
    }

    // 4. 점수순 정렬
    results.sort((a, b) => b.totalScore - a.totalScore);

    console.log(`✅ Transfer matching completed: ${results.length} gillers found`);
    return results.slice(0, 10);
  }

  /**
   * 환승역 정보 조회
   */
  private static async getTransferStation(stationId: string): Promise<TransferStation | null> {
    const stationRef = doc(db, 'config_stations', stationId);
    const stationDoc = await getDoc(stationRef);

    if (!stationDoc.exists()) {
      return null;
    }

    const station = stationDoc.data();
    if (!station) {
      return null;
    }

    // 환승역인지 확인 (2개 이상 노선)
    if (!station.transferLines || station.transferLines.length < 2) {
      return null;
    }

    return {
      id: stationId,
      stationId,
      stationName: station.stationName || station.name || '',
      line: station.line,
      lineCode: station.lineCode,
      lat: station.lat,
      lng: station.lng,
      transferLines: station.transferLines,
      transferTime: station.transferTime || 5,
      facilities: {
        hasElevator: station.hasElevator || false,
        hasEscalator: station.hasEscalator || false,
        hasRestroom: station.hasRestroom || false,
      },
    };
  }

  /**
   * 가능한 모든 환승역 찾기
   */
  private static async findAllTransferStations(
    fromLineCode: string,
    toLineCode: string
  ): Promise<TransferStation[]> {
    const stationsRef = collection(db, 'config_stations');
    const snapshot = await getDocs(stationsRef);

    const transferStations: TransferStation[] = [];

    snapshot.forEach(doc => {
      const station = doc.data();
      if (!station) {
        return;
      }

      // 환승역이고, 두 노선 모두 환승 가능한지 확인
      if (
        station.transferLines &&
        station.transferLines.length >= 2 &&
        station.transferLines.includes(fromLineCode) &&
        station.transferLines.includes(toLineCode)
      ) {
        transferStations.push({
          id: doc.id,
          stationId: doc.id,
          stationName: station.stationName || station.name || '',
          line: station.line,
          lineCode: station.lineCode,
          lat: station.lat,
          lng: station.lng,
          transferLines: station.transferLines,
          transferTime: station.transferTime || 5,
          facilities: {
            hasElevator: station.hasElevator || false,
            hasEscalator: station.hasEscalator || false,
            hasRestroom: station.hasRestroom || false,
          },
        });
      }
    });

    return transferStations;
  }

  /**
   * 환승 경로 계산
   */
  private static async calculateTransferRoute(
    pickupStation: any,
    transferStation: TransferStation,
    deliveryStation: any
  ): Promise<TransferRoute | null> {
    // 1. 첫 번째 구간 (출발역 → 환승역)
    const firstLegTime = await this.getTravelTime(
      pickupStation.id,
      transferStation.stationId,
      pickupStation.lineCode
    );

    // 2. 두 번째 구간 (환승역 → 도착역)
    const secondLegTime = await this.getTravelTime(
      transferStation.stationId,
      deliveryStation.id,
      deliveryStation.lineCode
    );

    if (!firstLegTime || !secondLegTime) {
      return null;
    }

    // 3. 경로 생성
    const route: TransferRoute = {
      pickupStation,
      transferStation,
      deliveryStation,
      legs: [
        {
          from: pickupStation,
          to: transferStation,
          lineCode: pickupStation.lineCode,
          travelTime: firstLegTime,
        },
        {
          from: transferStation,
          to: deliveryStation,
          lineCode: deliveryStation.lineCode,
          travelTime: secondLegTime,
        },
      ],
      totalTravelTime: firstLegTime + secondLegTime + transferStation.transferTime,
      totalTransferTime: transferStation.transferTime,
      transferCount: 1,
      baseFare: 1400, // 기본 요금
      transferBonus: 500, // 환승 보너스
      totalFare: 1400 + 500, // 환승 할인 적용
    };

    return route;
  }

  /**
   * 이동 시간 조회
   */
  private static async getTravelTime(
    fromStationId: string,
    toStationId: string,
    lineCode: string
  ): Promise<number | null> {
    // config_travel_times에서 조회
    const travelTimesRef = collection(db, 'config_travel_times');
    const q = query(
      travelTimesRef,
      where('fromStationId', '==', fromStationId),
      where('toStationId', '==', toStationId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return data.travelTime || null;
  }

  /**
   * 특정 역까지 매칭 가능한 길러 찾기
   */
  private static async findGillersToStation(
    fromStationId: string,
    toStationId: string
  ): Promise<any[]> {
    const routesRef = collection(db, 'routes');
    const q = query(
      routesRef,
      where('stations', 'array-contains', fromStationId)
    );

    const snapshot = await getDocs(q);
    const gillers: any[] = [];

    snapshot.forEach(doc => {
      const route = doc.data();
      if (route.stations.includes(toStationId)) {
        gillers.push({
          id: route.gillerId,
          ...route,
        });
      }
    });

    return gillers;
  }

  /**
   * 환승 매칭 점수 계산
   */
  private static async calculateTransferMatchScore(
    giller: any,
    request: DeliveryRequestP1,
    transferRoute: TransferRoute
  ): Promise<MatchingResult> {
    // 점수 계산 (환�승 보너스 포함)
    const routeScore = this.calculateRouteScore(giller, transferRoute);
    const timeScore = this.calculateTimeScore(giller, transferRoute);
    const ratingScore = this.calculateRatingScore(giller);
    const transferBonus = 10; // 환승 매칭 보너스

    const totalScore = Math.min(
      100,
      (routeScore + timeScore + ratingScore) / 3 + transferBonus
    );

    return {
      gillerId: giller.id,
      gillerName: giller.gillerName || '길러',
      gillerRating: giller.rating || 5.0,
      totalScore,
      scores: {
        routeScore,
        timeScore,
        ratingScore,
        responseTimeScore: 80, // 기본값
      },
      routeDetails: {
        travelTime: transferRoute.totalTravelTime,
        isExpressAvailable: false,
        transferCount: transferRoute.transferCount,
        congestionLevel: 'medium',
      },
      reasons: [
        `환승역: ${transferRoute.transferStation.stationName}`,
        routeScore > 80 ? '최적 경로입니다' : '적절한 경로입니다',
        timeScore > 80 ? '시간이 적절합니다' : '시간이 맞습니다',
      ],
    };
  }

  /**
   * 경로 점수 계산
   */
  private static calculateRouteScore(giller: any, transferRoute: TransferRoute): number {
    // 환승역 시설 완비도에 따른 보너스
    let facilityBonus = 0;
    if (transferRoute.transferStation.facilities?.hasElevator) facilityBonus += 5;
    if (transferRoute.transferStation.facilities?.hasEscalator) facilityBonus += 3;
    if (transferRoute.transferStation.facilities?.hasRestroom) facilityBonus += 2;

    return Math.min(100, 70 + facilityBonus);
  }

  /**
   * 시간 점수 계산
   */
  private static calculateTimeScore(giller: any, transferRoute: TransferRoute): number {
    const travelTime = transferRoute.totalTravelTime;
    return Math.max(0, 100 - travelTime);
  }

  /**
   * 평점 점수 계산
   */
  private static calculateRatingScore(giller: any): number {
    const rating = giller.rating || 5.0;
    return (rating / 5.0) * 100;
  }
}
