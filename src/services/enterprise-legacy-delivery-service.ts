/**
 * Enterprise legacy delivery service.
 */
import { collection, doc, getDoc, updateDoc, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type {
  EnterpriseLegacyDelivery,
  EnterpriseLegacyDeliveryStatus,
  DeliveryPricing,
  CreateEnterpriseLegacyDeliveryData,
} from '../types/enterprise-legacy-delivery';
import type { EnterpriseLegacyGillerTier } from '../types/enterprise-legacy-giller-tier';
import type { Timestamp } from 'firebase/firestore';
import { WEIGHT_SURCHARGE_RATE, BASE_DELIVERY_FEES } from '../types/enterprise-legacy-delivery';
import { getAllStations } from './config-service';

const DELIVERY_COLLECTION = 'b2b_deliveries';
const B2B_GILLER_COLLECTION = 'b2b_giller_tiers';
const B2B_NOTIFICATION_COLLECTION = 'b2b_dispatch_notifications';

type EnterpriseLegacyGillerTierDoc = Partial<EnterpriseLegacyGillerTier> & {
  gillerId?: string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
};

/** Enterprise legacy delivery service */
export class EnterpriseLegacyDeliveryService {
  /** 레거시 기업 계약 배송 요청 생성 */
  static async createDelivery(data: CreateEnterpriseLegacyDeliveryData): Promise<string> {
    // 1. 거리 계산 (향후 외부 지도 API로 대체 가능)
    const distance = await this.calculateDistance(data.pickupLocation.station, data.dropoffLocation.station);

    // 2. 기본 배송비 계산
    const baseFee = this.calculateBaseFee(distance);

    // 3. 무게 추가 요금 계산
    const weightSurcharge = data.weight * WEIGHT_SURCHARGE_RATE;

    // 4. 총 배송비
    const totalFee = baseFee + weightSurcharge;

    // 5. 길러 수익 (현재 90%)
    const gillerEarning = Math.round(totalFee * 0.9);

    const pricing = {
      baseFee,
      weightSurcharge,
      totalFee,
      gillerEarning,
    };

    const deliveryData = {
      contractId: data.contractId,
      businessId: data.businessId,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      scheduledTime: data.scheduledTime,
      weight: data.weight,
      notes: data.notes,
      type: 'on-demand',
      status: 'pending' as const,
      pricing,
    };

    const docRef = await addDoc(collection(db, DELIVERY_COLLECTION), deliveryData);

    await updateDoc(docRef, {
      pricing,
    });

    // 6. B2B 길러 매칭 시작
    await this.matchEnterpriseLegacyGillers(docRef.id, deliveryData as EnterpriseLegacyDelivery);

    return docRef.id;
  }

  /** 거리 계산 (간이 버전) */
  private static async calculateDistance(fromStation: string, toStation: string): Promise<number> {
    const stations = await getAllStations();
    const from = stations.find((station) => station.stationName === fromStation || station.stationId === fromStation);
    const to = stations.find((station) => station.stationName === toStation || station.stationId === toStation);

    if (!from?.location || !to?.location) {
      const stationHash = fromStation.length + toStation.length;
      return stationHash * 2;
    }

    const toRad = (value: number): number => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(to.location.latitude - from.location.latitude);
    const dLon = toRad(to.location.longitude - from.location.longitude);
    const lat1 = toRad(from.location.latitude);
    const lat2 = toRad(to.location.latitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.max(1, Math.round(earthRadiusKm * c));
  }

  /** 기본 배송비 계산 */
  private static calculateBaseFee(distanceKm: number): number {
    if (distanceKm < 5) {
      return BASE_DELIVERY_FEES.small;
    }
    if (distanceKm < 10) {
      return BASE_DELIVERY_FEES.medium;
    }
    return BASE_DELIVERY_FEES.large;
  }

  /** 레거시 기업 계약 길러 매칭 */
  private static async matchEnterpriseLegacyGillers(deliveryId: string, delivery: EnterpriseLegacyDelivery): Promise<void> {
    const enterpriseLegacyGillers = await this.getEnterpriseLegacyGillers();

    const compatibleGillers = enterpriseLegacyGillers.map((giller) => {
      const isCompatible = this.checkCompatibility(delivery, giller);
      return {
        giller,
        isCompatible,
      };
    });

    const availableGillers = compatibleGillers.filter((item) => item.isCompatible);

    if (availableGillers.length === 0) {
      console.warn('매칭 가능한 B2B 길러가 없습니다.');
      return;
    }

    availableGillers.sort((a, b) => {
      const priorityA = this.getTierPriority(a.giller.tier);
      const priorityB = this.getTierPriority(b.giller.tier);
      return priorityB - priorityA;
    });

    const selectedGillers = availableGillers.slice(0, 3);

    for (const item of selectedGillers) {
      await this.sendNotification(item.giller.gillerId, {
        type: 'b2b_delivery_request',
        deliveryId,
        tier: item.giller.tier,
        pricing: delivery.pricing,
      });
    }
  }

  /** 활성 상태의 레거시 기업 계약 길러 조회 */
  private static async getEnterpriseLegacyGillers(): Promise<Array<EnterpriseLegacyGillerTier & { gillerId: string }>> {
    const q = query(collection(db, B2B_GILLER_COLLECTION), where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((snapshot) => {
      const raw = snapshot.data() as EnterpriseLegacyGillerTierDoc;
      return {
        ...(raw as EnterpriseLegacyGillerTier),
        gillerId: raw.gillerId ?? snapshot.id,
      };
    });
  }

  /** 배송과 길러의 호환 여부 확인 */
  private static checkCompatibility(
    delivery: EnterpriseLegacyDelivery,
    giller: EnterpriseLegacyGillerTier & { gillerId: string }
  ): boolean {
    void delivery;
    void giller;
    return true;
  }

  /** 길러 알림 큐 저장 */
  private static async sendNotification(
    gillerId: string,
    data: {
      type: string;
      deliveryId: string;
      tier: string;
      pricing?: DeliveryPricing;
    }
  ): Promise<void> {
    await addDoc(collection(db, B2B_NOTIFICATION_COLLECTION), {
      gillerId,
      ...data,
      status: 'queued',
      createdAt: serverTimestamp(),
    });
  }

  /** 등급 우선순위 가져오기 */
  private static getTierPriority(tier: string): number {
    const priorities: Record<string, number> = {
      platinum: 10,
      gold: 7,
      silver: 5,
    };
    return priorities[tier] ?? 0;
  }

  /** 배송 수락 */
  static async acceptDelivery(deliveryId: string, gillerId: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);

    await updateDoc(deliveryRef, {
      gillerId,
      status: 'matched' as EnterpriseLegacyDeliveryStatus,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** 배송 거절 */
  static rejectDelivery(deliveryId: string, gillerId: string, reason?: string): void {
    console.warn(`B2B delivery rejected: ${deliveryId} by ${gillerId}, reason: ${reason ?? 'none'}`);
  }

  /** 픽업 완료 */
  static async confirmPickup(deliveryId: string, pickupPhoto: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);

    await updateDoc(deliveryRef, {
      status: 'picked_up' as EnterpriseLegacyDeliveryStatus,
      pickupPhoto,
      updatedAt: new Date(),
    });
  }

  /** 배송 시작 */
  static async startDelivery(deliveryId: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);

    await updateDoc(deliveryRef, {
      status: 'in_transit' as EnterpriseLegacyDeliveryStatus,
      updatedAt: new Date(),
    });
  }

  /** 배송 완료 */
  static async completeDelivery(deliveryId: string, deliveryPhoto: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);

    await updateDoc(deliveryRef, {
      status: 'delivered' as EnterpriseLegacyDeliveryStatus,
      deliveryPhoto,
      completedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** 배송 취소 */
  static async cancelDelivery(deliveryId: string, _reason: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);

    await updateDoc(deliveryRef, {
      status: 'cancelled' as EnterpriseLegacyDeliveryStatus,
      updatedAt: new Date(),
    });
  }

  /** 레거시 기업 계약 배송 조회 */
  static async getDelivery(deliveryId: string): Promise<EnterpriseLegacyDelivery | null> {
    const deliveryDoc = await getDoc(doc(db, DELIVERY_COLLECTION, deliveryId));
    if (!deliveryDoc.exists()) {
      return null;
    }
    return {
      id: deliveryDoc.id,
      ...deliveryDoc.data(),
    } as EnterpriseLegacyDelivery;
  }

  /** 고객사별 배송 목록 조회 */
  static async getBusinessDeliveries(businessId: string, status?: EnterpriseLegacyDeliveryStatus): Promise<EnterpriseLegacyDelivery[]> {
    let q = query(collection(db, DELIVERY_COLLECTION), where('businessId', '==', businessId));

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }) as EnterpriseLegacyDelivery);
  }

  /** 길러별 배송 목록 조회 */
  static async getGillerDeliveries(gillerId: string, status?: EnterpriseLegacyDeliveryStatus): Promise<EnterpriseLegacyDelivery[]> {
    let q = query(collection(db, DELIVERY_COLLECTION), where('gillerId', '==', gillerId));

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }) as EnterpriseLegacyDelivery);
  }

  /** 배송 정보 수정 */
  static async updateDelivery(deliveryId: string, updates: Partial<EnterpriseLegacyDelivery>): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    await updateDoc(deliveryRef, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  /** 정기 배송 템플릿 생성 */
  static createScheduledDelivery(
    contractId: string,
    schedule: {
      frequency: 'daily' | 'weekly' | 'biweekly';
      preferredDays?: string[];
      preferredTime: string;
    },
    deliveryData: Omit<CreateEnterpriseLegacyDeliveryData, 'contractId'>
  ): void {
    console.warn('Scheduled B2B delivery template requested', { contractId, schedule, deliveryData });
  }
}
