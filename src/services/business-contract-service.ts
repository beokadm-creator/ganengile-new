/**
 * @deprecated Use enterprise-legacy-contract-service instead.
 *
 * This file remains as a compatibility layer while the old enterprise customer
 * subscription flow is renamed away from the overloaded "B2B" label.
 */
import { collection, doc, getDoc, updateDoc, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { 
  BusinessContract, 
  SubscriptionTier, 
  ContractDuration,
  DeliverySettings,
  BillingInfo
} from '../types/business-contract';
import { SUBSCRIPTION_TIERS } from '../types/business-contract';

const COLLECTION = 'business_contracts';

/**
 * Legacy enterprise customer contract service.
 */
export class BusinessContractService {
  static async getSubscriptionTiers(): Promise<Array<{
    id: SubscriptionTier;
    name: string;
    price: number;
    deliveryLimit: number;
    pricePerDelivery: number;
    features: string[];
    isPopular?: boolean;
  }>> {
    return await Promise.resolve([
      {
        id: 'basic',
        name: '베이직',
        price: SUBSCRIPTION_TIERS.basic.pricing.monthly,
        deliveryLimit: SUBSCRIPTION_TIERS.basic.features.maxDeliveries,
        pricePerDelivery: SUBSCRIPTION_TIERS.basic.pricing.perDelivery,
        features: [
          '월 20건까지 이용',
          '이메일 지원',
          '소규모 매장에 적합',
        ],
      },
      {
        id: 'standard',
        name: '스탠다드',
        price: SUBSCRIPTION_TIERS.standard.pricing.monthly,
        deliveryLimit: SUBSCRIPTION_TIERS.standard.features.maxDeliveries,
        pricePerDelivery: SUBSCRIPTION_TIERS.standard.pricing.perDelivery,
        features: [
          '월 100건까지 이용',
          '전화 지원',
          '보험 및 리포트 포함',
        ],
        isPopular: true,
      },
      {
        id: 'premium',
        name: '프리미엄',
        price: SUBSCRIPTION_TIERS.premium.pricing.monthly,
        deliveryLimit: SUBSCRIPTION_TIERS.premium.features.maxDeliveries,
        pricePerDelivery: SUBSCRIPTION_TIERS.premium.pricing.perDelivery,
        features: [
          '월 500건까지 이용',
          '전담 지원',
          '보험 및 운영 분석 포함',
        ],
      },
    ]);
  }

  static async subscribeToTier(businessId: string, tier: SubscriptionTier): Promise<void> {
    const existingContracts = await this.getBusinessContracts(businessId);
    const activeContract = existingContracts.find((contract) => contract.status === 'active');

    if (activeContract) {
      await this.changeTier(activeContract.id, tier);
      return;
    }

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);

    await this.createContract({
      businessId,
      tier,
      duration: {
        start: now,
        end,
        minDuration: 1,
        autoRenew: true,
      },
      deliverySettings: {
        frequency: 'weekly',
        preferredTime: '12:00',
        pickupLocation: {
          station: '미설정',
          address: '미설정',
          contact: '미설정',
        },
        dropoffLocation: {
          station: '미설정',
          address: '미설정',
          contact: '미설정',
        },
      },
      billing: {
        method: 'invoice',
        cycle: 'monthly',
      },
    });
  }
  /**
   * 계약 신청 생성
   */
  static async createContract(data: {
    businessId: string;
    tier: SubscriptionTier;
    duration: ContractDuration;
    deliverySettings: DeliverySettings;
    billing: BillingInfo;
  }): Promise<string> {
    const contractData = {
      ...data,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), contractData);
    return docRef.id;
  }

  /**
   * 계약 승인 (관리자 전용)
   */
  static async approveContract(contractId: string, adminUid: string): Promise<void> {
    const contractRef = doc(db, COLLECTION, contractId);
    await updateDoc(contractRef, {
      status: 'active',
      approvedBy: adminUid,
      approvedAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * 계약 해지
   */
  static async cancelContract(contractId: string, _reason?: string): Promise<void> {
    const contractRef = doc(db, COLLECTION, contractId);
    // Cancel contract
    await updateDoc(contractRef, {
      status: 'cancelled',
      updatedAt: new Date()
    });

    // Record termination history
    try {
      const contractSnap = await getDoc(contractRef);
      if (contractSnap.exists()) {
        const contractData = contractSnap.data();
        await addDoc(collection(db, 'contractHistory'), {
          contractId,
          action: 'cancelled',
          reason: _reason ?? 'N/A',
          performedAt: serverTimestamp(),
          contractSnapshot: {
            status: contractData.status,
            companyName: contractData.companyName,
            tier: contractData.tier,
          },
        });
      }
    } catch (historyError) {
      console.error('[business-contract] failed to save cancellation history:', historyError);
    }
  }

  /**
   * 계약 일시 정지
   */
  static async suspendContract(contractId: string, _reason: string): Promise<void> {
    const contractRef = doc(db, COLLECTION, contractId);
    await updateDoc(contractRef, {
      status: 'suspended',
      updatedAt: new Date()
    });
  }

  /**
   * 계약 재개
   */
  static async reactivateContract(contractId: string): Promise<void> {
    const contractRef = doc(db, COLLECTION, contractId);
    await updateDoc(contractRef, {
      status: 'active',
      updatedAt: new Date()
    });
  }

  /**
   * 계약 정보 조회
   */
  static async getContract(contractId: string): Promise<BusinessContract | null> {
    const contractDoc = await getDoc(doc(db, COLLECTION, contractId));
    if (!contractDoc.exists()) {
      return null;
    }
    return {
      id: contractDoc.id,
      ...contractDoc.data()
    } as BusinessContract;
  }

  /**
   * Legacy enterprise customer contract list.
   */
  static async getBusinessContracts(businessId: string): Promise<BusinessContract[]> {
    const q = query(
      collection(db, COLLECTION),
      where('businessId', '==', businessId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BusinessContract));
  }

  /**
   * 활성화된 계약 목록 조회
   */
  static async getActiveContracts(): Promise<BusinessContract[]> {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BusinessContract));
  }

  /**
   * 대기 중인 계약 목록 (관리자 전용)
   */
  static async getPendingContracts(): Promise<BusinessContract[]> {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'pending')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BusinessContract));
  }

  /**
   * 계약 정보 업데이트
   */
  static async updateContract(
    contractId: string,
    updates: Partial<BusinessContract>
  ): Promise<void> {
    const contractRef = doc(db, COLLECTION, contractId);
    await updateDoc(contractRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  /**
   * 구독 티어 변경
   */
  static async changeTier(
    contractId: string,
    newTier: SubscriptionTier
  ): Promise<void> {
    const contractRef = doc(db, COLLECTION, contractId);
    await updateDoc(contractRef, {
      tier: newTier,
      updatedAt: new Date()
    });
  }

  /**
   * 자동 갱신 설정
   */
  static async toggleAutoRenew(
    contractId: string,
    autoRenew: boolean
  ): Promise<void> {
    const contractRef = doc(db, COLLECTION, contractId);
    await updateDoc(contractRef, {
      'duration.autoRenew': autoRenew,
      updatedAt: new Date()
    });
  }

  /**
   * 계약 만료 임박 확인 (30일 이내)
   */
  static async getExpiringContracts(): Promise<BusinessContract[]> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'active')
    );

    const querySnapshot = await getDocs(q);
    const contracts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BusinessContract));

    // 클라이언트에서 필터링
    return contracts.filter(contract => {
      const endDate = new Date(contract.duration.end);
      return endDate <= thirtyDaysFromNow;
    });
  }
}

export const businessContractService = BusinessContractService;
