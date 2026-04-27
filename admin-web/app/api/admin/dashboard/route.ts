import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

async function getCount(collectionPath: string, field: string, value: unknown) {
   
  return db.collection(collectionPath).where(field, '==', value).count().get();
}

async function getCombinedCount(
  collectionPath: string,
  field: string,
  values: string[]
) {
  const snapshots = await Promise.all(values.map((value) => getCount(collectionPath, field, value)));
  return snapshots.reduce((sum, snapshot) => sum + snapshot.data().count, 0);
}

async function getDelayedRequestCount(requestDelayThreshold: Date) {
   
  const [pendingSnap, matchedSnap] = await Promise.all([
    db.collection('requests').where('status', '==', 'pending').get(),
    db.collection('requests').where('status', '==', 'matched').get(),
  ]);

  return [...pendingSnap.docs, ...matchedSnap.docs].filter((doc) => {
    const createdAt = doc.data().createdAt;
    if (createdAt && typeof createdAt.toDate === 'function') {
      return createdAt.toDate() <= requestDelayThreshold;
    }
    return false;
  }).length;
}

async function getDelayedDeliveryCount(deliveryDelayThreshold: Date) {
   
  const snap = await db.collection('deliveries')
    .where('status', 'in', ['picked_up', 'in_transit', 'arrived', 'at_locker', 'handover_pending', 'last_mile_in_progress'])
    .get();

  return snap.docs.filter((doc: any) => {
    const createdAt = doc.data().createdAt;
    if (createdAt && typeof createdAt.toDate === 'function') {
      return createdAt.toDate() <= deliveryDelayThreshold;
    }
    return false;
  }).length;
}

function readConfig(
  data: Record<string, unknown> | undefined,
  type: 'identity' | 'bank' | 'payment' | 'ai'
) {
  const provider = typeof data?.provider === 'string' ? data.provider : 'unknown';
  const defaultStatusMessage =
    type === 'identity'
      ? '본인 확인 연동 상태를 점검해 주세요.'
      : type === 'bank'
        ? '계좌 인증 준비 상태를 점검해 주세요.'
        : type === 'payment'
          ? 'PG 준비 상태를 점검해 주세요.'
          : 'AI 엔진 상태를 점검해 주세요.';

  return {
    enabled: Boolean(data?.enabled ?? false),
    testMode: Boolean(data?.testMode ?? true),
    liveReady: Boolean(data?.liveReady ?? false),
    statusMessage:
      typeof data?.statusMessage === 'string' && data.statusMessage.trim().length > 0
        ? data.statusMessage
        : defaultStatusMessage,
    provider,
  };
}

function readUserUpgradeState(data: Record<string, unknown> | undefined) {
  const gillerInfo =
    typeof data?.gillerInfo === 'object' && data.gillerInfo !== null
      ? (data.gillerInfo as Record<string, unknown>)
      : {};
  const bankAccount =
    typeof gillerInfo.bankAccount === 'object' && gillerInfo.bankAccount !== null
      ? (gillerInfo.bankAccount as Record<string, unknown>)
      : {};

  const identityStatus =
    typeof gillerInfo.identityVerificationStatus === 'string'
      ? gillerInfo.identityVerificationStatus
      : data?.isVerified
        ? 'approved'
        : 'not_submitted';

  const bankStatus =
    typeof bankAccount.verificationStatus === 'string'
      ? bankAccount.verificationStatus
      : 'not_submitted';

  return {
    identityApproved:
      identityStatus === 'approved' || identityStatus === 'approved_test_bypass',
    bankApproved:
      bankStatus === 'verified' ||
      bankStatus === 'approved' ||
      bankStatus === 'approved_test_bypass',
    gillerApplicationStatus:
      typeof data?.gillerApplicationStatus === 'string' ? data.gillerApplicationStatus : 'none',
  };
}

function readRequesterReadiness(data: Record<string, unknown> | undefined) {
  const phoneVerification =
    typeof data?.phoneVerification === 'object' && data.phoneVerification !== null
      ? (data.phoneVerification as Record<string, unknown>)
      : {};

  return {
    onboardingCompleted: data?.hasCompletedOnboarding === true,
    phoneVerified: phoneVerification.verified === true,
  };
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
     
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const requestDelayThreshold = new Date(now.getTime() - 15 * 60 * 1000);
    const deliveryDelayThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const [
      pendingWithdrawals,
      pendingDisputes,
      pendingGillerApps,
      activeDeliveryCount,
      todayRequests,
      totalUsers,
      fareCount,
      fareLatest,
      identityConfigSnap,
      bankConfigSnap,
      paymentConfigSnap,
      aiConfigSnap,
      lowConfidenceAnalyses,
      manualReviewDecisions,
      reservationDrafts,
      immediateDrafts,
      usersSnap,
      recentRequestsSnap,
      deliveryPartnersCount,
      activeDeliveryPartnersCount,
      partnerDispatchQueuedCount,
      partnerDispatchActiveCount,
      delayedRequestCount,
      delayedDeliveryCount,
    ] = await Promise.all([
      db.collection('withdraw_requests').where('status', '==', 'pending').count().get(),
      db.collection('disputes').where('status', '==', 'pending').count().get(),
      db.collection('giller_applications').where('status', '==', 'pending').count().get(),
      getCombinedCount('deliveries', 'status', ['accepted', 'picked_up', 'in_transit', 'arrived', 'at_locker']),
      db.collection('requests').where('createdAt', '>=', todayStart).count().get(),
      db.collection('users').count().get(),
      db.collection('config_fares').count().get(),
      db.collection('config_fares').orderBy('updatedAt', 'desc').limit(1).get(),
      db.collection('config_integrations').doc('identity').get(),
      db.collection('config_integrations').doc('bank').get(),
      db.collection('config_integrations').doc('payment').get(),
      db.collection('config_integrations').doc('ai').get(),
      db.collection('ai_analyses').where('status', '==', 'low_confidence').count().get(),
      db.collection('actor_selection_decisions')
        .where('manualReviewRequired', '==', true)
        .count()
        .get(),
      db.collection('request_drafts').where('requestMode', '==', 'reservation').count().get(),
      db.collection('request_drafts').where('requestMode', '==', 'immediate').count().get(),
      db.collection('users').limit(300).get(),
      db.collection('requests').orderBy('createdAt', 'desc').limit(12).get(),
      db.collection('delivery_partners').count().get(),
      db.collection('delivery_partners').where('status', '==', 'active').count().get(),
      getCombinedCount('partner_dispatches', 'status', ['queued', 'requested']),
      getCombinedCount('partner_dispatches', 'status', ['accepted', 'in_progress']),
      getDelayedRequestCount(requestDelayThreshold),
      getDelayedDeliveryCount(deliveryDelayThreshold),
    ]);

    const latestFareDoc = fareLatest.docs[0]?.data() as { updatedAt?: { toDate?: () => Date } } | undefined;
    const latestUpdatedAt = latestFareDoc?.updatedAt?.toDate
      ? latestFareDoc.updatedAt.toDate().toISOString()
      : null;

    const onboarding = usersSnap.docs.reduce(
      (acc: any, doc: any) => {
        const data = doc.data();
        const state = readUserUpgradeState(data);
        const readiness = readRequesterReadiness(data);

        if (!readiness.onboardingCompleted) acc.onboardingIncomplete += 1;
        if (readiness.onboardingCompleted && !readiness.phoneVerified) acc.requesterPhonePending += 1;
        if (state.gillerApplicationStatus === 'pending') acc.awaitingUpgradeReview += 1;
        if (state.identityApproved && !state.bankApproved) acc.identityDoneBankPending += 1;
        if (!state.identityApproved) acc.identityPending += 1;
        if (
          state.identityApproved &&
          state.bankApproved &&
          state.gillerApplicationStatus !== 'approved'
        ) {
          acc.readyForUpgradeReview += 1;
        }
        return acc;
      },
      {
        onboardingIncomplete: 0,
        requesterPhonePending: 0,
        identityPending: 0,
        identityDoneBankPending: 0,
        awaitingUpgradeReview: 0,
        readyForUpgradeReview: 0,
      }
    );

    const identityConfig = readConfig(identityConfigSnap.data(), 'identity');
    const bankConfig = readConfig(bankConfigSnap.data(), 'bank');
    const paymentConfig = readConfig(paymentConfigSnap.data(), 'payment');
    const aiConfig = readConfig(aiConfigSnap.data(), 'ai');
    const manualReviewCount = manualReviewDecisions.data().count;
    const lowConfidenceCount = lowConfidenceAnalyses.data().count;
    const geoMarkers: Array<{
      type: 'pickup' | 'dropoff';
      label: string;
      latitude: number;
      longitude: number;
    }> = [];

    recentRequestsSnap.docs.forEach((doc: any) => {
      if (geoMarkers.length >= 8) {
        return;
      }

      const data = doc.data() as {
        pickupStation?: { lat?: number; lng?: number };
        deliveryStation?: { lat?: number; lng?: number };
      };

      if (typeof data.pickupStation?.lat === 'number' && typeof data.pickupStation?.lng === 'number') {
        geoMarkers.push({
          type: 'pickup',
          label: 'P',
          latitude: data.pickupStation.lat,
          longitude: data.pickupStation.lng,
        });
      }

      if (
        geoMarkers.length < 8 &&
        typeof data.deliveryStation?.lat === 'number' &&
        typeof data.deliveryStation?.lng === 'number'
      ) {
        geoMarkers.push({
          type: 'dropoff',
          label: 'D',
          latitude: data.deliveryStation.lat,
          longitude: data.deliveryStation.lng,
        });
      }
    });

    return NextResponse.json({
      metrics: {
        pendingWithdrawals: pendingWithdrawals.data().count,
        pendingDisputes: pendingDisputes.data().count,
        pendingGillerApps: pendingGillerApps.data().count,
        activeDeliveries: activeDeliveryCount,
        todayRequests: todayRequests.data().count,
        totalUsers: totalUsers.data().count,
        fareCount: fareCount.data().count,
        fareLatestUpdatedAt: latestUpdatedAt,
        lowConfidenceCount,
        manualReviewCount,
        reservationDraftCount: reservationDrafts.data().count,
        immediateDraftCount: immediateDrafts.data().count,
        deliveryPartnersCount: deliveryPartnersCount.data().count,
        activeDeliveryPartnersCount: activeDeliveryPartnersCount.data().count,
        partnerDispatchQueuedCount,
        partnerDispatchActiveCount,
        delayedRequestCount,
        delayedDeliveryCount,
        criticalQueue:
          pendingWithdrawals.data().count +
          pendingDisputes.data().count +
          manualReviewCount +
          lowConfidenceCount +
          partnerDispatchQueuedCount +
          delayedRequestCount +
          delayedDeliveryCount,
      },
      integrations: {
        identity: identityConfig,
        bank: bankConfig,
        payment: paymentConfig,
        ai: {
          ...aiConfig,
          model: typeof aiConfigSnap.data()?.model === 'string' ? aiConfigSnap.data()?.model : 'unknown',
          disableThinking: Boolean(aiConfigSnap.data()?.disableThinking ?? true),
        },
      },
      onboarding,
      geo: {
        recentMarkers: geoMarkers,
      },
    });
  } catch (error) {
    console.error('Failed to build admin dashboard payload', error);
    return NextResponse.json({ error: 'Dashboard payload failed' }, { status: 500 });
  }
}
