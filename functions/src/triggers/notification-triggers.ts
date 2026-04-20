import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db, fcm } from '../shared-admin';
import type { User, DeliveryRequest, Match, NotificationSettings, ChatRoom, ChatMessage } from '../types';
import { NHNAlimtalkService } from '../services/nhn-alimtalk-service';

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
    console.warn('??FCM sent successfully:', title);
  } catch (error) {
    console.error('??FCM send error:', error);
    throw error;
  }
}

export { sendFCM };

export const sendMatchFoundNotification = functions.firestore
  .document('matches/{matchId}')
  .onCreate(async (snapshot, context) => {
    const match = snapshot.data() as Match;

    if (!match) {
      return null;
    }

    const { requestId } = match;

    try {
      const requestDoc = await db.collection('requests').doc(requestId).get();

      if (!requestDoc.exists) {
        console.error('??Request not found:', requestId);
        return null;
      }

      const request = requestDoc.data() as DeliveryRequest;
      if (!request) return null;

      const gillerDoc = await db.collection('users').doc(match.gillerId).get();

      if (!gillerDoc.exists) {
        console.error('??Giller not found:', match.gillerId);
        return null;
      }

      const giller = gillerDoc.data() as User;
      const fcmToken = giller?.fcmToken;

      const title = '새로운 배송 요청';
      const body = `${request.pickupStation.stationName} -> ${request.deliveryStation.stationName} (${request.fee.totalFee.toLocaleString()}원)`;

      let notificationSent = false;

      if (fcmToken) {
        try {
          await sendFCM(fcmToken, title, body, {
            type: 'match_found',
            requestId,
            matchId: context.params.matchId,
            screen: 'GillerRequests',
          });
          notificationSent = true;
          console.warn('App Push sent to Giller:', match.gillerId);
        } catch (fcmError) {
          console.error('App Push failed, falling back to Alimtalk:', fcmError);
        }
      } else {
        console.warn('No FCM token for giller:', match.gillerId);
      }

      if (!notificationSent && giller?.phoneNumber) {
        const alimtalkSuccess = await NHNAlimtalkService.sendNewMissionAlimtalk(giller.phoneNumber, {
          pickup: request.pickupStation.stationName,
          dropoff: request.deliveryStation.stationName,
          reward: `${request.fee.totalFee.toLocaleString()}원`,
        });
        
        if (alimtalkSuccess) {
          notificationSent = true;
          console.warn('NHN Alimtalk sent as fallback to Giller:', match.gillerId);
        }
      }

      await snapshot.ref.update({
        notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        notificationSent,
        notificationMethod: fcmToken ? 'fcm' : (giller?.phoneNumber ? 'alimtalk' : 'none'),
      });

      console.warn('Match notification process completed:', context.params.matchId);
      return null;
    } catch (error) {
      console.error('??Error sending match notification:', error);
      return null;
    }
  });

export const cleanupOldNotifications = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('Asia/Seoul')
  .onRun(async (_context) => {
    const now = admin.firestore.Timestamp.now();
    const thirtyDaysAgo = new Date(now.toDate().getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const oldNotifications = await db
        .collection('notifications')
        .where('read', '==', true)
        .where('createdAt', '<', thirtyDaysAgo)
        .limit(500)
        .get();

      const batch = db.batch();

      oldNotifications.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.warn(`??Deleted ${oldNotifications.size} old notifications`);
      return null;
    } catch (error) {
      console.error('??Error cleaning up notifications:', error);
      return null;
    }
  });

export const onChatMessageCreated = functions.firestore
  .document('chatRooms/{chatRoomId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data() as ChatMessage;

    if (!message) {
      return null;
    }

    if (message.type === 'system') {
      return null;
    }

    const { chatRoomId } = context.params;

    try {
      const chatRoomDoc = await db.collection('chatRooms').doc(chatRoomId).get();

      if (!chatRoomDoc.exists) {
        console.error('??Chat room not found:', chatRoomId);
        return null;
      }

      const chatRoom = chatRoomDoc.data() as ChatRoom;
      if (!chatRoom) return null;

      const senderId = message.senderId;

      const recipientId = chatRoom.participants.user1.userId === senderId
        ? chatRoom.participants.user2.userId
        : chatRoom.participants.user1.userId;

      const senderName = chatRoom.participants.user1.userId === senderId
        ? chatRoom.participants.user1.name
        : chatRoom.participants.user2.name;

      const recipientDoc = await db.collection('notificationSettings').doc(recipientId).get();

      if (!recipientDoc.exists) {
        console.warn('?좑툘 No notification settings for recipient:', recipientId);
        return null;
      }

      const settings = recipientDoc.data() as NotificationSettings;

      if (!settings?.enabled || !settings?.settings?.new_message) {
        console.warn('?좑툘 Notifications disabled for recipient:', recipientId);
        return null;
      }

      const fcmToken = settings.fcmToken;
      if (!fcmToken) {
        console.warn('?좑툘 No FCM token for recipient:', recipientId);
        return null;
      }

      const title = '?뮠 ??硫붿떆吏';
      const body = `${senderName}: ${message.content}`;

      await sendFCM(fcmToken, title, body, {
        type: 'new_message',
        chatRoomId,
        senderId,
      });

      console.warn('??Chat message notification sent:', context.params.messageId);
      return null;
    } catch (error) {
      console.error('??Error sending chat message notification:', error);
      return null;
    }
  });
