/**
 * B2B 배송 서비스
 * 
 * B2B 배송 요청 및 길러 매칭 관리
 */
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, addDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { 
  B2BDelivery,
  B2BDeliveryStatus,
  B2BDeliveryType,
  DeliveryPricing,
  Location,
  CreateB2BDeliveryData
} from '../types/b2b-delivery';
import type { B2BGillerTier } from '../types/b2b-giller-tier';
import { WEIGHT_SURCHARGE_RATE, BASE_DELIVERY_FEES } from '../types/b2b-delivery';

const DELIVERY_COLLECTION = 'b2b_deliveries';
const B2B_GILLER_COLLECTION = 'b2b_giller_tiers';

/**
 * B2B 배송 서비스
 */
export class B2BDeliveryService {
  /**
   * B2B 배송 요청 생성
   */
  static async createDelivery(data: CreateB2BDeliveryData): Promise<string> {
    // 1. 거리 계산 (TODO: 지도 API 사용)
    const distance = this.calculateDistance(data.pickupLocation.station, data.dropoffLocation.station);
    
    // 2. 기본 배송비 계산
    const baseFee = this.calculateBaseFee(distance);
    
    // 3. 중량 추가비 계산
    const weightSurcharge = data.weight * WEIGHT_SURCHARGE_RATE;
    
    // 4. 총 배송비
    const totalFee = baseFee + weightSurcharge;
    
    // 5. 길러 수익 (90%)
    const gillerEarning = Math.round(totalFee * 0.9);

    const deliveryData: Omit<B2BDelivery, 'id' | 'status' | 'pricing' | 'createdAt' | 'updatedAt'> = {
      contractId: data.contractId,
      businessId: '', // Firebase Auth UID에서 가져올 것
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      scheduledTime: data.scheduledTime,
      weight: data.weight,
      notes: data.notes,
      type: 'on-demand',
      status: 'pending'
    };

    const docRef = await addDoc(collection(db, DELIVERY_COLLECTION), deliveryData);
    
    // 6. 요금 정보 저장
    await updateDoc(docRef, {
      pricing: {
        baseFee,
        weightSurcharge,
        totalFee,
        gillerEarning
      }
    });

    // 7. B2B 길러 매칭 시작
    await this.matchB2BGillers(docRef.id, deliveryData as B2BDelivery);

    return docRef.id;
  }

  /**
   * 거리 계산 (간이 버전 - 실제로는 지도 API 사용)
   */
  private static calculateDistance(fromStation: string, toStation: string): number {
    // TODO: 지하철 역 간 실제 거리 계산
    // 임시: 역 이름으로 해싱하여 거리 추정
    const stationHash = fromStation.length + toStation.length;
    return stationHash * 2; // km 단위 추정
  }

  /**
   * 기본 배송비 계산
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
   * B2B 길러 매칭
   */
  private static async matchB2BGillers(
    deliveryId: string,
    delivery: B2BDelivery
  ): Promise<void> {
    // 1. B2B 자격 길러 조회
    const b2bGillers = await this.getB2BGillers();

    // 2. 매칭 가능한 길러 필터링
    const compatibleGillers = await Promise.all(
      b2bGillers.map(async (giller) => {
        const isCompatible = await this.checkCompatibility(delivery, giller);
        return {
          giller,
          isCompatible
        };
      })
    );

    // 3. 호환되는 길러만 필터링
    const availableGillers = compatibleGillers.filter(item => item.isCompatible);

    if (availableGillers.length === 0) {
      console.log('매칭 가능한 B2B 길러 없음');
      return;
    }

    // 4. 우선순위 정렬 (등급 높은 순)
    availableGillers.sort((a, b) => {
      const priorityA = this.getTierPriority(a.giller.tier);
      const priorityB = this.getTierPriority(b.giller.tier);
      return priorityB - priorityA;
    });

    // 5. 상위 3명에게 알림 발송 (TODO: 푸시 알림)
    const selectedGillers = availableGillers.slice(0, 3);

    for (const giller of selectedGillers) {
      await this.sendNotification(giller.gillerId, {
        type: 'b2b_delivery_request',
        deliveryId,
        tier: giller.tier,
        pricing: delivery.pricing
      });
    }
  }

  /**
   * B2B 자격 길러 조회
   */
  private static async getB2BGillers(): Promise<Array<B2BGillerTier & { gillerId: string }>> {
    const q = query(
      collection(db, B2B_GILLER_COLLECTION),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      gillerId: doc.data().gillerId,
      ...doc.data()
    } as B2BGillerTier & { gillerId: string }));
  }

  /**
   * 호환성 확인
   */
  private static async checkCompatibility(
    delivery: B2BDelivery,
    giller: B2BGillerTier & { gillerId: string }
  ): Promise<boolean> {
    // TODO: 길러 동선 확인, 일정 확인 등
    return true; // 임시: 모든 길러 호환
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
   * 푸시 알림 발송 (TODO: Firebase Cloud Messaging)
   */
  private static async sendNotification(gillerId: string, data: any): Promise<void> {
    // TODO: FCM 통해 알림 발송
    console.log(`알림 발송: ${gillerId}`, data);
  }

  /**
   * 배송 수락
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
   * 배송 거절
   */
  static async rejectDelivery(deliveryId: string, gillerId: string, reason?: string): Promise<void> {
    // TODO: 다른 길러에게 매칭 시도
    console.log(`배송 거절: ${deliveryId} by ${gillerId}, reason: ${reason}`);
  }

  /**
   * 픽업 완료
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
   * 배송 시작
   */
  static async startDelivery(deliveryId: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    
    await updateDoc(deliveryRef, {
      status: 'in_transit' as B2BDeliveryStatus,
      updatedAt: new Date()
    });
  }

  /**
   * 배송 완료
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
   * 배송 취소
   */
  static async cancelDelivery(deliveryId: string, reason: string): Promise<void> {
    const deliveryRef = doc(db, DELIVERY_COLLECTION, deliveryId);
    
    await updateDoc(deliveryRef, {
      status: 'cancelled' as B2BDeliveryStatus,
      updatedAt: new Date()
    });
  }

  /**
   * B2B 배송 조회
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
   * B2B 고객사 배송 목록
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
   * 길러 배송 목록
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
   * 배송 정보 업데이트
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
   * 정기 배송 생성 (일정 주기)
   */
  static async createScheduledDelivery(
    contractId: string,
    schedule: {
      frequency: 'daily' | 'weekly' | 'biweekly';
      preferredDays?: string[];
      preferredTime: string;
    },
    deliveryData: Omit<CreateB2BDeliveryData, 'contractId'>
  ): Promise<void> {
    // TODO: 스케줄링에 따라 배송 요청 자동 생성
    console.log('정기 배송 생성:', schedule, deliveryData);
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
 * B2B 계약 생성
 */
export async function createB2BContract(data: CreateB2BContractData): Promise<string> {
  // 유효성 검사
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
 * B2B 계약 조회
 */
export async function getB2BContract(contractId: string): Promise<B2BContract | null> {
  const contractDoc = await getDoc(doc(db, CONTRACTS_COLLECTION, contractId));
  if (!contractDoc.exists) {
    return null;
  }
  return contractDoc.data() as B2BContract;
}

/**
 * B2B 계약 수정
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
 * B2B 배송 요청 생성
 */
export async function createB2BRequest(data: CreateB2BRequestData): Promise<string> {
  // 계약 확인
  const contract = await getB2BContract(data.contractId);
  if (!contract) {
    throw new Error('계약을 찾을 수 없습니다');
  }

  // 월 배송 한도 확인 (TODO: 현재 월 배송 건수 확인)
  // const currentMonthDeliveries = await getMonthlyDeliveryCount(data.businessId);
  // if (currentMonthDeliveries >= contract.deliveryLimit) {
  //   throw new Error('월 배송 한도를 초과했습니다');
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
 * B2B 배송 요청 목록 조회
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
 * B2B 길러 배정
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
 * 세금 계산서 생성
 */
export async function createTaxInvoice(data: any): Promise<string> {
  const invoiceId = `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const invoiceData = {
    ...data,
    invoiceId,
    createdAt: new Date()
  };
  
  await setDoc(doc(db, INVOICES_COLLECTION, invoiceId), invoiceData);
  return invoiceId;
}

/**
 * 세금 계산서 목록 조회
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
