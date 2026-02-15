/**
 * Location Service - GPS 위치 추적
 * 
 * 기능:
 * - 현재 위치 가져오기
 * - 위치 권한 요청
 * - 지속적 위치 추적 (실시간 배송 추적용)
 * - 역 근처 위치 확인
 */

import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
}

export interface StationLocation {
  name: string;
  line: string;
  latitude: number;
  longitude: number;
}

export class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;

  /**
   * 위치 권한 요청
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.error('Location permission denied');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  /**
   * 현재 위치 가져오기 (일회성)
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        altitude: location.coords.altitude || null,
        speed: location.coords.speed || null,
        heading: location.coords.heading || null,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * 지속적 위치 추적 시작 (실시간 배송 추적용)
   */
  async startLocationTracking(
    callback: (location: LocationData) => void
  ): Promise<boolean> {
    try {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        return false;
      }

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10, // 10m마다 업데이트
          timeInterval: 5000, // 또는 5초마다 업데이트
        },
        (location) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            altitude: location.coords.altitude || null,
            speed: location.coords.speed || null,
            heading: location.coords.heading || null,
          });
        }
      );

      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  /**
   * 지속적 위치 추적 중지
   */
  stopLocationTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  /**
   * 두 위치 간의 거리 계산 (Haversine formula, 미터 단위)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 특정 역 근처에 있는지 확인 (반경 200m)
   */
  async isNearStation(
    currentLocation: LocationData,
    station: StationLocation,
    radius: number = 200
  ): Promise<boolean> {
    const distance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      station.latitude,
      station.longitude
    );

    return distance <= radius;
  }

  /**
   * 가장 가까운 역 찾기
   */
  async findNearestStation(
    currentLocation: LocationData,
    stations: StationLocation[]
  ): Promise<StationLocation | null> {
    if (stations.length === 0) {
      return null;
    }

    let nearestStation = stations[0];
    let minDistance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      stations[0].latitude,
      stations[0].longitude
    );

    for (let i = 1; i < stations.length; i++) {
      const distance = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        stations[i].latitude,
        stations[i].longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = stations[i];
      }
    }

    return nearestStation;
  }

  /**
   * 주소로 변역 (역 geocoding)
   * TODO: Google Maps Geocoding API 또는 Daum API 연동
   */
  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<string> {
    try {
      const geocoded = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (geocoded.length > 0) {
        const { street, city, region } = geocoded[0];
        return `${street || ''} ${city || ''} ${region || ''}`.trim();
      }

      return '위치를 찾을 수 없습니다';
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return '주소 변환 실패';
    }
  }
}

// Singleton instance
export const locationService = new LocationService();
