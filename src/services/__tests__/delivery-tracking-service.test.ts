/**
 * Delivery Tracking Service Unit Tests
 */

import { DeliveryTrackingService, DeliveryStatus } from '../delivery-tracking-service';
import { LocationData } from '../location-service';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, toMillis: () => Date.now() })),
    fromDate: jest.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), toMillis: () => date.getTime() })),
  },
}));

import { collection, doc, onSnapshot, updateDoc, getDoc, Timestamp } from 'firebase/firestore';

// Mock Location Service
jest.mock('../location-service', () => ({
  locationService: {
    startLocationTracking: jest.fn(),
    stopLocationTracking: jest.fn(),
  },
}));

import { locationService } from '../location-service';

describe('DeliveryTrackingService', () => {
  let deliveryTrackingService: DeliveryTrackingService;

  beforeEach(() => {
    deliveryTrackingService = new DeliveryTrackingService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    deliveryTrackingService.stopTracking();
  });

  describe('startTracking', () => {
    it('배송 추적을 시작하고 콜백을 호출해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      const mockDocSnapshot = {
        exists: true,
        id: deliveryId,
        data: () => ({
          requestId: 'req-123',
          status: 'in_transit',
          gillerId: 'giller-456',
          gillerLocation: { latitude: 37.5665, longitude: 126.9780 },
          currentStation: '서울역',
          nextStation: '강남역',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (onSnapshot as jest.Mock).mockImplementation((_ref, onNext, onError) => {
        onNext(mockDocSnapshot);
        return mockUnsubscribe;
      });

      // When
      const result = await deliveryTrackingService.startTracking(deliveryId, mockCallback);

      // Then
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: deliveryId,
          status: 'in_transit',
          gillerId: 'giller-456',
          progress: 60,
        })
      );
    });

    it('배송 완료 상태를 올바르게 처리해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const mockCallback = jest.fn();
      const mockDeliveryTime = new Date(Date.now() + 30 * 60 * 1000);
      const mockDocSnapshot = {
        exists: true,
        id: deliveryId,
        data: () => ({
          requestId: 'req-123',
          status: 'delivered',
          gillerId: 'giller-456',
          deliveryTime: Timestamp.fromDate(mockDeliveryTime),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (onSnapshot as jest.Mock).mockImplementation((_ref, onNext) => {
        onNext(mockDocSnapshot);
        return jest.fn();
      });

      // When
      await deliveryTrackingService.startTracking(deliveryId, mockCallback);

      // Then
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          progress: 100,
          isDelayed: false,
          delayMinutes: 0,
        })
      );
    });

    it('에러 발생 시 false를 반환해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const mockCallback = jest.fn();
      (doc as jest.Mock).mockImplementation(() => {
        throw new Error('Firestore error');
      });

      // When
      const result = await deliveryTrackingService.startTracking(deliveryId, mockCallback);

      // Then
      expect(result).toBe(false);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('stopTracking', () => {
    it('배송 추적을 중지해야 한다', () => {
      // Given
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribe);

      deliveryTrackingService.startTracking('delivery-123', jest.fn());

      // When
      deliveryTrackingService.stopTracking();

      // Then
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('위치 추적도 중지해야 한다', async () => {
      // Given
      const mockLocationUnsubscribe = jest.fn();
      (locationService.startLocationTracking as jest.Mock).mockResolvedValue(true);
      (locationService.stopLocationTracking as jest.Mock).mockImplementation(() => {
        mockLocationUnsubscribe();
      });

      await deliveryTrackingService.startLocationTracking('delivery-123');

      // When
      deliveryTrackingService.stopTracking();

      // Then
      expect(locationService.stopLocationTracking).toHaveBeenCalled();
    });
  });

  describe('updateDeliveryStatus', () => {
    it('배송 상태를 업데이트해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const newStatus = 'picked_up';
      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      // When
      const result = await deliveryTrackingService.updateDeliveryStatus(deliveryId, newStatus);

      // Then
      expect(result).toBe(true);
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        { status: newStatus, updatedAt: expect.any(Object) }
      );
    });

    it('에러 발생 시 false를 반환해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Update error'));

      // When
      const result = await deliveryTrackingService.updateDeliveryStatus(deliveryId, 'picked_up');

      // Then
      expect(result).toBe(false);
    });
  });

  describe('updateCurrentStation', () => {
    it('현재 역과 다음 역을 업데이트해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const currentStation = '서울역';
      const nextStation = '강남역';
      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      // When
      const result = await deliveryTrackingService.updateCurrentStation(
        deliveryId,
        currentStation,
        nextStation
      );

      // Then
      expect(result).toBe(true);
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        {
          currentStation,
          nextStation,
          updatedAt: expect.any(Object),
        }
      );
    });

    it('다음 역 없이 현재 역만 업데이트할 수도 있다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const currentStation = '서울역';
      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      // When
      const result = await deliveryTrackingService.updateCurrentStation(deliveryId, currentStation);

      // Then
      expect(result).toBe(true);
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        {
          currentStation,
          updatedAt: expect.any(Object),
        }
      );
    });
  });

  describe('startLocationTracking', () => {
    it('길러 위치 추적을 시작해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const mockLocationCallback = jest.fn();
      (locationService.startLocationTracking as jest.Mock).mockResolvedValue(true);

      // When
      const result = await deliveryTrackingService.startLocationTracking(deliveryId);

      // Then
      expect(result).toBe(true);
      expect(locationService.startLocationTracking).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('위치 추적 시작 실패 시 false를 반환해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      (locationService.startLocationTracking as jest.Mock).mockResolvedValue(false);

      // When
      const result = await deliveryTrackingService.startLocationTracking(deliveryId);

      // Then
      expect(result).toBe(false);
    });

    it('위치가 업데이트되면 Firestore에 저장해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const mockLocation: LocationData = {
        latitude: 37.5665,
        longitude: 126.9780,
        accuracy: 10,
        altitude: 50,
        speed: 1.5,
        heading: 90,
      };
      let locationCallback: ((location: LocationData) => Promise<void>) | undefined;

      (locationService.startLocationTracking as jest.Mock).mockImplementation(
        (callback) => {
          locationCallback = callback;
          return Promise.resolve(true);
        }
      );
      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await deliveryTrackingService.startLocationTracking(deliveryId);

      // When
      if (locationCallback) {
        await locationCallback(mockLocation);
      }

      // Then
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        {
          gillerLocation: mockLocation,
          updatedAt: expect.any(Object),
        }
      );
    });
  });

  describe('getDeliveryInfo', () => {
    it('배송 정보를 가져와야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const mockDocSnapshot = {
        exists: true,
        id: deliveryId,
        data: () => ({
          requestId: 'req-123',
          status: 'in_transit',
          gillerId: 'giller-456',
          gillerLocation: { latitude: 37.5665, longitude: 126.9780 },
          currentStation: '서울역',
          nextStation: '강남역',
          pickupTime: Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 1000)),
          deliveryTime: Timestamp.fromDate(new Date(Date.now() + 20 * 60 * 1000)),
          createdAt: Timestamp.fromDate(new Date(Date.now() - 15 * 60 * 1000)),
          updatedAt: Timestamp.now(),
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockDocSnapshot);

      // When
      const result = await deliveryTrackingService.getDeliveryInfo(deliveryId);

      // Then
      expect(result).not.toBeNull();
      expect(result?.id).toBe(deliveryId);
      expect(result?.status).toBe('in_transit');
      expect(result?.progress).toBe(60);
    });

    it('배송이 존재하지 않으면 null을 반환해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue({ exists: false });

      // When
      const result = await deliveryTrackingService.getDeliveryInfo(deliveryId);

      // Then
      expect(result).toBeNull();
    });

    it('에러 발생 시 null을 반환해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockRejectedValue(new Error('Get error'));

      // When
      const result = await deliveryTrackingService.getDeliveryInfo(deliveryId);

      // Then
      expect(result).toBeNull();
    });

    it('지연된 배송을 올바르게 계산해야 한다', async () => {
      // Given
      const deliveryId = 'delivery-123';
      const pastDeliveryTime = new Date(Date.now() - 10 * 60 * 1000);
      const mockDocSnapshot = {
        exists: true,
        id: deliveryId,
        data: () => ({
          requestId: 'req-123',
          status: 'in_transit',
          gillerId: 'giller-456',
          deliveryTime: Timestamp.fromDate(pastDeliveryTime),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockDocSnapshot);

      // When
      const result = await deliveryTrackingService.getDeliveryInfo(deliveryId);

      // Then
      expect(result?.isDelayed).toBe(true);
      expect(result?.delayMinutes).toBeGreaterThan(0);
    });
  });

  describe('진척률 계산', () => {
    it('상태별로 올바른 진척률을 반환해야 한다', async () => {
      const statuses = [
        { status: 'pending', expectedProgress: 0 },
        { status: 'matched', expectedProgress: 10 },
        { status: 'picked_up', expectedProgress: 30 },
        { status: 'in_transit', expectedProgress: 60 },
        { status: 'delivered', expectedProgress: 100 },
        { status: 'cancelled', expectedProgress: 0 },
      ];

      for (const { status, expectedProgress } of statuses) {
        const deliveryId = 'delivery-123';
        const mockDocSnapshot = {
          exists: true,
          id: deliveryId,
          data: () => ({
            requestId: 'req-123',
            status,
            gillerId: 'giller-456',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          }),
        };

        (doc as jest.Mock).mockReturnValue({});
        (onSnapshot as jest.Mock).mockImplementation((_ref, onNext) => {
          onNext(mockDocSnapshot);
          return jest.fn();
        });

        const mockCallback = jest.fn();
        await deliveryTrackingService.startTracking(deliveryId, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            progress: expectedProgress,
          })
        );

        deliveryTrackingService.stopTracking();
      }
    });
  });
});
