import * as functions from 'firebase-functions';
import { db } from '../shared-admin';
import {
  executeMissionPlanning,
  executePricingQuoteGeneration,
  executeRequestDraftAnalysis,
  type Beta1MissionPlanInput,
  type Beta1PricingQuoteInput,
  type Beta1RequestDraftAnalysisInput,
} from '../beta1-ai';
interface BadgeUserDoc {
  stats?: {
    completedDeliveries?: number;
    recent30DaysDeliveries?: number;
    rating?: number;
    recentPenalties?: number;
    accountAgeDays?: number;
  };
  role?: string;
  badges?: {
    activity?: string[];
    quality?: string[];
    expertise?: string[];
    community?: string[];
  };
  badgeBenefits?: {
    totalBadges?: number;
    currentTier?: string;
    profileFrame?: string;
  };
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

function readUserRole(userData: BadgeUserDoc | undefined): string {
  return userData?.role ?? '';
}

export const beta1AnalyzeRequestDraft = functions.https.onCall(
  async (data: Beta1RequestDraftAnalysisInput, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (data.requesterUserId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'requesterUserId mismatch');
    }

    try {
      return await executeRequestDraftAnalysis(db, data);
    } catch (error) {
      console.error('beta1AnalyzeRequestDraft error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to analyze request draft');
    }
  }
);

export const beta1GeneratePricingQuotes = functions.https.onCall(
  async (data: Beta1PricingQuoteInput, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (data.requesterUserId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'requesterUserId mismatch');
    }

    try {
      return await executePricingQuoteGeneration(db, data);
    } catch (error) {
      console.error('beta1GeneratePricingQuotes error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to generate pricing quotes');
    }
  }
);

export const beta1PlanMissionExecution = functions.https.onCall(
  async (data: Beta1MissionPlanInput, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const requestSnap = await db.collection('requests').doc(data.requestId).get();
      if (!requestSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const requestData = requestSnap.data() as Record<string, unknown> | undefined;
      const requesterUserId = typeof requestData?.requesterId === 'string' ? requestData.requesterId : '';
      const matchedGillerId = typeof requestData?.matchedGillerId === 'string' ? requestData.matchedGillerId : '';
      const roleAllowed = context.auth.uid === requesterUserId || context.auth.uid === matchedGillerId;

      if (!roleAllowed) {
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data() as BadgeUserDoc | undefined;
        const role = readUserRole(userData);
        if (role !== 'admin' && role !== 'superadmin') {
          throw new functions.https.HttpsError('permission-denied', 'Not allowed to plan mission');
        }
      }

      return await executeMissionPlanning(db, data);
    } catch (error) {
      console.error('beta1PlanMissionExecution error:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to plan mission execution');
    }
  }
);
