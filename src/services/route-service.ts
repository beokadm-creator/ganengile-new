/**
 * Route Service
 * Firebase Firestore Routes Collection 관리 서비스
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import type {
  Route,
  StationInfo,
  CreateRouteParams,
  UpdateRouteParams,
  RouteValidationResult,
  RouteSummary,
  RoutesByDay,
  StationRoutesResult,
} from '../types/route';

// 요일 라벨 (DaySelector와 동일)
const DAY_LABELS: { [key: number]: string } = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
  7: '일',
};

// AsyncStorage Keys
const ROUTES_CACHE_KEY = 'cached_routes';
const ROUTES_CACHE_VERSION = 'v1';

interface CachedRoutesData {
  version: string;
  routes: Route[];
  timestamp: number;
}

/**
 * AsyncStorage에서 캐시된 동선 로드
 */
async function loadCachedRoutesFromStorage(userId: string): Promise<Route[] | null> {
  try {
    const cachedData = await AsyncStorage.getItem(`${ROUTES_CACHE_KEY}_${userId}`);
    if (!cachedData) return null;

    const parsed: CachedRoutesData = JSON.parse(cachedData);

    // 버전 확인
    if (parsed.version !== ROUTES_CACHE_VERSION) {
      await AsyncStorage.removeItem(`${ROUTES_CACHE_KEY}_${userId}`);
      return null;
    }

    // TTL 확인 (5분)
    const ROUTE_CACHE_TTL = 5 * 60 * 1000;
    const now = Date.now();
    if (now - parsed.timestamp > ROUTE_CACHE_TTL) {
      await AsyncStorage.removeItem(`${ROUTES_CACHE_KEY}_${userId}`);
      return null;
    }

    // Date 객체 복원
    const restoredRoutes = parsed.routes.map(route => ({
      ...route,
      createdAt: new Date(route.createdAt),
      updatedAt: new Date(route.updatedAt),
    }));

    return restoredRoutes;
  } catch (err) {
    console.error('Error loading cached routes from storage:', err);
    return null;
  }
}

/**
 * AsyncStorage에 동선 캐시 저장
 */
async function saveRoutesToStorage(userId: string, routes: Route[]): Promise<void> {
  try {
    const cacheData: CachedRoutesData = {
      version: ROUTES_CACHE_VERSION,
      routes,
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(`${ROUTES_CACHE_KEY}_${userId}`, JSON.stringify(cacheData));
  } catch (err) {
    console.error('Error saving routes to storage:', err);
  }
}

/**
 * AsyncStorage 캐시 삭제
 */
export async function clearRoutesCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${ROUTES_CACHE_KEY}_${userId}`);
    cache.clearPattern(`^userRoutes:${userId}:`);
  } catch (err) {
    console.error('Error clearing routes cache:', err);
  }
}

// ==================== Cache Configuration ====================

const ROUTE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const USER_ROUTES_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class RouteCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new RouteCache();

// ==================== Helper Functions ====================

function convertTimestampToDate(timestamp: { seconds: number; nanoseconds?: number }): Date {
  return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
}

function convertDateToTimestamp(date: Date): { seconds: number; nanoseconds: number } {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1000000,
  };
}

function convertStationInfo(data: any): StationInfo {
  return {
    id: data.stationId,
    stationId: data.stationId,
    stationName: data.stationName,
    line: data.line,
    lineCode: data.lineCode,
    lat: data.lat,
    lng: data.lng,
  };
}

function convertRoute(data: any, docId: string): Route {
  return {
    routeId: docId,
    userId: data.userId,
    startStation: convertStationInfo(data.startStation),
    endStation: convertStationInfo(data.endStation),
    departureTime: data.departureTime,
    daysOfWeek: data.daysOfWeek,
    isActive: data.isActive ?? true,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
  };
}

// ==================== Retry Logic ====================

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      const errorCode = (error as { code?: string })?.code;
      const isNetworkError = !errorCode || errorCode === 'unavailable' || errorCode === 'deadline-exceeded';

      if (!isNetworkError || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ==================== Route Validation ====================

function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

function validateDaysOfWeek(days: number[]): boolean {
  if (!Array.isArray(days) || days.length === 0) {
    return false;
  }

  return days.every(day => day >= 1 && day <= 7);
}

function validateStationInfo(station: StationInfo): boolean {
  return !!(
    station &&
    station.stationId &&
    station.stationName &&
    station.line &&
    typeof station.latitude === 'number' &&
    typeof station.longitude === 'number'
  );
}

/**
 * 운행 시간대 검사 (새벽 2-5시는 지하철 운행 없음)
 * @param time 출발 시간 (HH:mm)
 * @returns 운행 가능 여부
 */
function isOperatingTime(time: string): boolean {
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // 02:00 ~ 04:59는 운행하지 않음
  if (hour === 2 && minute >= 0) return false;
  if (hour === 3) return false;
  if (hour === 4 && minute >= 0) return false;

  return true;
}

/**
 * 혼잡도 높은 시간대 확인 (7-9시, 18-20시)
 * @param time 출발 시간 (HH:mm)
 * @returns 혼잡 시간대 여부
 */
function isCongestionTime(time: string): boolean {
  const [hourStr] = time.split(':');
  const hour = parseInt(hourStr, 10);

  // 아침 러시아워: 7-9시
  if (hour >= 7 && hour <= 9) return true;
  // 저녁 러시아워: 18-20시
  if (hour >= 18 && hour <= 20) return true;

  return false;
}

/**
 * 출퇴근 가능 시간대 검사 (07:00-22:00)
 * @param time 출발 시간 (HH:mm)
 * @returns 출퇴근 가능 시간대 여부
 */
function isCommuteTime(time: string): boolean {
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // 07:00 이전 또는 22:00 이후는 출퇴근 시간대 아님
  if (hour < 7 || hour > 22) return false;
  if (hour === 22 && minute > 0) return false;

  return true;
}

/**
 * 두 시간이 겹치는지 확인 (±30분)
 * @param time1 시간1 (HH:mm)
 * @param time2 시간2 (HH:mm)
 * @returns 겹침 여부
 */
function isTimeOverlapping(time1: string, time2: string): boolean {
  const [hour1, minute1] = time1.split(':').map(Number);
  const [hour2, minute2] = time2.split(':').map(Number);

  const minutes1 = hour1 * 60 + minute1;
  const minutes2 = hour2 * 60 + minute2;

  // 30분 이내 차이면 겹치는 것으로 간주
  return Math.abs(minutes1 - minutes2) <= 30;
}

/**
 * 기존 동선과 시간대 중복 검사
 * @param existingRoutes 기존 동선 목록
 * @param daysOfWeek 운영 요일
 * @param departureTime 출발 시간
 * @param excludeRouteId 제외할 경로 ID (편집 시 사용)
 * @returns 중복 경로 목록
 */
function findOverlappingRoutes(
  existingRoutes: Route[],
  daysOfWeek: number[],
  departureTime: string,
  excludeRouteId?: string
): Route[] {
  return existingRoutes.filter(route => {
    // 자기 자신은 제외 (편집 시)
    if (excludeRouteId && route.routeId === excludeRouteId) {
      return false;
    }

    // 비활성화된 경로는 제외
    if (!route.isActive) {
      return false;
    }

    // 요일이 하나라도 겹치는지 확인
    const hasOverlappingDay = route.daysOfWeek.some(day => daysOfWeek.includes(day));
    if (!hasOverlappingDay) {
      return false;
    }

    // 시간이 겹치는지 확인
    return isTimeOverlapping(route.departureTime, departureTime);
  });
}

/**
 * 경로 유효성 검사
 * @param startStation 출발역 정보
 * @param endStation 도착역 정보
 * @param departureTime 출발 시간 (HH:mm)
 * @param daysOfWeek 운영 요일
 * @returns 유효성 검사 결과
 */
export function validateRoute(
  startStation: StationInfo,
  endStation: StationInfo,
  departureTime: string,
  daysOfWeek: number[]
): RouteValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!validateStationInfo(startStation)) {
    errors.push('🚫 출발역 정보가 올바르지 않습니다.');
  }

  if (!validateStationInfo(endStation)) {
    errors.push('🚫 도착역 정보가 올바르지 않습니다.');
  }

  if (startStation.stationId === endStation.stationId) {
    errors.push('🚫 출발역과 도착역이 같습니다.\n\n다른 역을 선택해주세요.');
  }

  if (!validateTimeFormat(departureTime)) {
    errors.push('🚫 시간 형식이 올바르지 않습니다.\n\nHH:mm 형식(예: 08:30)으로 입력해주세요.');
  } else {
    // 운행 시간대 검사
    if (!isOperatingTime(departureTime)) {
      errors.push('🚫 새벽 2시~5시는 지하철이 운행하지 않습니다.\n\n다른 시간을 선택해주세요.');
    }

    // 출퇴근 시간대 검사 (07:00-22:00)
    if (!isCommuteTime(departureTime)) {
      errors.push('🚫 출퇴근 시간대가 아닙니다.\n\n07:00~22:00 사이 시간을 선택해주세요.\n(지하철 운행 시간: 05:00~01:00)');
    }

    // 혼잡도 경고
    if (isCongestionTime(departureTime)) {
      warnings.push('⚠️ 혼잡도가 높은 시간대입니다.\n\n아침 7-9시, 저녁 6-8시는 배송 효율이 낮을 수 있습니다.');
    }
  }

  if (!validateDaysOfWeek(daysOfWeek)) {
    errors.push('🚫 요일 정보가 올바르지 않습니다.\n\n1(월)~7(일) 사이의 숫자를 선택해주세요.');
  }

  if (daysOfWeek.length === 0) {
    errors.push('🚫 운영 요일을 선택해주세요.\n\n최소 1개 이상의 요일을 선택해야 합니다.');
  }

  const hasWeekend = daysOfWeek.some(day => day === 6 || day === 7);
  const hasWeekday = daysOfWeek.some(day => day >= 1 && day <= 5);

  if (hasWeekend && hasWeekday) {
    warnings.push('ℹ️ 평일과 주말이 모두 포함되어 있습니다.\n\n주말 출퇴근 경로가 맞는지 확인해주세요.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 경로 생성 전용 유효성 검사 (최대 개수 포함)
 * @param userId 사용자 ID
 * @param startStation 출발역 정보
 * @param endStation 도착역 정보
 * @param departureTime 출발 시간 (HH:mm)
 * @param daysOfWeek 운영 요일
 * @returns 유효성 검사 결과
 */
export async function validateRouteForCreate(
  userId: string,
  startStation: StationInfo,
  endStation: StationInfo,
  departureTime: string,
  daysOfWeek: number[]
): Promise<RouteValidationResult> {
  // 기본 유효성 검사
  const baseValidation = validateRoute(startStation, endStation, departureTime, daysOfWeek);

  if (!baseValidation.isValid) {
    return baseValidation;
  }

  const errors: string[] = [...baseValidation.errors];
  const warnings: string[] = [...baseValidation.warnings];

  // 최대 5개 동선 제한 검사 + 시간대 중복 검사
  try {
    const existingRoutes = await getUserRoutes(userId);
    const activeRoutes = existingRoutes.filter(route => route.isActive);

    if (activeRoutes.length >= 5) {
      errors.push('🚫 동선을 더 이상 등록할 수 없습니다.\n\n최대 5개까지 등록 가능합니다.\n\n현재: ${activeRoutes.length}개');
      return {
        isValid: false,
        errors,
        warnings,
      };
    }

    // 4개인 경우 경고
    if (activeRoutes.length >= 4) {
      warnings.push('⚠️ 동선이 ${activeRoutes.length}개입니다.\n\n최대 5개까지 등록 가능하며, 5개가 되면 더 이상 등록할 수 없습니다.');
    }

    // 시간대 중복 검사
    const overlappingRoutes = findOverlappingRoutes(activeRoutes, daysOfWeek, departureTime);
    if (overlappingRoutes.length > 0) {
      const overlappingList = overlappingRoutes
        .map(r => {
          const days = r.daysOfWeek.map(d => DAY_LABELS[d]).join(', ');
          return `• ${r.startStation.stationName} → ${r.endStation.stationName} (${r.departureTime}, ${days})`;
        })
        .join('\n');

      warnings.push(
        `⚠️ 시간대가 겹치는 동선이 있습니다.\n\n${overlappingList}\n\n같은 시간대에 여러 동선을 운영하면 배송 효율이 낮아질 수 있습니다.\n\n계속 진행하시겠습니까?`
      );
    }
  } catch (error) {
    console.error('Error checking route limit:', error);
    warnings.push('⚠️ 동선 개수 확인 중 오류가 발생했습니다.\n\n계속 진행하시겠습니까?');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 경로 수정 전용 유효성 검사 (자기 자신 제외)
 * @param userId 사용자 ID
 * @param routeId 수정할 경로 ID (자기 자신 제외용)
 * @param startStation 출발역 정보
 * @param endStation 도착역 정보
 * @param departureTime 출발 시간 (HH:mm)
 * @param daysOfWeek 운영 요일
 * @returns 유효성 검사 결과
 */
export async function validateRouteForUpdate(
  userId: string,
  routeId: string,
  startStation: StationInfo,
  endStation: StationInfo,
  departureTime: string,
  daysOfWeek: number[]
): Promise<RouteValidationResult> {
  // 기본 유효성 검사
  const baseValidation = validateRoute(startStation, endStation, departureTime, daysOfWeek);

  if (!baseValidation.isValid) {
    return baseValidation;
  }

  const errors: string[] = [...baseValidation.errors];
  const warnings: string[] = [...baseValidation.warnings];

  // 시간대 중복 검사 (자기 자신 제외)
  try {
    const existingRoutes = await getUserRoutes(userId);
    const activeRoutes = existingRoutes.filter(route => route.isActive);

    // 시간대 중복 검사
    const overlappingRoutes = findOverlappingRoutes(activeRoutes, daysOfWeek, departureTime, routeId);
    if (overlappingRoutes.length > 0) {
      const overlappingList = overlappingRoutes
        .map(r => {
          const days = r.daysOfWeek.map(d => DAY_LABELS[d]).join(', ');
          return `• ${r.startStation.stationName} → ${r.endStation.stationName} (${r.departureTime}, ${days})`;
        })
        .join('\n');

      warnings.push(
        `⚠️ 시간대가 겹치는 동선이 있습니다.\n\n${overlappingList}\n\n같은 시간대에 여러 동선을 운영하면 배송 효율이 낮아질 수 있습니다.\n\n계속 진행하시겠습니까?`
      );
    }
  } catch (error) {
    console.error('Error checking route overlap:', error);
    warnings.push('⚠️ 시간대 중복 확인 중 오류가 발생했습니다.\n\n계속 진행하시겠습니까?');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ==================== Create Route ====================

/**
 * 새로운 경로 생성
 * @param args 사용자 ID 또는 CreateRouteParams 객체
 * @param startStation 출발역 정보 (args가 string일 때)
 * @param endStation 도착역 정보 (args가 string일 때)
 * @param departureTime 출발 시간 (args가 string일 때)
 * @param daysOfWeek 운영 요일 (args가 string일 때)
 * @returns 생성된 경로
 * @throws 유효성 검사 실패 시 에러
 */
export async function createRoute(
  args: string | CreateRouteParams,
  startStation?: StationInfo,
  endStation?: StationInfo,
  departureTime?: string,
  daysOfWeek?: number[]
): Promise<Route> {
  let userId: string;
  let start: StationInfo;
  let end: StationInfo;
  let time: string;
  let days: number[];

  if (typeof args === 'string') {
    userId = args;
    start = startStation!;
    end = endStation!;
    time = departureTime!;
    days = daysOfWeek!;
  } else {
    userId = args.userId;
    start = args.startStation;
    end = args.endStation;
    time = args.departureTime;
    days = args.daysOfWeek;
  }

  // 경로 생성 전용 유효성 검사 (최대 5개 제한 포함)
  const validation = await validateRouteForCreate(userId, start, end, time, days);

  if (!validation.isValid) {
    throw new Error(`경로 유효성 검사 실패: ${validation.errors.join(', ')}`);
  }

  const now = new Date();

  const routeData = {
    userId,
    startStation: start,
    endStation: end,
    departureTime: time,
    daysOfWeek: days,
    isActive: true,
    createdAt: convertDateToTimestamp(now),
    updatedAt: convertDateToTimestamp(now),
  };

  try {
    const docRef = await withRetry(() => addDoc(collection(db, 'routes'), routeData));
    const route: Route = {
      routeId: docRef.id,
      userId,
      startStation: start,
      endStation: end,
      departureTime: time,
      daysOfWeek: days,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // 캐시 무효화 (메모리 + AsyncStorage)
    cache.clearPattern(`^userRoutes:${userId}:`);
    cache.clearPattern(`^stationRoutes:`);
    await clearRoutesCache(userId);

    return route;
  } catch (error) {
    console.error('Error creating route:', error);
    throw error;
  }
}

// ==================== Read Routes ====================

/**
 * 특정 경로 조회
 * @param routeId 경로 ID
 * @param userId 사용자 ID (보안 체크용)
 * @returns 경로 또는 null (존재하지 않거나 권한 없음)
 */
export async function getRoute(routeId: string, userId: string): Promise<Route | null> {
  const cacheKey = `route:${routeId}`;
  const cached = cache.get<Route>(cacheKey);
  if (cached) {
    if (cached.userId !== userId) {
      return null;
    }
    return cached;
  }

  try {
    const docRef = doc(db, 'routes', routeId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists) {
      return null;
    }

    const route = convertRoute(docSnapshot.data(), docSnapshot.id);

    if (route.userId !== userId) {
      return null;
    }

    cache.set(cacheKey, route, ROUTE_CACHE_TTL);
    return route;
  } catch (error) {
    console.error(`Error fetching route ${routeId}:`, error);
    throw error;
  }
}

/**
 * 사용자의 모든 경로 조회
 * @param userId 사용자 ID
 * @returns 경로 목록
 */
/**
 * 사용자의 모든 경로 조회 (메모리 캐시 → AsyncStorage → Firestore)
 * @param userId 사용자 ID
 * @returns 경로 목록
 */
export async function getUserRoutes(userId: string): Promise<Route[]> {
  const cacheKey = `userRoutes:${userId}:all`;

  // 1. 메모리 캐시 확인
  const memCached = cache.get<Route[]>(cacheKey);
  if (memCached) {
    return memCached;
  }

  // 2. AsyncStorage 캐시 확인
  const storageCached = await loadCachedRoutesFromStorage(userId);
  if (storageCached) {
    // 메모리 캐시에도 저장
    cache.set(cacheKey, storageCached, USER_ROUTES_CACHE_TTL);
    return storageCached;
  }

  // 3. Firestore에서 로드
  try {
    const q = query(
      collection(db, 'routes'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const routes: Route[] = [];

    snapshot.forEach((docSnapshot) => {
      routes.push(convertRoute(docSnapshot.data(), docSnapshot.id));
    });

    // 메모리 캐시 저장
    cache.set(cacheKey, routes, USER_ROUTES_CACHE_TTL);

    // AsyncStorage 캐시 저장
    await saveRoutesToStorage(userId, routes);

    return routes;
  } catch (error) {
    console.error(`Error fetching routes for user ${userId}:`, error);
    throw error;
  }
}

/**
 * 사용자의 활성 경로 조회
 * @param userId 사용자 ID
 * @returns 활성 경로 목록
 */
export async function getUserActiveRoutes(userId: string): Promise<Route[]> {
  const cacheKey = `userRoutes:${userId}:active`;
  const cached = cache.get<Route[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'routes'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const routes: Route[] = [];

    snapshot.forEach((docSnapshot) => {
      routes.push(convertRoute(docSnapshot.data(), docSnapshot.id));
    });

    cache.set(cacheKey, routes, USER_ROUTES_CACHE_TTL);
    return routes;
  } catch (error) {
    console.error(`Error fetching active routes for user ${userId}:`, error);
    throw error;
  }
}

/**
 * 특정 요일의 활성 경로 조회
 * @param userId 사용자 ID
 * @param dayOfWeek 요일 (1=월, ..., 7=일)
 * @returns 해당 요일의 활성 경로 목록
 */
export async function getActiveRoutesForDay(userId: string, dayOfWeek: number): Promise<Route[]> {
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error('요일은 1-7 사이여야 합니다.');
  }

  const allActiveRoutes = await getUserActiveRoutes(userId);
  return allActiveRoutes.filter(route => route.daysOfWeek.includes(dayOfWeek));
}

/**
 * 특정 역을 지나가는 모든 경로 조회
 * @param stationId 역 ID
 * @returns 해당 역을 지나는 경로 목록
 */
export async function getRoutesByStation(stationId: string): Promise<StationRoutesResult> {
  const cacheKey = `stationRoutes:${stationId}`;
  const cached = cache.get<StationRoutesResult>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'routes'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const routes: Route[] = [];

    snapshot.forEach((docSnapshot) => {
      const route = convertRoute(docSnapshot.data(), docSnapshot.id);
      if (route.startStation.stationId === stationId || route.endStation.stationId === stationId) {
        routes.push(route);
      }
    });

    const result: StationRoutesResult = {
      stationId,
      stationName: routes[0]?.startStation.stationId === stationId
        ? routes[0].startStation.stationName
        : routes[0]?.endStation.stationName || '',
      routes,
    };

    cache.set(cacheKey, result, ROUTE_CACHE_TTL);
    return result;
  } catch (error) {
    console.error(`Error fetching routes for station ${stationId}:`, error);
    throw error;
  }
}

// ==================== Update Route ====================

/**
 * 경로 업데이트
 * @param routeId 경로 ID
 * @param userId 사용자 ID (권한 체크용)
 * @param updates 업데이트할 필드
 * @returns 업데이트된 경로 또는 null (권한 없음)
 */
export async function updateRoute(
  routeId: string,
  userId: string,
  updates: UpdateRouteParams
): Promise<Route | null> {
  const existingRoute = await getRoute(routeId, userId);

  if (!existingRoute) {
    return null;
  }

  const updatedData: any = {
    updatedAt: convertDateToTimestamp(new Date()),
  };

  if (updates.startStation) {
    updatedData.startStation = updates.startStation;
  }

  if (updates.endStation) {
    updatedData.endStation = updates.endStation;
  }

  if (updates.departureTime) {
    if (!validateTimeFormat(updates.departureTime)) {
      throw new Error('출발 시간 형식이 올바르지 않습니다. (HH:mm 형식이어야 합니다.)');
    }
    updatedData.departureTime = updates.departureTime;
  }

  if (updates.daysOfWeek) {
    if (!validateDaysOfWeek(updates.daysOfWeek)) {
      throw new Error('운영 요일이 올바르지 않습니다.');
    }
    updatedData.daysOfWeek = updates.daysOfWeek;
  }

  if (typeof updates.isActive === 'boolean') {
    updatedData.isActive = updates.isActive;
  }

  try {
    const docRef = doc(db, 'routes', routeId);
    await withRetry(() => updateDoc(docRef, updatedData));

    const updatedRoute: Route = {
      ...existingRoute,
      ...updates,
      updatedAt: new Date(),
    };

    // 캐시 무효화 (메모리 + AsyncStorage)
    cache.clearPattern(`^route:${routeId}$`);
    cache.clearPattern(`^userRoutes:${userId}:`);
    cache.clearPattern(`^stationRoutes:`);
    await clearRoutesCache(userId);

    return updatedRoute;
  } catch (error) {
    console.error(`Error updating route ${routeId}:`, error);
    throw error;
  }
}

/**
 * 경로 활성화
 * @param routeId 경로 ID
 * @param userId 사용자 ID
 * @returns 활성화된 경로 또는 null
 */
export async function activateRoute(routeId: string, userId: string): Promise<Route | null> {
  return updateRoute(routeId, userId, { isActive: true });
}

/**
 * 경로 비활성화
 * @param routeId 경로 ID
 * @param userId 사용자 ID
 * @returns 비활성화된 경로 또는 null
 */
export async function deactivateRoute(routeId: string, userId: string): Promise<Route | null> {
  return updateRoute(routeId, userId, { isActive: false });
}

// ==================== Delete Route ====================

/**
 * 경로 삭제
 * @param routeId 경로 ID
 * @param userId 사용자 ID (권한 체크용)
 * @returns 성공 여부
 */
export async function deleteRoute(routeId: string, userId: string): Promise<boolean> {
  const existingRoute = await getRoute(routeId, userId);

  if (!existingRoute) {
    return false;
  }

  try {
    const docRef = doc(db, 'routes', routeId);
    await withRetry(() => deleteDoc(docRef));

    // 캐시 무효화 (메모리 + AsyncStorage)
    cache.clearPattern(`^route:${routeId}$`);
    cache.clearPattern(`^userRoutes:${userId}:`);
    cache.clearPattern(`^stationRoutes:`);
    await clearRoutesCache(userId);

    return true;
  } catch (error) {
    console.error(`Error deleting route ${routeId}:`, error);
    throw error;
  }
}

// ==================== Route Summary ====================

/**
 * 경로 요약 정보 생성
 * @param route 경로
 * @returns 경로 요약
 */
export function createRouteSummary(route: Route): RouteSummary {
  return {
    routeId: route.routeId,
    startStationName: route.startStation.stationName,
    endStationName: route.endStation.stationName,
    departureTime: route.departureTime,
    daysOfWeek: route.daysOfWeek,
    isActive: route.isActive,
  };
}

/**
 * 사용자 경로 요약 목록 조회
 * @param userId 사용자 ID
 * @returns 경로 요약 목록
 */
export async function getUserRouteSummaries(userId: string): Promise<RouteSummary[]> {
  const routes = await getUserRoutes(userId);
  return routes.map(createRouteSummary);
}

// ==================== Cache Management ====================

/**
 * 경로 캐시 초기화
 * @param userId 사용자 ID (지정 시 해당 사용자 캐시만 초기화)
 */
export function clearRouteCache(userId?: string): void {
  if (userId) {
    cache.clearPattern(`^userRoutes:${userId}:`);
  } else {
    cache.clear();
  }
}

/**
 * 동선 중복 확인 (테스트용)
 * @param userId 사용자 ID
 * @param routeData 경로 데이터 (startStation, endStation, departureTime, daysOfWeek)
 * @returns 중복 확인 결과 (hasOverlap, overlappingRoutes)
 */
export async function checkRouteOverlap(
  userId: string,
  routeData: {
    startStation: StationInfo;
    endStation: StationInfo;
    departureTime: string;
    daysOfWeek: number[];
  }
): Promise<{ hasOverlap: boolean; overlappingRoutes: Route[] }> {
  const { startStation, endStation, departureTime, daysOfWeek } = routeData;

  // 기존 동선 조회
  const existingRoutes = await getUserRoutes(userId);
  const activeRoutes = existingRoutes.filter(route => route.isActive);

  // 중복 확인 (시간대 겹침)
  const overlappingRoutes = findOverlappingRoutes(
    activeRoutes,
    daysOfWeek,
    departureTime
  );

  return {
    hasOverlap: overlappingRoutes.length > 0,
    overlappingRoutes,
  };
}
