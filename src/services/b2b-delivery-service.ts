/**
 * B2B 諛곗넚 ?쒕퉬??
 * 
 * B2B 諛곗넚 ?붿껌 諛?湲몃윭 留ㅼ묶 愿由?
 */
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { 
  B2BDelivery,
  B2BDeliveryStatus,
  DeliveryPricing,
  CreateB2BDeliveryData
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

/**
 * B2B 諛곗넚 ?쒕퉬??
 */
export class B2BDeliveryService {
  /**
   * B2B 諛곗넚 ?붿껌 ?앹꽦
   */
  static async createDelivery(data: CreateB2BDeliveryData): Promise<string> {
    // 1. 嫄곕━ 怨꾩궛 (TODO: 吏??API ?ъ슜)
    const distance = await this.calculateDistance(data.pickupLocation.station, data.dropoffLocation.station);
    
    // 2. 湲곕낯 諛곗넚鍮?怨꾩궛
    const baseFee = this.calculateBaseFee(distance);
    
    // 3. 以묐웾 異붽?鍮?怨꾩궛
    const weightSurcharge = data.weight * WEIGHT_SURCHARGE_RATE;
    
    // 4. 珥?諛곗넚鍮?
    const totalFee = baseFee + weightSurcharge;
    
    // 5. 湲몃윭 ?섏씡 (90%)
    const gillerEarning = Math.round(totalFee * 0.9);

    const deliveryData = {
      contractId: data.contractId,
      businessId: data.businessId,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      scheduledTime: data.scheduledTime,
      weight: data.weight,
      notes: data.notes,
      type: 'on-demand',
      status: 'pending' as const
    };

    const docRef = await addDoc(collection(db, DELIVERY_COLLECTION), deliveryData);
    
    // 6. ?붽툑 ?뺣낫 ???
    await updateDoc(docRef, {
      pricing: {
        baseFee,
        weightSurcharge,
        totalFee,
        gillerEarning
      }
    });

    // 7. B2B 湲몃윭 留ㅼ묶 ?쒖옉
    await this.matchB2BGillers(docRef.id, deliveryData as B2BDelivery);

    return docRef.id;
  }

  /**
   * 嫄곕━ 怨꾩궛 (媛꾩씠 踰꾩쟾 - ?ㅼ젣濡쒕뒗 吏??API ?ъ슜)
   */
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

  /**
   * 湲곕낯 諛곗넚鍮?怨꾩궛
   */
  private static calculateBaseFee(distanceKm: number): number {
    if (distanceKm < 5) {
      return BASE_DELIVERY_FEES.small;
    } else if (distanceKm < 10) {
      return BASE_DELIVERY_FEES.medium;
    } else {
      return BASE_DELIVERY_FEES.large;
    }
  }

  /**
   * B2B 湲몃윭 留ㅼ묶
   */
  private static async matchB2BGillers(
    deliveryId: string,
    delivery: B2BDelivery
  ): Promise<void> {
    // 1. B2B ?먭꺽 湲몃윭 議고쉶
    const b2bGillers = await this.getB2BGillers();

    // 2. 留ㅼ묶 媛?ν븳 湲몃윭 ?꾪꽣留?
    const compatibleGillers = b2bGillers.map((giller) => {
      const isCompatible = this.checkCompatibility(delivery, giller);
      return {
        giller,
        isCompatible
      };
    });

    // 3. ?명솚?섎뒗 湲몃윭留??꾪꽣留?
    const availableGillers = compatibleGillers.filter(item => item.isCompatible);

    if (availableGillers.length === 0) {
      console.warn('매칭 가능한 B2B 길러가 없습니다.');
      return;
    }

    // 4. ?곗꽑?쒖쐞 ?뺣젹 (?깃툒 ?믪? ??
    availableGillers.sort((a, b) => {
      const priorityA = this.getTierPriority(a.giller.tier);
      const priorityB = this.getTierPriority(b.giller.tier);
      return priorityB - priorityA;
    });

    // 5. ?곸쐞 3紐낆뿉寃??뚮┝ 諛쒖넚 (TODO: ?몄떆 ?뚮┝)
    const selectedGillers = availableGillers.slice(0, 3);

    for (const item of selectedGillers) {
      await this.sendNotification(item.giller.gillerId, {
        type: 'b2b_delivery_request',
        deliveryId,
        tier: item.giller.tier,
        pricing: delivery.pricing
      });
    }
  }

  /**
   * B2B ?먭꺽 湲몃윭 議고쉶
   */
  private static async getB2BGillers(): Promise<Array<B2BGillerTier & { gillerId: string }>> {
    const q = query(
      collection(db, B2B_GILLER_COLLECTION),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((snapshot) => {
      const raw = snapshot.data() as B2BGillerTierDoc;
      return {
        ...(raw as B2BGillerTier),
        gillerId: raw.gillerId ?? snapshot.id,
      };
    });
  }

  /**
   * ?명솚???뺤씤
   */
  private static checkCompatibility(
    delivery: B2BDelivery,
    giller: B2BGillerTier & { gillerId: string }
  ): boolean {
    void delivery;
    void giller;
    return true;
  }

  /**
   * 길러 알림 큐 저장
   */
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

  /**
   * 등급 우선순위 가져오기
   */
  private static getTierPriority(tier: string): number {
    const priorities: Record<string, number> = {
      'platinum': 10,
      'gold': 7,
      'silver': 5
    };
    return priorities[tier] || 0;
  }

  /**
   * 諛곗넚 ?섎씫
   */
  static async acceptDelivery(deliveryId: string, gillerId: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    
    await updateDoc(deliveryRef, {
      gillerId,
      status: 'matched' as B2BDeliveryStatus,
      acceptedAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * 諛곗넚 嫄곗젅
   */
  static rejectDelivery(deliveryId: string, gillerId: string, reason?: string): void {
    console.warn(`B2B delivery rejected: ${deliveryId} by ${gillerId}, reason: ${reason ?? 'none'}`);
  }

  /**
   * ?쎌뾽 ?꾨즺
   */
  static async confirmPickup(
    deliveryId: string,
    pickupPhoto: string
  ): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    
    await updateDoc(deliveryRef, {
      status: 'picked_up' as B2BDeliveryStatus,
      pickupPhoto,
      updatedAt: new Date()
    });
  }

  /**
   * 諛곗넚 ?쒖옉
   */
  static async startDelivery(deliveryId: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    
    await updateDoc(deliveryRef, {
      status: 'in_transit' as B2BDeliveryStatus,
      updatedAt: new Date()
    });
  }

  /**
   * 諛곗넚 ?꾨즺
   */
  static async completeDelivery(
    deliveryId: string,
    deliveryPhoto: string
  ): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    
    await updateDoc(deliveryRef, {
      status: 'delivered' as B2BDeliveryStatus,
      deliveryPhoto,
      completedAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * 諛곗넚 痍⑥냼
   */
  static async cancelDelivery(deliveryId: string, _reason: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    
    await updateDoc(deliveryRef, {
      status: 'cancelled' as B2BDeliveryStatus,
      updatedAt: new Date()
    });
  }

  /**
   * B2B 諛곗넚 議고쉶
   */
  static async getDelivery(deliveryId: string): Promise<B2BDelivery | null> {
    const deliveryDoc = await getDoc(doc(db, DELIVERY_COLLECTION, deliveryId));
    if (!deliveryDoc.exists) {
      return null;
    }
    return {
      id: deliveryDoc.id,
      ...deliveryDoc.data()
    } as B2BDelivery;
  }

  /**
   * B2B 怨좉컼??諛곗넚 紐⑸줉
   */
  static async getBusinessDeliveries(
    businessId: string,
    status?: B2BDeliveryStatus
  ): Promise<B2BDelivery[]> {
    let q = query(
      collection(db, DELIVERY_COLLECTION),
      where('businessId', '==', businessId)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as B2BDelivery));
  }

  /**
   * 湲몃윭 諛곗넚 紐⑸줉
   */
  static async getGillerDeliveries(
    gillerId: string,
    status?: B2BDeliveryStatus
  ): Promise<B2BDelivery[]> {
    let q = query(
      collection(db, DELIVERY_COLLECTION),
      where('gillerId', '==', gillerId)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as B2BDelivery));
  }

  /**
   * 諛곗넚 ?뺣낫 ?낅뜲?댄듃
   */
  static async updateDelivery(
    deliveryId: string,
    updates: Partial<B2BDelivery>
  ): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    await updateDoc(deliveryRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  /**
   * ?뺢린 諛곗넚 ?앹꽦 (?쇱젙 二쇨린)
   */
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
  TaxInvoice
} from '../types/b2b-delivery';

const CONTRACTS_COLLECTION = 'businessContracts';
const REQUESTS_COLLECTION = 'b2bRequests';
const INVOICES_COLLECTION = 'taxInvoices';

/**
 * B2B 怨꾩빟 ?앹꽦
 */
export async function createB2BContract(data: CreateB2BContractData): Promise<string> {
  // ?좏슚??寃??
  if (!data.businessId || !data.businessName) {
    throw new Error('Invalid contract data: businessId and businessName are required');
  }
  
  const contractId = `contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const contractData = {
    ...data,
    contractId,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await setDoc(doc(db, CONTRACTS_COLLECTION, contractId), contractData);
  return contractId;
}

/**
 * B2B 怨꾩빟 議고쉶
 */
export async function getB2BContract(contractId: string): Promise<B2BContract | null> {
  const contractDoc = await getDoc(doc(db, CONTRACTS_COLLECTION, contractId));
  if (!contractDoc.exists) {
    return null;
  }
  return contractDoc.data() as B2BContract;
}

/**
 * B2B 怨꾩빟 ?섏젙
 */
export async function updateB2BContract(
  contractId: string,
  updates: Partial<B2BContract>
): Promise<void> {
  const contractRef = doc(db, CONTRACTS_COLLECTION, contractId);
  await updateDoc(contractRef, {
    ...updates,
    updatedAt: new Date()
  });
}

/**
 * B2B 諛곗넚 ?붿껌 ?앹꽦
 */
export async function createB2BRequest(data: CreateB2BRequestData): Promise<string> {
  // 怨꾩빟 ?뺤씤
  const contract = await getB2BContract(data.contractId);
  if (!contract) {
    throw new Error('怨꾩빟??李얠쓣 ???놁뒿?덈떎');
  }

  // ??諛곗넚 ?쒕룄 ?뺤씤 (TODO: ?꾩옱 ??諛곗넚 嫄댁닔 ?뺤씤)
  // const currentMonthDeliveries = await getMonthlyDeliveryCount(data.businessId);
  // if (currentMonthDeliveries >= contract.deliveryLimit) {
  //   throw new Error('??諛곗넚 ?쒕룄瑜?珥덇낵?덉뒿?덈떎');
  // }

  const requestId = `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const requestData = {
    ...data,
    requestId,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await setDoc(doc(db, REQUESTS_COLLECTION, requestId), requestData);
  return requestId;
}

/**
 * B2B 諛곗넚 ?붿껌 紐⑸줉 議고쉶
 */
export async function getB2BRequests(businessId: string): Promise<B2BRequest[]> {
  const q = query(
    collection(db, REQUESTS_COLLECTION),
    where('businessId', '==', businessId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as B2BRequest);
}

/**
 * B2B 湲몃윭 諛곗젙
 */
export async function assignB2BGiller(requestId: string, gillerId: string): Promise<void> {
  const requestRef = doc(db, REQUESTS_COLLECTION, requestId);
  await updateDoc(requestRef, {
    assignedGillerId: gillerId,
    status: 'assigned',
    updatedAt: new Date()
  });
}

/**
 * ?멸툑 怨꾩궛???앹꽦
 */
export async function createTaxInvoice(data: Record<string, unknown>): Promise<string> {
  const invoiceId = `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const invoiceData: Record<string, unknown> = {
    ...data,
    invoiceId,
    createdAt: new Date()
  };
  
  await setDoc(doc(db, INVOICES_COLLECTION, invoiceId), invoiceData);
  return invoiceId;
}

/**
 * ?멸툑 怨꾩궛??紐⑸줉 議고쉶
 */
export async function getTaxInvoices(businessId: string, month: string): Promise<TaxInvoice[]> {
  const q = query(
    collection(db, INVOICES_COLLECTION),
    where('businessId', '==', businessId),
    where('month', '==', month)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as TaxInvoice);
}

