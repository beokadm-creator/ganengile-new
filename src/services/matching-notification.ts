/**
 * Matching Notification Service
 * 매칭 생성 시 길러에게 FCM 푸시 알림 전송
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Notification types
 */
export enum NotificationType {
  MATCH_FOUND = 'match_found',
  REQUEST_ACCEPTED = 'request_accepted',
  REQUEST_CANCELLED = 'request_cancelled',
  PICKUP_ARRIVED = 'pickup_arrived',
  DELIVERY_ARRIVED = 'delivery_arrived',
  DELIVERY_COMPLETED = 'delivery_completed',
}

/**
 * Notification interface
 */
interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

/**
 * FCM Message interface
 */
interface FCMMessage {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: 'high' | 'normal';
    notification: {
      channelId: string;
      sound: string;
    };
  };
  apns?: {
    payload: {
      aps: {
        alert: {
          title: string;
          body: string;
        };
        sound: string;
        badge: number;
      };
    };
  };
}

/**
 * Get user's FCM token
 * @param userId User ID
 * @returns FCM token or null
 */
async function getUserFCMToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    return userData.fcmToken || null;
  } catch (error) {
    console.error('Error getting user FCM token:', error);
    return null;
  }
}

/**
 * Save notification to Firestore
 * @param userId User ID
 * @param type Notification type
 * @param title Notification title
 * @param body Notification body
 * @param data Additional data
 * @returns Notification document ID
 */
async function saveNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string> {
  try {
    const notificationData = {
      userId,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving notification:', error);
    throw error;
  }
}

/**
 * Send FCM push notification
 * Note: This requires Firebase Cloud Functions with FCM admin SDK
 * @param token FCM token
 * @param title Notification title
 * @param body Notification body
 * @param data Additional data
 */
async function sendFCM(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    // In a real implementation, this would call a Firebase Cloud Function
    // that uses the FCM Admin SDK to send the push notification
    console.log('📤 Sending FCM notification:', { token, title, body, data });

    // Placeholder: Call Cloud Function
    // const sendFCMFunction = httpsCallable(functions, 'sendFCMNotification');
    // await sendFCMFunction({ token, title, body, data });

    // For now, just log
    console.log('✅ FCM notification queued:', title);
  } catch (error) {
    console.error('Error sending FCM:', error);
    throw error;
  }
}

/**
 * Send match found notification to giller
 * @param gillerId Giller (courier) ID
 * @param requestId Request ID
 * @param pickupStation Pickup station name
 * @param deliveryStation Delivery station name
 * @param fee Delivery fee
 */
export async function sendMatchFoundNotification(
  gillerId: string,
  requestId: string,
  pickupStation: string,
  deliveryStation: string,
  fee: number
): Promise<void> {
  try {
    const title = '🎯 새로운 배송 요청';
    const body = `${pickupStation} → ${deliveryStation} (${fee.toLocaleString()}원)`;

    // Save to Firestore
    await saveNotification(
      gillerId,
      NotificationType.MATCH_FOUND,
      title,
      body,
      { requestId, pickupStation, deliveryStation, fee }
    );

    // Get FCM token
    const token = await getUserFCMToken(gillerId);

    if (token) {
      // Send push notification
      await sendFCM(token, title, body, {
        type: 'match_found',
        requestId,
        screen: 'RequestDetail',
      });
    } else {
      console.log(`⚠️ No FCM token for giller ${gillerId}`);
    }
  } catch (error) {
    console.error('Error sending match found notification:', error);
    throw error;
  }
}

/**
 * Send request accepted notification to gller
 * @param gllerId Gller (requester) ID
 * @param requestId Request ID
 * @param gillerName Giller (courier) name
 */
export async function sendRequestAcceptedNotification(
  gllerId: string,
  requestId: string,
  gillerName: string
): Promise<void> {
  try {
    const title = '✅ 배송이 수락되었습니다';
    const body = `${gillerName}님이 배송을 수락했습니다.`;

    // Save to Firestore
    await saveNotification(
      gllerId,
      NotificationType.REQUEST_ACCEPTED,
      title,
      body,
      { requestId, gillerName }
    );

    // Get FCM token
    const token = await getUserFCMToken(gllerId);

    if (token) {
      await sendFCM(token, title, body, {
        type: 'request_accepted',
        requestId,
        screen: 'RequestDetail',
      });
    }
  } catch (error) {
    console.error('Error sending request accepted notification:', error);
    throw error;
  }
}

/**
 * Send delivery completed notification
 * @param gllerId Gller (requester) ID
 * @param requestId Request ID
 * @param gillerName Giller (courier) name
 */
export async function sendDeliveryCompletedNotification(
  gllerId: string,
  requestId: string,
  gillerName: string
): Promise<void> {
  try {
    const title = '🎉 배송이 완료되었습니다';
    const body = `${gillerName}님이 배송을 완료했습니다.`;

    await saveNotification(
      gllerId,
      NotificationType.DELIVERY_COMPLETED,
      title,
      body,
      { requestId, gillerName }
    );

    const token = await getUserFCMToken(gllerId);
    if (token) {
      await sendFCM(token, title, body, {
        type: 'delivery_completed',
        requestId,
        screen: 'RequestDetail',
      });
    }
  } catch (error) {
    console.error('Error sending delivery completed notification:', error);
    throw error;
  }
}

/**
 * Send notifications to multiple gillers
 * @param gillerIds Array of giller IDs
 * @param notification Notification details
 */
export async function sendBulkNotifications(
  gillerIds: string[],
  notification: {
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
  }
): Promise<void> {
  try {
    const promises = gillerIds.map((gillerId) =>
      saveNotification(
        gillerId,
        notification.type,
        notification.title,
        notification.body,
        notification.data
      )
    );

    await Promise.all(promises);
    console.log(`✅ Sent ${gillerIds.length} notifications`);
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    throw error;
  }
}

/**
 * Get user notifications
 * @param userId User ID
 * @param limit Max number of notifications
 * @returns Array of notifications
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 20
): Promise<Notification[]> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    const notifications: Notification[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      notifications.push({
        notificationId: docSnapshot.id,
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data,
        read: data.read,
        createdAt: data.createdAt?.toDate() || new Date(),
      });
    });

    // Sort by created date (newest first)
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return notifications.slice(0, limit);
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 * @param notificationId Notification ID
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for user
 * @param userId User ID
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);

    const updatePromises = snapshot.docs.map((docSnapshot) =>
      updateDoc(docSnapshot.ref, {
        read: true,
        readAt: serverTimestamp(),
      })
    );

    await Promise.all(updatePromises);
    console.log(`✅ Marked ${snapshot.size} notifications as read`);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Get unread notification count
 * @param userId User ID
 * @returns Number of unread notifications
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
}
