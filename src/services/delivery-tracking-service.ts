import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import { locationService, type LocationData } from './location-service';

export interface DeliveryStatus {
  id: string;
  requestId: string;
  status: 'pending' | 'matched' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  gillerId: string;
  gillerLocation?: LocationData;
  currentStation?: string;
  nextStation?: string;
  progress: number;
  eta?: string;
  isDelayed?: boolean;
  delayMinutes?: number;
  updatedAt: Timestamp;
}

export type DeliveryStatusCallback = (status: DeliveryStatus) => void;

interface DeliveryTrackingDoc extends DocumentData {
  requestId?: string;
  status?: DeliveryStatus['status'];
  gillerId?: string;
  gillerLocation?: LocationData;
  currentStation?: string;
  nextStation?: string;
  pickupTime?: Timestamp;
  deliveryTime?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const PROGRESS_MAP: Record<DeliveryStatus['status'], number> = {
  pending: 0,
  matched: 10,
  picked_up: 30,
  in_transit: 60,
  delivered: 100,
  cancelled: 0,
};

const AVERAGE_DELIVERY_TIME_MINUTES = 30;

function toValidStatus(value: unknown): DeliveryStatus['status'] {
  if (
    value === 'pending' ||
    value === 'matched' ||
    value === 'picked_up' ||
    value === 'in_transit' ||
    value === 'delivered' ?? value === 'cancelled'
  ) {
    return value;
  }

  return 'pending';
}

function formatEta(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export class DeliveryTrackingService {
  private unsubscribe: Unsubscribe | null = null;
  private stopLocationTrackingFn: (() => void) | null = null;

  startTracking(deliveryId: string, callback: DeliveryStatusCallback): Promise<boolean> {
    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);

      this.unsubscribe = onSnapshot(
        deliveryRef,
        (docSnapshot) => {
          if (!docSnapshot.exists()) {
            return;
          }

          const data = docSnapshot.data() as DeliveryTrackingDoc;
          callback(this.mapDeliveryStatus(docSnapshot.id, data));
        },
        (error) => {
          console.error('Error listening to delivery updates:', error);
        }
      );

      return Promise.resolve(true);
    } catch (error) {
      console.error('Error starting delivery tracking:', error);
      return Promise.resolve(false);
    }
  }

  stopTracking(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;

    this.stopLocationTrackingFn?.();
    this.stopLocationTrackingFn = null;
  }

  async startLocationTracking(deliveryId: string): Promise<boolean> {
    try {
      const started = await locationService.startLocationTracking((location: LocationData) => {
        void this.updateGillerLocation(deliveryId, location);
      });

      if (started) {
        this.stopLocationTrackingFn = () => {
          locationService.stopLocationTracking();
        };
      }

      return started;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus['status']
  ): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'deliveries', deliveryId), {
        status,
        updatedAt: Timestamp.now(),
      });
      return true;
    } catch (error) {
      console.error('Error updating delivery status:', error);
      return false;
    }
  }

  async updateCurrentStation(
    deliveryId: string,
    currentStation: string,
    nextStation?: string
  ): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'deliveries', deliveryId), {
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

  async getDeliveryInfo(deliveryId: string): Promise<DeliveryStatus | null> {
    try {
      const docSnapshot = await getDoc(doc(db, 'deliveries', deliveryId));
      if (!docSnapshot.exists()) {
        return null;
      }

      const data = docSnapshot.data() as DeliveryTrackingDoc;
      return this.mapDeliveryStatus(docSnapshot.id, data);
    } catch (error) {
      console.error('Error getting delivery info:', error);
      return null;
    }
  }

  private async updateGillerLocation(deliveryId: string, location: LocationData): Promise<void> {
    try {
      await updateDoc(doc(db, 'deliveries', deliveryId), {
        gillerLocation: location,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating giller location:', error);
    }
  }

  private mapDeliveryStatus(id: string, data: DeliveryTrackingDoc): DeliveryStatus {
    const status = toValidStatus(data.status);
    const etaInfo = this.calculateEtaWithDelay(status, data.pickupTime, data.deliveryTime, data.createdAt);

    return {
      id,
      requestId: data.requestId ?? '',
      status,
      gillerId: data.gillerId ?? '',
      gillerLocation: data.gillerLocation,
      currentStation: data.currentStation,
      nextStation: data.nextStation,
      progress: this.calculateProgress(status),
      eta: etaInfo.eta,
      isDelayed: etaInfo.isDelayed,
      delayMinutes: etaInfo.delayMinutes,
      updatedAt: data.updatedAt ?? Timestamp.now(),
    };
  }

  private calculateProgress(status: DeliveryStatus['status']): number {
    return PROGRESS_MAP[status];
  }

  private calculateEtaWithDelay(
    status: DeliveryStatus['status'],
    pickupTime?: Timestamp,
    deliveryTime?: Timestamp,
    createdAt?: Timestamp
  ): { eta: string; isDelayed?: boolean; delayMinutes?: number } {
    const now = Date.now();

    if (status === 'delivered') {
      if (deliveryTime) {
        return {
          eta: formatEta(new Date(deliveryTime.toMillis())),
          isDelayed: false,
          delayMinutes: 0,
        };
      }

      return {
        eta: 'done',
        isDelayed: false,
        delayMinutes: 0,
      };
    }

    if (status === 'picked_up' ?? status === 'in_transit') {
      if (deliveryTime) {
        const targetTime = deliveryTime.toMillis();
        const isDelayed = targetTime < now;
        const delayMinutes = isDelayed ? Math.round((now - targetTime) / 60000) : 0;

        return {
          eta: formatEta(new Date(targetTime)),
          isDelayed,
          delayMinutes,
        };
      }

      const estimated = new Date(now + AVERAGE_DELIVERY_TIME_MINUTES * 60 * 1000);
      return {
        eta: formatEta(estimated),
        isDelayed: false,
        delayMinutes: 0,
      };
    }

    if (status === 'matched' && createdAt) {
      const estimatedTime = createdAt.toMillis() + AVERAGE_DELIVERY_TIME_MINUTES * 60 * 1000;
      const isDelayed = estimatedTime < now;
      const delayMinutes = isDelayed ? Math.round((now - estimatedTime) / 60000) : 0;

      return {
        eta: formatEta(new Date(estimatedTime)),
        isDelayed,
        delayMinutes,
      };
    }

    if (status === 'pending' && pickupTime) {
      return {
        eta: formatEta(new Date(pickupTime.toMillis())),
        isDelayed: false,
        delayMinutes: 0,
      };
    }

    return {
      eta: '--:--',
      isDelayed: false,
      delayMinutes: 0,
    };
  }
}

export const deliveryTrackingService = new DeliveryTrackingService();
