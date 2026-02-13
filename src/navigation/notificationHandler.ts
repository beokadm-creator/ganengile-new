/**
 * Notification Navigation Handler
 * Handles notification tap navigation for chat messages and other notifications
 */

import * as Notifications from 'expo-notifications';
import { navigateFromNotification } from './navigationRef';
import type { MainStackParamList } from '../types/navigation';

interface NotificationData {
  type: string;
  chatRoomId?: string;
  otherUserId?: string;
  otherUserName?: string;
  requestInfo?: { from: string; to: string; urgency: string };
}

export function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const rawData = response.notification.request.content.data;
  if (!rawData) return;

  const data = rawData as unknown as NotificationData;

  if (!data || !data.type) {
    return;
  }

  switch (data.type) {
    case 'new_message':
      if (data.chatRoomId && data.otherUserId && data.otherUserName) {
        navigateFromNotification('Chat', {
          chatRoomId: data.chatRoomId,
          otherUserId: data.otherUserId,
          otherUserName: data.otherUserName,
          requestInfo: data.requestInfo,
        });
      }
      break;

    case 'match_found':
    case 'match_accepted':
      if (data.chatRoomId && data.otherUserId && data.otherUserName) {
        navigateFromNotification('Chat', {
          chatRoomId: data.chatRoomId,
          otherUserId: data.otherUserId,
          otherUserName: data.otherUserName,
          requestInfo: data.requestInfo,
        });
      }
      break;

    default:
      break;
  }
}

export async function getInitialNotification() {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (response) {
    handleNotificationResponse(response);
  }
}
