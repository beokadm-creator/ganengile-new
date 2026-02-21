/**
 * Notification Service Tests
 * 푸시 알림 시스템 테스트
 *
 * Note: 이 테스트는 Firebase Messaging Mock 설정이 필요합니다.
 * 현재 Jest setup에서는 기본 mock만 제공되므로 일부 테스트가 스킵됩니다.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  sendPushNotification,
  createNotificationService,
} from '../src/services/notification-service';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { NotificationType } from '../src/types/chat';

// Note: Firebase mocks are now in jest.setup.js
// setupFirebaseMocks and clearFirebaseMocks are available globally

describe('Notification Service', () => {
  const testUserId = 'test-user-notification-001';
  const testFCMToken = 'test-fcm-token-12345';
  let notificationService: ReturnType<typeof createNotificationService>;

  beforeEach(() => {
    // Setup Firebase mocks
    setupFirebaseMocks();

    notificationService = createNotificationService();
  });

  afterEach(() => {
    // Clear all Firebase mocks
    clearFirebaseMocks();
  });

  describe('getFCMToken', () => {
    test.skip('should get FCM token successfully', async () => {
      // TODO: Firebase Messaging mock이 개선되면 활성화
      // Mock getToken function
      const { getToken } = require('firebase/messaging');
      getToken.mockResolvedValue(testFCMToken);

      const token = await notificationService.getFCMToken();

      expect(token).toBe(testFCMToken);
    });

    test('should handle missing FCM token gracefully', async () => {
      // Mock getToken to return null
      const { getToken } = require('firebase/messaging');
      getToken.mockResolvedValue(null);

      const token = await notificationService.getFCMToken();

      expect(token).toBeNull();
    });
  });

  describe('sendPushNotification', () => {
    test('should send notification successfully', async () => {
      const notificationData = {
        title: '새로운 배송 요청',
        body: '서울역에서 강남역으로 배송 요청이 있습니다.',
        data: {
          type: 'delivery_request',
          requestId: 'req-123',
        },
      };

      const result = await sendPushNotification(testFCMToken, notificationData);

      expect(result).toBeDefined();
    });

    test('should handle missing token gracefully', async () => {
      const notificationData = {
        title: '테스트',
        body: '내용',
      };

      const result = await sendPushNotification(null, notificationData);

      // 토큰이 없어도 에러가 나지 않아야 함
      expect(result).toBeDefined();
    });
  });

  describe('getNotificationSettings', () => {
    test.skip('should get notification settings', async () => {
      // TODO: Firestore mock 데이터 설정이 필요
      const userSettings = await notificationService.getNotificationSettings(testUserId);

      expect(userSettings).toBeDefined();
      expect(userSettings?.userId).toBe(testUserId);
      expect(userSettings?.enabled).toBe(true);
      expect(userSettings?.settings).toBeDefined();
    });

    test.skip('should return default settings for new user', async () => {
      // TODO: Firestore mock 데이터 설정이 필요
      const userSettings = await notificationService.getNotificationSettings(testUserId);

      expect(userSettings).toBeDefined();
      expect(userSettings?.enabled).toBe(true);
      expect(userSettings?.settings).toBeDefined();
      expect(userSettings?.settings && typeof userSettings.settings === 'object').toBe(true);
    });
  });

  describe('updateNotificationSettings', () => {
    test('should update notification settings', async () => {
      const newSettings = {
        deliveryRequests: true,
        matches: true,
        messages: false,
        promotions: false,
      };

      const result = await notificationService.updateNotificationSettings(
        testUserId,
        newSettings
      );

      expect(result).toBeDefined();
    });
  });

  describe('subscribeToNotifications', () => {
    test.skip('should subscribe to notification settings changes', async () => {
      // TODO: onSnapshot mock이 필요
      const { onSnapshot } = require('firebase/firestore');
      const mockUnsubscribe = jest.fn();
      onSnapshot.mockImplementation(() => mockUnsubscribe);

      // Subscribe
      const unsubscribe = notificationService.subscribeToNotificationSettings(
        testUserId,
        (settings) => {
          expect(settings).toBeDefined();
        }
      );

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');

      // Cleanup
      unsubscribe();
    });
  });
});
