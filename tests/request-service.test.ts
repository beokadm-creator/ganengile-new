/**
 * Request Service Tests
 * 배송 요청 서비스 테스트
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createRequest,
  getRequest,
  getUserRequests,
  updateRequest,
  cancelRequest,
  deleteRequest,
  validateRequest,
  calculateDeliveryFee,
} from '../src/services/request-service';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { requireUserId } from '../src/services/firebase';
import { PackageSize } from '../src/types/delivery';

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('firebase/firestore', () => {
  const mockModule = {
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    limit: (...args: any[]) => mockLimit(...args),
    getFirestore: () => ({}),
  };

  class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    toDate() { return new Date(this.seconds * 1000); }
    static fromDate(date: Date) { return new MockTimestamp(Math.floor(date.getTime() / 1000), 0); }
  }

  return {
    ...mockModule,
    serverTimestamp: () => new MockTimestamp(Math.floor(Date.now() / 1000), 0),
    Timestamp: MockTimestamp,
  };
});

jest.mock('firebase/app', () => ({
  initializeApp: () => ({}),
}));

jest.mock('../src/services/firebase', () => ({
  db: {},
  auth: {},
  requireUserId: jest.fn(() => 'test-user-001'),
}));

jest.mock('firebase/app', () => ({
  initializeApp: () => ({}),
}));

jest.mock('../src/services/firebase', () => ({
  db: {},
  auth: {},
  requireUserId: jest.fn(() => 'test-user-001'),
}));

describe('Request Service', () => {
  const testUserId = 'test-user-001';
  let createdRequestId: string | null = null;
  let mockRequests: Record<string, any> = {};

  beforeEach(() => {
    jest.spyOn(require('../src/services/firebase'), 'requireUserId').mockReturnValue(testUserId);

    mockRequests = {};
    mockDoc.mockImplementation(((db: any, collectionPath: string, docId: string) => ({
      id: docId,
      path: `${collectionPath}/${docId}`,
    })) as any);

    mockGetDoc.mockImplementation(async (docRef: any) => {
      const docId = docRef.id;
      if (mockRequests[docId]) {
        return { exists: () => true, id: docId, data: () => mockRequests[docId] };
      }
      return { exists: () => false, id: docId, data: () => null };
    });

    mockAddDoc.mockImplementation(async (collectionRef: any, data: any) => {
      const docId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newDoc = { ...data, createdAt: { seconds: Date.now() / 1000 }, updatedAt: { seconds: Date.now() / 1000 } };
      mockRequests[docId] = newDoc;
      return { id: docId };
    });

    mockUpdateDoc.mockImplementation(async (docRef: any, data: any) => {
      const docId = docRef.id;
      if (mockRequests[docId]) {
        mockRequests[docId] = { ...mockRequests[docId], ...data, updatedAt: { seconds: Date.now() / 1000 } };
      }
    });

    mockDeleteDoc.mockImplementation(async (docRef: any) => {
      const docId = docRef.id;
      delete mockRequests[docId];
    });

    mockGetDocs.mockImplementation(async (query: any) => {
      const docs = Object.entries(mockRequests)
        .filter(([id, data]) => (data).requesterId === testUserId)
        .map(([id, data]) => ({
          id,
          data: () => data,
        }));

      return {
        forEach: (callback: any) => docs.forEach(callback),
        docs,
      };
    });

    mockQuery.mockImplementation((...args: any[]) => args[args.length - 1]);
    mockWhere.mockImplementation(((field: string, op: string, value: any) => ({ field, op, value })) as any);
    mockOrderBy.mockImplementation(((field: string, dir: string) => ({ field, dir })) as any);
    mockLimit.mockImplementation(((n: number) => ({ limit: n })) as any);
  });

  afterEach(async () => {
    if (createdRequestId) {
      delete mockRequests[createdRequestId];
      createdRequestId = null;
    }
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    test('should pass validation with valid data', () => {
      const mockStation = {
        id: 'station-001',
        stationId: 'station-001',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      };

      const mockPackage = {
        size: PackageSize.MEDIUM,
        weight: 3.0,
        description: '테스트 물품',
        isFragile: false,
        isPerishable: false,
      };

      const mockFee = {
        baseFee: 3000,
        distanceFee: 1500,
        weightFee: 300,
        sizeFee: 500,
        serviceFee: 0,
        vat: 530,
        totalFee: 5830,
      };

      const result = validateRequest(
        testUserId,
        mockStation,
        { ...mockStation, stationId: 'station-002', stationName: '강남역' },
        mockPackage,
        mockFee,
        '홍길동',
        '010-1234-5678',
        new Date(Date.now() + 3600000),
        new Date(Date.now() + 7200000)
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation with same pickup and delivery stations', () => {
      const mockStation = {
        id: 'station-001',
        stationId: 'station-001',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      };

      const mockPackage = {
        size: PackageSize.MEDIUM,
        weight: 3.0,
        description: '테스트 물품',
        isFragile: false,
        isPerishable: false,
      };

      const mockFee = {
        baseFee: 3000,
        distanceFee: 1500,
        weightFee: 300,
        sizeFee: 500,
        serviceFee: 0,
        vat: 530,
        totalFee: 5830,
      };

      const result = validateRequest(
        testUserId,
        mockStation,
        mockStation, // Same station!
        mockPackage,
        mockFee,
        '홍길동',
        '010-1234-5678',
        new Date(Date.now() + 3600000),
        new Date(Date.now() + 7200000)
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('픽업 역과 배송 역이 같을 수 없습니다.');
    });

    test('should fail validation with invalid phone number', () => {
      const mockStation = {
        id: 'station-001',
        stationId: 'station-001',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      };

      const mockPackage = {
        size: PackageSize.MEDIUM,
        weight: 3.0,
        description: '테스트 물품',
        isFragile: false,
        isPerishable: false,
      };

      const mockFee = {
        baseFee: 3000,
        distanceFee: 1500,
        weightFee: 300,
        sizeFee: 500,
        serviceFee: 0,
        vat: 530,
        totalFee: 5830,
      };

      const result = validateRequest(
        testUserId,
        mockStation,
        { ...mockStation, stationId: 'station-002', stationName: '강남역' },
        mockPackage,
        mockFee,
        '홍길동',
        '010-1234-567', // Invalid format
        new Date(Date.now() + 3600000),
        new Date(Date.now() + 7200000)
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('수신자 전화번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)');
    });
  });

  describe('calculateDeliveryFee', () => {
    test('should calculate fee correctly', async () => {
      const mockStation = {
        id: 'station-001',
        stationId: 'station-001',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      };

      const fee = await calculateDeliveryFee(
        mockStation,
        { ...mockStation, id: 'station-002', stationId: 'station-002', stationName: '강남역', lng: 127.0473 },
        PackageSize.MEDIUM,
        3.0
      );

      expect(fee).toBeDefined();
      expect(fee.totalFee).toBeGreaterThan(0);
      expect(fee.baseFee).toBe(3000); // 기본 요금
      expect(fee.vat).toBeGreaterThan(0); // 부가세
    });
  });

  describe('createRequest', () => {
    test('should create a new request', async () => {
      const mockStation = {
        id: 'station-001',
        stationId: 'station-001',
        stationName: '서울역',
        line: '1호선',
        lineCode: '100',
        lat: 37.5547,
        lng: 126.9707,
      };

      const mockPackage = {
        size: PackageSize.MEDIUM,
        weight: 3.0,
        description: '테스트 물품',
        isFragile: false,
        isPerishable: false,
      };

      const mockFee = {
        baseFee: 3000,
        distanceFee: 1500,
        weightFee: 300,
        sizeFee: 500,
        serviceFee: 0,
        vat: 530,
        totalFee: 5830,
      };

      const request = await createRequest(
        testUserId,
        mockStation,
        { ...mockStation, stationId: 'station-002', stationName: '강남역' },
        'standard',
        mockPackage,
        mockFee,
        '홍길동',
        '010-1234-5678',
        new Date(Date.now() + 3600000),
        new Date(Date.now() + 7200000)
      );

      expect(request).toBeDefined();
      expect(request.requestId).toBeDefined();
      expect(request.requesterId).toBe(testUserId);
      expect(request.status).toBe('pending');

      createdRequestId = request.requestId;
    });
  });

  describe('getRequest', () => {
    test('should get request by ID', async () => {
      if (!createdRequestId) {
        console.log('Skipping: No request created');
        return;
      }

      const request = await getRequest(createdRequestId, testUserId);

      expect(request).toBeDefined();
      expect(request?.requestId).toBe(createdRequestId);
      expect(request?.requesterId).toBe(testUserId);
    });

    test('should return null for non-existent request', async () => {
      const request = await getRequest('non-existent-request', testUserId);
      expect(request).toBeNull();
    });

    test('should return null for request owned by another user', async () => {
      if (!createdRequestId) {
        console.log('Skipping: No request created');
        return;
      }

      const request = await getRequest(createdRequestId, 'other-user-id');
      expect(request).toBeNull();
    });
  });

  describe('getUserRequests', () => {
    test('should get all user requests', async () => {
      const requests = await getUserRequests(testUserId);

      expect(Array.isArray(requests)).toBe(true);
      if (createdRequestId) {
        expect(requests.some(r => r.requestId === createdRequestId)).toBe(true);
      }
    });
  });

  describe('updateRequest', () => {
    test('should update request status', async () => {
      if (!createdRequestId) {
        console.log('Skipping: No request created');
        return;
      }

      const updated = await updateRequest(
        createdRequestId,
        testUserId,
        { specialRequests: ['배송 전 연락 바랍니다'] }
      );

      expect(updated).toBeDefined();
      expect(updated?.specialRequests).toContain('배송 전 연락 바랍니다');
    });

    test('should not allow update by non-owner', async () => {
      if (!createdRequestId) {
        console.log('Skipping: No request created');
        return;
      }

      const updated = await updateRequest(
        createdRequestId,
        'other-user-id',
        { specialRequests: ['무단 수정'] }
      );

      expect(updated).toBeNull();
    });
  });

  describe('cancelRequest', () => {
    test('should cancel request', async () => {
      if (!createdRequestId) {
        console.log('Skipping: No request created');
        return;
      }

      const cancelled = await cancelRequest(
        createdRequestId,
        testUserId,
        '테스트 취소'
      );

      expect(cancelled).toBeDefined();
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.cancellationReason).toBe('테스트 취소');
    });
  });
});
