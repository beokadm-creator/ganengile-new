import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared-admin';
import type { Match } from '../types';

type BadgeCategory = 'activity' | 'quality' | 'expertise' | 'community';

interface BadgeStats {
  completedDeliveries?: number;
  recent30DaysDeliveries?: number;
  rating?: number;
  recentPenalties?: number;
  accountAgeDays?: number;
}

interface BadgeCollections {
  activity?: string[];
  quality?: string[];
  expertise?: string[];
  community?: string[];
}

interface BadgeBenefits {
  totalBadges?: number;
  currentTier?: string;
  profileFrame?: string;
}

interface BadgeUserDoc {
  stats?: BadgeStats;
  badges?: BadgeCollections;
  badgeBenefits?: BadgeBenefits;
  role?: string;
  gillerProfile?: {
    type?: string;
    promotion?: {
      status?: string;
    };
    benefits?: {
      rateBonus?: number;
    };
  };
}

interface BadgeCheck {
  id: string;
  category: BadgeCategory;
  condition: boolean;
}

type FirestoreUpdateValue = ReturnType<typeof admin.firestore.FieldValue.arrayUnion> | string | number;

function countBadges(items?: string[]): number {
  return items?.length ?? 0;
}

/**
 * Trigger: Auto-check badges on delivery completion
 */
export const onDeliveryCompleted = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, _context) => {
    const before = change.before.data() as Match;
    const after = change.after.data() as Match;

    // Only trigger when status changes to 'completed'
    if (before.status === 'completed' || after.status !== 'completed') {
      return null;
    }

    const gillerId = after.gillerId;

    try {
      // Check badge eligibility
      const userDoc = await db.collection('users').doc(gillerId).get();
      if (!userDoc.exists) {
        console.warn('User not found:', gillerId);
        return null;
      }

      const user = userDoc.data() as BadgeUserDoc | undefined;
      const stats = user?.stats ?? {};
      const badges: Required<BadgeCollections> = {
        activity: user?.badges?.activity ?? [],
        quality: user?.badges?.quality ?? [],
        expertise: user?.badges?.expertise ?? [],
        community: user?.badges?.community ?? [],
      };

      // Define badge checks
      const badgeChecks: BadgeCheck[] = [
        {
          id: 'badge_newbie',
          category: 'activity',
          condition: (stats.completedDeliveries ?? 0) >= 1,
        },
        {
          id: 'badge_active',
          category: 'activity',
          condition: (stats.recent30DaysDeliveries ?? 0) >= 10,
        },
        {
          id: 'badge_friendly',
          category: 'quality',
          condition: (stats.rating ?? 0) >= 4.9 && (stats.completedDeliveries ?? 0) >= 20,
        },
        {
          id: 'badge_trusted',
          category: 'quality',
          condition: (stats.recentPenalties ?? 0) === 0 && (stats.completedDeliveries ?? 0) >= 100,
        },
      ];

      // Award new badges
      const updates: Record<string, FirestoreUpdateValue> = {};
      let newBadgesAwarded = 0;

      for (const check of badgeChecks) {
        if (!badges[check.category]?.includes(check.id) && check.condition) {
          updates[`badges.${check.category}`] = admin.firestore.FieldValue.arrayUnion(check.id);
          newBadgesAwarded++;
          console.warn(`Badge awarded: ${check.id} to ${gillerId}`);
        }
      }

      // Update badge benefits
      if (newBadgesAwarded > 0) {
        const totalBadges =
          countBadges(badges.activity) +
          countBadges(badges.quality) +
          countBadges(badges.expertise) +
          countBadges(badges.community) +
          newBadgesAwarded;

        let tier = 'none';
        if (totalBadges >= 13) tier = 'platinum';
        else if (totalBadges >= 9) tier = 'gold';
        else if (totalBadges >= 5) tier = 'silver';
        else if (totalBadges >= 1) tier = 'bronze';

        updates['badgeBenefits.totalBadges'] = totalBadges;
        updates['badgeBenefits.currentTier'] = tier;
        updates['badgeBenefits.profileFrame'] = tier;

        await db.collection('users').doc(gillerId).update(updates);
        console.warn(`Updated badges for ${gillerId}: ${totalBadges} total, ${tier} tier`);
      }

      return null;
    } catch (error) {
      console.error('Error checking badges:', error);
      return null;
    }
  });
