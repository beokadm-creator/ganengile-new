/**
 * Giller Service
 * 길러 등급, 배지, 승급/강감 관리
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  GillerType,
  GillerStatus,
  REGULAR_GILLER_CONFIG,
  PROFESSIONAL_GILLER_CONFIG,
} from '../types/giller';
import type {
  GillerProfile,
  GillerLimits,
  GillerBenefits,
  GillerPromotion,
  PromotionCriteria,
} from '../types/giller';
import type { Badge, BadgeRank } from '../types/badge';
import { ALL_BADGES } from '../types/badge';

interface UserBadge {
  userId: string;
  badgeId: string;
  earnedAt: Timestamp;
}

const GILLERS_COLLECTION = 'gillers';
const USER_BADGES_COLLECTION = 'user_badges';

export class GillerService {
  private userId: string;

  constructor(userId?: string) {
    // Firebase Auth에서 userId 가져오기
    this.userId = userId || this.getCurrentUserId();
  }

  private getCurrentUserId(): string {
    // Firebase Auth currentUser 사용
    const { getAuth } = require('firebase/auth');
    const auth = getAuth();
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    return auth.currentUser.uid;
  }

  /**
   * 길러 프로필 조회
   */
  async getGillerProfile(userId?: string): Promise<GillerProfile | null> {
    const targetUserId = userId || this.userId;
    const docRef = doc(db, GILLERS_COLLECTION, targetUserId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data();
    return {
      userId: docSnap.id,
      gillerType: data.gillerType || GillerType.REGULAR,
      status: data.status || GillerStatus.ACTIVE,
      limits: data.limits || REGULAR_GILLER_CONFIG.limits,
      benefits: data.benefits || REGULAR_GILLER_CONFIG.benefits,
      stats: data.stats || {
        totalCompletedDeliveries: 0,
        totalEarnings: 0,
        rating: 5.0,
        accountAgeDays: 0,
        recentPenalties: 0,
        recentActivity: 0,
      },
      promotion: data.promotion,
    } as GillerProfile;
  }

  /**
   * 길러 프로필 생성 (신규 가입 시)
   */
  async createGillerProfile(userId: string): Promise<void> {
    const docRef = doc(db, GILLERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists) {
      return; // 이미 존재
    }

    // 일반 길러로 시작
    await setDoc(docRef, {
      gillerType: GillerType.REGULAR,
      status: GillerStatus.ACTIVE,
      limits: REGULAR_GILLER_CONFIG.limits,
      benefits: REGULAR_GILLER_CONFIG.benefits,
      stats: {
        totalCompletedDeliveries: 0,
        totalEarnings: 0,
        rating: 5.0,
        accountAgeDays: 0,
        recentPenalties: 0,
        recentActivity: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 승급 자격 확인
   */
  async checkPromotionEligibility(userId?: string): Promise<{
    isEligible: boolean;
    score: number;
    breakdown: {
      completedDeliveries: number;
      rating: number;
      accountAge: number;
      penalties: number;
      activity: number;
    };
  }> {
    const profile = await this.getGillerProfile(userId);
    if (!profile) {
      throw new Error('Giller profile not found');
    }

    // 승급 기준
    const criteria: PromotionCriteria = {
      minCompletedDeliveries: 50,
      minRating: 4.5,
      minAccountAgeDays: 30,
      maxRecentPenalties: 0,
      minRecentActivity: 20,
    };

    // 점수 계산 (100점 만점)
    const completedDeliveriesScore = Math.min(
      profile.stats.totalCompletedDeliveries / criteria.minCompletedDeliveries,
      1
    ) * 30;

    const ratingScore = Math.min(
      profile.stats.rating / criteria.minRating,
      1
    ) * 25;

    const accountAgeScore = Math.min(
      profile.stats.accountAgeDays / criteria.minAccountAgeDays,
      1
    ) * 15;

    const penaltiesScore = profile.stats.recentPenalties === 0 ? 20 : 0;

    const activityScore = Math.min(
      profile.stats.recentActivity / criteria.minRecentActivity,
      1
    ) * 10;

    const totalScore =
      completedDeliveriesScore +
      ratingScore +
      accountAgeScore +
      penaltiesScore +
      activityScore;

    const isEligible = totalScore >= 80;

    return {
      isEligible,
      score: totalScore,
      breakdown: {
        completedDeliveries: completedDeliveriesScore,
        rating: ratingScore,
        accountAge: accountAgeScore,
        penalties: penaltiesScore,
        activity: activityScore,
      },
    };
  }

  /**
   * 전문 길러 승급
   */
  async promoteToProfessional(userId?: string): Promise<void> {
    const targetUserId = userId || this.userId;
    const eligibility = await this.checkPromotionEligibility(targetUserId);

    if (!eligibility.isEligible) {
      throw new Error(
        `Not eligible for promotion. Score: ${eligibility.score}/80`
      );
    }

    const docRef = doc(db, GILLERS_COLLECTION, targetUserId);
    await updateDoc(docRef, {
      gillerType: GillerType.PROFESSIONAL,
      limits: PROFESSIONAL_GILLER_CONFIG.limits,
      benefits: PROFESSIONAL_GILLER_CONFIG.benefits,
      promotion: {
        isEligible: true,
        appliedAt: new Date(),
        score: eligibility.score,
      } as GillerPromotion,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 일반 길러 강등 (평점 저하, 페널티 등)
   */
  async demoteToRegular(userId?: string): Promise<void> {
    const targetUserId = userId || this.userId;
    const docRef = doc(db, GILLERS_COLLECTION, targetUserId);

    await updateDoc(docRef, {
      gillerType: GillerType.REGULAR,
      limits: REGULAR_GILLER_CONFIG.limits,
      benefits: REGULAR_GILLER_CONFIG.benefits,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 배지 획득 확인 및 부여
   */
  async checkAndAwardBadges(
    deliveryCount: number,
    currentRating: number,
    userId?: string
  ): Promise<Badge[]> {
    const targetUserId = userId || this.userId;
    const profile = await this.getGillerProfile(targetUserId);
    if (!profile) {
      throw new Error('Giller profile not found');
    }

    const awardedBadges: Badge[] = [];

    // 첫 배송 완료
    if (deliveryCount === 1) {
      const firstDeliveryBadge = ALL_BADGES.find(
        (b) => b.badgeId === 'first_delivery'
      );
      if (firstDeliveryBadge) {
        await this.awardBadge(targetUserId, firstDeliveryBadge.badgeId);
        awardedBadges.push(firstDeliveryBadge);
      }
    }

    // 10건 연속 완료 (활동가 배지)
    if (deliveryCount === 10) {
      const weeklyBadge = ALL_BADGES.find(
        (b) => b.badgeId === 'weekly_10'
      );
      if (weeklyBadge) {
        await this.awardBadge(targetUserId, weeklyBadge.badgeId);
        awardedBadges.push(weeklyBadge);
      }
    }

    // 50건 완료 (열정가 배지)
    if (deliveryCount === 50) {
      const monthlyBadge = ALL_BADGES.find(
        (b) => b.badgeId === 'monthly_50'
      );
      if (monthlyBadge) {
        await this.awardBadge(targetUserId, monthlyBadge.badgeId);
        awardedBadges.push(monthlyBadge);
      }
    }

    // 평점 4.8 이상 (최고 평점 배지)
    if (currentRating >= 4.8) {
      const ratingBadge = ALL_BADGES.find(
        (b) => b.badgeId === 'rating_4_8'
      );
      if (ratingBadge) {
        await this.awardBadgeIfNotEarned(targetUserId, ratingBadge.badgeId);
        awardedBadges.push(ratingBadge);
      }
    }

    return awardedBadges;
  }

  /**
   * 배지 부여
   */
  private async awardBadge(
    userId: string,
    badgeId: string
  ): Promise<void> {
    const collectionRef = collection(db, USER_BADGES_COLLECTION);
    const q = query(
      collectionRef,
      where('userId', '==', userId),
      where('badgeId', '==', badgeId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return; // 이미 획득
    }

    // 배지 부여
    const docRef = doc(collection(db, USER_BADGES_COLLECTION));
    await setDoc(docRef, {
      userId,
      badgeId,
      earnedAt: serverTimestamp(),
    });
  }

  /**
   * 배지 부여 (미획득 시만)
   */
  private async awardBadgeIfNotEarned(
    userId: string,
    badgeId: string
  ): Promise<void> {
    const collectionRef = collection(db, USER_BADGES_COLLECTION);
    const q = query(
      collectionRef,
      where('userId', '==', userId),
      where('badgeId', '==', badgeId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return; // 이미 획득
    }

    // 배지 부여
    const docRef = doc(collection(db, USER_BADGES_COLLECTION));
    await setDoc(docRef, {
      userId,
      badgeId,
      earnedAt: serverTimestamp(),
    });
  }

  /**
   * 사용자 배지 목록 조회
   */
  async getUserBadges(userId?: string): Promise<Badge[]> {
    const targetUserId = userId || this.userId;
    const collectionRef = collection(db, USER_BADGES_COLLECTION);
    const q = query(collectionRef, where('userId', '==', targetUserId));
    const querySnapshot = await getDocs(q);

    const badges: Badge[] = [];
    querySnapshot.forEach((doc) => {
      const userBadge = doc.data() as UserBadge;
      const badge = ALL_BADGES.find((b) => b.badgeId === userBadge.badgeId);
      if (badge) {
        badges.push({
          ...badge,
          earnedAt: userBadge.earnedAt instanceof Date 
            ? userBadge.earnedAt 
            : new Date(userBadge.earnedAt.seconds * 1000),
        });
      }
    });

    return badges;
  }

  /**
   * 길러 통계 업데이트 (배송 완료 시)
   */
  async updateGillerStats(
    deliveryFee: number,
    rating: number,
    userId?: string
  ): Promise<void> {
    const targetUserId = userId || this.userId;
    const docRef = doc(db, GILLERS_COLLECTION, targetUserId);

    await updateDoc(docRef, {
      'stats.totalCompletedDeliveries': increment(1),
      'stats.totalEarnings': increment(deliveryFee),
      'stats.rating': rating,
      'stats.recentActivity': increment(1),
      updatedAt: serverTimestamp(),
    });
  }
}

// Helper function for Firestore increment
function increment(value: number): any {
  return { __integerValue__: value };
}

export function createGillerService(userId?: string): GillerService {
  return new GillerService(userId);
}
