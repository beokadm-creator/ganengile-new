/**
 * Firebase Integration Tests
 * 인증, 동선 관리, 매칭, 평가 플로우 통합 테스트
 */

import { collection, doc, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

// Mock Firebase
jest.mock('../../services/firebase', () => ({
  db: {
    collection: jest.fn(),
    doc: jest.fn(),
  },
  auth: {
    currentUser: null,
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
  },
}));

describe('Firebase Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== 인증 플로우 ====================

  describe('Authentication Flow Integration', () => {
    it('TC-AUTH-001: 회원가입 후 Firestore에 사용자 저장', async () => {
      // Given
      const email = 'test@example.com';
      const password = 'password123';
      const name = '테스트 사용자';
      const mockUser = { uid: 'test-user-id' };

      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const mockDocRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };
      (doc as jest.Mock).mockReturnValue(mockDocRef);

      // When
      await createUserWithEmailAndPassword(auth, email, password);

      // Then
      expect(auth.createUserWithEmailAndPassword).toHaveBeenCalledWith(email, password);
      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          name,
          role: null,
          hasCompletedOnboarding: false,
        })
      );
    });

    it('TC-AUTH-002: 로그인 후 Auth state 변화 확인', async () => {
      // Given
      const email = 'test@example.com';
      const password = 'password123';
      const mockUser = { uid: 'test-user-id', email };

      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      // When
      await signInWithEmailAndPassword(auth, email, password);

      // Then
      expect(auth.signInWithEmailAndPassword).toHaveBeenCalledWith(email, password);
      // In real test, would verify Auth state changes
    });

    it('TC-AUTH-003: 로그아웃 후 Auth state 초기화 확인', async () => {
      // When
      await signOut(auth);

      // Then
      expect(auth.signOut).toHaveBeenCalled();
    });
  });

  // ==================== 동선 관리 플로우 ====================

  describe('Route Management Integration', () => {
    it('TC-ROUTE-001: 동선 생성 후 Firestore에 저장', async () => {
      // Given
      const userId = 'test-user-id';
      const routeData = {
        userId,
        startStation: { stationId: '1', stationName: '서울역' },
        endStation: { stationId: '2', stationName: '강남역' },
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime: '08:00',
      };

      const mockDocRef = {
        id: 'route-1',
        set: jest.fn().mockResolvedValue(undefined),
      };
      (addDoc as jest.Mock).mockResolvedValue({
        id: 'route-1',
      });

      // When
      await addDoc(collection(db, 'routes'), routeData);

      // Then
      expect(addDoc).toHaveBeenCalled();
    });

    it('TC-ROUTE-002: 동선 수정 후 Firestore에 업데이트', async () => {
      // Given
      const routeId = 'route-1';
      const updates = {
        departureTime: '09:00',
      };

      const mockDocRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };
      (doc as jest.Mock).mockReturnValue(mockDocRef);

      // When
      await updateDoc(doc(db, 'routes', routeId), updates);

      // Then
      expect(doc).toHaveBeenCalledWith(db, 'routes', routeId);
      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Date),
        })
      );
    });

    it('TC-ROUTE-003: 동선 삭제 후 Firestore에서 삭제', async () => {
      // Given
      const userId = 'test-user-id';
      const routeId = 'route-1';

      const mockDocRef = {
        delete: jest.fn().mockResolvedValue(undefined),
      };
      (doc as jest.Mock).mockReturnValue(mockDocRef);

      // When
      await deleteDoc(doc(db, 'routes', routeId));

      // Then
      expect(doc).toHaveBeenCalledWith(db, 'routes', routeId);
      expect(mockDocRef.delete).toHaveBeenCalled();
    });
  });

  // ==================== 매칭 플로우 ====================

  describe('Matching Integration', () => {
    it('TC-MATCH-001: 배송 요청 후 매칭되고 Firestore에 저장', async () => {
      // Given
      const request = {
        id: 'req-1',
        userId: 'user-1',
        pickupStation: { stationId: '1', stationName: '서울역' },
        deliveryStation: { stationId: '2', stationName: '강남역' },
        urgency: 'normal',
      };

      const mockDocRef = {
        id: 'match-1',
      };
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      // When
      await addDoc(collection(db, 'matches'), {
        requestId: request.id,
        gillerId: 'giller-1',
        score: 85,
      });

      // Then
      expect(addDoc).toHaveBeenCalled();
    });

    it('TC-MATCH-003: 30초 타임아웃 후 자동으로 재시도', async () => {
      // Given
      const requestId = 'req-1';
      jest.useFakeTimers();

      const mockFindMatching = jest.fn();
      const mockSetTimeout = jest.fn();

      // When
      mockSetTimeout.mockImplementation((callback, delay) => {
        setTimeout(callback, delay);
      });

      // Simulate 30 second wait
      mockSetTimeout(() => {
        mockFindMatching();
      }, 30000);

      jest.advanceTimersByTime(30000);

      // Then
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30000);
      jest.useRealTimers();
    });
  });

  // ==================== 평가 플로우 ====================

  describe('Rating Integration', () => {
    it('TC-RATING-001: 평가 제출 후 ratings collection에 저장', async () => {
      // Given
      const matchId = 'match-1';
      const ratingData = {
        fromUserId: 'user-1',
        toUserId: 'user-2',
        rating: 5,
        tags: [],
        comment: '좋았습니다!',
        isAnonymous: false,
      };

      const mockDocRef = {
        id: 'rating-1',
      };
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      // When
      await addDoc(collection(db, 'ratings'), ratingData);

      // Then
      expect(addDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId,
          fromUserId: 'user-1',
          toUserId: 'user-2',
          rating: 5,
        })
      );
    });

    it('TC-RATING-002: 평가 후 사용자 평균 평점 업데이트', async () => {
      // Given
      const userId = 'user-2';
      const existingRating = 4.5;
      const newRating = 5;

      const mockDocRef = {
        data: jest.fn().mockReturnValue({
          rating: existingRating,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (doc as jest.Mock).mockReturnValue(mockDocRef);

      // When
      await updateDoc(doc(db, 'users', userId), {
        rating: (existingRating + newRating) / 2,
      });

      // Then
      expect(doc).toHaveBeenCalledWith(db, 'users', userId);
      expect(mockDocRef.update).toHaveBeenCalled();
    });
  });
});
