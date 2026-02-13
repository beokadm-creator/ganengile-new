/**
 * Payment Service (P4)
 * 결제 처리 서비스
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../core/firebase';
import {
  Payment,
  PaymentStatus,
  CreatePaymentData,
  PAYMENT_COLLECTIONS,
  CommissionCalculationOptions,
} from '../types/payment';
import { CommissionService } from './CommissionService';

export class PaymentService {
  static async createPayment(
    data: CreatePaymentData
  ): Promise<Payment> {
    const paymentId = doc(collection(db, PAYMENT_COLLECTIONS.PAYMENTS)).id;
    const now = Timestamp.now();

    const commissionResult = CommissionService.calculateCommission({
      amount: data.amount,
      gillerGrade: data.gillerGrade || 'regular',
      urgencyLevel: data.urgencyLevel || 'normal',
    } as CommissionCalculationOptions);

    const payment: Payment = {
      paymentId,
      deliveryId: data.deliveryId,
      requestId: data.requestId,
      matchId: data.matchId,
      gllerId: data.gllerId,
      amount: data.amount,
      commission: {
        baseCommission: commissionResult.baseCommission,
        gradeBonus: commissionResult.gradeBonus,
        urgencySurcharge: commissionResult.urgencySurcharge,
        totalCommission: commissionResult.totalCommission,
      },
      paymentMethod: data.paymentMethod,
      status: PaymentStatus.PENDING,
      attemptCount: 0,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    };

    const paymentRef = doc(db, PAYMENT_COLLECTIONS.PAYMENTS, paymentId);
    await setDoc(paymentRef, payment);

    console.log(`💳 Payment created: ${paymentId} for amount: ${data.amount} KRW`);

    return payment;
  }

  static async processPayment(
    paymentId: string,
    pgResponse: Record<string, any>
  ): Promise<Payment> {
    const paymentRef = doc(db, PAYMENT_COLLECTIONS.PAYMENTS, paymentId);

    await updateDoc(paymentRef, {
      status: PaymentStatus.COMPLETED,
      completedAt: Timestamp.now(),
      'metadata.pgResponse': pgResponse,
      updatedAt: Timestamp.now(),
    });

    const paymentDoc = await getDoc(paymentRef);
    const payment = paymentDoc.data() as Payment;

    console.log(`✅ Payment completed: ${paymentId}`);

    return payment;
  }

  static async failPayment(
    paymentId: string,
    failureReason: string
  ): Promise<Payment> {
    const paymentRef = doc(db, PAYMENT_COLLECTIONS.PAYMENTS, paymentId);

    const paymentDoc = await getDoc(paymentRef);
    const payment = paymentDoc.data() as Payment;

    await updateDoc(paymentRef, {
      status: PaymentStatus.FAILED,
      failureReason,
      attemptCount: payment.attemptCount + 1,
      updatedAt: Timestamp.now(),
    });

    console.log(`❌ Payment failed: ${paymentId} - ${failureReason}`);

    return (await getDoc(paymentRef)).data() as Payment;
  }

  static async cancelPayment(
    paymentId: string,
    reason: string
  ): Promise<void> {
    const paymentRef = doc(db, PAYMENT_COLLECTIONS.PAYMENTS, paymentId);

    await updateDoc(paymentRef, {
      status: PaymentStatus.CANCELLED,
      cancelledAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    console.log(`🚫 Payment cancelled: ${paymentId} - ${reason}`);
  }

  static async getPayment(paymentId: string): Promise<Payment | null> {
    const paymentRef = doc(db, PAYMENT_COLLECTIONS.PAYMENTS, paymentId);
    const paymentDoc = await getDoc(paymentRef);

    if (!paymentDoc.exists()) {
      return null;
    }

    return paymentDoc.data() as Payment;
  }

  static async getPaymentsByGller(gllerId: string): Promise<Payment[]> {
    const paymentsRef = collection(db, PAYMENT_COLLECTIONS.PAYMENTS);
    const q = query(
      paymentsRef,
      where('gllerId', '==', gllerId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data() as Payment);
  }

  static async getPaymentsByDelivery(
    deliveryId: string
  ): Promise<Payment[]> {
    const paymentsRef = collection(db, PAYMENT_COLLECTIONS.PAYMENTS);
    const q = query(
      paymentsRef,
      where('deliveryId', '==', deliveryId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data() as Payment);
  }

  static async processRefund(
    paymentId: string,
    reason: string
  ): Promise<void> {
    const paymentRef = doc(db, PAYMENT_COLLECTIONS.PAYMENTS, paymentId);

    await updateDoc(paymentRef, {
      status: PaymentStatus.REFUNDING,
      refund: {
        amount: 0,
        reason,
        status: 'pending',
      },
      updatedAt: Timestamp.now(),
    });

    console.log(`💸 Refund initiated for payment: ${paymentId}`);
  }

  static async completeRefund(
    paymentId: string,
    refundAmount: number
  ): Promise<void> {
    const paymentRef = doc(db, PAYMENT_COLLECTIONS.PAYMENTS, paymentId);

    const paymentDoc = await getDoc(paymentRef);
    const payment = paymentDoc.data() as Payment;

    const currentRefund = payment.refund || {
      amount: refundAmount,
      reason: '',
      status: 'completed' as const,
    };

    await updateDoc(paymentRef, {
      status: PaymentStatus.REFUNDED,
      refund: {
        ...currentRefund,
        amount: refundAmount,
        refundedAt: Timestamp.now(),
        status: 'completed',
      },
      updatedAt: Timestamp.now(),
    });

    console.log(`💸 Refund completed for payment: ${paymentId}, amount: ${refundAmount} KRW`);
  }
}
