/**
 * Matching Service Unit Tests
 */

import {
  findMatchesForRequest,
  fetchActiveGillerRoutes,
  acceptRequest,
  declineRequest,
  findGiller,
  convertToDeliveryRequest,
  getPendingGillerRequests,
} from '../matching-service';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  },
}));

// Mock other services
jest.mock('../delivery-service', () => ({
  gillerAcceptRequest: jest.fn(),
}));

jest.mock('../matching-notification', () => ({
  sendMatchFoundNotification: jest.fn(),
}));

jest.mock('../chat-service', () => ({
  createChatService: jest.fn(),
  getChatRoomByRequestId: jest.fn(),
}));

jest.mock('../../data/matching-engine', () => ({
  matchGillersToRequest: jest.fn(),
  getTopMatches: jest.fn(),
}));

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { gillerAcceptRequest } from '../delivery-service';
import { sendMatchFoundNotification } from '../matching-notification';
import { createChatService, getChatRoomByRequestId } from '../chat-service';
import { matchGillersToRequest } from '../../data/matching-engine';

describe('Matching Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDocs as jest.Mock).mockReset();
    (getDoc as jest.Mock).mockReset();
  });

  describe('fetchActiveGillerRoutes', () => {
    it('활성화된 길러 경로를 가져와야 한다', async () => {
      // Given
      const mockRoutes = [
        {
          id: 'route-1',
          data: () => ({
            userId: 'giller-1',
            gillerName: '길러A',
            startStation: { stationName: '서울역' },
            endStation: { stationName: '강남역' },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3, 4, 5],
            isActive: true,
          }),
        },
      ];
      const mockQuery = { _collectionName: 'routes' };
      const mockSnapshot = {
        forEach: (callback) => {
          mockRoutes.forEach((route, index) => callback(route, index));
        },
      };

      (collection as jest.Mock).mockReturnValue(mockQuery);
      (where as jest.Mock).mockReturnValue(mockQuery);
      (query as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      // When
      const result = await fetchActiveGillerRoutes();

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].gillerId).toBe('giller-1');
      expect(result[0].gillerName).toBe('길러A');
    });

    it('역 정보를 찾을 수 없는 경로는 건너뛰어야 한다', async () => {
      // Given
      const mockRoutes = [
        {
          id: 'route-1',
          data: () => ({
            userId: 'giller-1',
            gillerName: '길러A',
            startStation: { stationName: '알 수 없는 역' },
            endStation: { stationName: '강남역' },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3, 4, 5],
            isActive: true,
          }),
        },
      ];
      const mockQuery = { _collectionName: 'routes' };
      const mockSnapshot = {
        forEach: (callback) => {
          mockRoutes.forEach((route, index) => callback(route, index));
        },
      };

      (collection as jest.Mock).mockReturnValue(mockQuery);
      (where as jest.Mock).mockReturnValue(mockQuery);
      (query as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      // When
      const result = await fetchActiveGillerRoutes();

      // Then
      expect(result).toHaveLength(0);
    });

    it('에러 발생 시 에러를 던져야 한다', async () => {
      // Given
      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      // When & Then
      await expect(fetchActiveGillerRoutes()).rejects.toThrow();
    });
  });

  describe('findMatchesForRequest', () => {
    it('요청에 대한 매칭을 찾아야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const mockRequestDoc = {
        exists: () => true,
        id: requestId,
        data: () => ({
          pickupStation: { stationName: '서울역' },
          deliveryStation: { stationName: '강남역' },
          packageInfo: {
            size: 'small',
            weight: 'light',
          },
        }),
      };
      const mockMatches = [
        {
          gillerId: 'giller-1',
          gillerName: '길러A',
          totalScore: 95,
          routeMatchScore: 90,
          timeMatchScore: 85,
          ratingScore: 90,
          completionRateScore: 95,
          routeDetails: {
            travelTime: 1200,
            isExpressAvailable: true,
            transferCount: 1,
            congestionLevel: 'low',
          },
          reasons: ['좋은 경로 매칭'],
        },
      ];

      const mockRouteSnapshot = {
        forEach: (callback) => callback({
          id: 'route-1',
          data: () => ({
            userId: 'giller-1',
            gillerName: '길러A',
            startStation: { stationName: '서울역' },
            endStation: { stationName: '강남역' },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            isActive: true,
            rating: 4.5,
            totalDeliveries: 50,
            completedDeliveries: 48,
          }),
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockRequestDoc);
      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue(mockRouteSnapshot);
      (matchGillersToRequest as jest.Mock).mockReturnValue(mockMatches);

      // When
      const result = await findMatchesForRequest(requestId);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].gillerId).toBe('giller-1');
    });

    it('요청이 존재하지 않으면 에러를 던져야 한다', async () => {
      // Given
      const requestId = 'req-123';
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      // When
      const result = await findMatchesForRequest(requestId);

      // Then
      expect(result).toEqual([]);
    });

    it('topN 파라미터로 결과 수를 제한해야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const mockRequestDoc = {
        exists: () => true,
        id: requestId,
        data: () => ({
          pickupStation: { stationName: '서울역' },
          deliveryStation: { stationName: '강남역' },
          packageInfo: { size: 'small', weight: 'light' },
        }),
      };
      const mockMatches = Array.from({ length: 10 }, (_, i) => ({
        gillerId: `giller-${i}`,
        gillerName: `길러${i}`,
        totalScore: 100 - i,
        routeMatchScore: 90 - i,
        timeMatchScore: 80 - i,
        ratingScore: 70 - i,
        completionRateScore: 60 - i,
        routeDetails: {
          travelTime: 1200,
          isExpressAvailable: true,
          transferCount: 1,
          congestionLevel: 'low',
        },
        reasons: [],
      }));
      const mockRouteSnapshot = {
        forEach: (callback) => callback({
          id: 'route-1',
          data: () => ({
            userId: 'giller-1',
            gillerName: '길러A',
            startStation: { stationName: '서울역' },
            endStation: { stationName: '강남역' },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            isActive: true,
          }),
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockRequestDoc);
      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue(mockRouteSnapshot);
      (matchGillersToRequest as jest.Mock).mockReturnValue(mockMatches);

      // When
      const result = await findMatchesForRequest(requestId, 3);

      // Then
      expect(result).toHaveLength(1);
    });
  });

  describe('acceptRequest', () => {
    it('요청을 수락하고 채팅방을 생성해야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const gillerId = 'giller-456';
      const mockRequestDoc = {
        exists: () => true,
        data: () => ({
          status: 'matched',
          requesterId: 'gller-789',
          pickupStation: { stationName: '서울역' },
          deliveryStation: { stationName: '강남역' },
          fee: { totalFee: 5000 },
        }),
      };
      const mockGllerData = { name: '이용자', profileImage: 'url' };
      const mockGillerData = { name: '길러', profileImage: 'url' };
      const mockDeliveryId = 'delivery-123';
      const mockChatRoom = { chatRoomId: 'chat-123' };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockRequestDoc)
        .mockResolvedValueOnce({ exists: () => true, data: () => mockGllerData })
        .mockResolvedValueOnce({ exists: () => true, data: () => mockGillerData });
      (gillerAcceptRequest as jest.Mock).mockResolvedValue({
        success: true,
        deliveryId: mockDeliveryId,
      });
      (getChatRoomByRequestId as jest.Mock).mockResolvedValue(null);
      (createChatService as jest.Mock).mockReturnValue({
        createChatRoom: jest.fn().mockResolvedValue(undefined),
        sendSystemMessage: jest.fn().mockResolvedValue(undefined),
      });
      (getChatRoomByRequestId as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockChatRoom);

      // When
      const result = await acceptRequest(requestId, gillerId);

      // Then
      expect(result.success).toBe(true);
      expect(result.deliveryId).toBe(mockDeliveryId);
    });

    it('이미 매칭된 요청은 수락할 수 없다', async () => {
      // Given
      const requestId = 'req-123';
      const gillerId = 'giller-456';
      const mockRequestDoc = {
        exists: () => true,
        data: () => ({
          status: 'in_progress',
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockRequestDoc);

      // When
      const result = await acceptRequest(requestId, gillerId);

      // Then
      expect(result.success).toBe(false);
      expect(result.message).toContain('현재 처리할 수 없는 요청');
    });

    it('요청이 존재하지 않으면 실패해야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const gillerId = 'giller-456';
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      // When
      const result = await acceptRequest(requestId, gillerId);

      // Then
      expect(result.success).toBe(false);
      expect(result.message).toContain('찾을 수 없습니다');
    });

    it('미션 보드 요청은 레거시 수락 경로를 막아야 한다', async () => {
      const requestId = 'req-beta1';
      const gillerId = 'giller-456';
      const mockRequestDoc = {
        exists: () => true,
        data: () => ({
          status: 'pending',
          beta1RequestStatus: 'match_pending',
          missionProgress: { totalMissionCount: 3 },
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockRequestDoc);

      const result = await acceptRequest(requestId, gillerId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('미션 보드');
      expect(gillerAcceptRequest).not.toHaveBeenCalled();
    });
  });

  describe('declineRequest', () => {
    it('요청을 거절해야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const gillerId = 'giller-456';
      const mockMatchSnapshot = {
        empty: false,
        docs: [{ id: 'match-1' }],
      };
      const mockQuery = {};

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (query as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue(mockMatchSnapshot);
      (doc as jest.Mock).mockReturnValue({});
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      // When
      const result = await declineRequest(requestId, gillerId);

      // Then
      expect(result.success).toBe(true);
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        { status: 'declined', declinedAt: expect.any(Date) }
      );
    });

    it('매칭 정보를 찾을 수 없으면 실패해야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const gillerId = 'giller-456';
      const mockQuery = {};
      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (query as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue({ empty: true });

      // When
      const result = await declineRequest(requestId, gillerId);

      // Then
      expect(result.success).toBe(false);
      expect(result.message).toContain('찾을 수 없습니다');
    });
  });

  describe('findGiller', () => {
    it('최적의 길러를 찾아야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const mockMatches = [
        {
          gillerId: 'giller-1',
          gillerName: '길러A',
          rank: 1,
          score: 95,
          routeMatchScore: 90,
          timeMatchScore: 85,
          ratingScore: 4.8,
          completionRateScore: 95,
          routeDetails: {
            travelTime: 1200,
            isExpressAvailable: true,
            transferCount: 1,
            congestionLevel: 'low',
          },
          rating: 4.8,
          completedDeliveries: 50,
          estimatedFee: 5000,
          profileImage: 'url',
          reasons: [],
        },
      ];
      const mockRequestDoc = {
        exists: () => true,
        id: requestId,
        data: () => ({
          pickupStation: { stationName: '서울역' },
          deliveryStation: { stationName: '강남역' },
          fee: { totalFee: 5000 },
        }),
      };
      const mockRouteSnapshot = {
        forEach: (callback) => callback({
          id: 'route-1',
          data: () => ({
            userId: 'giller-1',
            gillerName: '길러A',
            startStation: { stationName: '서울역' },
            endStation: { stationName: '강남역' },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            isActive: true,
          }),
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockRequestDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            fee: { totalFee: 5000 },
          }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            name: '길러A',
            rating: 4.8,
            gillerInfo: { totalDeliveries: 50, completedDeliveries: 50 },
            profileImage: 'url',
          }),
        })
        .mockResolvedValue({
          exists: () => true,
          data: () => ({
            name: '길러A',
            rating: 4.8,
            gillerInfo: { totalDeliveries: 50, completedDeliveries: 50 },
            profileImage: 'url',
            fee: { totalFee: 5000 },
          }),
        });
      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue(mockRouteSnapshot);
      (matchGillersToRequest as jest.Mock).mockReturnValue(mockMatches);

      // When
      const result = await findGiller(requestId);

      // Then
      expect(result.success).toBe(true);
      expect(result.data?.giller.id).toBe('giller-1');
      expect(result.data?.giller.rating).toBe(4.8);
      expect(result.data?.rank).toBe(1);
    });

    it('매칭 가능한 길러가 없으면 실패해야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const mockRequestDoc = {
        exists: () => true,
        id: requestId,
        data: () => ({
          pickupStation: { stationName: '서울역' },
          deliveryStation: { stationName: '강남역' },
          fee: { totalFee: 5000 },
        }),
      };
      const emptyRouteSnapshot = { forEach: () => undefined };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockRequestDoc);
      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue(emptyRouteSnapshot);
      (matchGillersToRequest as jest.Mock).mockReturnValue([]);

      // When
      const result = await findGiller(requestId);

      // Then
      expect(result.success).toBe(false);
      expect(result.error).toContain('찾지 못했습니다');
    });

    it('예상 시간을 계산해야 한다', async () => {
      // Given
      const requestId = 'req-123';
      const mockMatches = [
        {
          gillerId: 'giller-1',
          gillerName: '길러A',
          rank: 1,
          totalScore: 95,
          routeMatchScore: 90,
          timeMatchScore: 85,
          ratingScore: 4.8,
          completionRateScore: 95,
          estimatedFee: 5000,
          rating: 4.8,
          completedDeliveries: 50,
          reasons: [],
          routeDetails: {
            travelTime: 1200,
            isExpressAvailable: true,
            transferCount: 1,
            congestionLevel: 'low',
          },
        },
      ];
      const mockRequestDoc = {
        exists: () => true,
        id: requestId,
        data: () => ({
          pickupStation: { stationName: '서울역' },
          deliveryStation: { stationName: '강남역' },
          fee: { totalFee: 5000 },
        }),
      };
      const mockRouteSnapshot = {
        forEach: (callback) => callback({
          id: 'route-1',
          data: () => ({
            userId: 'giller-1',
            gillerName: '길러A',
            startStation: { stationName: '서울역' },
            endStation: { stationName: '강남역' },
            departureTime: '08:30',
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            isActive: true,
          }),
        }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockRequestDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            fee: { totalFee: 5000 },
          }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            name: '길러A',
            rating: 4.8,
            gillerInfo: { totalDeliveries: 50, completedDeliveries: 50 },
          }),
        })
        .mockResolvedValue({
          exists: () => true,
          data: () => ({
            name: '길러A',
            rating: 4.8,
            gillerInfo: { totalDeliveries: 50, completedDeliveries: 50 },
            fee: { totalFee: 5000 },
          }),
        });
      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue(mockRouteSnapshot);
      (matchGillersToRequest as jest.Mock).mockReturnValue(mockMatches);

      // When
      const result = await findGiller(requestId);

      // Then
      expect(result.success).toBe(true);
      expect(result.data?.giller.estimatedTime).toBeLessThan(20);
    });
  });

  describe('getPendingGillerRequests', () => {
    it('미션 보드 요청은 레거시 요청 목록에서 제외해야 한다', async () => {
      const mockSnapshot = {
        forEach: (callback: (docItem: { id: string; data: () => Record<string, unknown> }) => void) => {
          [
            {
              id: 'legacy-request',
              data: () => ({
                status: 'pending',
                requesterName: '레거시 요청',
                fee: { totalFee: 5000 },
                pickupStation: { stationName: '서울역' },
                deliveryStation: { stationName: '강남역' },
              }),
            },
            {
              id: 'beta1-request',
              data: () => ({
                status: 'pending',
                beta1RequestStatus: 'match_pending',
                missionProgress: { totalMissionCount: 2 },
                requesterName: '새 요청',
                fee: { totalFee: 7000 },
                pickupStation: { stationName: '시청역' },
                deliveryStation: { stationName: '잠실역' },
              }),
            },
          ].forEach(callback);
        },
      };

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getPendingGillerRequests();

      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe('legacy-request');
    });
  });

  describe('convertToDeliveryRequest', () => {
    it('Firestore 문서를 DeliveryRequest 형식으로 변환해야 한다', () => {
      // Given
      const requestDoc = {
        id: 'req-123',
        pickupStation: { stationName: '서울역' },
        deliveryStation: { stationName: '강남역' },
        packageInfo: {
          size: 'small',
          weight: 'light',
        },
      };

      // When
      const result = convertToDeliveryRequest(requestDoc);

      // Then
      expect(result.pickupStation).toBe('서울역');
      expect(result.deliveryStation).toBe('강남역');
      expect(result.time).toBe('08:00');
      expect(typeof result.dayOfWeek).toBe('string');
    });

    it('무게를 올바르게 변환해야 한다', () => {
      // Given
      const requestDoc = {
        id: 'req-123',
        pickupStation: { stationName: '서울역' },
        deliveryStation: { stationName: '강남역' },
        packageInfo: {
          size: 'small',
          weight: 'heavy',
        },
      };

      // When
      const result = convertToDeliveryRequest(requestDoc);

      // Then
      expect(result.pickupStation).toBe('서울역');
      expect(result.deliveryStation).toBe('강남역');
    });
  });
});
