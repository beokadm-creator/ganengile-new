/**
 * Matching Service Tests
 * 현재 계약 기준 smoke 회귀 테스트
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import * as matchingService from '../src/services/matching-service';

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(() => ({})),
  doc: jest.fn((_db, collectionName: string, id: string) => ({ collectionName, id })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => new Date()),
  updateDoc: jest.fn(),
  where: jest.fn(() => ({})),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
  },
}));

jest.mock('../src/services/delivery-service', () => ({
  gillerAcceptRequest: jest.fn(),
}));

jest.mock('../src/services/matching-notification', () => ({
  sendMatchFoundNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/chat-service', () => ({
  createChatService: jest.fn(() => ({
    createChatRoom: jest.fn().mockResolvedValue(undefined),
    sendSystemMessage: jest.fn().mockResolvedValue(undefined),
  })),
  getChatRoomByRequestId: jest.fn(),
}));

jest.mock('../src/data/matching-engine', () => ({
  getTopMatches: jest.fn((matches: unknown[]) => matches),
  matchGillersToRequest: jest.fn(() => []),
}));

import { addDoc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { gillerAcceptRequest } from '../src/services/delivery-service';
import { createChatService, getChatRoomByRequestId } from '../src/services/chat-service';

describe('Matching Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchUserInfo maps giller profile fields', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: '길러A',
        rating: 4.7,
        profileImage: 'https://example.com/giller.png',
        gillerInfo: {
          totalDeliveries: 12,
          completedDeliveries: 11,
        },
      }),
    });

    const result = await matchingService.fetchUserInfo('giller-001');

    expect(result).toEqual({
      name: '길러A',
      rating: 4.7,
      totalDeliveries: 12,
      completedDeliveries: 11,
      profileImage: 'https://example.com/giller.png',
    });
  });

  test('fetchUserInfo returns default values when the user is missing', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    const result = await matchingService.fetchUserInfo('missing-user');

    expect(result).toEqual({
      name: 'giller',
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
      profileImage: undefined,
    });
  });

  test('acceptRequest returns failure when the request is missing', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    const result = await matchingService.acceptRequest('missing-request', 'giller-001');

    expect(result).toEqual({
      success: false,
      message: '요청을 찾을 수 없습니다.',
    });
  });

  test('acceptRequest creates a chat room after a successful accept', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          requesterId: 'requester-001',
          status: 'matched',
          pickupStation: { stationName: '강남역' },
          deliveryStation: { stationName: '서울역' },
          fee: { totalFee: 5500 },
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: '요청자',
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: '길러',
        }),
      });

    (gillerAcceptRequest as jest.Mock).mockResolvedValue({
      success: true,
      message: '배송을 수락했습니다.',
      deliveryId: 'delivery-001',
    });
    (getChatRoomByRequestId as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ chatRoomId: 'chat-room-001' });

    const result = await matchingService.acceptRequest('request-001', 'giller-001');

    expect(result.success).toBe(true);
    expect(createChatService).toHaveBeenCalled();
  });

  test('declineRequest marks matching documents as declined', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      empty: false,
      docs: [
        { id: 'match-001' },
        { id: 'match-002' },
      ],
    });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await matchingService.declineRequest('request-001', 'giller-001');

    expect(result).toEqual({
      success: true,
      message: '요청을 거절했습니다.',
    });
    expect(updateDoc).toHaveBeenCalledTimes(2);
  });

  test('processMatchingForRequest returns 0 when no match candidates are found', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    const result = await matchingService.processMatchingForRequest('missing-request');

    expect(result).toBe(0);
    expect(addDoc).not.toHaveBeenCalled();
  });
});
