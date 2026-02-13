/**
 * Transfer Matching Types
 * 환승 매칭 관련 타입
 */

import type { Station } from './config';

/**
 * 환승 가능성 정보
 */
export interface TransferPossibility {
  canTransfer: boolean;
  transferStation?: Station;  // 환승역
  originalRoute: Route;
  transferRoute?: Route;
  additionalTime?: number;    // 환승 추가 시간 (분)
  totalTravelTime?: number;   // 총 소요 시간 (분)
}

/**
 * 경로 정보
 */
export interface Route {
  startStation: Station;
  endStation: Station;
}

/**
 * 환승 배송비
 */
export interface TransferPricing {
  baseFee: number;           // 기본 배송비 (거리 기반)
  transferBonus: number;     // 환승 보너스 (1,000원)
  subwayFee: number;         // 지하첗 요금
  totalFee: number;          // 최종 배송비
  gillerEarning: number;     // 길러 수익 (90%)
}

/**
 * 환승 매칭 결과
 */
export interface TransferMatch {
  matchId: string;
  requestId: string;
  gillerId: string;
  gillerRouteId: string;
  transferInfo: TransferPossibility;
  pricing: TransferPricing;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}
