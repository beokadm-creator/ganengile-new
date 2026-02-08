/**
 * Professional Giller Service (P1)
 * 전문 길러 시스템 관련 비즈니스 로직
 */

import { GillerType, GillerStatus, User } from '../types/user';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../core/firebase';

/**
 * 전문 길러 혜택 설정
 */
const GILLER_LIMITS = {
  [GillerType.REGULAR]: {
    limits: {
      maxRoutes: 5,
      maxDailyDeliveries: 10,
    },
    benefits: {
      rateBonus: 0,
      priorityMatching: 'normal' as const,
      supportLevel: 'standard' as const,
      exclusiveRequests: false,
      analytics: false,
      earlyAccess: false,
    },
  },
  [GillerType.PROFESSIONAL]: {
    limits: {
      maxRoutes: 10,
      maxDailyDeliveries: 20,
    },
    benefits: {
      rateBonus: 0.15, // 15%
      priorityMatching: 'high' as const,
      supportLevel: 'priority' as const,
      exclusiveRequests: true,
      analytics: true,
      earlyAccess: true,
    },
  },
  [GillerType.MASTER]: {
    limits: {
      maxRoutes: 15,
      maxDailyDeliveries: 30,
    },
    benefits: {
      rateBonus: 0.25, // 25%
      priorityMatching: 'highest' as const,
      supportLevel: 'dedicated' as const,
      exclusiveRequests: true,
      analytics: true,
      earlyAccess: true,
    },
  },
};

/**
 * 전문 길러 승급 기준
 */
const PROMOTION_REQUIREMENTS = {
  [GillerType.PROFESSIONAL]: {
    minCompletedDeliveries: 50,
    minRating: 4.7,
    maxRecentPenalties: 2,
    minAccountAgeDays: 30,
    minRecent30DaysDeliveries: 20,
  },
  [GillerType.MASTER]: {
    minCompletedDeliveries: 200,
    minRating: 4.9,
    maxRecentPenalties: 1,
    minAccountAgeDays: 90,
    minRecent30DaysDeliveries: 50,
  },
};

/**
 * 전문 길러 서비스
 */
export class ProfessionalGillerService {
  /**
   * 기본 길러 프로필 생성 (신규 가입 시)
   */
  static createDefaultGillerProfile(): User['gillerProfile'] {
    return {
      type: GillerType.REGULAR,
      status: GillerStatus.ACTIVE,
      limits: GILLER_LIMITS[GillerType.REGULAR].limits,
      benefits: GILLER_LIMITS[GillerType.REGULAR].benefits,
    };
  }

  /**
   * 승급 신청
   */
  static async applyForPromotion(userId: string, targetGrade: GillerType): Promise<void> {
    if (targetGrade === GillerType.REGULAR) {
      throw new Error('Cannot apply for Regular grade');
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const user = userDoc.data() as User;
    const currentGrade = user.gillerProfile?.type || GillerType.REGULAR;

    // 이미 목표 등급 이상인 경우
    if (currentGrade === targetGrade || currentGrade === GillerType.MASTER) {
      throw new Error('Already at or above target grade');
    }

    // 승급 신청 정보 업데이트
    await updateDoc(userRef, {
      'gillerProfile.promotion': {
        appliedAt: new Date(),
        status: 'pending',
      },
    });

    console.log(`📝 Promotion application: ${userId} -> ${targetGrade}`);
  }

  /**
   * 승급 심사 (자동)
   */
  static async reviewPromotion(userId: string): Promise<{
    approved: boolean;
    reason?: string;
  }> {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const user = userDoc.data() as User;
    const promotion = user.gillerProfile?.promotion;

    if (!promotion || promotion.status !== 'pending') {
      return { approved: false, reason: 'No pending promotion application' };
    }

    const currentGrade = user.gillerProfile?.type || GillerType.REGULAR;
    const targetGrade = currentGrade === GillerType.REGULAR
      ? GillerType.PROFESSIONAL
      : GillerType.MASTER;

    const requirements = PROMOTION_REQUIREMENTS[targetGrade];
    const stats = user.stats;

    // 기준 확인
    const checks = {
      completedDeliveries: stats.completedDeliveries >= requirements.minCompletedDeliveries,
      rating: stats.rating >= requirements.minRating,
      penalties: stats.recentPenalties <= requirements.maxRecentPenalties,
      accountAge: stats.accountAgeDays >= requirements.minAccountAgeDays,
      recentActivity: stats.recent30DaysDeliveries >= requirements.minRecent30DaysDeliveries,
    };

    const allPassed = Object.values(checks).every(check => check === true);

    if (allPassed) {
      // 승급 승인
      await this.promoteUser(userId, targetGrade);
      return { approved: true };
    } else {
      // 승급 거부
      const failedChecks = Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([key]) => key);

      await updateDoc(userRef, {
        'gillerProfile.promotion.status': 'rejected',
      });

      return {
        approved: false,
        reason: `Requirements not met: ${failedChecks.join(', ')}`,
      };
    }
  }

  /**
   * 승급 실행
   */
  private static async promoteUser(userId: string, newGrade: GillerType): Promise<void> {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      'gillerProfile.type': newGrade,
      'gillerProfile.limits': GILLER_LIMITS[newGrade].limits,
      'gillerProfile.benefits': GILLER_LIMITS[newGrade].benefits,
      'gillerProfile.promotion.status': 'approved',
      'gillerProfile.promotion.approvedAt': new Date(),
      'updatedAt': Timestamp.now(),
    });

    console.log(`🎉 Promoted: ${userId} -> ${newGrade}`);
  }

  /**
   * 강등 (페널티 등의 이유로)
   */
  static async demoteUser(
    userId: string,
    reason: string
  ): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const user = userDoc.data() as User;
    const currentGrade = user.gillerProfile?.type || GillerType.REGULAR;

    if (currentGrade === GillerType.REGULAR) {
      throw new Error('Already at Regular grade');
    }

    const newGrade = currentGrade === GillerType.MASTER
      ? GillerType.PROFESSIONAL
      : GillerType.REGULAR;

    await updateDoc(userRef, {
      'gillerProfile.type': newGrade,
      'gillerProfile.limits': GILLER_LIMITS[newGrade].limits,
      'gillerProfile.benefits': GILLER_LIMITS[newGrade].benefits,
      'gillerProfile.status': GillerStatus.ACTIVE,
      'updatedAt': Timestamp.now(),
    });

    console.log(`⚠️ Demoted: ${userId} -> ${newGrade} (Reason: ${reason})`);
  }

  /**
   * 길러 정지
   */
  static async suspendUser(
    userId: string,
    reason: string
  ): Promise<void> {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      'gillerProfile.status': GillerStatus.SUSPENDED,
      'isActive': false,
      'updatedAt': Timestamp.now(),
    });

    console.log(`⛔ Suspended: ${userId} (Reason: ${reason})`);
  }

  /**
   * 길러 정지 해제
   */
  static async unsuspendUser(userId: string): Promise<void> {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      'gillerProfile.status': GillerStatus.ACTIVE,
      'isActive': true,
      'updatedAt': Timestamp.now(),
    });

    console.log(`✅ Unsuspended: ${userId}`);
  }

  /**
   * 요금 보너스 계산
   */
  static calculateRateBonus(userId: string, baseRate: number): Promise<number> {
    // Firebase Functions에서 구현 필요
    // 여기서는 간단히 계산만
    return Promise.resolve(baseRate);
  }

  /**
   * 우선 매칭 레벨 확인
   */
  static async getPriorityLevel(userId: string): Promise<'normal' | 'high' | 'highest'> {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return 'normal';
    }

    const user = userDoc.data() as User;
    return user.gillerProfile?.benefits?.priorityMatching || 'normal';
  }
}
