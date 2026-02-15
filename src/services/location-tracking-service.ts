/**
 * Location Tracking Service
 * 실시간 위치 추적 및 Firestore 업데이트
 */

import * as Location from 'expo-location';
import {
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface TrackingStatus {
  isTracking: boolean;
  lastLocation: LocationData | null;
  error: string | null;
}

/**
 * 위치 권한 요청
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      throw new Error('위치 권한이 거부되었습니다.');
    }

    // 백그라운드 위치 권한 (선택사항)
    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== 'granted') {
      console.warn('백그라운드 위치 권한이 거부되었습니다.');
    }

    return true;
  } catch (error: any) {
    console.error('Location permission error:', error);
    throw error;
  }
}

/**
 * 현재 위치 가져오기 (단발성)
 */
export async function getCurrentLocation(): Promise<LocationData> {
  try {
    // 권한 확인
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      throw new Error('위치 권한이 필요합니다.');
    }

    // 위치 가져오기
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude || undefined,
      heading: location.coords.heading || undefined,
      speed: location.coords.speed || undefined,
    };
  } catch (error: any) {
    console.error('Get current location error:', error);
    throw error;
  }
}

/**
 * 위치 추적 서비스
 * 배송 중 기러의 실시간 위치 추적
 */
export class LocationTrackingService {
  private subscription: Location.LocationSubscription | null = null;
  private deliveryId: string | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private isTracking = false;

  /**
   * 위치 추적 시작
   * @param deliveryId 배송 ID
   * @param updateIntervalMs 업데이트 간격 (ms)
   */
  async startTracking(deliveryId: string, updateIntervalMs: number = 10000): Promise<void> {
    if (this.isTracking) {
      console.warn('Already tracking location');
      return;
    }

    try {
      // 권한 요청
      await requestLocationPermission();

      this.deliveryId = deliveryId;
      this.isTracking = true;

      // 위치 추적 시작
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10, // 10m 이동 시 업데이트
          timeInterval: updateIntervalMs,
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      console.log('Location tracking started for delivery:', deliveryId);
    } catch (error: any) {
      console.error('Start tracking error:', error);
      this.isTracking = false;
      throw error;
    }
  }

  /**
   * 위치 업데이트 핸들러
   */
  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    if (!this.deliveryId || !this.isTracking) {
      return;
    }

    try {
      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
      };

      // Firestore에 위치 업데이트
      await updateDoc(doc(db, 'deliveries', this.deliveryId), {
        'tracking.currentLocation': locationData,
        'tracking.lastLocationUpdate': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('Location updated:', locationData);
    } catch (error) {
      console.error('Location update error:', error);
    }
  }

  /**
   * 위치 추적 중지
   */
  stopTracking(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.deliveryId = null;
    this.isTracking = false;

    console.log('Location tracking stopped');
  }

  /**
   * 추적 상태 확인
   */
  getStatus(): TrackingStatus {
    return {
      isTracking: this.isTracking,
      lastLocation: null, // Firestore에서 가져와야 함
      error: null,
    };
  }
}

// 싱글톤 인스턴스
const locationTrackingService = new LocationTrackingService();

/**
 * 배송 추적 시작
 */
export async function startDeliveryTracking(
  deliveryId: string,
  updateIntervalMs?: number
): Promise<void> {
  return locationTrackingService.startTracking(deliveryId, updateIntervalMs);
}

/**
 * 배송 추적 중지
 */
export function stopDeliveryTracking(): void {
  locationTrackingService.stopTracking();
}

/**
 * 추적 상태 확인
 */
export function getTrackingStatus(): TrackingStatus {
  return locationTrackingService.getStatus();
}

/**
 * 배송 중 거리 계산 (하버사인 공식)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 미터 단위
}

/**
 * ETA 계산 (평균 속도 기반)
 */
export function calculateETA(
  distance: number,
  averageSpeed: number = 4.5 // m/s (약 16km/h)
): number {
  // 초 단위 ETA
  const etaSeconds = distance / averageSpeed;

  // 분 단위로 변환
  return Math.ceil(etaSeconds / 60);
}

/**
 * 지하철 역까지의 거리 계산
 */
export function calculateDistanceToStation(
  currentLocation: LocationData,
  stationLocation: { latitude: number; longitude: number }
): number {
  return calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    stationLocation.latitude,
    stationLocation.longitude
  );
}
