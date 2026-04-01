import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';

export enum NotificationType {
  MATCH_FOUND = 'match_found',
  REQUEST_ACCEPTED = 'request_accepted',
  REQUEST_CANCELLED = 'request_cancelled',
  PICKUP_ARRIVED = 'pickup_arrived',
  DELIVERY_ARRIVED = 'delivery_arrived',
  DELIVERY_COMPLETED = 'delivery_completed',
}

interface NotificationRecord {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

async function getUserFCMToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data() as { fcmToken?: string } | undefined;
    return userData?.fcmToken ?? null;
  } catch (error) {
    console.error('Error getting user FCM token:', error);
    return null;
  }
}

async function saveNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    title,
    body,
    data,
    read: false,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

function sendFCM(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  console.warn('FCM notification queued', { token, title, body, data });
  return Promise.resolve();
}

export async function sendMatchFoundNotification(
  gillerId: string,
  requestId: string,
  pickupStation: string,
  deliveryStation: string,
  fee: number
): Promise<void> {
  const title = '새 배송 요청이 도착했습니다';
  const body = `${pickupStation} -> ${deliveryStation} (${fee.toLocaleString()}원)`;

  await saveNotification(gillerId, NotificationType.MATCH_FOUND, title, body, {
    requestId,
    pickupStation,
    deliveryStation,
    fee,
  });

  const token = await getUserFCMToken(gillerId);
  if (token) {
    await sendFCM(token, title, body, {
      type: NotificationType.MATCH_FOUND,
      requestId,
      screen: 'RequestDetail',
    });
  }
}

export async function sendRequestAcceptedNotification(
  gllerId: string,
  requestId: string,
  gillerName: string
): Promise<void> {
  const title = '배송 요청이 수락되었습니다';
  const body = `${gillerName}님이 배송 요청을 수락했습니다.`;

  await saveNotification(gllerId, NotificationType.REQUEST_ACCEPTED, title, body, {
    requestId,
    gillerName,
  });

  const token = await getUserFCMToken(gllerId);
  if (token) {
    await sendFCM(token, title, body, {
      type: NotificationType.REQUEST_ACCEPTED,
      requestId,
      screen: 'RequestDetail',
    });
  }
}

export async function sendDeliveryCompletedNotification(
  gllerId: string,
  requestId: string,
  gillerName: string
): Promise<void> {
  const title = '배송이 완료되었습니다';
  const body = `${gillerName}님이 배송을 완료했습니다.`;

  await saveNotification(gllerId, NotificationType.DELIVERY_COMPLETED, title, body, {
    requestId,
    gillerName,
  });

  const token = await getUserFCMToken(gllerId);
  if (token) {
    await sendFCM(token, title, body, {
      type: NotificationType.DELIVERY_COMPLETED,
      requestId,
      screen: 'RequestDetail',
    });
  }
}

export async function sendBulkNotifications(
  gillerIds: string[],
  notification: {
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  await Promise.all(
    gillerIds.map((gillerId) =>
      saveNotification(
        gillerId,
        notification.type,
        notification.title,
        notification.body,
        notification.data
      )
    )
  );
}

export async function getUserNotifications(
  userId: string,
  limitCount: number = 20
): Promise<NotificationRecord[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);
  const notifications = snapshot.docs
    .map((docSnapshot) => {
      const data = docSnapshot.data() as {
        userId?: string;
        type?: NotificationType;
        title?: string;
        body?: string;
        data?: Record<string, unknown>;
        read?: boolean;
        createdAt?: { toDate?: () => Date };
      };

      return {
        notificationId: docSnapshot.id,
        userId: data.userId ?? userId,
        type: data.type ?? NotificationType.MATCH_FOUND,
        title: data.title ?? '',
        body: data.body ?? '',
        data: data.data,
        read: data.read ?? false,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
      };
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return notifications.slice(0, limitCount);
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true,
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);
  await Promise.all(
    snapshot.docs.map((docSnapshot) =>
      updateDoc(docSnapshot.ref, {
        read: true,
        readAt: serverTimestamp(),
      })
    )
  );
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}
