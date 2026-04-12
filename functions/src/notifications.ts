import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function: Send push notification automatically when a new notification document is created.
 * Listens to: /notifications/{notificationId}
 */
export const onNotificationCreated = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notificationData = snapshot.data();
    if (!notificationData) return null;

    const { userId, title, body, data, read } = notificationData;

    // We don't need to send push if it's already marked as read (unlikely on creation, but just in case)
    if (read) return null;

    try {
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        console.warn(`User ${userId} not found for notification ${context.params.notificationId}`);
        return null;
      }

      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        console.warn(`User ${userId} has no FCM token. Skipping push notification.`);
        return null;
      }

      // Convert all values in data to strings (FCM requirement for data payload)
      const stringifiedData: Record<string, string> = {};
      if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          if (value !== null && value !== undefined) {
            stringifiedData[key] = String(value);
          }
        }
      }

      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: title || '새로운 알림',
          body: body || '',
        },
        data: stringifiedData,
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
                title: title || '새로운 알림',
                body: body || '',
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      await admin.messaging().send(message);
      console.warn(`?? FCM successfully sent to user ${userId} for notification ${context.params.notificationId}`);

      // Optionally, mark that push was sent
      await snapshot.ref.update({
        pushSentAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error(`?좑툘 Failed to send FCM to user ${userId}:`, error);
      await snapshot.ref.update({
        pushError: String(error)
      });
    }

    return null;
  });
