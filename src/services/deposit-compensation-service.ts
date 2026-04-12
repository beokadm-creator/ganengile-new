import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { PointService } from './PointService';
import { TossPaymentService } from './TossPaymentService';
import type { Deposit, DepositStatus } from '../types/point';
import { PointCategory } from '../types/point';

const DEPOSITS_COLLECTION = 'deposits';

async function getDepositDocument(depositId: string): Promise<{ ref: ReturnType<typeof doc>; deposit: Deposit } | null> {
  const depositRef = doc(db, DEPOSITS_COLLECTION, depositId);
  const depositDoc = await getDoc(depositRef);

  if (!depositDoc.exists()) {
    return null;
  }

  return {
    ref: depositRef,
    deposit: depositDoc.data() as Deposit,
  };
}

export class DepositCompensationService {
  static async refundDeposit(
    depositId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const record = await getDepositDocument(depositId);
      if (!record) {
        return { success: false, error: 'Deposit not found' };
      }

      const { ref, deposit } = record;
      if (deposit.status !== ('paid' as DepositStatus)) {
        return { success: false, error: 'Deposit is not paid' };
      }

      if (deposit.pointAmount && deposit.pointAmount > 0) {
        await PointService.earnPoints(
          deposit.userId,
          deposit.pointAmount,
          PointCategory.DEPOSIT_REFUND,
          `보증금 환급 (${deposit.pointAmount.toLocaleString()}원)`
        );
      }

      if (deposit.tossAmount && deposit.tossAmount > 0 && deposit.paymentId) {
        const refundResult = await TossPaymentService.refundPayment(
          deposit.paymentId,
          deposit.tossAmount,
          '배송 완료에 따른 보증금 환급'
        );
        if (!refundResult.success) {
          throw new Error(`보증금 환급(결제 취소) 실패: ${refundResult.error}`);
        }
      }

      await updateDoc(ref, {
        status: 'refunded' as DepositStatus,
        refundedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('Deposit refund failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async deductCompensation(
    depositId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const record = await getDepositDocument(depositId);
      if (!record) {
        return { success: false, error: 'Deposit not found' };
      }

      const { ref, deposit } = record;
      if (deposit.status !== ('paid' as DepositStatus)) {
        return { success: false, error: 'Deposit is not paid' };
      }

      // 1. 이미 보증금 결제 시점(payDeposit)에서 Giller의 포인트가 차감되었고,
      // Toss 결제도 승인되었으므로 여기서 Giller의 포인트를 한 번 더 차감(spendPoints)하면 이중 차감 버그가 발생합니다.
      // 보증금은 플랫폼이 '보관(hold)' 중인 상태이므로, 단순히 상태만 'deducted'로 변경하여 환불을 불가하게 만듭니다.

      await updateDoc(ref, {
        status: 'deducted' as DepositStatus,
        deductedAt: Timestamp.now(),
        compensationAmount: deposit.depositAmount,
        updatedAt: Timestamp.now(),
      });

      // TODO: (추가 정책에 따라) 차감된 보증금을 요청자(Requester)에게 포인트로 보상금 지급(earnPoints)하는 로직을 여기에 추가할 수 있습니다.
      // 예: await PointService.earnPoints(deposit.gllerId, deposit.depositAmount, PointCategory.DISPUTE_COMPENSATION, ...);

      return { success: true };
    } catch (error: any) {
      console.error('Deposit compensation deduction failed:', error);
      return { success: false, error: error.message };
    }
  }
}
