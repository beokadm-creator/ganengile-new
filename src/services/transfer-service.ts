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
   * 경로 소요 시간 계산 (단순 예시)
   * @param route 경로
   * @returns 소요 시간 (분)
   */
  private calculateTravelTime(_route: Route): Promise<number> {
    // 실제로는 config_travel_times 테이블에서 조회
    // 여기서는 단순화를 위해 고정 시간 반환
    return Promise.resolve(30); // 30분 가정
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
    // 환승 경로:
    // 1. 길러 경로 (예: 강남역 → 역삼역)
    // 2. 환승역에서 걸어가기 (예: 역삼역 → 학동역)
    // 3. 요청 경로 (예: 학동역 → 목적역)

    const gillerRouteTime = await this.calculateTravelTime(gillerRoute);
    const walkingTime = 3; // 3분 가정
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
    let subwayFee = policy.basePublicFare ?? 1400;
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
