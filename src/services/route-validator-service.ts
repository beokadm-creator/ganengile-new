/**
 * Route Validator Service
 * 동선 유효성 검사 (시간대, 방향, 요일)
 */

import { StationInfo } from '../types/route';
import { pathfindingService } from './PathfindingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// AsyncStorage Keys
const FAVORITE_ROUTES_KEY = '@favorite_routes';

// Favorite Route 타입
export interface FavoriteRoute {
  routeId: string;
  startStation: StationInfo;
  endStation: StationInfo;
  departureTime: string;
  selectedDays: number[];
  createdAt: string;
}

/**
 * 동선 유효성 검사
 */
export const validateRouteInput = (
  startStation: StationInfo | null,
  endStation: StationInfo | null,
  departureTime: string,
  selectedDays: number[]
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 필수 필드 검사
  if (!startStation) {
    errors.push('출발역을 선택해주세요.');
  }

  if (!endStation) {
    errors.push('도착역을 선택해주세요.');
  }

  if (startStation && endStation && startStation.id === endStation.id) {
    errors.push('출발역과 도착역이 같습니다.');
  }

  if (selectedDays.length === 0) {
    errors.push('요일을 하나 이상 선택해주세요.');
  }

  // 2. 시간대 검사 (rush hour 권장)
  const [hour, minute] = departureTime.split(':').map(Number);
  const timeInMinutes = hour * 60 + minute;

  // 아침 러시아워: 07:00-09:00
  const isMorningRush = timeInMinutes >= 420 && timeInMinutes <= 540;
  // 저녁 러시아워: 18:00-20:00
  const isEveningRush = timeInMinutes >= 1080 && timeInMinutes <= 1200;

  if (!isMorningRush && !isEveningRush) {
    warnings.push('러시아워 시간대가 아니면 매칭이 어려울 수 있습니다.');
  }

  // 3. 조순 시간 검사 (too early/late)
  if (timeInMinutes < 300) {
    // 05:00 이전
    warnings.push('지하철 운행 시간 전입니다.');
  }

  if (timeInMinutes > 1380) {
    // 23:00 이후
    warnings.push('지하철 운행이 종료될 시간입니다.');
  }

  // 4. 요일별 권장 시간대
  const hasWeekday = selectedDays.some((d) => d <= 5);
  const hasWeekend = selectedDays.some((d) => d >= 6);

  if (hasWeekday && hasWeekend) {
    warnings.push('평일/주말 시간대를 다르게 설정하는 것을 권장합니다.');
  }

  // 5. 방향성 검사 (출퇴근 경로)
  if (startStation && endStation) {
    // 서울 중심부 기준
    const seoulCenterIds = new Set([
      '1301', // 서울역
      '1336', //을지로입구
      '1342', //충무로
      '1351', //동대문
    ]);

    const isStartCenter = seoulCenterIds.has(startStation.id);
    const isEndCenter = seoulCenterIds.has(endStation.id);

    if (hasWeekday && isStartCenter && isEndCenter) {
      warnings.push('출근 시간대에 중심부 간 이동은 매칭이 어려울 수 있습니다.');
    }
  }

  // 6. 배차 간격 고려
  if (warnings.length === 0 && !isMorningRush && !isEveningRush) {
    const offPeakHours = [10, 11, 12, 13, 14, 15];
    if (offPeakHours.includes(hour)) {
      warnings.push('비수기 시간대입니다. 배차 간격이 길 수 있습니다.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * 예상 소요 시간 계산 (PathfindingService 활용)
 */
export const estimateTravelTime = async (
  startStation: StationInfo,
  endStation: StationInfo
): Promise<number> => {
  try {
    // PathfindingService가 초기화되었는지 확인
    const result = pathfindingService.calculateETA(
      startStation.id,
      endStation.id
    );

    if (result && result.minutes > 0) {
      return result.minutes;
    }

    // Fallback: 단순 거리 기반 추정
    const latDiff = Math.abs(startStation.lat - endStation.lat);
    const lngDiff = Math.abs(startStation.lng - endStation.lng);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

    // 1도 약 111km, 지하철 평균 속도 40km/h
    const estimatedMinutes = Math.round((distance * 111) / 40 * 60);

    return Math.max(estimatedMinutes, 10); // 최소 10분
  } catch (error) {
    console.error('Failed to estimate travel time:', error);

    // Error fallback: 단순 거리 기반 추정
    const latDiff = Math.abs(startStation.lat - endStation.lat);
    const lngDiff = Math.abs(startStation.lng - endStation.lng);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

    const estimatedMinutes = Math.round((distance * 111) / 40 * 60);
    return Math.max(estimatedMinutes, 10);
  }
};

/**
 * 동선 저장 후 저장소 최신화 (AsyncStorage에 즐겨찾기 저장)
 */
export const saveRouteToFavorites = async (
  routeId: string,
  startStation: StationInfo,
  endStation: StationInfo,
  departureTime: string,
  selectedDays: number[]
): Promise<boolean> => {
  try {
    // 기존 즐겨찾기 가져오기
    const existingFavoritesJson = await AsyncStorage.getItem(FAVORITE_ROUTES_KEY);
    const existingFavorites: FavoriteRoute[] = existingFavoritesJson
      ? JSON.parse(existingFavoritesJson)
      : [];

    // 새로운 즐겨찾기 생성
    const newFavorite: FavoriteRoute = {
      routeId,
      startStation,
      endStation,
      departureTime,
      selectedDays,
      createdAt: new Date().toISOString(),
    };

    // 중복 체크 (같은 경로가 이미 있는지)
    const isDuplicate = existingFavorites.some(
      (fav) =>
        fav.startStation.id === startStation.id &&
        fav.endStation.id === endStation.id &&
        fav.departureTime === departureTime &&
        JSON.stringify(fav.selectedDays.sort()) === JSON.stringify(selectedDays.sort())
    );

    if (isDuplicate) {
      console.log('Route already exists in favorites:', routeId);
      return true; // 이미 있으면 성공으로 처리
    }

    // 즐겨찾기 추가 (최대 20개)
    const updatedFavorites = [newFavorite, ...existingFavorites].slice(0, 20);

    // AsyncStorage에 저장
    await AsyncStorage.setItem(FAVORITE_ROUTES_KEY, JSON.stringify(updatedFavorites));

    console.log('Route saved to favorites:', routeId);
    return true;
  } catch (error) {
    console.error('Failed to save route to favorites:', error);
    return false;
  }
};

/**
 * 즐겨찾기 동선 목록 가져오기
 */
export const getFavoriteRoutes = async (): Promise<FavoriteRoute[]> => {
  try {
    const favoritesJson = await AsyncStorage.getItem(FAVORITE_ROUTES_KEY);
    return favoritesJson ? JSON.parse(favoritesJson) : [];
  } catch (error) {
    console.error('Failed to get favorite routes:', error);
    return [];
  }
};

/**
 * 즐겨찾기 동선 삭제
 */
export const removeFavoriteRoute = async (routeId: string): Promise<boolean> => {
  try {
    const existingFavoritesJson = await AsyncStorage.getItem(FAVORITE_ROUTES_KEY);
    const existingFavorites: FavoriteRoute[] = existingFavoritesJson
      ? JSON.parse(existingFavoritesJson)
      : [];

    const updatedFavorites = existingFavorites.filter((fav) => fav.routeId !== routeId);

    await AsyncStorage.setItem(FAVORITE_ROUTES_KEY, JSON.stringify(updatedFavorites));

    console.log('Route removed from favorites:', routeId);
    return true;
  } catch (error) {
    console.error('Failed to remove favorite route:', error);
    return false;
  }
};
