// @ts-nocheck
/**
 * Giller Settlement Scheduler
 *
 * 매월 5일 00:00에 실행되어 레거시 기업 계약 길러의 월간 정산을 자동 처리합니다.
 *
 * 실행 일정: "0 0 5 * *" (매월 5일 00:00, Asia/Seoul)
 */

import * as admin from 'firebase-admin';

/**
 * 매월 5일 길러 정산 스케줄러
 *
 * 1. 레거시 기업 계약 길러 조회 (gillerProfile.tier: 'silver' | 'gold' | 'platinum')
 * 2. 전월 배송 집계
 * 3. 등급별 수수료율 적용, 보너스 계산
 * 4. 정산 정보 생성
 * 5. 이체 실행 (또는 이체 정보 저장)
 */
export const gillerSettlementScheduler = async (): Promise<{
  processed: number;
  settlementsGenerated: number;
  totalAmount: number;
  errors: string[];
}> => {
  console.warn('💰 [Giller Settlement Scheduler] Started at:', new Date().toISOString());

  const db = admin.firestore();
  const now = new Date();
  const timeZone = 'Asia/Seoul';

  // 한국 시간 기준 전월 계산
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone }));
  const prevMonth = new Date(koreaTime.getFullYear(), koreaTime.getMonth() - 1, 1);

  const year = prevMonth.getFullYear();
  const month = prevMonth.getMonth() + 1; // 1-12

  console.warn(`📅 Target period: ${year}년 ${month}월`);

  const errors: string[] = [];
  let totalAmount = 0;

  try {
    // 1. 레거시 기업 계약 길러 조회 (등급별)
    const enterpriseLegacyTiers = ['silver', 'gold', 'platinum'] as const;

    const batch = db.batch();
    let settlementsGenerated = 0;

    for (const tier of enterpriseLegacyTiers) {
      console.warn(`🔍 Processing tier: ${tier}`);

      // 해당 등급 길러 조회
      const usersSnapshot = await db
        .collection('users')
        .where('gillerProfile.tier', '==', tier)
        .get();

      console.warn(`👥 Found ${usersSnapshot.size} ${tier} gillers`);

      for (const userDoc of usersSnapshot.docs) {
        const gillerId = userDoc.id;
        const giller = userDoc.data();

        try {
          // 2-1. 전월 배송 집계
          const startOfMonth = new Date(year, month - 1, 1);
          const endOfMonth = new Date(year, month, 0, 23, 59, 59);

          const deliveriesSnapshot = await db
            .collection('b2bDeliveries')
            .where('gillerId', '==', gillerId)
            .where('status', '==', 'completed')
            .where('completedAt', '>=', startOfMonth)
            .where('completedAt', '<=', endOfMonth)
            .get();

          const deliveries = deliveriesSnapshot.docs.map((doc) => doc.data() as Record<string, any>);

          if (deliveries.length === 0) {
            console.warn(`⏭️ No enterprise legacy deliveries for giller ${gillerId} in ${year}-${month}`);
            continue;
          }

          // 2-2. 기본 수익 계산
          const totalDeliveries = deliveries.length;
          const baseEarnings = deliveries.reduce((sum, d) => sum + (d.fee?.gillerNet ?? 0), 0);

          // 2-3. 등급별 보너스 계산
          let tierBonusRate = 0;
          if (tier === 'silver') tierBonusRate = 0.05; // 5% 보너스
          else if (tier === 'gold') tierBonusRate = 0.10; // 10% 보너스
          else if (tier === 'platinum') tierBonusRate = 0.15; // 15% 보너스

          const tierBonus = Math.round(baseEarnings * tierBonusRate);

          // 2-4. 추가 보너스 계산
          const activityBonus = totalDeliveries >= 50 ? 50000 : 0; // 50건 이상 시 5만원 보너스
          const qualityBonus = (giller.rating ?? 0) >= 4.9 ? 30000 : 0; // 4.9 이상 시 3만원 보너스

          const bonusTotal = tierBonus + activityBonus + qualityBonus;
          const totalEarnings = baseEarnings + bonusTotal;

          // 2-5. 세금 계산 (3.3% 원천징수)
          const withholdingTax = Math.round(totalEarnings * 0.033);
          const netAmount = totalEarnings - withholdingTax;

          console.warn(
            `💰 Giller ${gillerId} (${tier}): ${totalDeliveries} deliveries, ${baseEarnings}원 base, ${bonusTotal}원 bonus, ${netAmount}원 net`
          );

          // 2-6. 정산 정보 생성
          const settlementRef = db.collection('b2bSettlements').doc();

          const settlement = {
            settlementId: settlementRef.id,
            gillerId,
            gillerName: giller.name ?? '익명',
            gillerTier: tier,
            period: {
              year,
              month,
              start: startOfMonth,
              end: endOfMonth,
            },
            deliveries: {
              total: totalDeliveries,
              completed: totalDeliveries,
              canceled: 0,
            },
            earnings: {
              base: baseEarnings,
              tierBonus,
              activityBonus,
              qualityBonus,
              bonusTotal,
              subtotal: totalEarnings,
              withholdingTax,
              netAmount,
            },
            tier,
            bankAccount: {
              bank: giller.bankAccount?.bank ?? '',
              accountNumber: giller.bankAccount?.accountNumber ?? '',
              accountHolder: giller.bankAccount?.accountHolder ?? '',
            },
            status: 'pending', // pending → completed
            transferredAt: null,
            createdAt: admin.firestore.Timestamp.now(),
          };

          batch.set(settlementRef, settlement);
          settlementsGenerated++;
          totalAmount += netAmount;

          console.warn(`✅ Settlement created: ${settlement.settlementId}`);

          // TODO: 2-7. 이체 실행 (또는 이체 요청)
          // await executeTransfer(settlement);
          // batch.update(settlementRef, {
          //   status: 'completed',
          //   transferredAt: admin.firestore.Timestamp.now(),
          // });

          // TODO: 2-8. 길러에게 푸시 알림
          // await sendSettlementNotification(gillerId, settlement);

        } catch (error) {
          const errMsg = `Error processing giller ${gillerId}: ${error}`;
          console.error(errMsg);
          errors.push(errMsg);
        }
      }
    }

    // 3. Batch commit
    if (settlementsGenerated > 0) {
      await batch.commit();
      console.warn(`🎉 Giller settlement scheduler completed: ${settlementsGenerated} settlements, ${totalAmount}원 total`);
    }

    return {
      processed: settlementsGenerated,
      settlementsGenerated,
      totalAmount,
      errors,
    };
  } catch (error) {
    console.error('❌ Giller settlement scheduler error:', error);
    throw error;
  }
};
