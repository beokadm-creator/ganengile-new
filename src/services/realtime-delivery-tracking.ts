/**
 * Real-time Delivery Tracking Service
 * Firestore onSnapshot을 활용한 실시간 위치 업데이트
 * 업데이트 주기: 10초
 */

import { doc, onSnapshot, updateDoc, Unsubscribe } from 'firebase/firestore';
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
  progress: number; // 0-100
  status: 'pending' | 'in-transit' | 'delivered';
}

/**
 * 실시간 배송 추적 리스너
 * @param requestId 배송 요청 ID
 * @param onUpdate 업데이트 콜백 (10초마다 호출)
 * @returns Unsubscribe 함수
 */
export function subscribeToDeliveryTracking(
  requestId: string,
  onUpdate: (data: DeliveryTrackingData) => void
): Unsubscribe {
  const deliveryDoc = doc(db, 'deliveries', requestId);

  // Firestore 실시간 리스너
  const unsubscribe = onSnapshot(deliveryDoc, (docSnapshot) => {
    if (!docSnapshot.exists) {
      console.warn(`Delivery ${requestId} not found`);
      return;
    }

    const data = docSnapshot.data();
    if (!data) {
      console.warn(`Delivery ${requestId} data is empty`);
      return;
    }

    // 실시간 추적 데이터 변환
    const trackingData: DeliveryTrackingData = {
      requestId: data.requestId,
      gillerId: data.gillerId,
      currentLocation: {
        latitude: data.currentLocation?.latitude || 37.5,
        longitude: data.currentLocation?.longitude || 127.0,
        station: data.currentLocation?.station || '알 수 없음',
        updatedAt: data.currentLocation?.updatedAt?.toDate() || new Date(),
        status: data.currentLocation?.status || 'moving'
      },
      estimatedArrival: data.estimatedArrival?.toDate() || new Date(),
      progress: calculateProgress(data),
      status: data.status || 'in-transit'
    };

    onUpdate(trackingData);
  }, (error) => {
    console.error('Error listening to delivery updates:', error);
  });

  return unsubscribe;
}

/**
 * 10초마다 위치 업데이트 (Giller가 호출)
 * @param gillerId 기일러 ID
 * @param requestId 배송 요청 ID
 * @param location 현재 위치
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
      'currentLocation': {
        ...location,
        updatedAt: new Date()
      },
      'lastLocationUpdateAt': new Date()
    });

    console.log(`✅ Giller ${gillerId} location updated for request ${requestId}`);
  } catch (error) {
    console.error('Error updating giller location:', error);
    throw error;
  }
}

/**
 * 진척도 계산 (0-100%)
 */
function calculateProgress(deliveryData: any): number {
  if (!deliveryData.pickupStation || !deliveryData.deliveryStation) {
    return 0;
  }

  const pickupTime = deliveryData.pickupCompletedAt?.toDate() || new Date();
  const deliveryTime = deliveryData.deliveryCompletedAt?.toDate() || new Date(Date.now() + 30 * 60 * 1000);
  const currentTime = new Date();

  const totalDuration = deliveryTime.getTime() - pickupTime.getTime();
  const elapsed = currentTime.getTime() - pickupTime.getTime();

  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

/**
 * 10초마다 자동 위치 업데이트 스케줄러 (Giller용)
 * @param gillerId 기일러 ID
 * @param requestId 배송 요청 ID
 * @param initialLocation 초기 위치
 * @returns Interval ID (취소 시 사용)
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
): number {
  // 즉시 첫 업데이트
  updateGillerLocation(gillerId, requestId, initialLocation);

  // 10초마다 업데이트
  const intervalId = setInterval(async () => {
    try {
      // GPS에서 현재 위치 가져오기 (모의)
      const currentLocation = await getCurrentLocation();

      await updateGillerLocation(gillerId, requestId, currentLocation);
    } catch (error) {
      console.error('Error in location update interval:', error);
    }
  }, 10000); // 10초

  console.log(`📍 Started location updates for request ${requestId} (every 10s)`);
  return intervalId;
}

/**
 * 위치 업데이트 중지
 */
export function stopLocationUpdates(intervalId: number): void {
  clearInterval(intervalId);
  console.log('⏹️ Location updates stopped');
}

/**
 * 현재 위치 가져오기 (모의 - 실제로는 Geolocation API 사용)
 */
async function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  station: string;
  status: 'moving' | 'waiting' | 'arrived';
}> {
  // 실제 구현에서는 navigator.geolocation.getCurrentPosition() 사용
  return {
    latitude: 37.5 + Math.random() * 0.01,
    longitude: 127.0 + Math.random() * 0.01,
    station: '이동 중',
    status: 'moving'
  };
}

/**
 * 배송 완료 처리
 */
export async function completeDelivery(
  requestId: string,
  gillerId: string
): Promise<void> {
  try {
    const deliveryDoc = doc(db, 'deliveries', requestId);

    await updateDoc(deliveryDoc, {
      'status': 'delivered',
      'deliveryCompletedAt': new Date(),
      'progress': 100
    });

    console.log(`✅ Delivery ${requestId} completed by giller ${gillerId}`);
  } catch (error) {
    console.error('Error completing delivery:', error);
    throw error;
  }
}

/**
 * 픽업 완료 처리
 */
export async function completePickup(
  requestId: string,
  gillerId: string
): Promise<void> {
  try {
    const deliveryDoc = doc(db, 'deliveries', requestId);

    await updateDoc(deliveryDoc, {
      'status': 'in-transit',
      'pickupCompletedAt': new Date(),
      'progress': 10
    });

    console.log(`✅ Pickup completed for request ${requestId} by giller ${gillerId}`);
  } catch (error) {
    console.error('Error completing pickup:', error);
    throw error;
  }
}
