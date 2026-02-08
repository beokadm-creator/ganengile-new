/**
 * Notification Service
 * Firebase Cloud Messaging (FCM) 기반 푸시 알림 서비스
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, messaging, requireUserId } from './firebase';
import type {
  NotificationSettings,
  PushNotificationData,
} from '../types/chat';
import { NotificationType } from '../types/chat';

const NOTIFICATION_SETTINGS_COLLECTION = 'notificationSettings';

export type NotificationSettingsListener = (settings: NotificationSettings) => void;

/**
 * 알림 템플릿
 */
const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; body: string }> = {
  [NotificationType.MATCH_FOUND]: {
    title: '새로운 배송 매칭',
    body: '내 동선과 매칭되는 배송 요청이 있습니다.',
  },
  [NotificationType.MATCH_ACCEPTED]: {
    title: '매칭 수락',
    body: '길러가 배송을 수락했습니다.',
  },
  [NotificationType.MATCH_CANCELLED]: {
    title: '매칭 취소',
    body: '매칭이 취소되었습니다.',
  },
  [NotificationType.PICKUP_REQUESTED]: {
    title: '픽업 요청',
    body: '배송자가 픽업을 요청했습니다.',
  },
  [NotificationType.PICKUP_VERIFIED]: {
    title: '픽업 완료',
    body: '픽업이 인증되었습니다.',
  },
  [NotificationType.DELIVERY_COMPLETED]: {
    title: '배송 완료',
    body: '배송이 완료되었습니다.',
  },
  [NotificationType.NEW_MESSAGE]: {
    title: '새 메시지',
    body: '새로운 메시지가 도착했습니다.',
  },
  [NotificationType.RATING_RECEIVED]: {
    title: '새 평가',
    body: '새로운 평가가 등록되었습니다.',
  },
};

export class NotificationService {
  private userId: string;
  private vapidKey: string = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || '';

  constructor() {
    this.userId = requireUserId();
  }

  /**
   * FCM 토큰 가져오기
   */
  async getFCMToken(): Promise<string | null> {
    if (!messaging) {
      console.warn('Firebase Messaging not available');
      return null;
    }

    try {
      const currentToken = await getToken(messaging, { vapidKey: this.vapidKey });

      if (!currentToken) {
        console.warn('No FCM token available');
        return null;
      }

      await this.saveFCMToken(currentToken);
      return currentToken;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * FCM 토큰 저장
   */
  private async saveFCMToken(token: string): Promise<void> {
    const docRef = doc(db, NOTIFICATION_SETTINGS_COLLECTION, this.userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      await updateDoc(docRef, { fcmToken: token, updatedAt: serverTimestamp() });
    } else {
      await setDoc(docRef, {
        userId: this.userId,
        enabled: true,
        settings: this.getDefaultNotificationSettings(),
        fcmToken: token,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  /**
   * 기본 알림 설정
   */
  private getDefaultNotificationSettings(): NotificationSettings['settings'] {
    return {
      [NotificationType.MATCH_FOUND]: true,
      [NotificationType.MATCH_ACCEPTED]: true,
      [NotificationType.MATCH_CANCELLED]: true,
      [NotificationType.PICKUP_REQUESTED]: true,
      [NotificationType.PICKUP_VERIFIED]: true,
      [NotificationType.DELIVERY_COMPLETED]: true,
      [NotificationType.NEW_MESSAGE]: true,
      [NotificationType.RATING_RECEIVED]: true,
    };
  }

  /**
   * 알림 설정 가져오기
   */
  async getNotificationSettings(): Promise<NotificationSettings | null> {
    const docRef = doc(db, NOTIFICATION_SETTINGS_COLLECTION, this.userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      userId: docSnap.data()?.userId,
      enabled: docSnap.data()?.enabled ?? true,
      settings: docSnap.data()?.settings ?? this.getDefaultNotificationSettings(),
      fcmToken: docSnap.data()?.fcmToken,
      quietHours: docSnap.data()?.quietHours,
      createdAt: docSnap.data()?.createdAt,
      updatedAt: docSnap.data()?.updatedAt,
    } as NotificationSettings;
  }

  /**
   * 알림 설정 실시간 구독
   */
  subscribeToNotificationSettings(listener: NotificationSettingsListener): () => void {
    const docRef = doc(db, NOTIFICATION_SETTINGS_COLLECTION, this.userId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        listener({
          userId: data.userId,
          enabled: data.enabled ?? true,
          settings: data.settings ?? this.getDefaultNotificationSettings(),
          fcmToken: data.fcmToken,
          quietHours: data.quietHours,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        } as NotificationSettings);
      }
    });

    return unsubscribe;
  }

  /**
   * 알림 설정 업데이트
   */
  async updateNotificationSettings(
    updates: Partial<Omit<NotificationSettings, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const docRef = doc(db, NOTIFICATION_SETTINGS_COLLECTION, this.userId);

    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 특정 알림 타입 활성화/비활성화
   */
  async setNotificationTypeEnabled(type: NotificationType, enabled: boolean): Promise<void> {
    const docRef = doc(db, NOTIFICATION_SETTINGS_COLLECTION, this.userId);

    await updateDoc(docRef, {
      [`settings.${type}`]: enabled,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 알림 전체 활성화/비활성화
   */
  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    const docRef = doc(db, NOTIFICATION_SETTINGS_COLLECTION, this.userId);

    await updateDoc(docRef, {
      enabled,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 포그라운드 메시지 수신 리스너 설정
   */
  onForegroundMessage(callback: (payload: any) => void): () => void {
    if (!messaging) {
      console.warn('Firebase Messaging not available');
      return () => {};
    }

    return onMessage(messaging, (payload) => {
      callback(payload);
    });
  }

  /**
   * 알림 템플릿 가져오기
   */
  getNotificationTemplate(type: NotificationType, customData?: { [key: string]: string }): PushNotificationData {
    const template = NOTIFICATION_TEMPLATES[type];
    let body = template.body;

    if (customData) {
      Object.keys(customData).forEach((key) => {
        body = body.replace(`{${key}}`, customData[key]);
      });
    }

    return {
      type,
      title: template.title,
      body,
      data: customData,
    };
  }

  /**
   * 알림 비활성 시간대 확인
   */
  isQuietHours(settings: NotificationSettings): boolean {
    if (!settings.quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { startTime, endTime } = settings.quietHours;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * 알림 전송 가능 여부 확인
   */
  canSendNotification(settings: NotificationSettings | null, type: NotificationType): boolean {
    if (!settings?.enabled) {
      return false;
    }

    if (!settings.settings[type]) {
      return false;
    }

    if (this.isQuietHours(settings)) {
      return false;
    }

    return true;
  }
}

/**
 * 알림 서비스 인스턴스 생성
 */
export function createNotificationService(): NotificationService {
  return new NotificationService();
}

/**
 * 서버에서 푸시 알림 전송 (Firebase Functions 호출)
 */
export async function sendPushNotification(
  userId: string,
  notification: PushNotificationData
): Promise<boolean> {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functionsInstance = getFunctions();
    const sendPushNotificationFn = httpsCallable(functionsInstance, 'sendPushNotification');

    await sendPushNotificationFn({
      userId,
      notification,
    });

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

/**
 * 배송 관련 이벤트에 푸시 알림 전송
 */
export async function notifyDeliveryEvent(
  userId: string,
  type: NotificationType,
  data?: { [key: string]: string }
): Promise<void> {
  const notificationService = createNotificationService();
  const settings = await notificationService.getNotificationSettings();

  if (!notificationService.canSendNotification(settings, type)) {
    return;
  }

  const template = notificationService.getNotificationTemplate(type, data);

  if (data?.requestId) {
    template.data = { ...template.data, requestId: data.requestId };
  }
  if (data?.matchId) {
    template.data = { ...template.data, matchId: data.matchId };
  }

  await sendPushNotification(userId, template);
}
