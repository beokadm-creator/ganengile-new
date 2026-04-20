import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared-admin';

interface BadgeUserDoc {
  stats?: {
    completedDeliveries?: number;
    recent30DaysDeliveries?: number;
    rating?: number;
    recentPenalties?: number;
    accountAgeDays?: number;
  };
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

export const reviewPromotion = functions.https.onCall(async (data, context): Promise<{ approved: boolean; reason?: string }> => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const user = userDoc.data() as BadgeUserDoc | undefined;
    const promotion = user?.gillerProfile?.promotion;

    if (promotion?.status !== 'pending') {
      return { approved: false, reason: 'No pending promotion application' };
    }

    const currentGrade = user?.gillerProfile?.type ?? 'regular';
    const targetGrade = currentGrade === 'regular' ? 'professional' : 'master';

    const requirements = targetGrade === 'professional'
      ? {
          minCompletedDeliveries: 50,
          minRating: 4.7,
          maxRecentPenalties: 2,
          minAccountAgeDays: 30,
          minRecent30DaysDeliveries: 20,
        }
      : {
          minCompletedDeliveries: 200,
          minRating: 4.9,
          maxRecentPenalties: 1,
          minAccountAgeDays: 90,
          minRecent30DaysDeliveries: 50,
        };

    const stats = user?.stats ?? {};

    const checks = {
      completedDeliveries: (stats.completedDeliveries ?? 0) >= requirements.minCompletedDeliveries,
      rating: (stats.rating ?? 0) >= requirements.minRating,
      penalties: (stats.recentPenalties ?? 0) <= requirements.maxRecentPenalties,
      accountAge: (stats.accountAgeDays ?? 0) >= requirements.minAccountAgeDays,
      recentActivity: (stats.recent30DaysDeliveries ?? 0) >= requirements.minRecent30DaysDeliveries,
    };

    const allPassed = Object.values(checks).every(check => check === true);

    if (allPassed) {
      const limits = targetGrade === 'professional'
        ? { maxRoutes: 10, maxDailyDeliveries: 20 }
        : { maxRoutes: 15, maxDailyDeliveries: 30 };

      const benefits = targetGrade === 'professional'
        ? {
            priorityMatching: 'high',
            rateBonus: 0.15,
            supportLevel: 'priority',
            exclusiveRequests: true,
            analytics: true,
            earlyAccess: true,
          }
        : {
            priorityMatching: 'highest',
            rateBonus: 0.25,
            supportLevel: 'dedicated',
            exclusiveRequests: true,
            analytics: true,
            earlyAccess: true,
          };

      await db.collection('users').doc(userId).update({
        'gillerProfile.type': targetGrade,
        'gillerProfile.limits': limits,
        'gillerProfile.benefits': benefits,
        'gillerProfile.promotion.status': 'approved',
        'gillerProfile.promotion.approvedAt': admin.firestore.FieldValue.serverTimestamp(),
        'updatedAt': admin.firestore.FieldValue.serverTimestamp(),
      });

      console.warn(`Promoted: ${userId} -> ${targetGrade}`);
      return { approved: true };
    } else {
      const failedChecks = Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([key]) => key);

      await db.collection('users').doc(userId).update({
        'gillerProfile.promotion.status': 'rejected',
      });

      console.warn(`Promotion rejected: ${userId} - ${failedChecks.join(', ')}`);
      return {
        approved: false,
        reason: `Requirements not met: ${failedChecks.join(', ')}`,
      };
    }
  } catch (error) {
    console.error('Error reviewing promotion:', error);
    throw new functions.https.HttpsError('internal', 'Error reviewing promotion');
  }
});
