import { getDoc, doc, onSnapshot } from 'firebase/firestore';
import { getRequestById, subscribeToRequest } from '../request-service';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => ({ toDate: () => new Date() })),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  },
  onSnapshot: jest.fn(),
}));

jest.mock('../firebase', () => ({
  db: {},
}));

jest.mock('../beta1-engine-service', () => ({
  bootstrapRequestCreationEngine: jest.fn(),
}));

jest.mock('../config-service', () => ({
  getTravelTimeConfig: jest.fn(),
}));

jest.mock('../matching-service', () => ({
  processMatchingForRequest: jest.fn(),
}));

jest.mock('../pricing-service', () => ({
  calculatePhase1DeliveryFee: jest.fn(),
  PRICING_POLICY: {},
}));

jest.mock('../pricing-policy-config-service', () => ({
  getPricingPolicyConfig: jest.fn(),
}));

jest.mock('../route-pricing-override-service', () => ({
  getRoutePricingOverride: jest.fn(),
}));

describe('request-service normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockReturnValue({});
  });

  it('normalizes address, recipient, and photo fields from request documents', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      id: 'req-1',
      data: () => ({
        requesterId: 'user-1',
        pickupStation: { stationId: 's1', stationName: '강남역', line: '2호선' },
        deliveryStation: { stationId: 's2', stationName: '잠실역', line: '2호선' },
        packageInfo: {
          size: 'small',
          weight: 'light',
          description: '서류',
        },
        initialNegotiationFee: 7000,
        deadline: { toDate: () => new Date('2026-04-11T12:00:00Z') },
        status: 'pending',
        pickupAddressDetail: {
          roadAddress: '서울 강남구 테헤란로 1',
          detailAddress: '101호',
          fullAddress: '서울 강남구 테헤란로 1 101호',
        },
        deliveryAddressDetail: {
          roadAddress: '서울 송파구 올림픽로 2',
          detailAddress: '202호',
          fullAddress: '서울 송파구 올림픽로 2 202호',
        },
        recipientName: '홍길동',
        recipientPhone: '01012345678',
        selectedPhotoIds: ['https://example.com/photo-1.jpg'],
      }),
    });

    const request = await getRequestById('req-1');

    expect(request).toEqual(
      expect.objectContaining({
        requestId: 'req-1',
        recipientName: '홍길동',
        recipientPhone: '01012345678',
        selectedPhotoIds: ['https://example.com/photo-1.jpg'],
        pickupAddress: expect.objectContaining({
          fullAddress: '서울 강남구 테헤란로 1 101호',
        }),
        deliveryAddress: expect.objectContaining({
          fullAddress: '서울 송파구 올림픽로 2 202호',
        }),
        packageInfo: expect.objectContaining({
          imageUrl: 'https://example.com/photo-1.jpg',
        }),
      })
    );
  });

  it('normalizes request snapshots in subscribeToRequest', () => {
    const callback = jest.fn();
    const unsubscribe = jest.fn();

    (onSnapshot as jest.Mock).mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        id: 'req-2',
        data: () => ({
          requesterId: 'user-2',
          pickupStation: { stationId: 's1', stationName: '강남역', line: '2호선' },
          deliveryStation: { stationId: 's2', stationName: '잠실역', line: '2호선' },
          packageInfo: {
            size: 'small',
            weight: 'light',
            description: '노트북',
          },
          initialNegotiationFee: 12000,
          deadline: { toDate: () => new Date('2026-04-11T12:00:00Z') },
          status: 'pending',
          recipientName: '김철수',
          selectedPhotoIds: ['https://example.com/photo-2.jpg'],
        }),
      });

      return unsubscribe;
    });

    const stop = subscribeToRequest('req-2', callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-2',
        recipientName: '김철수',
        selectedPhotoIds: ['https://example.com/photo-2.jpg'],
        packageInfo: expect.objectContaining({
          imageUrl: 'https://example.com/photo-2.jpg',
        }),
      })
    );

    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
