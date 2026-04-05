/**
 * Real-time Delivery Tracking Service
 * Firestore onSnapshot 기반의 실시간 위치 업데이트
 * 업데이트 주기: 10초
 */

import { doc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

export interface GillerLocation {
  latitude: number;
  longitude: number;
  station: string;
  updatedAt: Date;
  status: 'moving' | 'waiting' | 'arrived';
}

export interface DeliveryTrackingData {
  requestId: string;
  gillerId: string;
  currentLocation: GillerLocation;
  estimatedArrival: Date;
  progress: number;
  status: 'pending' | 'in-transit' | 'delivered';
}

/**
 * 실시간 배송 추적 리스너
 * @param requestId 배송 요청 ID
 * @param onUpdate 업데이트 콜백
 * @returns Unsubscribe 함수
 */
export function subscribeToDeliveryTracking(
  requestId: string,
  onUpdate: (data: DeliveryTrackingData) => void
): Unsubscribe {
  const deliveryDoc = doc(db, 'deliveries', requestId);

  const unsubscribe = onSnapshot(
    deliveryDoc,
    (docSnapshot) => {
      if (!docSnapshot.exists()) {
        console.warn(`Delivery ${requestId} not found`);
        return;
      }

      const data = docSnapshot.data();
      if (!data) {
        console.warn(`Delivery ${requestId} data is empty`);
        return;
      }

      const trackingData: DeliveryTrackingData = {
        requestId: data.requestId,
        gillerId: data.gillerId,
        currentLocation: {
          latitude: data.currentLocation?.latitude ?? 37.5,
          longitude: data.currentLocation?.longitude ?? 127.0,
          station: data.currentLocation?.station ?? '위치 정보 없음',
          updatedAt: data.currentLocation?.updatedAt?.toDate() ?? new Date(),
          status: data.currentLocation?.status ?? 'moving',
        },
        estimatedArrival: data.estimatedArrival?.toDate() ?? new Date(),
        progress: calculateProgress(data),
        status: data.status ?? 'in-transit',
      };

      onUpdate(trackingData);
    },
    (error) => {
      console.error('Error listening to delivery updates:', error);
    }
  );

  return unsubscribe;
}

/**
 * 길러 현재 위치를 배송 문서에 반영합니다.
 */
export async function updateGillerLocation(
  gillerId: string,
  requestId: string,
  location: {
    latitude: number;
    longitude: number;
    station: string;
    status: 'moving' | 'waiting' | 'arrived';
  }
): Promise<void> {
  try {
    const deliveryDoc = doc(db, 'deliveries', requestId);

    await updateDoc(deliveryDoc, {
      currentLocation: {
        ...location,
        updatedAt: new Date(),
      },
      lastLocationUpdateAt: new Date(),
    });

    // Giller location updated for request
  } catch (error) {
    console.error('Error updating giller location:', error);
    throw error;
  }
}

function calculateProgress(deliveryData: Record<string, any>): number {
  if (!deliveryData.pickupStation ?? !deliveryData.deliveryStation) {
    return 0;
  }

  const pickupTime = deliveryData.pickupCompletedAt?.toDate?.() ?? new Date();
  const deliveryTime =
    deliveryData.deliveryCompletedAt?.toDate?.() ?? new Date(Date.now() + 30 * 60 * 1000);
  const currentTime = new Date();

  const totalDuration = deliveryTime.getTime() - pickupTime.getTime();
  const elapsed = currentTime.getTime() - pickupTime.getTime();

  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

/**
 * 길러의 위치를 10초마다 갱신합니다.
 */
export function startLocationUpdates(
  gillerId: string,
  requestId: string,
  initialLocation: {
    latitude: number;
    longitude: number;
    station: string;
    status: 'moving' | 'waiting' | 'arrived';
  }
): ReturnType<typeof setInterval> {
  void updateGillerLocation(gillerId, requestId, initialLocation);

  const intervalId = setInterval(async () => {
    try {
      const currentLocation = await getCurrentLocation();
      await updateGillerLocation(gillerId, requestId, currentLocation);
    } catch (error) {
      console.error('Error in location update interval:', error);
    }
  }, 10000);

  // Started location updates for request
  return intervalId;
}

export function stopLocationUpdates(intervalId: ReturnType<typeof setInterval>): void {
  clearInterval(intervalId);
  // Location updates stopped
}

/**
 * 현재 위치를 가져옵니다.
 * 현재는 mock 좌표를 반환하며, 실제 구현에서는 Geolocation API 연동이 필요합니다.
 */
function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  station: string;
  status: 'moving' | 'waiting' | 'arrived';
}> {
  return Promise.resolve({
    latitude: 37.5 + Math.random() * 0.01,
    longitude: 127.0 + Math.random() * 0.01,
    station: '이동 중',
    status: 'moving',
  });
}

export async function completeDelivery(requestId: string, _gillerId: string): Promise<void> {
  try {
    const deliveryDoc = doc(db, 'deliveries', requestId);

    await updateDoc(deliveryDoc, {
      status: 'delivered',
      deliveryCompletedAt: new Date(),
      progress: 100,
    });

    // Delivery completed by giller
  } catch (error) {
    console.error('Error completing delivery:', error);
    throw error;
  }
}

export async function completePickup(requestId: string, _gillerId: string): Promise<void> {
  try {
    const deliveryDoc = doc(db, 'deliveries', requestId);

    await updateDoc(deliveryDoc, {
      status: 'in-transit',
      pickupCompletedAt: new Date(),
      progress: 10,
    });

    // Pickup completed for request by giller
  } catch (error) {
    console.error('Error completing pickup:', error);
    throw error;
  }
}
