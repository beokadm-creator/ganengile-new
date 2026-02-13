/**
 * useNotifications Hook
 * Handles push notification permissions, registration, and event handling
 * for Expo Notifications
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useUser } from '../contexts/UserContext';
import { createNotificationService } from '../services/notification-service';
import type { ChatMessage } from '../types/chat';
import type { MainStackNavigationProp } from '../types/navigation';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: false,
  }),
});

export interface NotificationHandlers {
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void;
}

export function useNotifications(handlers?: NotificationHandlers) {
  const { user } = useUser();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus>(
    Notifications.PermissionStatus.UNDETERMINED
  );
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const notificationService = useRef(createNotificationService()).current;

  /**
   * Request notification permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // Web doesn't support push notifications in Expo
      console.warn('Push notifications not supported on web');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus as Notifications.PermissionStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status as Notifications.PermissionStatus;
    }

    setPermissionStatus(finalStatus);

    if (finalStatus !== 'granted') {
      console.warn('Notification permissions not granted');
      return false;
    }

    return true;
  }, []);

  /**
   * Register for push notifications and get Expo push token
   */
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return null;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return null;
    }

    // Get Expo push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID || '',
    });

    setExpoPushToken(token.data);

    // Save token to notification service via updateNotificationSettings
    if (user && token.data) {
      await notificationService.updateNotificationSettings({ fcmToken: token.data });
    }

    return token.data;
  }, [requestPermissions, notificationService, user]);

  /**
   * Send local notification (for chat messages)
   */
  const sendLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: any
  ): Promise<void> => {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        badge: 1,
      },
      trigger: null, // Show immediately
    });
  }, []);

  /**
   * Handle incoming chat message notification
   */
  const handleChatMessageNotification = useCallback(async (
    message: ChatMessage,
    senderName: string,
    chatRoomId: string
  ): Promise<void> => {
    // Only show notification if message is not from current user
    if (message.senderId === user?.uid) {
      return;
    }

    // Check if notification is enabled for NEW_MESSAGE
    const settings = await notificationService.getNotificationSettings();
    if (!notificationService.canSendNotification(settings, 'new_message' as any)) {
      return;
    }

    await sendLocalNotification(
      `${senderName}님으로부터 새 메시지`,
      message.content,
      { chatRoomId, senderId: message.senderId, type: 'new_message' }
    );
  }, [user, notificationService, sendLocalNotification]);

  /**
   * Initialize notification listeners
   */
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    // Register for push notifications on mount
    registerForPushNotifications();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        handlers?.onNotificationReceived?.(notification);
      }
    );

    // Listen for notification tap/response
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { chatRoomId } = response.notification.request.content.data as any;

        handlers?.onNotificationTapped?.(response);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [registerForPushNotifications, handlers]);

  /**
   * Set badge count
   */
  const setBadgeCount = useCallback(async (count: number): Promise<void> => {
    if (Platform.OS === 'android' || Platform.OS === 'web') {
      return; // Badge not supported on Android or web
    }

    await Notifications.setBadgeCountAsync(count);
  }, []);

  return {
    expoPushToken,
    permissionStatus,
    requestPermissions,
    registerForPushNotifications,
    sendLocalNotification,
    handleChatMessageNotification,
    setBadgeCount,
  };
}
