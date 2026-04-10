import { useCallback, useEffect, useState } from 'react';

const WEB_NOTIFICATION_STORAGE_KEY = 'ganengile:web-notification-inbox';
const WEB_NOTIFICATION_BADGE_KEY = 'ganengile:web-notification-badge';
const WEB_NOTIFICATION_EVENT = 'ganengile:web-notification-updated';
const DEFAULT_TITLE = '가는길에';

type BrowserPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface WebNotificationPayload {
  title?: string;
  body?: string;
  type?: string;
  chatRoomId?: string;
  otherUserId?: string;
  otherUserName?: string;
  requestInfo?: { from: string; to: string; urgency: string };
  createdAt?: number;
  clickedAt?: number;
  consumedAt?: number;
  [key: string]: unknown;
}

export interface NotificationHandlers {
  onNotificationReceived?: (notification: {
    title: string;
    body: string;
    data?: WebNotificationPayload;
  }) => void;
  onNotificationTapped?: (response: {
    notification: { request: { content: { data?: WebNotificationPayload } } };
  }) => void;
}

function canUseBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function readInbox(): WebNotificationPayload[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_NOTIFICATION_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WebNotificationPayload[]) : [];
  } catch {
    return [];
  }
}

function writeInbox(items: WebNotificationPayload[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(WEB_NOTIFICATION_STORAGE_KEY, JSON.stringify(items.slice(-20)));
}

function updateDocumentTitle(count: number): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.title = count > 0 ? `(${count}) ${DEFAULT_TITLE}` : DEFAULT_TITLE;
}

function setStoredBadgeCount(count: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(WEB_NOTIFICATION_BADGE_KEY, String(Math.max(0, count)));
  updateDocumentTitle(Math.max(0, count));
}

function dispatchInboxEvent(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(WEB_NOTIFICATION_EVENT));
}

function pushInboxItem(payload: WebNotificationPayload): void {
  const nextItems = [...readInbox(), payload];
  writeInbox(nextItems);

  const unreadCount = nextItems.filter((item) => item.clickedAt == null).length;
  setStoredBadgeCount(unreadCount);
  dispatchInboxEvent();
}

function markClickedPayload(payload: WebNotificationPayload): void {
  const items = readInbox();
  const nextItems = items.map((item) => {
    if (item.createdAt === payload.createdAt) {
      return {
        ...item,
        clickedAt: Date.now(),
      };
    }

    return item;
  });

  writeInbox(nextItems);
  const unreadCount = nextItems.filter((item) => item.clickedAt == null).length;
  setStoredBadgeCount(unreadCount);
  dispatchInboxEvent();
}

export function useNotifications(handlers?: NotificationHandlers) {
  const [permissionStatus, setPermissionStatus] = useState<{ status: BrowserPermissionState }>(() => ({
    status: canUseBrowserNotifications() ? Notification.permission : 'unsupported',
  }));
  const [expoPushToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const emitLatestNotification = (): void => {
      const items = readInbox();
      const latest = items[items.length - 1];
      if (!latest) {
        return;
      }

      handlers?.onNotificationReceived?.({
        title: typeof latest.title === 'string' ? latest.title : '가는길에 알림',
        body: typeof latest.body === 'string' ? latest.body : '',
        data: latest,
      });
    };

    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== WEB_NOTIFICATION_STORAGE_KEY ?? !event.newValue) { // eslint-disable-line no-constant-binary-expression, no-constant-condition
        return;
      }

      emitLatestNotification();
    };

    const handleLocalEvent = (): void => {
      emitLatestNotification();
    };

    const handleVisibilityChange = (): void => {
      if (canUseBrowserNotifications()) {
        setPermissionStatus({ status: Notification.permission });
      }
    };

    updateDocumentTitle(Number(window.localStorage.getItem(WEB_NOTIFICATION_BADGE_KEY) ?? '0'));
    window.addEventListener('storage', handleStorage);
    window.addEventListener(WEB_NOTIFICATION_EVENT, handleLocalEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(WEB_NOTIFICATION_EVENT, handleLocalEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handlers]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!canUseBrowserNotifications()) {
      setPermissionStatus({ status: 'unsupported' });
      return false;
    }

    const result = await Notification.requestPermission();
    setPermissionStatus({ status: result });
    return result === 'granted';
  }, []);

  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    const granted = await requestPermissions();
    if (!granted) {
      return null;
    }

    return 'web-browser-notification';
  }, [requestPermissions]);

  const sendLocalNotification = useCallback(
    (title: string, body: string, data?: WebNotificationPayload): void => {
      const payload: WebNotificationPayload = {
        ...data,
        title,
        body,
        createdAt: Date.now(),
      };

      pushInboxItem(payload);
      handlers?.onNotificationReceived?.({ title, body, data: payload });

      if (!canUseBrowserNotifications() ?? Notification.permission !== 'granted') { // eslint-disable-line no-constant-binary-expression, no-constant-condition
        return;
      }

      const notification = new Notification(title, {
        body,
        tag: data?.chatRoomId ?? data?.type ?? `ganengile-${Date.now()}`,
      });

      notification.onclick = () => {
        markClickedPayload(payload);
        handlers?.onNotificationTapped?.({
          notification: {
            request: {
              content: {
                data: payload,
              },
            },
          },
        });
        window.focus();
        notification.close();
      };
    },
    [handlers]
  );

  const handleChatMessageNotification = useCallback(
    (message: { content: string; senderId?: string }, senderName: string, chatRoomId: string): void => {
      sendLocalNotification(`${senderName}님의 새 메시지`, message.content, {
        type: 'new_message',
        chatRoomId,
        otherUserName: senderName,
        otherUserId: message.senderId,
      });
    },
    [sendLocalNotification]
  );

  const setBadgeCount = useCallback((count: number): void => {
    setStoredBadgeCount(count);
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
