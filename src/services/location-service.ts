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

export interface NearbyStation<T extends StationLocation = StationLocation> {
  station: T;
  distanceMeters: number;
}

export class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;

  async requestLocationPermission(): Promise<boolean> {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      const granted = permission.granted;
      const status = permission.status as string | undefined;
      return typeof granted === 'boolean' ? granted : status === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

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
        accuracy: location.coords.accuracy ?? 0,
        altitude: location.coords.altitude ?? null,
        speed: location.coords.speed ?? 0,
        heading: location.coords.heading ?? null,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

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
          distanceInterval: 20, // 10 -> 20 최적화
          timeInterval: 15000, // 5000 -> 15000 최적화
        },
        (location) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 0,
            altitude: location.coords.altitude ?? null,
            speed: location.coords.speed ?? 0,
            heading: location.coords.heading ?? null,
          });
        }
      );

      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  stopLocationTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const earthRadius = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  }

  isNearStation(
    currentLocation: LocationData,
    station: StationLocation,
    radius: number = 200
  ): boolean {
    const distance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      station.latitude,
      station.longitude
    );

    return distance <= radius;
  }

  findNearestStation(
    currentLocation: LocationData,
    stations: StationLocation[]
  ): StationLocation | null {
    if (stations.length === 0) {
      return null;
    }

    let nearestStation = stations[0];
    let minDistance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      nearestStation.latitude,
      nearestStation.longitude
    );

    for (const station of stations.slice(1)) {
      const distance = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        station.latitude,
        station.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = station;
      }
    }

    return nearestStation;
  }

  findNearestStations<T extends StationLocation>(
    currentLocation: LocationData,
    stations: T[],
    limit: number = 3
  ): Array<NearbyStation<T>> {
    return stations
      .map((station) => ({
        station,
        distanceMeters: this.calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          station.latitude,
          station.longitude
        ),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, Math.max(1, limit));
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      let proxyUrl = '';
      try {
        const mapConfig = await import('../config/map-config');
        proxyUrl = mapConfig.getNaverReverseGeocodeProxyUrl();
      } catch (e) {
        // ignore dynamic import errors in tests
      }
      
      if (proxyUrl) {
        const requestUrl = new URL(proxyUrl);
        requestUrl.searchParams.set('coords', `${longitude},${latitude}`);
        
        try {
          const response = await fetch(requestUrl.toString());
          if (response.ok) {
            const payload = await response.json();
            if (payload.ok && payload.address) {
              return payload.address;
            }
          }
        } catch (e) {
          console.warn('Naver reverse geocoding failed, falling back to native', e);
        }
      }

      // Fallback to native reverse geocoding
      const geocoded = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (geocoded.length > 0) {
        const first = geocoded[0];
        const compactCity = first.city?.replace(/시$/, '') ?? first.city;
        const segments = [
          first.street,
          first.district,
          compactCity,
          first.region,
          first.name,
        ].filter(Boolean);

        if (segments.length > 0) {
          return segments.join(' ');
        }
      }

      return '위치를 찾을 수 없습니다';
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return '주소 변환 실패';
    }
  }
}

export const locationService = new LocationService();
