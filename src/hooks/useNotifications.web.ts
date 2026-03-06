/**
 * useNotifications Hook (Web Stub)
 * Web doesn't support expo-notifications
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';

export interface NotificationHandlers {
  onNotificationReceived?: (notification: any) => void;
  onNotificationTapped?: (response: any) => void;
}

// Mock types for web compatibility
interface MockPermissionStatus {
  status: string;
}

interface MockSubscription {
  remove: () => void;
}

export function useNotifications(_handlers?: NotificationHandlers) {
  /**
   * Request notification permissions (web stub)
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.warn('Push notifications not supported on web');
      return false;
    }
    return false;
  }, []);

  /**
   * Register for push notifications (web stub)
   */
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return null;
    }
    return null;
  }, []);

  /**
   * Send local notification (web stub)
   */
  const sendLocalNotification = useCallback(async (
    _title: string,
    _body: string,
    _data?: any
  ): Promise<void> => {
    if (Platform.OS === 'web') {
      return;
    }
  }, []);

  /**
   * Handle incoming chat message notification (web stub)
   */
  const handleChatMessageNotification = useCallback(async (
    _message: any,
    _senderName: string,
    _chatRoomId: string
  ): Promise<void> => {
    // No-op on web
  }, []);

  /**
   * Set badge count (web stub)
   */
  const setBadgeCount = useCallback(async (_count: number): Promise<void> => {
    // No-op on web
  }, []);

  return {
    expoPushToken: null,
    permissionStatus: undefined as unknown as MockPermissionStatus,
    requestPermissions,
    registerForPushNotifications,
    sendLocalNotification,
    handleChatMessageNotification,
    setBadgeCount,
  };
}
