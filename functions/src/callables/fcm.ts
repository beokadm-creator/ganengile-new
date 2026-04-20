import * as functions from 'firebase-functions';
import { admin, db, fcm } from '../shared-admin';
import type {
  SaveFCMTokenData,
  SaveFCMTokenResult,
  SendPushNotificationData,
  SendPushNotificationResult,
  NotificationSettings,
} from '../types';

async function sendFCM(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const message: admin.messaging.Message = {
    token,
    notification: {
      title,
      body,
    },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    await fcm.send(message);
    console.warn('FCM token saved for user:', title);
  } catch (error) {
    console.error('FCM send error:', error);
    throw error;
  }
}

export const saveFCMToken = functions.https.onCall(async (data: SaveFCMTokenData, context): Promise<SaveFCMTokenResult> => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { token } = data;

  if (!token) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'FCM token is required'
    );
  }

  try {
    const userId = context.auth.uid;

    await db.collection('users').doc(userId).update({
      fcmToken: token,
      fcmTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.warn('FCM token saved for user:', userId);

    return { success: true };
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error saving FCM token'
    );
  }
});

export const sendPushNotification = functions.https.onCall(async (data: SendPushNotificationData, context): Promise<SendPushNotificationResult> => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { userId, notification } = data;

  if (!userId || !notification) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'userId and notification are required'
    );
  }

  try {
    const settingsDoc = await db.collection('notificationSettings').doc(userId).get();

    if (!settingsDoc.exists) {
      console.warn('No notification settings for user:', userId);
      return { success: false, reason: 'No notification settings' };
    }

    const settings = settingsDoc.data() as NotificationSettings;

    if (!settings?.enabled) {
      console.warn('Notifications disabled for user:', userId);
      return { success: false, reason: 'Notifications disabled' };
    }

    const fcmToken = settings.fcmToken;
    if (!fcmToken) {
      console.warn('No FCM token for user:', userId);
      return { success: false, reason: 'No FCM token' };
    }

    await sendFCM(fcmToken, notification.title, notification.body, notification.data);

    return { success: true };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error sending push notification'
    );
  }
});
