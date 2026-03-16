import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../core/firebase';
import { PointService } from './PointService';
import { TossPaymentService } from './TossPaymentService';
import type { Deposit, DepositStatus, DepositPaymentMethod } from '../types/point';
import { DEPOSIT_RATE } from '../types/point';

const DEPOSITS_COLLECTION = 'deposits';

export class DepositService {
  static async payDeposit(
    gillerId: string,
    gllerId: string,
    requestId: string,
    itemValue: number
  ): Promise<{
    success: boolean;
    deposit?: Deposit;
    error?: string;
  }> {
    try {
      const depositAmount = Math.round(itemValue * DEPOSIT_RATE);

      const pointBalance = await PointService.getBalance(gillerId);

      let paymentMethod: DepositPaymentMethod;
      let pointAmount = 0;
      let tossAmount = 0;
      let paymentId: string | undefined;

      if (pointBalance >= depositAmount) {
        paymentMethod = 'point_only' as DepositPaymentMethod;
        pointAmount = depositAmount;
        tossAmount = 0;
      } else {
        paymentMethod = 'mixed' as DepositPaymentMethod;
        pointAmount = pointBalance;
        tossAmount = depositAmount - pointBalance;

        const tossResult = await TossPaymentService.chargePayment(
          tossAmount,
          `deposit_${requestId}`,
          `보증금 결제 (${depositAmount.toLocaleString()}원)`
        );

        if (!tossResult.success) {
          return {
            success: false,
            error: tossResult.error || '토스페이먼츠 결제 실패',
          };
        }

        paymentId = tossResult.paymentId;
      }

      const depositRef = collection(db, DEPOSITS_COLLECTION);
      const depositData: Deposit = {
        depositId: '',
        userId: gillerId,
        gllerId,
        requestId,
        itemValue,
        depositAmount,
        paymentMethod,
        pointAmount: pointAmount > 0 ? pointAmount : undefined,
        tossAmount: tossAmount > 0 ? tossAmount : undefined,
        totalAmount: depositAmount,
        paymentId,
        status: 'paid' as DepositStatus,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const newDepositRef = await addDoc(depositRef, depositData);

      const depositId = newDepositRef.id;

      await updateDoc(newDepositRef, { depositId });

      if (pointAmount > 0) {
        await PointService.spendPoints(
          gillerId,
          pointAmount,
          'deposit_payment' as any,
          `보증금 결제 (${depositAmount.toLocaleString()}원)`
        );
      }

      console.log(`💳 Deposit paid: ${depositAmount} for user ${gillerId}`);
      return { success: true, deposit: depositData };
    } catch (error: any) {
      console.error('Deposit payment failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async refundDeposit(
    depositId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const depositRef = doc(db, DEPOSITS_COLLECTION, depositId);
      const depositDoc = await getDoc(depositRef);

      if (!depositDoc.exists()) {
        return { success: false, error: 'Deposit not found' };
      }

      const deposit = depositDoc.data() as Deposit;

      if (deposit.status !== 'paid') {
        return { success: false, error: 'Deposit is not paid' };
      }

      if (deposit.pointAmount && deposit.pointAmount > 0) {
        await PointService.earnPoints(
          deposit.userId,
          deposit.pointAmount,
          'deposit_refund' as any,
          `보증금 환급 (${deposit.pointAmount.toLocaleString()}원)`
        );
      }

      if (deposit.tossAmount && deposit.tossAmount > 0 && deposit.paymentId) {
        await TossPaymentService.refundPayment(
          deposit.paymentId,
          deposit.tossAmount,
          '배송 완료로 인한 보증금 환급'
        );
      }

      await updateDoc(depositRef, {
        status: 'refunded' as DepositStatus,
        refundedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      console.log(`💸 Deposit refunded: ${deposit.depositAmount} for user ${deposit.userId}`);
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
      const depositRef = doc(db, DEPOSITS_COLLECTION, depositId);
      const depositDoc = await getDoc(depositRef);

      if (!depositDoc.exists()) {
        return { success: false, error: 'Deposit not found' };
      }

      const deposit = depositDoc.data() as Deposit;

      if (deposit.status !== 'paid') {
        return { success: false, error: 'Deposit is not paid' };
      }

      await PointService.spendPoints(
        deposit.userId,
        deposit.depositAmount,
        'deposit_compensation' as any,
        `사고/분실로 인한 보증금 배상 차감 (${deposit.depositAmount.toLocaleString()}원)`
      );

      await updateDoc(depositRef, {
        status: 'deducted' as DepositStatus,
        deductedAt: Timestamp.now(),
        compensationAmount: deposit.depositAmount,
        updatedAt: Timestamp.now(),
      });

      console.log(`⚠️ Deposit deducted: ${deposit.depositAmount} for user ${deposit.userId}`);
      return { success: true };
    } catch (error: any) {
      console.error('Deposit compensation deduction failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async getDeposits(
    userId: string
  ): Promise<Deposit[]> {
    const q = query(
      collection(db, DEPOSITS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Deposit);
  }

  static async getDepositByRequestId(
    requestId: string
  ): Promise<Deposit | null> {
    try {
      const q = query(
        collection(db, DEPOSITS_COLLECTION),
        where('requestId', '==', requestId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const docSnap = snapshot.docs[0];
      return {
        depositId: docSnap.id,
        ...(docSnap.data() as Deposit),
      };
    } catch (error) {
      console.error('Error fetching deposit by request ID:', error);
      return null;
    }
  }
}
