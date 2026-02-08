/**
 * Route Types
 * Firestore Routes Collection 타입 정의
 */

// ==================== Station Info ====================

/**
 * 역 정보
 */
export interface StationInfo {
  /** 역 ID (config_stations 컬렉션의 stationId) */
  id: string; // stationId의 별칭 (호환성)
  stationId: string;
  /** 역 이름 (한글) */
  stationName: string;
  /** 호선 */
  line: string;
  /** 호선 코드 (예: L1, L2, L3...) */
  lineCode: string;
  /** 위도 */
  lat: number;
  /** 경도 */
  lng: number;
}

// ==================== Route ====================

/**
 * 경로 상태
 */
export type RouteStatus = 'active' | 'inactive' | 'deleted';

/**
 * 사용자 경로 (동선)
 */
export interface Route {
  /** 경로 ID (Firestore 문서 ID) */
  routeId: string;
  /** 사용자 ID (Firebase Auth UID) */
  userId: string;
  /** 출발역 정보 */
  startStation: StationInfo;
  /** 도착역 정보 */
  endStation: StationInfo;
  /** 출발 시간 (HH:mm format) */
  departureTime: string;
  /** 운영 요일 [1=월, 2=화, 3=수, 4=목, 5=금, 6=토, 7=일] */
  daysOfWeek: number[];
  /** 활성화 여부 */
  isActive: boolean;
  /** 생성 일시 */
  createdAt: Date;
  /** 수정 일시 */
  updatedAt: Date;
}

/**
 * 경로 생성 파라미터
 */
export interface CreateRouteParams {
  /** 사용자 ID */
  userId: string;
  /** 출발역 정보 */
  startStation: StationInfo;
  /** 도착역 정보 */
  endStation: StationInfo;
  /** 출발 시간 (HH:mm format) */
  departureTime: string;
  /** 운영 요일 [1=월, 2=화, 3=수, 4=목, 5=금, 6=토, 7=일] */
  daysOfWeek: number[];
}

/**
 * 경로 업데이트 파라미터
 */
export interface UpdateRouteParams {
  /** 출발역 정보 (선택적) */
  startStation?: StationInfo;
  /** 도착역 정보 (선택적) */
  endStation?: StationInfo;
  /** 출발 시간 (선택적) */
  departureTime?: string;
  /** 운영 요일 (선택적) */
  daysOfWeek?: number[];
  /** 활성화 여부 (선택적) */
  isActive?: boolean;
}

// ==================== Validation ====================

/**
 * 경로 유효성 검사 결과
 */
export interface RouteValidationResult {
  /** 유효성 여부 */
  isValid: boolean;
  /** 에러 메시지 목록 */
  errors: string[];
  /** 경고 메시지 목록 */
  warnings: string[];
}

/**
 * 경로 요약 정보
 */
export interface RouteSummary {
  /** 경로 ID */
  routeId: string;
  /** 출발역 이름 */
  startStationName: string;
  /** 도착역 이름 */
  endStationName: string;
  /** 출발 시간 */
  departureTime: string;
  /** 운영 요일 */
  daysOfWeek: number[];
  /** 활성화 여부 */
  isActive: boolean;
}

/**
 * 요일별 경로 목록
 */
export interface RoutesByDay {
  /** 요일 (1=월, ..., 7=일) */
  dayOfWeek: number;
  /** 경로 목록 */
  routes: Route[];
}

/**
 * 역 관련 경로 목록
 */
export interface StationRoutesResult {
  /** 역 ID */
  stationId: string;
  /** 역 이름 */
  stationName: string;
  /** 이 역을 지나는 경로 목록 */
  routes: Route[];
}
