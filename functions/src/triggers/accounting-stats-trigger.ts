import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// ...

/**
 * [Admin 전용] 특정 월의 회계 통계를 수동으로 전체 재집계(Backfill)합니다.
 * 사용법: HTTPS Callable로 { year: 2024, month: 10 } 전송
 */
export const syncAccountingStats = functions.https.onCall(async (data, context) => {
  // 간단한 어드민 권한 체크 (실제 프로젝트 정책에 맞게 수정 필요)
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Admin required');
  
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (userDoc.data()?.role !== 'admin' && userDoc.data()?.role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin required');
  }

  const year = data.year;
  const month = data.month;
  if (!year || !month) throw new functions.https.HttpsError('invalid-argument', 'year and month required');

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  const docId = `${year}-${String(month).padStart(2, '0')}`;

  const db = admin.firestore();

  let totalGrossRevenue = 0;
  let totalRevenueDiscount = 0;
  let totalLiabilityOffset = 0;
  let totalCashCollected = 0;
  let totalGillerGrossPayout = 0;
  let totalGillerWithholdingTax = 0;
  let totalGillerNetPayout = 0;

  // 1. Payments 집계
  const paymentsSnap = await db.collection('payments')
    .where('createdAt', '>=', startOfMonth)
    .where('createdAt', '<=', endOfMonth)
    .get();

  for (const doc of paymentsSnap.docs) {
    const d = doc.data();
    if (d.type === 'request_fee' && d.status !== 'failed') {
      const acc = d.metadata?.accounting;
      if (acc) {
        totalGrossRevenue += acc.originalGrossAmount || 0;
        totalRevenueDiscount += acc.revenueDiscountAmount || 0;
        totalLiabilityOffset += acc.liabilityOffsetAmount || 0;
        totalCashCollected += acc.actualCashPaymentRequired || 0;
      } else {
        totalGrossRevenue += d.amount || 0;
        totalCashCollected += d.amount || 0;
      }
    } else if (d.type === 'giller_earning' && d.status === 'completed') {
      totalGillerGrossPayout += d.amount || 0;
      totalGillerWithholdingTax += d.tax || 0;
      totalGillerNetPayout += d.netAmount || 0;
    }
  }

  // 2. Partner Settlements 집계
  let totalPartnerGrossPayout = 0;
  let totalPartnerCommission = 0;
  let totalPartnerVat = 0;
  let totalPartnerNetPayout = 0;

  const partnerSnap = await db.collection('partner_settlements')
    .where('periodStart', '>=', startOfMonth.toISOString().split('T')[0])
    .where('periodStart', '<=', endOfMonth.toISOString().split('T')[0])
    .get();

  for (const doc of partnerSnap.docs) {
    const d = doc.data();
    totalPartnerGrossPayout += d.grossAmount || 0;
    totalPartnerCommission += d.commissionAmount || 0;
    totalPartnerVat += d.taxAmount || 0;
    totalPartnerNetPayout += d.netAmount || 0;
  }

  // 3. 통계 문서 덮어쓰기
  await db.collection('accounting_stats_monthly').doc(docId).set({
    period: { year, month },
    totalGrossRevenue,
    totalRevenueDiscount,
    totalLiabilityOffset,
    totalCashCollected,
    totalGillerGrossPayout,
    totalGillerWithholdingTax,
    totalGillerNetPayout,
    totalPartnerGrossPayout,
    totalPartnerCommission,
    totalPartnerVat,
    totalPartnerNetPayout,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isBackfilled: true,
  });

  return { success: true, message: `${docId} stats synced.` };
});

/**
 * Payment 문서의 변경 사항(Create, Update, Delete)을 감지하여
 * 월별 회계 통계 문서(accounting_stats_monthly/{YYYY-MM})에 집계합니다.
 */
export const onPaymentWrite = functions.firestore
  .document('payments/{paymentId}')
  .onWrite(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // 삭제된 경우
    if (!change.after.exists) {
      if (beforeData) {
        await updateMonthlyStats(beforeData, -1);
      }
      return null;
    }

    // 새로 생성된 경우
    if (!change.before.exists) {
      if (afterData) {
        await updateMonthlyStats(afterData, 1);
      }
      return null;
    }

    // 업데이트된 경우 (차이만큼 증감)
    if (beforeData && afterData) {
      await updateMonthlyStats(beforeData, -1);
      await updateMonthlyStats(afterData, 1);
    }
    return null;
  });

/**
 * Partner Settlement 문서의 변경 사항을 감지하여 월별 회계 통계 문서에 집계합니다.
 */
export const onPartnerSettlementWrite = functions.firestore
  .document('partner_settlements/{settlementId}')
  .onWrite(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (!change.after.exists) {
      if (beforeData) await updatePartnerMonthlyStats(beforeData, -1);
      return null;
    }
    if (!change.before.exists) {
      if (afterData) await updatePartnerMonthlyStats(afterData, 1);
      return null;
    }
    if (beforeData && afterData) {
      await updatePartnerMonthlyStats(beforeData, -1);
      await updatePartnerMonthlyStats(afterData, 1);
    }
    return null;
  });

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------

async function updateMonthlyStats(data: any, multiplier: 1 | -1) {
  // 날짜 파싱
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
  const year = createdAt.getFullYear();
  const month = String(createdAt.getMonth() + 1).padStart(2, '0');
  const docId = `${year}-${month}`;

  let totalGrossRevenue = 0;
  let totalRevenueDiscount = 0;
  let totalLiabilityOffset = 0;
  let totalCashCollected = 0;

  let totalGillerGrossPayout = 0;
  let totalGillerWithholdingTax = 0;
  let totalGillerNetPayout = 0;

  if (data.type === 'request_fee' && data.status !== 'failed') {
    const accounting = data.metadata?.accounting;
    if (accounting) {
      totalGrossRevenue = (accounting.originalGrossAmount || 0) * multiplier;
      totalRevenueDiscount = (accounting.revenueDiscountAmount || 0) * multiplier;
      totalLiabilityOffset = (accounting.liabilityOffsetAmount || 0) * multiplier;
      totalCashCollected = (accounting.actualCashPaymentRequired || 0) * multiplier;
    } else {
      totalGrossRevenue = (data.amount || 0) * multiplier;
      totalCashCollected = (data.amount || 0) * multiplier;
    }
  } else if (data.type === 'giller_earning' && data.status === 'completed') {
    totalGillerGrossPayout = (data.amount || 0) * multiplier;
    totalGillerWithholdingTax = (data.tax || 0) * multiplier;
    totalGillerNetPayout = (data.netAmount || 0) * multiplier;
  } else {
    // 집계 대상 아님
    return;
  }

  const db = admin.firestore();
  const statsRef = db.collection('accounting_stats_monthly').doc(docId);

  await statsRef.set({
    period: { year, month: createdAt.getMonth() + 1 },
    totalGrossRevenue: admin.firestore.FieldValue.increment(totalGrossRevenue),
    totalRevenueDiscount: admin.firestore.FieldValue.increment(totalRevenueDiscount),
    totalLiabilityOffset: admin.firestore.FieldValue.increment(totalLiabilityOffset),
    totalCashCollected: admin.firestore.FieldValue.increment(totalCashCollected),
    totalGillerGrossPayout: admin.firestore.FieldValue.increment(totalGillerGrossPayout),
    totalGillerWithholdingTax: admin.firestore.FieldValue.increment(totalGillerWithholdingTax),
    totalGillerNetPayout: admin.firestore.FieldValue.increment(totalGillerNetPayout),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function updatePartnerMonthlyStats(data: any, multiplier: 1 | -1) {
  let dateStr = data.periodStart;
  if (!dateStr && data.createdAt?.toDate) {
    dateStr = data.createdAt.toDate().toISOString().split('T')[0];
  }
  if (!dateStr) return; // 날짜를 알 수 없음

  const [year, month] = dateStr.split('-');
  const docId = `${year}-${month}`;

  const grossAmount = (data.grossAmount || 0) * multiplier;
  const commissionAmount = (data.commissionAmount || 0) * multiplier;
  const taxAmount = (data.taxAmount || 0) * multiplier;
  const netAmount = (data.netAmount || 0) * multiplier;

  const db = admin.firestore();
  const statsRef = db.collection('accounting_stats_monthly').doc(docId);

  await statsRef.set({
    period: { year: parseInt(year, 10), month: parseInt(month, 10) },
    totalPartnerGrossPayout: admin.firestore.FieldValue.increment(grossAmount),
    totalPartnerCommission: admin.firestore.FieldValue.increment(commissionAmount),
    totalPartnerVat: admin.firestore.FieldValue.increment(taxAmount),
    totalPartnerNetPayout: admin.firestore.FieldValue.increment(netAmount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}