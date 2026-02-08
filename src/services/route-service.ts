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

function convertDateToTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
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
    station.lineCode &&
    typeof station.lat === 'number' &&
    typeof station.lng === 'number'
  );
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
    errors.push('출발역 정보가 올바르지 않습니다.');
  }

  if (!validateStationInfo(endStation)) {
    errors.push('도착역 정보가 올바르지 않습니다.');
  }

  if (startStation.stationId === endStation.stationId) {
    errors.push('출발역과 도착역이 같을 수 없습니다.');
  }

  if (!validateTimeFormat(departureTime)) {
    errors.push('출발 시간 형식이 올바르지 않습니다. (HH:mm 형식이어야 합니다.)');
  }

  if (!validateDaysOfWeek(daysOfWeek)) {
    errors.push('운영 요일이 올바르지 않습니다. (1-7 사이의 숫자 배열이어야 합니다.)');
  }

  if (daysOfWeek.length === 0) {
    warnings.push('운영 요일이 하나도 없습니다.');
  }

  const hasWeekend = daysOfWeek.some(day => day === 6 || day === 7);
  const hasWeekday = daysOfWeek.some(day => day >= 1 && day <= 5);

  if (hasWeekend && hasWeekday) {
    warnings.push('주말과 평일이 모두 포함되어 있습니다.');
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

  const validation = validateRoute(start, end, time, days);

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

    cache.clearPattern(`^userRoutes:${userId}:`);
    cache.clearPattern(`^stationRoutes:`);

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

    if (!docSnapshot.exists()) {
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
export async function getUserRoutes(userId: string): Promise<Route[]> {
  const cacheKey = `userRoutes:${userId}:all`;
  const cached = cache.get<Route[]>(cacheKey);
  if (cached) {
    return cached;
  }

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

    cache.set(cacheKey, routes, USER_ROUTES_CACHE_TTL);
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

    cache.clearPattern(`^route:${routeId}$`);
    cache.clearPattern(`^userRoutes:${userId}:`);
    cache.clearPattern(`^stationRoutes:`);

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

    cache.clearPattern(`^route:${routeId}$`);
    cache.clearPattern(`^userRoutes:${userId}:`);
    cache.clearPattern(`^stationRoutes:`);

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
