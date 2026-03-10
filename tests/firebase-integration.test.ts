/**
 * Firebase Integration Tests
 * 실제 Firebase Firestore 연동 테스트
 *
 * 주의: 이 테스트는 실제 Firebase DB에 연결됩니다.
 * 개발/테스트용 Firebase 프로젝트에서만 실행하세요.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { createRequest, calculateDeliveryFee } from '../src/services/request-service';
import { createAuction } from '../src/services/auction-service';

describe('Firebase Integration Tests', () => {
  let testRequestId: string;
  let testAuctionId: string;

  beforeAll(() => {
    // Firebase 연결 확인
    expect(db).toBeDefined();
    console.log('✅ Firebase DB 연결됨');
  });

  describe('Firestore - Request Collection', () => {
    test('should create a delivery request', async () => {
      const requestData = {
        requesterId: 'test-user-integration',
        pickupStation: {
          id: 'station-1',
          stationId: 'station-1',
          stationName: '서울역',
          line: '1호선',
          lineCode: '1',
          lat: 37.5547,
          lng: 126.9707,
        },
        deliveryStation: {
          id: 'station-2',
          stationId: 'station-2',
          stationName: '강남역',
          line: '2호선',
          lineCode: '2',
          lat: 37.5172,
          lng: 127.0473,
        },
        packageInfo: {
          size: 'small' as const,
          weight: 'light' as const,
          description: '테스트 물품',
        },
        fee: 5300,
        preferredTime: {
          departureTime: '09:00',
          arrivalTime: '10:00',
        },
        deadline: new Date(Date.now() + 86400000), // 내일
        urgency: 'normal' as const,
      };

      const request = await createRequest(requestData);
      expect(request).toBeDefined();
      expect(request.requestId).toBeDefined();
      expect(request.status).toBe('pending');

      testRequestId = request.requestId;
      console.log('✅ Request 생성됨:', request.requestId);
    }, 30000);

    test('should read the created request', async () => {
      expect(testRequestId).toBeDefined();

      const docRef = doc(db, 'requests', testRequestId);
      const docSnapshot = await getDoc(docRef);

      expect(docSnapshot.exists()).toBe(true);
      const data = docSnapshot.data();
      expect(data?.requesterId).toBe('test-user-integration');
      expect(data?.status).toBe('pending');

      console.log('✅ Request 조회됨:', testRequestId);
    }, 10000);

    test('should query requests by user', async () => {
      const q = query(
        collection(db, 'requests'),
        where('requesterId', '==', 'test-user-integration')
      );

      const snapshot = await getDocs(q);
      expect(snapshot.empty).toBe(false);
      expect(snapshot.size).toBeGreaterThan(0);

      console.log(`✅ ${snapshot.size}개의 Request 조회됨`);
    }, 10000);

    test('should update request status', async () => {
      expect(testRequestId).toBeDefined();

      const docRef = doc(db, 'requests', testRequestId);
      await updateDoc(docRef, {
        status: 'matched',
        matchedGillerId: 'test-giller-1',
        updatedAt: serverTimestamp(),
      });

      const updatedDoc = await getDoc(docRef);
      expect(updatedDoc.exists()).toBe(true);
      expect(updatedDoc.data()?.status).toBe('matched');

      console.log('✅ Request 상태 업데이트됨');
    }, 10000);

    test('should delete the test request', async () => {
      expect(testRequestId).toBeDefined();

      const docRef = doc(db, 'requests', testRequestId);
      await deleteDoc(docRef);

      const deletedDoc = await getDoc(docRef);
      expect(deletedDoc.exists()).toBe(false);

      console.log('✅ Request 삭제됨');
    }, 10000);
  });

  describe('Firestore - Auction Collection', () => {
    test('should create an auction', async () => {
      const auctionData = {
        gllerId: 'test-user-integration',
        gllerName: '테스트 사용자',
        pickupStation: {
          id: 'station-1',
          stationId: 'station-1',
          stationName: '서울역',
          line: '1호선',
          lineCode: '1',
          lat: 37.5547,
          lng: 126.9707,
        },
        deliveryStation: {
          id: 'station-2',
          stationId: 'station-2',
          stationName: '강남역',
          line: '2호선',
          lineCode: '2',
          lat: 37.5172,
          lng: 127.0473,
        },
        packageSize: 'small' as const,
        packageWeight: 1,
        packageDescription: '테스트 물품',
        baseFee: 3500,
        durationMinutes: 30,
      };

      const auction = await createAuction(auctionData);
      expect(auction).toBeDefined();
      expect(auction.auctionId).toBeDefined();
      expect(auction.status).toBe('active');

      testAuctionId = auction.auctionId;
      console.log('✅ Auction 생성됨:', auction.auctionId);
    }, 30000);

    test('should read the created auction', async () => {
      expect(testAuctionId).toBeDefined();

      const docRef = doc(db, 'auctions', testAuctionId);
      const docSnapshot = await getDoc(docRef);

      expect(docSnapshot.exists()).toBe(true);
      const data = docSnapshot.data();
      expect(data?.gllerId).toBe('test-user-integration');
      expect(data?.status).toBe('active');

      console.log('✅ Auction 조회됨:', testAuctionId);
    }, 10000);

    test('should query active auctions', async () => {
      const q = query(
        collection(db, 'auctions'),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      expect(snapshot.size).toBeGreaterThan(0);

      console.log(`✅ ${snapshot.size}개의 진행 중인 Auction 조회됨`);
    }, 10000);

    test('should delete the test auction', async () => {
      expect(testAuctionId).toBeDefined();

      const docRef = doc(db, 'auctions', testAuctionId);
      await deleteDoc(docRef);

      const deletedDoc = await getDoc(docRef);
      expect(deletedDoc.exists()).toBe(false);

      console.log('✅ Auction 삭제됨');
    }, 10000);
  });

  describe('Firestore - Query Performance', () => {
    test('should handle complex queries efficiently', async () => {
      const startTime = Date.now();

      // 복합 쿼리 테스트
      const q = query(
        collection(db, 'requests'),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5000); // 5초 이내
      console.log(`✅ 복합 쿼리 실행 시간: ${elapsed}ms`);
    }, 10000);
  });
});
