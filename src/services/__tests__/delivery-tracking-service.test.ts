import { DeliveryTrackingService } from '../delivery-tracking-service';
import { getDoc, onSnapshot, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { locationService } from '../location-service';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      toMillis: () => Date.now(),
    })),
    fromDate: jest.fn((date: Date) => ({
      toMillis: () => date.getTime(),
    })),
  },
}));

jest.mock('../location-service', () => ({
  locationService: {
    startLocationTracking: jest.fn(),
    stopLocationTracking: jest.fn(),
  },
}));

describe('DeliveryTrackingService', () => {
  let service: DeliveryTrackingService;

  beforeEach(() => {
    service = new DeliveryTrackingService();
    jest.clearAllMocks();
    (doc as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    service.stopTracking();
  });

  it('subscribes and maps snapshot payload into tracking status', async () => {
    const callback = jest.fn();
    const unsubscribe = jest.fn();

    (onSnapshot as jest.Mock).mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        id: 'delivery-123',
        data: () => ({
          requestId: 'req-123',
          status: 'in_transit',
          gillerId: 'giller-456',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      });

      return unsubscribe;
    });

    await expect(service.startTracking('delivery-123', callback)).resolves.toBe(true);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'delivery-123',
        status: 'in_transit',
        progress: 60,
      })
    );

    service.stopTracking();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('updates delivery status with a fresh timestamp', async () => {
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await expect(service.updateDeliveryStatus('delivery-123', 'picked_up')).resolves.toBe(true);
    expect(updateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        status: 'picked_up',
        updatedAt: expect.any(Object),
      })
    );
  });

  it('loads delivery info when the document exists', async () => {
    const lateDelivery = new Date(Date.now() - 10 * 60 * 1000);
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      id: 'delivery-123',
      data: () => ({
        requestId: 'req-123',
        status: 'in_transit',
        gillerId: 'giller-456',
        deliveryTime: Timestamp.fromDate(lateDelivery),
        updatedAt: Timestamp.now(),
      }),
    });

    const result = await service.getDeliveryInfo('delivery-123');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'delivery-123',
        status: 'in_transit',
        isDelayed: true,
      })
    );
  });

  it('stops location tracking once tracking is stopped', async () => {
    (locationService.startLocationTracking as jest.Mock).mockResolvedValue(true);

    await expect(service.startLocationTracking('delivery-123')).resolves.toBe(true);
    service.stopTracking();

    expect(locationService.stopLocationTracking).toHaveBeenCalled();
  });
});
