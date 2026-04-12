// @ts-nocheck
/**
 * Partner Settlement Scheduler
 *
 * 매월 5일 01:00에 실행되어 외부 전문 배송업체(B2B Partners)의 월간 정산을 자동 처리합니다.
 *
 * 실행 일정: "0 1 5 * *" (매월 5일 01:00, Asia/Seoul)
 */

import * as admin from 'firebase-admin';
import { executeTossPayout } from '../services/toss-payout';

export const partnerSettlementScheduler = async (): Promise<{
  processedPartners: number;
  settlementsGenerated: number;
  totalAmount: number;
  errors: string[];
}> => {
  console.warn('🏢 [Partner Settlement Scheduler] Started at:', new Date().toISOString());

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
  let processedPartners = 0;
  let settlementsGenerated = 0;

  try {
    const batch = db.batch();

    // 1. 활성 파트너 조회
    const partnersSnapshot = await db
      .collection('delivery_partners')
      .where('status', 'in', ['active', 'testing', 'connected'])
      .get();

    console.warn(`🏢 Found ${partnersSnapshot.size} partners to process`);

    for (const partnerDoc of partnersSnapshot.docs) {
      processedPartners++;
      const partnerId = partnerDoc.id;
      const partner = partnerDoc.data();

      // 파트너별 개별 설정 가져오기 (없으면 기본값 사용)
      const settlementConfig = partner.settlementConfig || {
        commissionRate: 0.15, // 15% 위임 수수료
        taxRate: 0.1,         // 10% 부가세
        settlementCycle: 'monthly',
      };

      try {
        // 2. 전월 완료된 파트너 위임 배송 집계
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const dispatchesSnapshot = await db
          .collection('partner_dispatches')
          .where('partnerId', '==', partnerId)
          .where('status', 'in', ['completed', 'delivered'])
          .where('updatedAt', '>=', startOfMonth)
          .where('updatedAt', '<=', endOfMonth)
          .get();

        const dispatches = dispatchesSnapshot.docs.map((doc) => doc.data());

        if (dispatches.length === 0) {
          console.warn(`⏭️ No dispatches for partner ${partnerId} in ${year}-${month}`);
          continue;
        }

        // 3. 금액 계산
        const totalDeliveries = dispatches.length;
        let totalGrossAmount = 0;

        for (const dispatch of dispatches) {
          // 파트너에게 위임 시 책정된 단가 (quotedCost 또는 fee.totalFee 등)
          const dispatchFee = dispatch.quotedCost ?? dispatch.estimatedCost ?? 0;
          totalGrossAmount += dispatchFee;
        }

        if (totalGrossAmount <= 0) {
          console.warn(`⚠️ Partner ${partnerId} has ${totalDeliveries} deliveries but 0 gross amount.`);
          continue;
        }

        // 파트너 설정에 따른 수수료 및 세금 계산
        const commissionAmount = Math.round(totalGrossAmount * settlementConfig.commissionRate);
        const feeAfterCommission = totalGrossAmount - commissionAmount;
        const taxAmount = Math.round(feeAfterCommission * settlementConfig.taxRate);
        const netAmount = feeAfterCommission - taxAmount;

        console.warn(
          `💰 Partner ${partnerId}: ${totalDeliveries} deliveries, Gross: ${totalGrossAmount}, Comm: ${commissionAmount}, Tax: ${taxAmount}, Net: ${netAmount}`
        );

        // 4. 정산 정보 생성
        const settlementRef = db.collection('partner_settlements').doc();

        const settlement = {
          id: settlementRef.id,
          partnerId,
          partnerName: partner.partnerName ?? 'Unknown Partner',
          periodStart: startOfMonth.toISOString().split('T')[0],
          periodEnd: endOfMonth.toISOString().split('T')[0],
          grossAmount: totalGrossAmount,
          commissionAmount,
          taxAmount,
          netAmount,
          deliveryCount: totalDeliveries,
          configSnapshot: settlementConfig, // 정산 당시의 요율 스냅샷 기록
          bankAccount: settlementConfig.bankAccount || null,
          status: 'pending', // pending -> processing -> completed
          createdAt: admin.firestore.Timestamp.now(),
          settledAt: null,
        };

        batch.set(settlementRef, settlement);
        settlementsGenerated++;
        totalAmount += netAmount;
      } catch (error) {
        const errMsg = `Error processing partner ${partnerId}: ${error}`;
        console.error(errMsg);
        errors.push(errMsg);
      }
    }

    // 5. 일괄 저장 (1st Phase: Save settlements as pending)
    if (settlementsGenerated > 0) {
      await batch.commit();
      console.warn(`💾 Phase 1: Saved ${settlementsGenerated} pending partner settlements to DB.`);
    }

    // 6. Phase 2: Execute Payouts sequentially for the generated settlements
    if (settlementsGenerated > 0) {
      const pendingSettlements = await db
        .collection('partner_settlements')
        .where('periodStart', '==', new Date(year, month - 1, 1).toISOString().split('T')[0])
        .where('status', '==', 'pending')
        .get();

      for (const doc of pendingSettlements.docs) {
        const settlement = doc.data();
        const { partnerId, netAmount, bankAccount } = settlement;

        if (netAmount > 0 && bankAccount?.bank && bankAccount?.accountNumber) {
          try {
            const payoutResult = await executeTossPayout(
              bankAccount.bank,
              bankAccount.accountNumber,
              netAmount,
              `${month}월 크라우드 파트너 정산금`,
              `partner_settlement_${doc.id}` // 멱등키(Idempotency Key) 추가
            );

            if (payoutResult.success) {
              await doc.ref.update({
                status: 'completed',
                settledAt: admin.firestore.Timestamp.now(),
                transactionId: payoutResult.transactionId ?? null,
                updatedAt: admin.firestore.Timestamp.now(),
              });
              console.warn(`✅ Partner payout success for ${partnerId}`);
            } else {
              await doc.ref.update({
                status: 'failed',
                transferError: payoutResult.error,
                updatedAt: admin.firestore.Timestamp.now(),
              });
              console.error(`❌ Partner payout failed for ${partnerId}: ${payoutResult.error}`);
            }
          } catch (payoutError) {
            await doc.ref.update({
              status: 'failed',
              transferError: String(payoutError),
              updatedAt: admin.firestore.Timestamp.now(),
            });
            console.error(`❌ Critical payout error for partner ${partnerId}:`, payoutError);
          }
        } else {
          // If amount is 0 or bank info is missing, mark as failed automatically
          await doc.ref.update({
            status: 'failed',
            transferError: 'Invalid bank account or zero amount',
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
      }
    }

    return { processedPartners, settlementsGenerated, totalAmount, errors };
  } catch (error) {
    console.error('Fatal error in partnerSettlementScheduler:', error);
    throw error;
  }
};
