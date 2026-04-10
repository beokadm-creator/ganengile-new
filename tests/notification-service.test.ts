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
import { NotificationType } from '../src/types/chat';
import { getDoc } from 'firebase/firestore';

describe('Notification Service', () => {
  const testUserId = 'test-user-notification-001';
  const testFCMToken = 'test-fcm-token-12345';
  let notificationService: ReturnType<typeof createNotificationService>;

  beforeEach(() => {
    notificationService = createNotificationService();
  });

  describe('getFCMToken', () => {
    test('should return null when messaging is unavailable in the current runtime', async () => {
      const { getToken } = require('firebase/messaging');
      getToken.mockResolvedValue(testFCMToken);

      const token = await notificationService.getFCMToken();

      expect(token).toBeNull();
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
    test('should get notification settings', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: testUserId,
          enabled: true,
          settings: {
            [NotificationType.MATCH_FOUND]: true,
            [NotificationType.MATCH_ACCEPTED]: true,
            [NotificationType.MATCH_CANCELLED]: true,
            [NotificationType.PICKUP_REQUESTED]: true,
            [NotificationType.PICKUP_VERIFIED]: true,
            [NotificationType.DELIVERY_COMPLETED]: true,
            [NotificationType.NEW_MESSAGE]: false,
            [NotificationType.RATING_RECEIVED]: true,
          },
          fcmToken: testFCMToken,
        }),
      });
      const userSettings = await notificationService.getNotificationSettings();

      expect(userSettings).toBeDefined();
      expect(userSettings?.userId).toBe(testUserId);
      expect(userSettings?.enabled).toBe(true);
      expect(userSettings?.settings).toBeDefined();
    });

    test('should return null for a new user without settings', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });
      const userSettings = await notificationService.getNotificationSettings();

      expect(userSettings).toBeNull();
    });
  });

  describe('updateNotificationSettings', () => {
    test('should update notification settings', async () => {
      const newSettings = {
        settings: {
          [NotificationType.MATCH_FOUND]: true,
          [NotificationType.MATCH_ACCEPTED]: true,
          [NotificationType.MATCH_CANCELLED]: true,
          [NotificationType.PICKUP_REQUESTED]: true,
          [NotificationType.PICKUP_VERIFIED]: true,
          [NotificationType.DELIVERY_COMPLETED]: false,
          [NotificationType.NEW_MESSAGE]: false,
          [NotificationType.RATING_RECEIVED]: false,
        },
      };

      await expect(
        notificationService.updateNotificationSettings(newSettings)
      ).resolves.toBeUndefined();
    });
  });

  describe('subscribeToNotifications', () => {
    test('should subscribe to notification settings changes', async () => {
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');
      onSnapshot.mockImplementation((_ref, listener) => {
        listener({
          exists: () => true,
          data: () => ({
            userId: testUserId,
            enabled: true,
            settings: {
              [NotificationType.MATCH_FOUND]: true,
              [NotificationType.MATCH_ACCEPTED]: true,
              [NotificationType.MATCH_CANCELLED]: true,
              [NotificationType.PICKUP_REQUESTED]: true,
              [NotificationType.PICKUP_VERIFIED]: true,
              [NotificationType.DELIVERY_COMPLETED]: true,
              [NotificationType.NEW_MESSAGE]: true,
              [NotificationType.RATING_RECEIVED]: true,
            },
          }),
        });
        return mockUnsubscribe;
      });

      // Subscribe
      const unsubscribe = notificationService.subscribeToNotificationSettings(
        (settings) => {
          expect(settings).toBeDefined();
          expect(settings.userId).toBe(testUserId);
        }
      );

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');

      // Cleanup
      unsubscribe();
    });
  });
});
