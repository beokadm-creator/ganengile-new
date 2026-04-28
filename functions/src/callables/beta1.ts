import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
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

type FirestoreRecord = Record<string, any>;
type BundleRecord = FirestoreRecord & { missionBundleId: string };
type MissionRecord = FirestoreRecord & { id: string };
type LegRecord = FirestoreRecord & { id: string };

function readUserRole(userData: BadgeUserDoc | undefined): string {
  return userData?.role ?? '';
}

function requiresAddressHandling(legType: unknown): boolean {
  return String(legType ?? '').includes('address');
}

async function assertGillerCanAccept(uid: string): Promise<void> {
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data() as BadgeUserDoc & {
    role?: string;
    gillerApplicationStatus?: string;
    isVerified?: boolean;
    isGiller?: boolean;
  } | undefined;

  const role = userData?.role ?? '';
  const hasGillerRole = role === 'giller' || role === 'both' || userData?.isGiller === true;
  const isApproved = userData?.gillerApplicationStatus === 'approved';
  if (!hasGillerRole && !isApproved) {
    throw new functions.https.HttpsError('permission-denied', 'Giller approval is required');
  }
}

export const beta1AcceptMissionBundleForGiller = functions.https.onCall(
  async (data: { bundleId?: string; gillerUserId?: string }, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    if (!data.bundleId) {
      throw new functions.https.HttpsError('invalid-argument', 'bundleId is required');
    }
    if (data.gillerUserId && data.gillerUserId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'gillerUserId mismatch');
    }

    await assertGillerCanAccept(uid);

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const bundleRef = db.collection('mission_bundles').doc(data.bundleId);

    return db.runTransaction(async (transaction) => {
      const bundleSnapshot = await transaction.get(bundleRef);
      if (!bundleSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Mission bundle not found');
      }

      const bundle: BundleRecord = {
        missionBundleId: bundleSnapshot.id,
        ...(bundleSnapshot.data() as Record<string, any>),
      };
      if (bundle.status !== 'active') {
        throw new functions.https.HttpsError('failed-precondition', 'Mission bundle is not active');
      }
      if (bundle.selectedGillerUserId && bundle.selectedGillerUserId !== uid) {
        throw new functions.https.HttpsError('already-exists', 'Mission bundle already accepted by another giller');
      }

      const missionRefs = (bundle.missionIds ?? []).map((missionId: string) =>
        db.collection('missions').doc(missionId)
      );
      const missionSnapshots = await Promise.all(missionRefs.map((ref: FirebaseFirestore.DocumentReference) => transaction.get(ref)));
      const selectedMissions: MissionRecord[] = missionSnapshots
        .filter((snapshot: FirebaseFirestore.DocumentSnapshot) => snapshot.exists)
        .map((snapshot: FirebaseFirestore.DocumentSnapshot) => ({ id: snapshot.id, ...(snapshot.data() as FirestoreRecord) }));

      if (selectedMissions.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'Mission bundle has no missions');
      }
      if (selectedMissions.some((mission) => mission.assignedGillerUserId && mission.assignedGillerUserId !== uid)) {
        throw new functions.https.HttpsError('already-exists', 'Mission already accepted by another giller');
      }

      const allMissionQuery = db.collection('missions').where('deliveryId', '==', bundle.deliveryId);
      const siblingBundleQuery = db.collection('mission_bundles').where('deliveryId', '==', bundle.deliveryId);
      const [allMissionSnapshots, siblingBundleSnapshots] = await Promise.all([
        transaction.get(allMissionQuery),
        transaction.get(siblingBundleQuery),
      ]);

      const selectedLegIds = selectedMissions
        .map((mission: MissionRecord) => String(mission.deliveryLegId ?? ''))
        .filter(Boolean);
      const selectedMissionIds = new Set(selectedMissions.map((mission: MissionRecord) => mission.id));
      const allMissions: MissionRecord[] = allMissionSnapshots.docs.map((snapshot: FirebaseFirestore.QueryDocumentSnapshot) => ({
        id: snapshot.id,
        ...(snapshot.data() as FirestoreRecord),
      }));
      const siblingBundles: BundleRecord[] = siblingBundleSnapshots.docs.map((snapshot: FirebaseFirestore.QueryDocumentSnapshot) => ({
        missionBundleId: snapshot.id,
        ...(snapshot.data() as FirestoreRecord),
      }));

      selectedMissions.forEach((mission: MissionRecord) => {
        transaction.update(db.collection('missions').doc(mission.id), {
          assignedGillerUserId: uid,
          status: 'accepted',
          updatedAt: serverTimestamp,
        });
      });

      selectedLegIds.forEach((deliveryLegId: string) => {
        transaction.update(db.collection('delivery_legs').doc(deliveryLegId), {
          actorType: 'giller',
          status: 'ready',
          updatedAt: serverTimestamp,
        });
      });

      const rewardTotal = selectedMissions.reduce(
        (sum: number, mission: MissionRecord) => sum + Number(mission.currentReward ?? mission.recommendedReward ?? 0),
        0
      );
      transaction.update(bundleRef, {
        selectedGillerUserId: uid,
        status: 'active',
        rewardTotal,
        updatedAt: serverTimestamp,
      });

      const acceptedMissionCount = allMissions.filter(
        (mission: MissionRecord) => Boolean(mission.assignedGillerUserId) || selectedMissionIds.has(mission.id)
      ).length;
      const totalMissionCount = allMissions.length;
      const coversEntireDelivery = selectedMissions.length === totalMissionCount;
      const partiallyMatched = acceptedMissionCount > 0 && acceptedMissionCount < totalMissionCount;

      transaction.update(db.collection('deliveries').doc(bundle.deliveryId), {
        beta1DeliveryStatus: coversEntireDelivery ? 'assigned' : 'created',
        ...(coversEntireDelivery ? { gillerId: uid } : {}),
        updatedAt: serverTimestamp,
      });

      if (bundle.requestId) {
        transaction.update(db.collection('requests').doc(bundle.requestId), {
          matchedGillerId: coversEntireDelivery ? uid : null,
          status: coversEntireDelivery ? 'accepted' : 'pending',
          beta1RequestStatus: coversEntireDelivery ? 'accepted' : 'match_pending',
          missionProgress: {
            acceptedMissionCount,
            totalMissionCount,
            partiallyMatched,
            lastBundleId: bundle.missionBundleId,
            lastMatchedAt: serverTimestamp,
          },
          updatedAt: serverTimestamp,
        });
      }

      siblingBundles
        .filter((candidate: BundleRecord) => candidate.missionBundleId !== bundle.missionBundleId)
        .filter((candidate: BundleRecord) => (candidate.missionIds ?? []).some((missionId: string) => selectedMissionIds.has(missionId)))
        .forEach((candidate: BundleRecord) => {
          transaction.update(db.collection('mission_bundles').doc(candidate.missionBundleId), {
            status: 'cancelled',
            updatedAt: serverTimestamp,
          });
        });

      return { ok: true, acceptedMissionCount, totalMissionCount, coversEntireDelivery };
    });
  }
);

export const beta1ReleaseMissionBundleForGiller = functions.https.onCall(
  async (data: { bundleId?: string; gillerUserId?: string }, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    if (!data.bundleId) {
      throw new functions.https.HttpsError('invalid-argument', 'bundleId is required');
    }
    if (data.gillerUserId && data.gillerUserId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'gillerUserId mismatch');
    }

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const deleteField = admin.firestore.FieldValue.delete();
    const bundleRef = db.collection('mission_bundles').doc(data.bundleId);

    return db.runTransaction(async (transaction) => {
      const bundleSnapshot = await transaction.get(bundleRef);
      if (!bundleSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Mission bundle not found');
      }

      const bundle: BundleRecord = {
        missionBundleId: bundleSnapshot.id,
        ...(bundleSnapshot.data() as Record<string, any>),
      };
      if (bundle.selectedGillerUserId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the assigned giller can release this mission');
      }

      const missionRefs = (bundle.missionIds ?? []).map((missionId: string) =>
        db.collection('missions').doc(missionId)
      );
      const missionSnapshots = await Promise.all(missionRefs.map((ref: FirebaseFirestore.DocumentReference) => transaction.get(ref)));
      const selectedMissions: MissionRecord[] = missionSnapshots
        .filter((snapshot: FirebaseFirestore.DocumentSnapshot) => snapshot.exists)
        .map((snapshot: FirebaseFirestore.DocumentSnapshot) => ({ id: snapshot.id, ...(snapshot.data() as FirestoreRecord) }));

      if (
        selectedMissions.some((mission: MissionRecord) =>
          ['in_progress', 'arrival_pending', 'handover_pending', 'completed'].includes(String(mission.status ?? ''))
        )
      ) {
        throw new functions.https.HttpsError('failed-precondition', 'Already started missions cannot be released');
      }

      const legRefs = selectedMissions
        .map((mission: MissionRecord) => String(mission.deliveryLegId ?? ''))
        .filter(Boolean)
        .map((deliveryLegId: string) => db.collection('delivery_legs').doc(deliveryLegId));
      const legSnapshots = await Promise.all(legRefs.map((ref: FirebaseFirestore.DocumentReference) => transaction.get(ref)));
      const selectedLegs: LegRecord[] = legSnapshots
        .filter((snapshot: FirebaseFirestore.DocumentSnapshot) => snapshot.exists)
        .map((snapshot: FirebaseFirestore.DocumentSnapshot) => ({ id: snapshot.id, ...(snapshot.data() as FirestoreRecord) }));

      const siblingBundleSnapshots = await transaction.get(
        db.collection('mission_bundles').where('deliveryId', '==', bundle.deliveryId)
      );
      const selectedMissionIds = new Set(selectedMissions.map((mission: MissionRecord) => mission.id));

      selectedMissions.forEach((mission: MissionRecord) => {
        transaction.update(db.collection('missions').doc(mission.id), {
          assignedGillerUserId: deleteField,
          status: 'queued',
          updatedAt: serverTimestamp,
        });
      });

      selectedLegs.forEach((leg: LegRecord) => {
        transaction.update(db.collection('delivery_legs').doc(leg.id), {
          actorType: requiresAddressHandling(leg.legType) ? 'external_partner' : 'giller',
          status: 'ready',
          updatedAt: serverTimestamp,
        });
      });

      transaction.update(bundleRef, {
        selectedGillerUserId: deleteField,
        status: 'active',
        updatedAt: serverTimestamp,
      });

      siblingBundleSnapshots.docs
        .map((snapshot: FirebaseFirestore.QueryDocumentSnapshot) => ({ missionBundleId: snapshot.id, ...(snapshot.data() as FirestoreRecord) }) as BundleRecord)
        .filter((candidate: BundleRecord) => candidate.missionBundleId !== bundle.missionBundleId)
        .filter((candidate: BundleRecord) => (candidate.missionIds ?? []).some((missionId: string) => selectedMissionIds.has(missionId)))
        .forEach((candidate: BundleRecord) => {
          transaction.update(db.collection('mission_bundles').doc(candidate.missionBundleId), {
            status: 'active',
            updatedAt: serverTimestamp,
          });
        });

      transaction.update(db.collection('deliveries').doc(bundle.deliveryId), {
        beta1DeliveryStatus: 'created',
        gillerId: deleteField,
        updatedAt: serverTimestamp,
      });

      if (bundle.requestId) {
        transaction.update(db.collection('requests').doc(bundle.requestId), {
          matchedGillerId: null,
          status: 'pending',
          beta1RequestStatus: 'match_pending',
          updatedAt: serverTimestamp,
        });
      }

      return { ok: true };
    });
  }
);

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
