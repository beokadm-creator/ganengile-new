/**
 * Location Service Unit Tests
 */

import { LocationService, LocationData, StationLocation } from '../location-service';

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: {
    Balanced: 'balanced',
    High: 'high',
    Low: 'low',
  },
  reverseGeocodeAsync: jest.fn(),
}));

import * as Location from 'expo-location';

describe('LocationService', () => {
  let locationService: LocationService;

  beforeEach(() => {
    locationService = new LocationService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    locationService.stopLocationTracking();
  });

  describe('requestLocationPermission', () => {
    it('위치 권한이 승인되면 true를 반환해야 한다', async () => {
      // Given
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      // When
      const result = await locationService.requestLocationPermission();

      // Then
      expect(result).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('위치 권한이 거부되면 false를 반환해야 한다', async () => {
      // Given
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      // When
      const result = await locationService.requestLocationPermission();

      // Then
      expect(result).toBe(false);
    });

    it('권한 요청 중 에러가 발생하면 false를 반환해야 한다', async () => {
      // Given
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission error')
      );

      // When
      const result = await locationService.requestLocationPermission();

      // Then
      expect(result).toBe(false);
    });
  });

  describe('getCurrentLocation', () => {
    it('현재 위치를 성공적으로 가져와야 한다', async () => {
      // Given
      const mockLocation = {
        coords: {
          latitude: 37.5665,
          longitude: 126.9780,
          accuracy: 10,
          altitude: 50,
          speed: null,
          heading: null,
        },
      };

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockLocation);

      // When
      const result = await locationService.getCurrentLocation();

      // Then
      expect(result).toEqual({
        latitude: 37.5665,
        longitude: 126.9780,
        accuracy: 10,
        altitude: 50,
        speed: 0,
        heading: null,
      });
    });

    it('위치 권한이 없으면 null을 반환해야 한다', async () => {
      // Given
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      // When
      const result = await locationService.getCurrentLocation();

      // Then
      expect(result).toBeNull();
    });

    it('위치 가져오기가 실패하면 null을 반환해야 한다', async () => {
      // Given
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
        new Error('Location error')
      );

      // When
      const result = await locationService.getCurrentLocation();

      // Then
      expect(result).toBeNull();
    });

    it('accuracy가 없으면 0으로 설정해야 한다', async () => {
      // Given
      const mockLocation = {
        coords: {
          latitude: 37.5665,
          longitude: 126.9780,
          accuracy: null,
          altitude: null,
          speed: null,
          heading: null,
        },
      };

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockLocation);

      // When
      const result = await locationService.getCurrentLocation();

      // Then
      expect(result?.accuracy).toBe(0);
    });
  });

  describe('calculateDistance (Haversine Formula)', () => {
    it('서울역에서 강남역까지의 거리를 계산해야 한다', () => {
      // Given
      const lat1 = 37.5547; // Seoul Station
      const lon1 = 126.9707;
      const lat2 = 37.5172; // Gangnam Station
      const lon2 = 127.0473;

      // When
      const distance = locationService.calculateDistance(lat1, lon1, lat2, lon2);

      // Then
      // 약 7-8km 정도여야 함
      expect(distance).toBeGreaterThan(6000);
      expect(distance).toBeLessThan(9000);
    });

    it('같은 위치면 거리가 0이어야 한다', () => {
      // Given
      const lat = 37.5665;
      const lon = 126.9780;

      // When
      const distance = locationService.calculateDistance(lat, lon, lat, lon);

      // Then
      expect(distance).toBe(0);
    });

    it('정확한 Haversine 공식을 사용해야 한다', () => {
      // Given
      // Equator test: 1 degree of longitude at equator ≈ 111.32 km
      const lat1 = 0;
      const lon1 = 0;
      const lat2 = 0;
      const lon2 = 1;

      // When
      const distance = locationService.calculateDistance(lat1, lon1, lat2, lon2);

      // Then
      // 1 degree at equator ≈ 111.32 km
      expect(distance).toBeGreaterThan(111000);
      expect(distance).toBeLessThan(112000);
    });

    it('작은 거리도 정확히 계산해야 한다', () => {
      // Given
      // 두 위치 사이의 작은 거리 (약 100m)
      const lat1 = 37.5665;
      const lon1 = 126.9780;
      const lat2 = 37.5674; // 약 0.0009도 차이 (북쪽으로 약 100m)
      const lon2 = 126.9780;

      // When
      const distance = locationService.calculateDistance(lat1, lon1, lat2, lon2);

      // Then
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });
  });

  describe('isNearStation', () => {
    const mockCurrentLocation: LocationData = {
      latitude: 37.5547,
      longitude: 126.9707,
      accuracy: 10,
      altitude: 50,
      speed: 0,
      heading: null,
    };

    const mockStation: StationLocation = {
      name: '서울역',
      line: '1호선',
      latitude: 37.5547,
      longitude: 126.9707,
    };

    it('반경 200m 내에 있으면 true를 반환해야 한다', async () => {
      // When
      const result = await locationService.isNearStation(mockCurrentLocation, mockStation, 200);

      // Then
      expect(result).toBe(true);
    });

    it('반경 200m 밖에 있으면 false를 반환해야 한다', async () => {
      // Given - 약 300m 떨어진 위치
      const farLocation: LocationData = {
        ...mockCurrentLocation,
        latitude: 37.5574, // 약 0.0027도 차이 (북쪽으로 약 300m)
        longitude: 126.9707,
      };

      // When
      const result = await locationService.isNearStation(farLocation, mockStation, 200);

      // Then
      expect(result).toBe(false);
    });

    it('사용자 정의 반경을 사용해야 한다', async () => {
      // Given - 약 150m 떨어진 위치
      const nearLocation: LocationData = {
        ...mockCurrentLocation,
        latitude: 37.5561, // 약 0.0014도 차이 (북쪽으로 약 150m)
        longitude: 126.9707,
      };

      // When - 100m 반경으로는 false, 200m 반경으로는 true
      const result100 = await locationService.isNearStation(nearLocation, mockStation, 100);
      const result200 = await locationService.isNearStation(nearLocation, mockStation, 200);

      // Then
      expect(result100).toBe(false);
      expect(result200).toBe(true);
    });
  });

  describe('findNearestStation', () => {
    const mockCurrentLocation: LocationData = {
      latitude: 37.5547,
      longitude: 126.9707,
      accuracy: 10,
      altitude: 50,
      speed: 0,
      heading: null,
    };

    const mockStations: StationLocation[] = [
      {
        name: '서울역',
        line: '1호선',
        latitude: 37.5547,
        longitude: 126.9707,
      },
      {
        name: '남영역',
        line: '1호선',
        latitude: 37.5452,
        longitude: 126.9725,
      },
      {
        name: '용산역',
        line: '1호선',
        latitude: 37.5296,
        longitude: 126.9656,
      },
    ];

    it('가장 가까운 역을 찾아야 한다', async () => {
      // When
      const result = await locationService.findNearestStation(mockCurrentLocation, mockStations);

      // Then
      expect(result).not.toBeNull();
      expect(result?.name).toBe('서울역');
    });

    it('빈 배열이면 null을 반환해야 한다', async () => {
      // When
      const result = await locationService.findNearestStation(mockCurrentLocation, []);

      // Then
      expect(result).toBeNull();
    });

    it('역이 하나만 있어도 해당 역을 반환해야 한다', async () => {
      // Given
      const singleStation: StationLocation[] = [
        {
          name: '서울역',
          line: '1호선',
          latitude: 37.5547,
          longitude: 126.9707,
        },
      ];

      // When
      const result = await locationService.findNearestStation(mockCurrentLocation, singleStation);

      // Then
      expect(result).toEqual(singleStation[0]);
    });
  });

  describe('startLocationTracking', () => {
    it('위치 추적을 시작하고 콜백을 호출해야 한다', async () => {
      // Given
      const mockCallback = jest.fn();
      const mockLocation = {
        coords: {
          latitude: 37.5665,
          longitude: 126.9780,
          accuracy: 10,
          altitude: 50,
          speed: 1.5,
          heading: 90,
        },
      };

      const mockUnsubscribe = { remove: jest.fn() };
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.watchPositionAsync as jest.Mock).mockImplementation(
        (_options, callback) => {
          callback(mockLocation);
          return Promise.resolve(mockUnsubscribe);
        }
      );

      // When
      const result = await locationService.startLocationTracking(mockCallback);

      // Then
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalledWith({
        latitude: 37.5665,
        longitude: 126.9780,
        accuracy: 10,
        altitude: 50,
        speed: 1.5,
        heading: 90,
      });
    });

    it('위치 권한이 없으면 false를 반환해야 한다', async () => {
      // Given
      const mockCallback = jest.fn();
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      // When
      const result = await locationService.startLocationTracking(mockCallback);

      // Then
      expect(result).toBe(false);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('stopLocationTracking', () => {
    it('위치 추적을 중지해야 한다', async () => {
      // Given
      const mockCallback = jest.fn();
      const mockLocation = {
        coords: {
          latitude: 37.5665,
          longitude: 126.9780,
          accuracy: 10,
          altitude: 50,
          speed: null,
          heading: null,
        },
      };
      const mockUnsubscribe = { remove: jest.fn() };
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.watchPositionAsync as jest.Mock).mockImplementation(
        (_options, callback) => {
          callback(mockLocation);
          return Promise.resolve(mockUnsubscribe);
        }
      );

      await locationService.startLocationTracking(mockCallback);

      // When
      locationService.stopLocationTracking();

      // Then
      expect(mockUnsubscribe.remove).toHaveBeenCalled();
    });

    it('추적이 시작되지 않았으면 아무 일도 일어나지 않아야 한다', () => {
      // When - 추적 시작 없이 중지
      expect(() => locationService.stopLocationTracking()).not.toThrow();
    });
  });

  describe('reverseGeocode', () => {
    it('위도/경도를 주소로 변환해야 한다', async () => {
      // Given
      const mockGeocoded = [
        {
          street: '서울특별시 중구',
          city: '서울특별시',
          region: '대한민국',
        },
      ];
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue(mockGeocoded);

      // When
      const result = await locationService.reverseGeocode(37.5665, 126.9780);

      // Then
      expect(result).toBe('서울특별시 중구 서울특별 대한민국');
      expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({
        latitude: 37.5665,
        longitude: 126.9780,
      });
    });

    it('주소를 찾을 수 없으면 기본 메시지를 반환해야 한다', async () => {
      // Given
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([]);

      // When
      const result = await locationService.reverseGeocode(37.5665, 126.9780);

      // Then
      expect(result).toBe('위치를 찾을 수 없습니다');
    });

    it('변환 실패 시 에러 메시지를 반환해야 한다', async () => {
      // Given
      (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValue(
        new Error('Geocoding error')
      );

      // When
      const result = await locationService.reverseGeocode(37.5665, 126.9780);

      // Then
      expect(result).toBe('주소 변환 실패');
    });
  });
});
