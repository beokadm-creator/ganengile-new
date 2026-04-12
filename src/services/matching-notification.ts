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



export async function sendMatchFoundNotification(
  gillerId: string,
  requestId: string,
  pickupStation: string,
  deliveryStation: string,
  fee: number
): Promise<void> {
  const title = '새 미션이 도착했습니다';
  const body = `${pickupStation} -> ${deliveryStation} · ${fee.toLocaleString()}원`;

  await saveNotification(gillerId, NotificationType.MATCH_FOUND, title, body, {
    type: NotificationType.MATCH_FOUND,
    requestId,
    pickupStation,
    deliveryStation,
    fee,
    screen: 'GillerRequests',
  });
}

export async function sendMissionBundleAvailableNotification(
  gillerId: string,
  requestId: string,
  pickupStation: string,
  deliveryStation: string,
  fee: number,
  bundleCount: number
): Promise<void> {
  const title = '선택 가능한 배송 구간이 도착했습니다';
  const body = `${pickupStation} -> ${deliveryStation} · ${bundleCount}개 구간 카드 · ${fee.toLocaleString()}원`;

  await saveNotification(gillerId, NotificationType.MATCH_FOUND, title, body, {
    type: NotificationType.MATCH_FOUND,
    requestId,
    pickupStation,
    deliveryStation,
    fee,
    bundleCount,
    mode: 'mission_bundle',
    screen: 'GillerRequests',
  });
}

export async function sendRequestAcceptedNotification(
  gllerId: string,
  requestId: string,
  gillerName: string
): Promise<void> {
  const title = '배송 요청이 수락되었습니다';
  const body = `${gillerName}님이 배송 요청을 수락했습니다.`;

  await saveNotification(gllerId, NotificationType.REQUEST_ACCEPTED, title, body, {
    type: NotificationType.REQUEST_ACCEPTED,
    requestId,
    gillerName,
    screen: 'RequestDetail',
  });
}

export async function sendRequestProgressNotification(
  gllerId: string,
  requestId: string,
  acceptedMissionCount: number,
  totalMissionCount: number,
  fullyMatched: boolean
): Promise<void> {
  const title = fullyMatched ? '배송 연결이 완료되었습니다' : '일부 구간이 연결되었습니다';
  const body = fullyMatched
    ? '배송 준비가 시작됩니다.'
    : `${acceptedMissionCount}/${totalMissionCount} 구간 연결 중`;

  await saveNotification(gllerId, NotificationType.REQUEST_ACCEPTED, title, body, {
    type: NotificationType.REQUEST_ACCEPTED,
    requestId,
    acceptedMissionCount,
    totalMissionCount,
    fullyMatched,
    screen: 'RequestDetail',
  });
}

export async function sendRequestExecutionNotification(
  userId: string,
  requestId: string,
  stage: 'picked_up' | 'arrived' | 'delivered',
  title: string,
  body: string
): Promise<void> {
  const notificationType =
    stage === 'picked_up'
      ? NotificationType.PICKUP_ARRIVED
      : stage === 'arrived'
        ? NotificationType.DELIVERY_ARRIVED
        : NotificationType.DELIVERY_COMPLETED;

  await saveNotification(userId, notificationType, title, body, {
    type: notificationType,
    requestId,
    stage,
    screen: 'RequestDetail',
  });
}

export async function sendMissionReturnedNotification(
  gllerId: string,
  requestId: string
): Promise<void> {
  const title = '구간이 다시 조정되고 있습니다';
  const body = '남은 구간을 다시 찾고 있습니다.';

  await saveNotification(gllerId, NotificationType.REQUEST_ACCEPTED, title, body, {
    type: NotificationType.REQUEST_ACCEPTED,
    requestId,
    mode: 'mission_returned',
    screen: 'RequestDetail',
  });
}

export async function sendDeliveryCompletedNotification(
  gllerId: string,
  requestId: string,
  gillerName: string
): Promise<void> {
  const title = '배송이 완료되었습니다';
  const body = `${gillerName}님이 배송을 완료했습니다.`;

  await saveNotification(gllerId, NotificationType.DELIVERY_COMPLETED, title, body, {
    type: NotificationType.DELIVERY_COMPLETED,
    requestId,
    gillerName,
    screen: 'RequestDetail',
  });
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
