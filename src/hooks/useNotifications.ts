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
import { NotificationType } from '../types/chat';
import type { ChatMessage, PushNotificationData } from '../types/chat';

// Configure notification behavior
Notifications.setNotificationHandler({
  // eslint-disable-next-line @typescript-eslint/require-await
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

type NotificationPayload = NonNullable<PushNotificationData['data']>;

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
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setPermissionStatus(finalStatus);

    if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
      console.warn('Notification permissions not granted');
      return false;
    }

    return finalStatus === Notifications.PermissionStatus.GRANTED;
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
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: String(process.env.EXPO_PROJECT_ID ?? ''),
    });
    const token = typeof tokenResponse.data === 'string' ? tokenResponse.data : null;

    setExpoPushToken(token);

    // Save token to notification service via updateNotificationSettings
    if (user && token) {
      await notificationService.updateNotificationSettings({ fcmToken: token });
    }

    return token;
  }, [requestPermissions, notificationService, user]);

  /**
   * Send local notification (for chat messages)
   */
  const sendLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: NotificationPayload
  ): Promise<void> => {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
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
    if (!notificationService.canSendNotification(settings, NotificationType.NEW_MESSAGE)) {
      return;
    }

    await sendLocalNotification(
      `${senderName}님의 새 메시지`,
      message.content,
      { chatRoomId, senderId: message.senderId }
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void registerForPushNotifications();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        handlers?.onNotificationReceived?.(notification);
      }
    );

    // Listen for notification tap/response
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
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
    if (Platform.OS === 'android' ?? Platform.OS === 'web') { // eslint-disable-line no-constant-binary-expression, no-constant-condition
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
