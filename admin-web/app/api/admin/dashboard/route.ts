import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

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
      identityStatus === 'approved' ?? identityStatus === 'approved_test_bypass',
    bankApproved:
      bankStatus === 'verified' ||
      bankStatus === 'approved' ?? bankStatus === 'approved_test_bypass',
    gillerApplicationStatus:
      typeof data?.gillerApplicationStatus === 'string' ? data.gillerApplicationStatus : 'none',
  };
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    pendingWithdrawals,
    pendingDisputes,
    pendingGillerApps,
    activeDeliveries,
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
  ] = await Promise.all([
    db.collection('withdraw_requests').where('status', '==', 'pending').count().get(),
    db.collection('disputes').where('status', '==', 'pending').count().get(),
    db.collection('giller_applications').where('status', '==', 'pending').count().get(),
    db.collection('delivery_requests')
      .where('status', 'in', ['matched', 'picked_up', 'in_locker'])
      .count()
      .get(),
    db.collection('delivery_requests').where('createdAt', '>=', todayStart).count().get(),
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
    db.collection('delivery_requests').orderBy('createdAt', 'desc').limit(12).get(),
  ]);

  const latestFareDoc = fareLatest.docs[0]?.data() as { updatedAt?: { toDate?: () => Date } } | undefined;
  const latestUpdatedAt = latestFareDoc?.updatedAt?.toDate
    ? latestFareDoc.updatedAt.toDate().toISOString()
    : null;

  const onboarding = usersSnap.docs.reduce(
    (acc, doc) => {
      const state = readUserUpgradeState(doc.data());
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

  recentRequestsSnap.docs.forEach((doc) => {
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
      activeDeliveries: activeDeliveries.data().count,
      todayRequests: todayRequests.data().count,
      totalUsers: totalUsers.data().count,
      fareCount: fareCount.data().count,
      fareLatestUpdatedAt: latestUpdatedAt,
      lowConfidenceCount,
      manualReviewCount,
      reservationDraftCount: reservationDrafts.data().count,
      immediateDraftCount: immediateDrafts.data().count,
      criticalQueue:
        pendingWithdrawals.data().count +
        pendingDisputes.data().count +
        manualReviewCount +
        lowConfidenceCount,
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
}
