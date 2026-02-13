/**
 * B2B 길러 서비스
 * 
 * B2B 길러 등급 관리 및 승급/강감
 */
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { 
  B2BGillerTier,
  B2BGillerStatus,
  B2BGillerHistory,
  B2BGillerCriteria,
  B2BGillerBenefits,
  B2B_TIER_CRITERIA,
  B2B_TIER_BENEFITS,
  B2B_TIER_DETAILS
} from '../types/b2b-giller-tier';
import { getDoc } from 'firebase/firestore';

const TIER_COLLECTION = 'b2b_giller_tiers';
const GILLER_COLLECTION = 'users'; // 길러 정보
const DELIVERY_COLLECTION = 'b2b_deliveries';

/**
 * B2B 길러 서비스
 */
export class B2BGillerService {
  /**
   * B2B 길러 등록
   */
  static async registerB2BGiller(gillerId: string): Promise<void> {
    // 1. 길러 기본 정보 조회
    const gillerDoc = await getDoc(doc(db, GILLER_COLLECTION, gillerId));
    if (!gillerDoc.exists()) {
      throw new Error('길러를 찾을 수 없습니다');
    }

    // 2. 초기 등급 평가
    const initialTier = await this.evaluateGiller(gillerId);

    // 3. B2B 길러 등급 생성
    const tierData: Omit<B2BGillerTier, 'id' | 'updatedAt'> = {
      gillerId,
      tier: initialTier.tier,
      criteria: initialTier.criteria,
      benefits: initialTier.benefits,
      history: {
        lastEvaluated: new Date(),
        nextEvaluation: this.calculateNextEvaluation()
      },
      status: 'active' as B2BGillerStatus
    };

    await addDoc(collection(db, TIER_COLLECTION), tierData);
  }

  /**
   * 길러 등급 평가
   */
  private static async evaluateGiller(gillerId: string): Promise<{
    tier: B2BGillerTier['tier'];
    criteria: B2BGillerCriteria;
    benefits: B2BGillerBenefits;
  }> {
    // 1. 길러 데이터 조회
    const gillerDoc = await getDoc(doc(db, GILLER_COLLECTION, gillerId));
    const giller = gillerDoc.data();
    
    // TODO: giller 컬렉션에 rating, completedDeliveries 등 필요
    // 임시: 기본값 사용
    const rating = 4.5;
    const completedDeliveries = 30;
    const accountAgeMonths = 6;

    // 2. 각 등급 기준 확인
    if (this.meetsCriteria(accountAgeMonths, completedDeliveries, rating, B2B_TIER_CRITERIA.platinum)) {
      return {
        tier: 'platinum',
        criteria: B2B_TIER_CRITERIA.platinum,
        benefits: B2B_TIER_BENEFITS.platinum
      };
    } else if (this.meetsCriteria(accountAgeMonths, completedDeliveries, rating, B2B_TIER_CRITERIA.gold)) {
      return {
        tier: 'gold',
        criteria: B2B_TIER_CRITERIA.gold,
        benefits: B2B_TIER_BENEFITS.gold
      };
    } else if (this.meetsCriteria(accountAgeMonths, completedDeliveries, rating, B2B_TIER_CRITERIA.silver)) {
      return {
        tier: 'silver',
        criteria: B2B_TIER_CRITERIA.silver,
        benefits: B2B_TIER_BENEFITS.silver
      };
    } else {
      // B2B 자격 없음
      throw new Error('B2B 길러 자격 미달');
    }
  }

  /**
   * 기준 충족 확인
   */
  private static meetsCriteria(
    tenure: number,
    monthlyDeliveries: number,
    rating: number,
    criteria: B2BGillerCriteria
  ): boolean {
    return tenure >= criteria.tenure &&
           monthlyDeliveries >= criteria.monthlyDeliveries &&
           rating >= criteria.rating;
  }

  /**
   * 다음 심사 일자 계산 (매월)
   */
  private static calculateNextEvaluation(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  }

  /**
   * 승급 심사 (매월 1일 실행)
   */
  static async evaluateAllGillers(): Promise<void> {
    const q = query(
      collection(db, TIER_COLLECTION),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);

    for (const tierDoc of querySnapshot.docs) {
      const tier = tierDoc.data() as B2BGillerTier;
      const now = new Date();
      
      // 다음 심사 일자 도달 여부 확인
      if (now >= tier.history.nextEvaluation) {
        await this.reevaluateGiller(tierDoc.id);
      }
    }
  }

  /**
   * 길러 재심사
   */
  private static async reevaluateGiller(tierId: string): Promise<void> {
    const tierDoc = await getDoc(doc(db, TIER_COLLECTION, tierId));
    const currentTier = tierDoc.data() as B2BGillerTier;

    // 새 등급 평가
    const newTier = await this.evaluateGiller(currentTier.gillerId);

    // 등급 변경 여부 확인
    if (newTier.tier !== currentTier.tier) {
      // 등급 상향
      await this.promoteGiller(tierId, newTier);
    } else {
      // 등급 유지: 다음 심사 일자만 업데이트
      await updateDoc(doc(db, TIER_COLLECTION, tierId), {
        'history.lastEvaluated': new Date(),
        'history.nextEvaluation': this.calculateNextEvaluation()
      });
    }
  }

  /**
   * 승급 (등급 상향)
   */
  private static async promoteGiller(
    tierId: string,
    newTier: { tier: B2BGillerTier['tier']; criteria: any; benefits: any }
  ): Promise<void> {
    const now = new Date();

    await updateDoc(doc(db, TIER_COLLECTION, tierId), {
      tier: newTier.tier,
      criteria: newTier.criteria,
      benefits: newTier.benefits,
      history: {
        promotedAt: now,
        lastEvaluated: now,
        nextEvaluation: this.calculateNextEvaluation()
      }
    });

    // TODO: 승급 축하 알림 발송
    console.log(`승급 완료: ${tierId} -> ${newTier.tier}`);
  }

  /**
   * 강감 (등급 하향 또는 자격 박탈)
   */
  static async demoteGiller(tierId: string, reason: string): Promise<void> {
    // TODO: 강감 정책 구현
    await updateDoc(doc(db, TIER_COLLECTION, tierId), {
      status: 'suspended' as B2BGillerStatus
    });

    console.log(`강감 완료: ${tierId}, reason: ${reason}`);
  }

  /**
   * B2B 길러 등급 조회
   */
  static async getB2BGillerTier(gillerId: string): Promise<B2BGillerTier | null> {
    const q = query(
      collection(db, TIER_COLLECTION),
      where('gillerId', '==', gillerId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as B2BGillerTier;
  }

  /**
   * 활성 B2B 길러 목록
   */
  static async getActiveB2BGillers(): Promise<Array<B2BGillerTier & { gillerId: string }>> {
    const q = query(
      collection(db, TIER_COLLECTION),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as B2BGillerTier & { gillerId: string }));
  }

  /**
   * 등급별 길러 수 통계
   */
  static async getTierStats(): Promise<Record<string, number>> {
    const snapshot = await getDocs(collection(db, TIER_COLLECTION));
    
    const stats: Record<string, number> = {
      silver: 0,
      gold: 0,
      platinum: 0
    };

    snapshot.docs.forEach(doc => {
      const tier = doc.data().tier;
      if (tier in stats) {
        stats[tier]++;
      }
    });

    return stats;
  }

  /**
   * B2B 자격 확인
   */
  static async checkB2BEligibility(gillerId: string): Promise<{
    eligible: boolean;
    currentTier?: string;
    requiredFor?: { [key in B2BGillerTier['tier']?: B2BGillerCriteria };
  }> {
    const tier = await this.getB2BGillerTier(gillerId);
    
    if (!tier) {
      return {
        eligible: false,
        requiredFor: B2B_TIER_CRITERIA
      };
    }

    return {
      eligible: true,
      currentTier: tier.tier
    };
  }

  /**
   * 길러 등급 정보 삭제 (관리자 전용)
   */
  static async deleteB2BGillerTier(tierId: string): Promise<void> {
    await deleteDoc(doc(db, TIER_COLLECTION, tierId));
  }

  /**
   * 월간 보너스 계산
   */
  static calculateMonthlyBonus(tier: B2BGillerTier['tier'], b2bDeliveries: number): number {
    const tierBenefits = B2B_TIER_BENEFITS[tier];
    const monthlyBonusInWon = tierBenefits.monthlyBonus * 10000; // 만원 → 원
    
    return monthlyBonusInWon;
  }

  /**
   * 요금 보너스 계산
   */
  static calculateRateBonus(tier: B2BGillerTier['tier'], baseEarning: number): number {
    const tierBenefits = B2B_TIER_BENEFITS[tier];
    return Math.round(baseEarning * (tierBenefits.rateBonus / 100));
  }

  /**
   * 총 수익 계산 (기본 수익 + 요금 보너스)
   */
  static calculateTotalEarning(
    tier: B2BGillerTier['tier'],
    baseEarning: number,
    b2bDeliveries: number
  ): number {
    const rateBonus = this.calculateRateBonus(tier, baseEarning);
    const monthlyBonus = this.calculateMonthlyBonus(tier, b2bDeliveries);
    
    return baseEarning + rateBonus + monthlyBonus;
  }

  /**
   * 등급 상세 정보 조회
   */
  static getTierDetails(tier: B2BGillerTier['tier']): {
    name: string;
    description: string;
    criteria: B2BGillerCriteria;
    benefits: B2BGillerBenefits;
  } {
    return B2B_TIER_DETAILS[tier];
  }

  /**
   * 등급별 우선순위 비교
   */
  static compareTierPriority(tier1: B2BGillerTier['tier'], tier2: B2BGillerTier['tier']): number {
    const priority1 = B2B_TIER_BENEFITS[tier1].priorityLevel;
    const priority2 = B2B_TIER_BENEFITS[tier2].priorityLevel;
    
    return priority1 - priority2;
  }
}
