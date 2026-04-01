import { navigateFromNotification } from './navigationRef';

const WEB_NOTIFICATION_STORAGE_KEY = 'ganengile:web-notification-inbox';
const WEB_NOTIFICATION_BADGE_KEY = 'ganengile:web-notification-badge';

interface WebNotificationData {
  type?: string;
  chatRoomId?: string;
  otherUserId?: string;
  otherUserName?: string;
  requestInfo?: { from: string; to: string; urgency: string };
  clickedAt?: number;
  consumedAt?: number;
  createdAt?: number;
}

function extractData(response: unknown): WebNotificationData | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const notification = (response as {
    notification?: {
      request?: {
        content?: {
          data?: WebNotificationData;
        };
      };
    };
  }).notification;

  return notification?.request?.content?.data ?? null;
}

function readInbox(): WebNotificationData[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_NOTIFICATION_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WebNotificationData[]) : [];
  } catch {
    return [];
  }
}

function markConsumed(target: WebNotificationData): void {
  if (typeof window === 'undefined') {
    return;
  }

  const items = readInbox();
  const nextItems = items.map((item) => {
    if (item.createdAt === target.createdAt) {
      return {
        ...item,
        consumedAt: Date.now(),
      };
    }

    return item;
  });

  window.localStorage.setItem(WEB_NOTIFICATION_STORAGE_KEY, JSON.stringify(nextItems.slice(-20)));
  const unreadCount = nextItems.filter((item) => item.clickedAt == null).length;
  window.localStorage.setItem(WEB_NOTIFICATION_BADGE_KEY, String(Math.max(0, unreadCount)));
}

export function handleNotificationResponse(response: unknown): void {
  const data = extractData(response);
  if (!data?.type) {
    return;
  }

  switch (data.type) {
    case 'new_message':
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

  markConsumed(data);
}

export function getInitialNotification(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const latestClicked = [...readInbox()]
    .reverse()
    .find((item) => typeof item.clickedAt === 'number' && item.consumedAt == null);

  if (!latestClicked) {
    return;
  }

  handleNotificationResponse({
    notification: {
      request: {
        content: {
          data: latestClicked,
        },
      },
    },
  });
}
