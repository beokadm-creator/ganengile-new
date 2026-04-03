/**
 * Extended Matching Types
 * 길러 배송 매칭 시스템 개선을 위한 확장 타입 정의
 */

import { DeliveryRequest } from './delivery';
import { Route } from './route';

/**
 * 동선 매칭 점수 상세 정보
 */
export interface RouteMatchScore {
  /** 종합 매칭 점수 (0-100) */
  score: number;

  /** 픽업역 일치 여부 */
  pickupMatch: boolean;

  /** 배송역 일치 여부 */
  deliveryMatch: boolean;

  /** 시간대 일치 점수 (0-15) */
  timeMatch: number;

  /** 요일 일치 여부 */
  dayMatch: boolean;

  /** 경로 방향성 */
  routeDirection: 'exact' | 'partial' | 'reverse';

  /** 매칭된 동선 ID */
  matchedRouteId?: string;

  /** 매칭된 동선 정보 */
  matchedRoute?: Route;

  /** 점수 상세 breakdown */
  details: {
    pickupStationScore: number;  // 0-30
    deliveryStationScore: number; // 0-30
    dayOfWeekScore: number;      // 0-10
    timeScore: number;           // 0-15
    directionBonus: number;      // 0-15
  };
}

/**
 * 위치 기반 필터링된 요청
 */
export interface LocationFilteredRequest extends DeliveryRequest {
  /** 추가 메타데이터 */
  metadata: {
    /** 현재 위치로부터의 거리 (m) */
    distanceFromCurrent: number;

    /** 가장 가까운 역 이름 */
    nearestStation: string;

    /** 예상 소요 시간 (분) */
    estimatedTimeMinutes: number;

    /** 현재 위치와의 거리 순위 */
    distanceRank?: number;
  };
}

/**
 * 동선 기반 필터링된 요청
 */
export interface RouteFilteredRequest extends DeliveryRequest {
  /** 매칭 점수 */
  matchScore: RouteMatchScore;

  /** 매칭된 동선 수 */
  matchedRouteCount: number;

  /** 매칭된 동선 목록 */
  matchedRoutes: Route[];
}

/**
 * 호선 필터 옵션
 */
export interface LineFilterOptions {
  /** 선택된 호선 코드 (예: '1', '2', '3') */
  selectedLines: string[];

  /** 모든 호선 표시 여부 */
  showAllLines: boolean;
}

/**
 * 지역 필터 옵션
 */
export interface RegionFilterOptions {
  /** 선택된 지역들 */
  selectedRegions: string[];

  /** 모든 지역 표시 여부 */
  showAllRegions: boolean;
}

/**
 * 매칭 필터 결합
 */
export interface MatchingFilterOptions {
  /** 호선 필터 */
  lineFilter?: LineFilterOptions;

  /** 지역 필터 */
  regionFilter?: RegionFilterOptions;

  /** 최소 매칭 점수 */
  minMatchScore?: number;

  /** 최대 거리 (m) */
  maxDistance?: number;

  /** 최소 배송비 */
  minFee?: number;

  /** 최대 배송비 */
  maxFee?: number;
}

/**
 * 매칭 탭 타입
 */
export enum MatchingTabType {
  /** 동선 매칭 */
  ROUTE_MATCHING = 'route_matching',

  /** 즉시 매칭 */
  INSTANT_MATCHING = 'instant_matching',
}

/**
 * 길러 통계 정보 (매칭용)
 */
export interface GillerMatchingStats {
  /** 길러 ID */
  gillerId: string;

  /** 길러 이름 */
  gillerName: string;

  /** 평점 */
  rating: number;

  /** 총 배송 건수 */
  totalDeliveries: number;

  /** 완료된 배송 건수 */
  completedDeliveries: number;

  /** 완료율 */
  completionRate: number;

  /** 평균 응답 시간 (분) */
  averageResponseTime: number;

  /** 전문 길러 등급 */
  professionalLevel?: 'regular' | 'professional' | 'master';

  /** 배지 보너스 */
  badgeBonus?: number;
}

/**
 * 매칭 요청 결과
 */
export interface MatchingRequestResult {
  /** 요청 정보 */
  request: DeliveryRequest;

  /** 매칭 타입 */
  matchType: 'route' | 'location';

  /** 매칭 점수 (동선 매칭인 경우) */
  routeMatchScore?: RouteMatchScore;

  /** 위치 정보 (즉시 매칭인 경우) */
  locationInfo?: {
    distance: number;
    nearestStation: string;
    estimatedTime: number;
  };

  /** 길러 정보 */
  gillerInfo?: GillerMatchingStats;

  /** 예상 수익 */
  estimatedEarnings?: number;
}

/**
 * 매칭 시스템 설정
 */
export interface MatchingSystemConfig {
  /** 위치 기반 매칭 반경 (m) */
  locationMatchRadius: number;

  /** 최소 매칭 점수 */
  minMatchScore: number;

  /** 동선 매칭 우선순위 */
  routeMatchPriority: boolean;

  /** 캐시 유효기간 (ms) */
  cacheTTL: number;
}

/**
 * 매칭 이벤트 타입
 */
export enum MatchingEventType {
  /** 매칭 시작 */
  MATCHING_STARTED = 'matching_started',

  /** 매칭 완료 */
  MATCHING_COMPLETED = 'matching_completed',

  /** 매칭 실패 */
  MATCHING_FAILED = 'matching_failed',

  /** 필터 변경 */
  FILTER_CHANGED = 'filter_changed',

  /** 위치 업데이트 */
  LOCATION_UPDATED = 'location_updated',
}

/**
 * 매칭 이벤트
 */
export interface MatchingEvent {
  /** 이벤트 타입 */
  type: MatchingEventType;

  /** 타임스탬프 */
  timestamp: Date;

  /** 이벤트 데이터 */
  data?: any;
}
