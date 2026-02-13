/**
 * B2B 계약 서비스
 * 
 * B2B 고객사의 계약 관리 (신청, 승인, 해지)
 */
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { 
  BusinessContract, 
  ContractStatus, 
  SubscriptionTier, 
  Location,
  ContractDuration,
  DeliverySettings,
  BillingInfo
} from '../types/business-contract';

const COLLECTION = 'business_contracts';

/**
 * B2B 계약 서비스
 */
export class BusinessContractService {
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
    const contractData: Omit<BusinessContract, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
      ...data,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
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
  static async cancelContract(contractId: string, reason?: string): Promise<void> {
    const contractRef = doc(db, COLLECTION, contractId);
    await updateDoc(contractRef, {
      status: 'cancelled',
      updatedAt: new Date()
    });

    // TODO: 계약 해지 기록 저장
  }

  /**
   * 계약 일시 정지
   */
  static async suspendContract(contractId: string, reason: string): Promise<void> {
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
   * B2B 고객사 계약 목록 조회
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
