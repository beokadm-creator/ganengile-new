import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { PointService } from './PointService';
import { TossPaymentService } from './TossPaymentService';
import { DepositCompensationService } from './deposit-compensation-service';
import { DEPOSIT_RATE, DepositPaymentMethod, PointCategory, type Deposit, type DepositStatus } from '../types/point';

const DEPOSITS_COLLECTION = 'deposits';

export class DepositService {
  static async payDeposit(
    gillerId: string,
    requesterId: string,
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
        paymentMethod = DepositPaymentMethod.POINT_ONLY;
        pointAmount = depositAmount;
      } else {
        paymentMethod = DepositPaymentMethod.MIXED;
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
            error: tossResult.error ?? '결제 공급자 결제에 실패했습니다.',
          };
        }

        paymentId = tossResult.paymentId;
      }

      const depositPayload: Deposit = {
        depositId: '',
        userId: gillerId,
        gllerId: requesterId,
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

      const depositRef = await addDoc(collection(db, DEPOSITS_COLLECTION), depositPayload);
      await updateDoc(depositRef, { depositId: depositRef.id });

      if (pointAmount > 0) {
        await PointService.spendPoints(
          gillerId,
          pointAmount,
          PointCategory.DEPOSIT_PAYMENT,
          `보증금 결제 (${depositAmount.toLocaleString()}원)`
        );
      }

      return {
        success: true,
        deposit: {
          ...depositPayload,
          depositId: depositRef.id,
        },
      };
    } catch (error: unknown) {
      console.error('Deposit payment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '보증금 결제 중 오류가 발생했습니다.',
      };
    }
  }

  static async refundDeposit(
    depositId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    return DepositCompensationService.refundDeposit(depositId);
  }

  static async deductCompensation(
    depositId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    return DepositCompensationService.deductCompensation(depositId);
  }

  static async getDeposits(userId: string): Promise<Deposit[]> {
    const depositQuery = query(
      collection(db, DEPOSITS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(depositQuery);
    return snapshot.docs.map((docItem) => docItem.data() as Deposit);
  }

  static async getDepositByRequestId(requestId: string): Promise<Deposit | null> {
    try {
      const depositQuery = query(
        collection(db, DEPOSITS_COLLECTION),
        where('requestId', '==', requestId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(depositQuery);
      if (snapshot.empty) {
        return null;
      }

      const docSnap = snapshot.docs[0];
      return {
        ...(docSnap.data() as Deposit),
        depositId: docSnap.id,
      };
    } catch (error) {
      console.error('Error fetching deposit by request ID:', error);
      return null;
    }
  }
}
