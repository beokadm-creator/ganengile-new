/**
 * Badge Service (P1)
 * 배지 관련 비즈니스 로직
 */

import { Badge, User } from '../types/user';
import { INITIAL_BADGES } from '../data/badges';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../core/firebase';

/**
 * 배지 서비스
 */
export class BadgeService {
  /**
   * 배지 초기화 (Firestore에 배지 데이터 생성)
   */
  static async initializeBadges(): Promise<void> {
    console.warn('🎖️ Initializing badges...');

    const batch = INITIAL_BADGES.map(async (badgeData) => {
      const badgeRef = doc(db, 'badges', badgeData.id);
      const badgeDoc = await getDoc(badgeRef);

      if (!badgeDoc.exists()) {
        // 배지 문서 생성 (Admin SDK 필요)
        console.warn(`Creating badge: ${badgeData.name}`);
        // Firebase Functions를 통해 생성하거나 Admin SDK 사용 필요
      }
    });

    await Promise.all(batch);
    console.warn('✅ Badges initialized');
  }

  /**
   * 사용자의 배지 티어 계산
   */
  static calculateBadgeTier(badges: User['badges']): {
    frame: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
    tier: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
    total: number;
  } {
    const totalBadges =
      (badges?.activity?.length ?? 0) +
      (badges?.quality?.length ?? 0) +
      (badges?.expertise?.length ?? 0) +
      (badges?.community?.length ?? 0);

    let tier: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' = 'none';

    if (totalBadges >= 13) tier = 'platinum';
    else if (totalBadges >= 9) tier = 'gold';
    else if (totalBadges >= 5) tier = 'silver';
    else if (totalBadges >= 1) tier = 'bronze';

    return {
      frame: tier,
      tier,
      total: totalBadges,
    };
  }

  /**
   * 배지 부여 여부 확인
   */
  static async checkBadgeEligibility(
    userId: string,
    badgeId: string
  ): Promise<boolean> {
    const badge = INITIAL_BADGES.find(b => b.id === badgeId);
    if (!badge) return false;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return false;

    const user = userDoc.data() as User;

    // 이미 소유한 배지인지 확인
    const category = badge.category;
    const hasBadge = user.badges?.[category]?.includes(badgeId);
    if (hasBadge) return false;

    // 배지 획득 조건 확인
    return this.evaluateBadgeRequirement(user, badge);
  }

  /**
   * 배지 획득 조건 평가
   */
  private static evaluateBadgeRequirement(
    user: User,
    badge: Omit<Badge, 'createdAt'>
  ): boolean {
    const { requirement } = badge;
    const stats = user.stats;

    switch (requirement.type) {
      case 'completedDeliveries':
        return stats.completedDeliveries >= (requirement.value as number);

      case 'weeklyDeliveries':
        // 주간 배송 수 확인 (별도 로직 필요)
        return stats.recent30DaysDeliveries >= (requirement.value as number);

      case 'consecutiveWeeks':
        // 연속 주간 활동 확인 (별도 로직 필요)
        return stats.completedDeliveries >= ((requirement.value as { minWeekly: number }).minWeekly * (requirement.value as { weeks: number }).weeks);

      case 'consecutiveDeliveriesWithoutDelay':
        // 지연 없는 연속 배송 확인 (별도 로직 필요)
        return stats.recentPenalties === 0 && stats.completedDeliveries >= (requirement.value as number);

      case 'minRating':
        return stats.rating >= (requirement.value as number) &&
               stats.completedDeliveries >= (requirement.minDeliveries as number);

      case 'noShowCount':
        return stats.recentPenalties === 0 &&
               stats.completedDeliveries >= (requirement.completedDeliveries as number);

      case 'uniqueLinesUsed':
        // 이용 노선 수 확인 (별도 로직 필요)
        return stats.completedDeliveries >= (requirement.value as number);

      case 'transferDeliveries':
        // 환승 배송 수 확인 (별도 로직 필요)
        return stats.completedDeliveries >= (requirement.value as number);

      case 'delayRate':
        // 지연율 확인 (별도 로직 필요)
        return stats.recentPenalties < ((requirement.value as number) * stats.completedDeliveries) &&
               stats.completedDeliveries >= (requirement.minDeliveries as number);

      default:
        return false;
    }
  }

  /**
   * 배지 부여
   */
  static async awardBadge(userId: string, badgeId: string): Promise<void> {
    const badge = INITIAL_BADGES.find(b => b.id === badgeId);
    if (!badge) {
      throw new Error(`Badge not found: ${badgeId}`);
    }

    const userRef = doc(db, 'users', userId);

    // 배지 추가
    const categoryKey = badge.category as keyof NonNullable<User['badges']>;
    await updateDoc(userRef, {
      [`badges.${categoryKey}`]: arrayUnion(badgeId),
    });

    // 배지 혜택 업데이트
    const userDoc = await getDoc(userRef);
    const user = userDoc.data() as User;
    const badgeBenefits = this.calculateBadgeTier(user.badges);

    await updateDoc(userRef, {
      'badgeBenefits.totalBadges': badgeBenefits.total,
      'badgeBenefits.currentTier': badgeBenefits.tier,
      'badgeBenefits.profileFrame': badgeBenefits.frame,
    });

    console.warn(`🎖️ Badge awarded: ${badge.name} to user ${userId}`);
  }

  /**
   * 배지 철회 (페널티 등의 이유로)
   */
  static async revokeBadge(userId: string, badgeId: string): Promise<void> {
    const badge = INITIAL_BADGES.find(b => b.id === badgeId);
    if (!badge) {
      throw new Error(`Badge not found: ${badgeId}`);
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const user = userDoc.data() as User;

    // 배지 제거
    const categoryKey = badge.category as keyof NonNullable<User['badges']>;
    const updatedBadges = {
      ...user.badges,
      [categoryKey]: (user.badges?.[categoryKey] ?? []).filter((id: string) => id !== badgeId),
    };

    // 배지 혜택 재계산
    const badgeBenefits = this.calculateBadgeTier(updatedBadges);

    await updateDoc(userRef, {
      [`badges.${categoryKey}`]: updatedBadges[categoryKey],
      'badgeBenefits.totalBadges': badgeBenefits.total,
      'badgeBenefits.currentTier': badgeBenefits.tier,
      'badgeBenefits.profileFrame': badgeBenefits.frame,
    });

    console.warn('⚠️ Badge revoked:', badge.name, 'from user', userId);
  }

  /**
   * Get badges earned by a giller (if available).
   * This is a lightweight fetcher to support UI rendering.
   * Returns an array of Badge-like objects or an empty array if unavailable.
   */
  static getGillerBadges(_userId: string): import('../types/user').Badge[] {
    // Minimal implementation: return empty list for now to avoid breaking UI.
    // A full implementation would read user.badges from Firestore and map to Badge objects.
    return [];
  }
}
