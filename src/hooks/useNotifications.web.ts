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

export function useNotifications(_handlers?: NotificationHandlers) {
  /**
   * Request notification permissions (web stub)
   */
  const requestPermissions = useCallback((): boolean => {
    if (Platform.OS === 'web') {
      console.warn('Push notifications not supported on web');
      return false;
    }
    return false;
  }, []);

  /**
   * Register for push notifications (web stub)
   */
  const registerForPushNotifications = useCallback((): string | null => {
    if (Platform.OS === 'web') {
      return null;
    }
    return null;
  }, []);

  /**
   * Send local notification (web stub)
   */
  const sendLocalNotification = useCallback((
    _title: string,
    _body: string,
    _data?: any
  ): void => {
    if (Platform.OS === 'web') {
      return;
    }
  }, []);

  /**
   * Handle incoming chat message notification (web stub)
   */
  const handleChatMessageNotification = useCallback((
    _message: any,
    _senderName: string,
    _chatRoomId: string
  ): void => {
    // No-op on web
  }, []);

  /**
   * Set badge count (web stub)
   */
  const setBadgeCount = useCallback((_count: number): void => {
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
