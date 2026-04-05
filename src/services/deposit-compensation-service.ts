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
        TossPaymentService.refundPayment(
          deposit.paymentId,
          deposit.tossAmount,
          '배송 완료에 따른 보증금 환급'
        );
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

      await PointService.spendPoints(
        deposit.userId,
        deposit.depositAmount,
        PointCategory.DEPOSIT_COMPENSATION,
        `사고/분실에 따른 보증금 배상 차감 (${deposit.depositAmount.toLocaleString()}원)`
      );

      await updateDoc(ref, {
        status: 'deducted' as DepositStatus,
        deductedAt: Timestamp.now(),
        compensationAmount: deposit.depositAmount,
        updatedAt: Timestamp.now(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('Deposit compensation deduction failed:', error);
      return { success: false, error: error.message };
    }
  }
}
