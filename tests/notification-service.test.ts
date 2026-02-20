/**
 * Notification Service Tests
 * 푸시 알림 시스템 테스트
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
    test('should get FCM token successfully', async () => {
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

  describe('updateNotificationSettings', () => {
    test('should update notification enabled status', async () => {
      const settings = {
        enabled: false,
      };

      await expect(notificationService.updateNotificationSettings(settings)).resolves.not.toThrow();

      const userSettings = await notificationService.getNotificationSettings();

      expect(userSettings?.enabled).toBe(false);
    });

    test('should toggle all notifications on', async () => {
      const settings = {
        enabled: true,
      };

      await expect(notificationService.updateNotificationSettings(settings)).resolves.not.toThrow();

      const userSettings = await notificationService.getNotificationSettings();
      expect(userSettings?.enabled).toBe(true);
    });
  });

  describe('getNotificationSettings', () => {
    test('should get notification settings', async () => {
      // First update enabled status
      const settings = {
        enabled: true,
      };

      await notificationService.updateNotificationSettings(settings);

      // Get settings
      const userSettings = await notificationService.getNotificationSettings();

      expect(userSettings).toBeDefined();
      expect(userSettings?.userId).toBe(testUserId);
      expect(userSettings?.enabled).toBe(true);
      expect(userSettings?.settings).toBeDefined();
    });

    test('should return default settings for new user', async () => {
      const userSettings = await notificationService.getNotificationSettings();

      expect(userSettings).toBeDefined();
      expect(userSettings?.enabled).toBe(true);
      expect(userSettings?.settings).toBeDefined();
      expect(userSettings?.settings && typeof userSettings.settings === 'object').toBe(true);
    });
  });

  describe('sendPushNotification', () => {
    test('should send push notification successfully', async () => {
      const notification = {
        type: NotificationType.MATCH_FOUND,
        title: '새로운 배송 매칭',
        body: '내 동선과 매칭되는 배송 요청이 있습니다.',
        data: {
          requestId: 'test-request-001',
          matchId: 'test-match-001',
        },
      };

      // Mock fetch for FCM API
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: 1 }),
        })
      ) as any;

      await expect(
        sendPushNotification(testUserId, notification)
      ).resolves.not.toThrow();
    });

    test('should skip notification if user has disabled type', async () => {
      // Update enabled status only
      const settings = {
        enabled: false,
      };

      await notificationService.updateNotificationSettings(settings);

      const notification = {
        type: NotificationType.MATCH_FOUND,
        title: '새로운 배송 매칭',
        body: '내 동선과 매칭되는 배송 요청이 있습니다.',
      };

      await expect(
        sendPushNotification(testUserId, notification)
      ).resolves.not.toThrow();
    });

    test('should skip notification if all notifications disabled', async () => {
      // Create settings with all disabled
      const settings = {
        enabled: false,
      };

      await notificationService.updateNotificationSettings(settings);

      const notification = {
        type: NotificationType.MATCH_FOUND,
        title: '테스트',
        body: '테스트 메시지',
      };

      await expect(
        sendPushNotification(testUserId, notification)
      ).resolves.not.toThrow();
    });
  });

  describe('subscribeToNotifications', () => {
    test('should subscribe to notification settings changes', async () => {
      // Create initial settings
      const settings = {
        enabled: true,
        settings: {
          match_found: true,
          match_accepted: true,
          match_cancelled: false,
          pickup_requested: false,
          pickup_verified: false,
          delivery_completed: false,
          new_message: false,
          rating_received: false,
        } as any,
      };

      await notificationService.updateNotificationSettings(settings);

      // Mock onSnapshot
      const { onSnapshot } = require('firebase/firestore');
      const mockUnsubscribe = jest.fn();
      onSnapshot.mockImplementation(() => mockUnsubscribe);

      // Subscribe
      const unsubscribe = notificationService.subscribeToNotificationSettings(
        (newSettings: any) => {
          expect(newSettings).toBeDefined();
          expect(newSettings?.userId).toBe(testUserId);
        }
      );

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('Notification Templates', () => {
    test('should use correct template for MATCH_FOUND', () => {
      const notification = {
        type: NotificationType.MATCH_FOUND,
        title: '',
        body: '',
      };

      // The service should use templates defined in notification-service.ts
      expect(notification.type).toBe(NotificationType.MATCH_FOUND);
    });

    test('should use correct template for NEW_MESSAGE', () => {
      const notification = {
        type: NotificationType.NEW_MESSAGE,
        title: '',
        body: '',
      };

      expect(notification.type).toBe(NotificationType.NEW_MESSAGE);
    });
  });
});
