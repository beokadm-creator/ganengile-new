/**
 * Real-time Delivery Tracking Service
 * 
 * 기능:
 * - Firestore 실시간 리스너로 배송 상태 추적
 * - Giller 위치 업데이트
 * - 배송 진행률 계산 (개선됨)
 * - ETA (예상 도착 시간) 계산 (지연 보정 포함)
 * @version 2.0.0 - 최적화 완료
 */

import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  getDoc,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { LocationData, locationService } from './location-service';

export interface DeliveryStatus {
  id: string;
  requestId: string;
  status: 'pending' | 'matched' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  gillerId: string;
  gillerLocation?: LocationData;
  currentStation?: string;
  nextStation?: string;
  progress: number; // 0-100
  eta?: string; // 예상 도착 시간 (HH:mm format)
  isDelayed?: boolean; // 지연 여부
  delayMinutes?: number; // 지연 시간 (분)
  updatedAt: Timestamp;
}

export type DeliveryStatusCallback = (status: DeliveryStatus) => void;

// 배송 상태별 진척률 매핑 (개선됨)
const PROGRESS_MAP: Record<string, number> = {
  'pending': 0,
  'matched': 10,
  'picked_up': 30,
  'in_transit': 60,
  'delivered': 100,
  'cancelled': 0,
};

// 평균 배송 시간 (분)
const AVERAGE_DELIVERY_TIME = 30;

export class DeliveryTrackingService {
  private unsubscribe: Unsubscribe | null = null;
  private locationTrackingStopped: (() => void) | null = null;

  /**
   * 배송 실시간 추적 시작 (Giller/Requester 모두 사용)
   */
  async startTracking(
    deliveryId: string,
    callback: DeliveryStatusCallback
  ): Promise<boolean> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);

      // Firestore 실시간 리스너
      this.unsubscribe = onSnapshot(
        deliveryRef,
        (docSnapshot) => {
          if (docSnapshot.exists) {
            const data = docSnapshot.data();
            
            // 진척률 계산 (개선된 로직)
            const progress = this.calculateProgress(data.status);
            
            // ETA 계산 (지연 보정 포함)
            const etaInfo = this.calculateETAWithDelay(
              data.status,
              data.pickupTime,
              data.deliveryTime,
              data.createdAt
            );

            const deliveryStatus: DeliveryStatus = {
              id: docSnapshot.id,
              requestId: data.requestId || '',
              status: data.status || 'pending',
              gillerId: data.gillerId || '',
              gillerLocation: data.gillerLocation,
              currentStation: data.currentStation,
              nextStation: data.nextStation,
              progress,
              eta: etaInfo.eta,
              isDelayed: etaInfo.isDelayed,
              delayMinutes: etaInfo.delayMinutes,
              updatedAt: data.updatedAt || Timestamp.now(),
            };

            callback(deliveryStatus);
          }
        },
        (error) => {
          console.error('Error listening to delivery updates:', error);
        }
      );

      return true;
    } catch (error) {
      console.error('Error starting delivery tracking:', error);
      return false;
    }
  }

  /**
   * 배송 추적 중지
   */
  stopTracking(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.locationTrackingStopped) {
      this.locationTrackingStopped();
      this.locationTrackingStopped = null;
    }
  }

  /**
   * Giller 위치 추적 시작 (Giller만 사용)
   */
  async startLocationTracking(
    deliveryId: string
  ): Promise<boolean> {
    try {
      const started = await locationService.startLocationTracking(
        async (location: LocationData) => {
          // Giller 위치를 Firestore에 업데이트
          await this.updateGillerLocation(deliveryId, location);
        }
      );

      if (started) {
        this.locationTrackingStopped = () => {
          locationService.stopLocationTracking();
        };
      }

      return started;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  /**
   * Giller 위치 업데이트
   */
  private async updateGillerLocation(
    deliveryId: string,
    location: LocationData
  ): Promise<void> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);

      await updateDoc(deliveryRef, {
        gillerLocation: location,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating giller location:', error);
    }
  }

  /**
   * 배송 상태 업데이트
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus['status']
  ): Promise<boolean> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);

      await updateDoc(deliveryRef, {
        status,
        updatedAt: Timestamp.now(),
      });

      return true;
    } catch (error) {
      console.error('Error updating delivery status:', error);
      return false;
    }
  }

  /**
   * 현재 역 업데이트
   */
  async updateCurrentStation(
    deliveryId: string,
    currentStation: string,
    nextStation?: string
  ): Promise<boolean> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);

      await updateDoc(deliveryRef, {
        currentStation,
        nextStation,
        updatedAt: Timestamp.now(),
      });

      return true;
    } catch (error) {
      console.error('Error updating current station:', error);
      return false;
    }
  }

  /**
   * 배송 진행률 계산 (개선됨)
   * @version 2.0.0 - 상태 매핑 사용으로 유지보수성 개선
   */
  private calculateProgress(status: string): number {
    return PROGRESS_MAP[status] ?? 0;
  }

  /**
   * ETA 계산 (지연 보정 포함)
   * @version 2.0.0 - 지연 감지 및 보정 로직 추가
   */
  private calculateETAWithDelay(
    status: string,
    pickupTime?: Timestamp,
    deliveryTime?: Timestamp,
    createdAt?: Timestamp
  ): { eta: string; isDelayed?: boolean; delayMinutes?: number } {
    const now = Date.now();

    // 배송 완료
    if (status === 'delivered') {
      if (deliveryTime) {
        return {
          eta: new Date(deliveryTime.toMillis()).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isDelayed: false,
          delayMinutes: 0,
        };
      }
      return {
        eta: '도착 완료',
        isDelayed: false,
      };
    }

    // 픽업 또는 이송 중
    if (status === 'picked_up' || status === 'in_transit') {
      // 목표 배송 시간이 있으면 그대로 사용
      if (deliveryTime) {
        const targetTime = deliveryTime.toMillis();
        const isDelayed = targetTime < now;
        const delayMinutes = isDelayed ? Math.round((now - targetTime) / 60000) : 0;

        return {
          eta: new Date(targetTime).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isDelayed,
          delayMinutes,
        };
      }

      // 목표 시간이 없으면 평균 시간으로 계산
      const estimatedTime = now + AVERAGE_DELIVERY_TIME * 60 * 1000;
      return {
        eta: new Date(estimatedTime).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isDelayed: false,
        delayMinutes: 0,
      };
    }

    // 매칭 대기 중
    if (status === 'matched' && createdAt) {
      // 매칭 시간으로부터 평균 배송 시간 계산
      const estimatedTime = createdAt.toMillis() + AVERAGE_DELIVERY_TIME * 60 * 1000;
      const isDelayed = estimatedTime < now;
      const delayMinutes = isDelayed ? Math.round((now - estimatedTime) / 60000) : 0;

      return {
        eta: new Date(estimatedTime).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isDelayed,
        delayMinutes,
      };
    }

    // 대기 중
    return {
      eta: '--:--',
      isDelayed: false,
      delayMinutes: 0,
    };
  }

  /**
   * 배송 정보 가져오기 (일회성)
   */
  async getDeliveryInfo(deliveryId: string): Promise<DeliveryStatus | null> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);
      const docSnapshot = await getDoc(deliveryRef);

      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        
        // 진척률 계산
        const progress = this.calculateProgress(data.status);
        
        // ETA 계산 (지연 보정 포함)
        const etaInfo = this.calculateETAWithDelay(
          data.status,
          data.pickupTime,
          data.deliveryTime,
          data.createdAt
        );

        return {
          id: docSnapshot.id,
          requestId: data.requestId || '',
          status: data.status || 'pending',
          gillerId: data.gillerId || '',
          gillerLocation: data.gillerLocation,
          currentStation: data.currentStation,
          nextStation: data.nextStation,
          progress,
          eta: etaInfo.eta,
          isDelayed: etaInfo.isDelayed,
          delayMinutes: etaInfo.delayMinutes,
          updatedAt: data.updatedAt || Timestamp.now(),
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting delivery info:', error);
      return null;
    }
  }
}

// Singleton instance
export const deliveryTrackingService = new DeliveryTrackingService();
