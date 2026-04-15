/**
 * Transfer Service
 * 환승 매칭 알고리즘 구현
 */

import { collection, doc, getDoc, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { TransferPossibility, TransferPricing, TransferMatch, Route } from '../types/transfer';
import type { Station } from '../types/config';

import { getPricingPolicyConfig } from './pricing-policy-config-service';

const TRANSFER_MATCHES_COLLECTION = 'transfer_matches';

export class TransferService {
  /**
   * 환승 가능 여부 판단
   * @param requestRoute 요청 경로
   * @param gillerRoute 길러 경로
   * @param maxDetourTime 최대 우회 시간 (분)
   */
  async checkTransferPossibility(
    requestRoute: Route,
    gillerRoute: Route,
    maxDetourTime: number = 15
  ): Promise<TransferPossibility> {
    // 1. 두 경로의 교차점(환승역) 찾기
    const transferStation = this.findTransferStation(requestRoute, gillerRoute);

    if (!transferStation) {
      return { canTransfer: false, originalRoute: gillerRoute };
    }

    // 2. 환승 경로 계산
    const originalTime = await this.calculateTravelTime(gillerRoute);
    const transferTime = await this.calculateTravelTimeWithTransfer(
      gillerRoute,
      transferStation,
      requestRoute
    );

    if (!transferTime) {
      return { canTransfer: false, originalRoute: gillerRoute };
    }

    // 3. 추가 시간 계산
    const additionalTime = transferTime - originalTime;

    // 4. 우회 가능 여부 판단
    const canTransfer = additionalTime <= maxDetourTime;

    return {
      canTransfer,
      transferStation,
      originalRoute: gillerRoute,
      transferRoute: requestRoute,
      additionalTime,
      totalTravelTime: transferTime,
    };
  }

  /**
   * 환승역 찾기
   * @param route1 경로 1
   * @param route2 경로 2
   * @returns 환승역 (없으면 null)
   */
  private findTransferStation(route1: Route, route2: Route): Station | null {
    // 두 역 중 하나가 환승역이면 환승 가능
    if (route1.startStation.stationId === route2.startStation.stationId ||
        route1.startStation.stationId === route2.endStation.stationId ||
        route1.endStation.stationId === route2.startStation.stationId ||
        route1.endStation.stationId === route2.endStation.stationId) {
      // 첫 번째 경로의 출발역을 환승역으로 반환
      return route1.startStation;
    }

    // 환승역이 없으면 null
    return null;
  }

  /**
   * 경로 소요 시간 계산
   * 직선 거리를 기준으로 평균 지하철 이동 속도(약 30km/h)를 적용해 소요 시간(분)을 추정합니다.
   * @param route 경로
   * @returns 소요 시간 (분)
   */
  private async calculateTravelTime(route: Route): Promise<number> {
    if (!route.startStation.location?.latitude || !route.startStation.location?.longitude || !route.endStation.location?.latitude || !route.endStation.location?.longitude) {
      return 30; // 좌표가 없는 경우 기본값
    }
    
    // 직선 거리 계산 (단위: km)
    const lat1 = route.startStation.location.latitude;
    const lon1 = route.startStation.location.longitude;
    const lat2 = route.endStation.location.latitude;
    const lon2 = route.endStation.location.longitude;
    
    const R = 6371; // 지구 반경 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    
    // 평균 지하철 이동 속도 30km/h 가정
    // 소요 시간(분) = (거리 / 속도) * 60
    // 여기에 기본 대기 시간 5분 추가
    const estimatedMinutes = Math.round((distanceKm / 30) * 60) + 5;
    
    return Math.max(5, estimatedMinutes);
  }

  /**
   * 환승 경로 소요 시간 계산
   * @param gillerRoute 길러 경로
   * @param transferStation 환승역
   * @param requestRoute 요청 경로
   * @returns 총 소요 시간 (분)
   */
  private async calculateTravelTimeWithTransfer(
    gillerRoute: Route,
    transferStation: Station,
    requestRoute: Route
  ): Promise<number> {
    const gillerRouteTime = await this.calculateTravelTime(gillerRoute);
    
    // 환승 도보 시간 추정: 환승역 정보가 있으면 5분, 기본 5분 적용
    const walkingTime = 5;
    
    const requestRouteTime = await this.calculateTravelTime(requestRoute);

    return gillerRouteTime + walkingTime + requestRouteTime;
  }

  /**
   * 환승 배송비 계산
   * @param baseFee 기본 배송비
   * @param totalTravelTime 총 소요 시간 (분)
   * @returns 환승 배송비 정보
   */
  async calculateTransferPricing(
    baseFee: number,
    totalTravelTime?: number
  ): Promise<TransferPricing> {
    const policy = await getPricingPolicyConfig();

    // 1. 기본 배송비 (정책에서 보너스 가져오기, 없으면 기본값 1000)
    const transferBonus = policy.incentiveRules?.transferBonusPerHop ?? 1000;

    // 2. 지하철 요금 (거리/시간 기반 추정)
    // 정책에 명시된 기본 대중교통 요금 사용
    let subwayFee = 1400;
    if (totalTravelTime && totalTravelTime > 30) {
      subwayFee += 200; // 단순 예시: 30분 초과 시 200원 추가
    }
    if (totalTravelTime && totalTravelTime > 50) {
      subwayFee += 200; // 단순 예시: 50분 초과 시 200원 추가
    }

    // 3. 최종 배송비
    const totalFee = baseFee + transferBonus;

    // 4. 길러 수익 (플랫폼 수수료율 기반 차감)
    // gillerFee = (totalFee - subwayFee) * (1 - platformFeeRate)
    const gillerEarning = Math.round((totalFee - subwayFee) * (1 - policy.platformFeeRate));

    return {
      baseFee,
      transferBonus,
      subwayFee,
      totalFee,
      gillerEarning,
    };
  }

  /**
   * 환승 매칭 생성
   * @param requestId 요청 ID
   * @param gillerId 길러 ID
   * @param transferInfo 환승 정보
   * @param pricing 요금 정보
   * @returns 매칭 ID
   */
  async createTransferMatch(
    requestId: string,
    gillerId: string,
    transferInfo: TransferPossibility,
    pricing: TransferPricing
  ): Promise<string> {
    const matchData = {
      requestId,
      gillerId,
      gillerRouteId: '', // TODO(beta2): gillerRouteId from route document
      transferInfo: {
        canTransfer: transferInfo.canTransfer,
        transferStation: transferInfo.transferStation 
          ? transferInfo.transferStation.stationName 
          : undefined,
        originalRoute: transferInfo.originalRoute,
        transferRoute: transferInfo.transferRoute,
        additionalTime: transferInfo.additionalTime,
        totalTravelTime: transferInfo.totalTravelTime,
      },
      pricing,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(collection(db, TRANSFER_MATCHES_COLLECTION), matchData);
    return docRef.id;
  }

  /**
   * 환승 매칭 조회
   * @param matchId 매칭 ID
   * @returns 매칭 정보
   */
  async getTransferMatch(matchId: string): Promise<TransferMatch | null> {
    const docRef = doc(db, TRANSFER_MATCHES_COLLECTION, matchId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      matchId: docSnap.id,
      ...docSnap.data(),
    } as TransferMatch;
  }

  /**
   * 요청에 대한 환승 매칭 목록 조회
   * @param requestId 요청 ID
   * @returns 환승 매칭 목록
   */
  async getTransferMatchesByRequest(requestId: string): Promise<TransferMatch[]> {
    const q = query(
      collection(db, TRANSFER_MATCHES_COLLECTION),
      where('requestId', '==', requestId)
    );

    const querySnapshot = await getDocs(q);
    const matches: TransferMatch[] = [];

    querySnapshot.forEach((doc) => {
      matches.push({
        matchId: doc.id,
        ...doc.data(),
      } as TransferMatch);
    });

    return matches;
  }
}

export function createTransferService(): TransferService {
  return new TransferService();
}
