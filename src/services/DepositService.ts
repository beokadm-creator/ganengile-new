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
    itemValue: number,
    paymentKey?: string
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

        if (!paymentKey) {
          return { success: false, error: '외부 결제 금액이 필요하나 paymentKey가 제공되지 않았습니다.' };
        }

        const tossResult = await TossPaymentService.chargePayment(
          paymentKey,
          `deposit_${requestId}`,
          tossAmount
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

      let depositRef;
      try {
        depositRef = await addDoc(collection(db, DEPOSITS_COLLECTION), depositPayload);
        await updateDoc(depositRef, { depositId: depositRef.id });
      } catch (dbError) {
        // DB 저장 실패 시, 이미 승인된 Toss 결제가 있다면 취소(롤백) 시도
        if (paymentId && tossAmount > 0) {
          console.error('DB save failed after Toss charge. Attempting to refund...', dbError);
          await TossPaymentService.refundPayment(paymentId, tossAmount, '시스템 오류 자동 취소');
        }
        throw dbError;
      }

      if (pointAmount > 0) {
        try {
          await PointService.spendPoints(
            gillerId,
            pointAmount,
            PointCategory.DEPOSIT_PAYMENT,
            `보증금 결제 (${depositAmount.toLocaleString()}원)`
          );
        } catch (pointError) {
          // 포인트 차감 실패 시, DB 문서는 실패 상태로 롤백하고 Toss 결제도 취소
          console.error('Point spend failed after DB save. Rolling back...', pointError);
          await updateDoc(depositRef, { status: 'failed' as DepositStatus });
          if (paymentId && tossAmount > 0) {
            await TossPaymentService.refundPayment(paymentId, tossAmount, '시스템 오류 자동 취소 (포인트 차감 실패)');
          }
          throw pointError;
        }
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
