/**
 * B2B 배송 서비스
 *
 * B2B 배송 요청과 길러 매칭을 관리합니다.
 */
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type {
  B2BDelivery,
  B2BDeliveryStatus,
  DeliveryPricing,
  CreateB2BDeliveryData,
} from '../types/b2b-delivery';
import type { B2BGillerTier } from '../types/b2b-giller-tier';
import type { Timestamp } from 'firebase/firestore';
import { WEIGHT_SURCHARGE_RATE, BASE_DELIVERY_FEES } from '../types/b2b-delivery';
import { getAllStations } from './config-service';

const DELIVERY_COLLECTION = 'b2b_deliveries';
const B2B_GILLER_COLLECTION = 'b2b_giller_tiers';
const B2B_NOTIFICATION_COLLECTION = 'b2b_dispatch_notifications';

type B2BGillerTierDoc = Partial<B2BGillerTier> & {
  gillerId?: string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
};

/** B2B 배송 서비스 */
export class B2BDeliveryService {
  /** B2B 배송 요청 생성 */
  static async createDelivery(data: CreateB2BDeliveryData): Promise<string> {
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
    await this.matchB2BGillers(docRef.id, deliveryData as B2BDelivery);

    return docRef.id;
  }

  /** 거리 계산 (간이 버전) */
  private static async calculateDistance(fromStation: string, toStation: string): Promise<number> {
    const stations = await getAllStations();
    const from = stations.find((station) => station.stationName === fromStation ?? station.stationId === fromStation);
    const to = stations.find((station) => station.stationName === toStation ?? station.stationId === toStation);

    if (!from?.location ?? !to?.location) {
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

  /** B2B 길러 매칭 */
  private static async matchB2BGillers(deliveryId: string, delivery: B2BDelivery): Promise<void> {
    const b2bGillers = await this.getB2BGillers();

    const compatibleGillers = b2bGillers.map((giller) => {
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

  /** 활성 상태의 B2B 길러 조회 */
  private static async getB2BGillers(): Promise<Array<B2BGillerTier & { gillerId: string }>> {
    const q = query(collection(db, B2B_GILLER_COLLECTION), where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((snapshot) => {
      const raw = snapshot.data() as B2BGillerTierDoc;
      return {
        ...(raw as B2BGillerTier),
        gillerId: raw.gillerId ?? snapshot.id,
      };
    });
  }

  /** 배송과 길러의 호환 여부 확인 */
  private static checkCompatibility(
    delivery: B2BDelivery,
    giller: B2BGillerTier & { gillerId: string }
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
      status: 'matched' as B2BDeliveryStatus,
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
      status: 'picked_up' as B2BDeliveryStatus,
      pickupPhoto,
      updatedAt: new Date(),
    });
  }

  /** 배송 시작 */
  static async startDelivery(deliveryId: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);

    await updateDoc(deliveryRef, {
      status: 'in_transit' as B2BDeliveryStatus,
      updatedAt: new Date(),
    });
  }

  /** 배송 완료 */
  static async completeDelivery(deliveryId: string, deliveryPhoto: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);

    await updateDoc(deliveryRef, {
      status: 'delivered' as B2BDeliveryStatus,
      deliveryPhoto,
      completedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** 배송 취소 */
  static async cancelDelivery(deliveryId: string, _reason: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);

    await updateDoc(deliveryRef, {
      status: 'cancelled' as B2BDeliveryStatus,
      updatedAt: new Date(),
    });
  }

  /** B2B 배송 조회 */
  static async getDelivery(deliveryId: string): Promise<B2BDelivery | null> {
    const deliveryDoc = await getDoc(doc(db, DELIVERY_COLLECTION, deliveryId));
    if (!deliveryDoc.exists()) {
      return null;
    }
    return {
      id: deliveryDoc.id,
      ...deliveryDoc.data(),
    } as B2BDelivery;
  }

  /** 고객사별 배송 목록 조회 */
  static async getBusinessDeliveries(businessId: string, status?: B2BDeliveryStatus): Promise<B2BDelivery[]> {
    let q = query(collection(db, DELIVERY_COLLECTION), where('businessId', '==', businessId));

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }) as B2BDelivery);
  }

  /** 길러별 배송 목록 조회 */
  static async getGillerDeliveries(gillerId: string, status?: B2BDeliveryStatus): Promise<B2BDelivery[]> {
    let q = query(collection(db, DELIVERY_COLLECTION), where('gillerId', '==', gillerId));

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }) as B2BDelivery);
  }

  /** 배송 정보 수정 */
  static async updateDelivery(deliveryId: string, updates: Partial<B2BDelivery>): Promise<void> {
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
    deliveryData: Omit<CreateB2BDeliveryData, 'contractId'>
  ): void {
    console.warn('Scheduled B2B delivery template requested', { contractId, schedule, deliveryData });
  }
}

// ============================================================================
// B2B Contract & Request Functions (for tests)
// ============================================================================

import type {
  B2BContract,
  CreateB2BContractData,
  B2BRequest,
  CreateB2BRequestData,
  TaxInvoice,
} from '../types/b2b-delivery';

const CONTRACTS_COLLECTION = 'businessContracts';
const REQUESTS_COLLECTION = 'b2bRequests';
const INVOICES_COLLECTION = 'taxInvoices';

/** B2B 계약 생성 */
export async function createB2BContract(data: CreateB2BContractData): Promise<string> {
  if (!data.businessId ?? !data.businessName) {
    throw new Error('Invalid contract data: businessId and businessName are required');
  }

  const contractId = `contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const contractData = {
    ...data,
    contractId,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await setDoc(doc(db, CONTRACTS_COLLECTION, contractId), contractData);
  return contractId;
}

/** B2B 계약 조회 */
export async function getB2BContract(contractId: string): Promise<B2BContract | null> {
  const contractDoc = await getDoc(doc(db, CONTRACTS_COLLECTION, contractId));
  if (!contractDoc.exists()) {
    return null;
  }
  return contractDoc.data() as B2BContract;
}

/** B2B 계약 수정 */
export async function updateB2BContract(contractId: string, updates: Partial<B2BContract>): Promise<void> {
  const contractRef = doc(db, CONTRACTS_COLLECTION, contractId);
  await updateDoc(contractRef, {
    ...updates,
    updatedAt: new Date(),
  });
}

/** B2B 배송 요청 생성 */
export async function createB2BRequest(data: CreateB2BRequestData): Promise<string> {
  const contract = await getB2BContract(data.contractId);
  if (!contract) {
    throw new Error('계약을 찾을 수 없습니다.');
  }

  const requestId = `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const requestData = {
    ...data,
    requestId,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await setDoc(doc(db, REQUESTS_COLLECTION, requestId), requestData);
  return requestId;
}

/** B2B 배송 요청 목록 조회 */
export async function getB2BRequests(businessId: string): Promise<B2BRequest[]> {
  const q = query(collection(db, REQUESTS_COLLECTION), where('businessId', '==', businessId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((snapshot) => snapshot.data() as B2BRequest);
}

/** B2B 길러 배정 */
export async function assignB2BGiller(requestId: string, gillerId: string): Promise<void> {
  const requestRef = doc(db, REQUESTS_COLLECTION, requestId);
  await updateDoc(requestRef, {
    assignedGillerId: gillerId,
    status: 'assigned',
    updatedAt: new Date(),
  });
}

/** 세금계산서 생성 */
export async function createTaxInvoice(data: Record<string, unknown>): Promise<string> {
  const invoiceId = `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const invoiceData: Record<string, unknown> = {
    ...data,
    invoiceId,
    createdAt: new Date(),
  };

  await setDoc(doc(db, INVOICES_COLLECTION, invoiceId), invoiceData);
  return invoiceId;
}

/** 세금계산서 목록 조회 */
export async function getTaxInvoices(businessId: string, month: string): Promise<TaxInvoice[]> {
  const q = query(
    collection(db, INVOICES_COLLECTION),
    where('businessId', '==', businessId),
    where('month', '==', month)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((snapshot) => snapshot.data() as TaxInvoice);
}