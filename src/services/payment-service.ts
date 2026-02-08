/**
 * Payment Service
 * 결제 및 수익 정산 시스템
 */

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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Payment status
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/**
 * Payment type
 */
export enum PaymentType {
  REQUEST_FEE = 'request_fee', // Gller pays request fee
  GILLER_EARNING = 'giller_earning', // Giller receives payment
  WITHDRAWAL = 'withdrawal', // Giller withdraws earnings
}

/**
 * Payment interface
 */
export interface Payment {
  paymentId: string;
  userId: string;
  type: PaymentType;
  amount: number;
  fee?: number; // Platform fee
  netAmount?: number; // Amount after fee
  status: PaymentStatus;
  requestId?: string;
  deliveryId?: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Create payment for request fee
 * @param userId User ID (gller)
 * @param requestId Request ID
 * @param amount Fee amount
 * @returns Payment ID
 */
export async function createRequestPayment(
  userId: string,
  requestId: string,
  amount: number
): Promise<string> {
  try {
    const paymentData = {
      userId,
      type: PaymentType.REQUEST_FEE,
      amount,
      fee: Math.round(amount * 0.1), // 10% platform fee
      netAmount: Math.round(amount * 0.9), // 90% to giller
      status: PaymentStatus.PENDING,
      requestId,
      description: '배송 요청 수수료',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'payments'), paymentData);

    console.log('✅ Request payment created:', docRef.id);

    return docRef.id;
  } catch (error) {
    console.error('Error creating request payment:', error);
    throw error;
  }
}

/**
 * Create earning for giller
 * @param userId User ID (giller)
 * @param requestId Request ID
 * @param amount Earning amount
 * @returns Payment ID
 */
export async function createGillerEarning(
  userId: string,
  requestId: string,
  amount: number
): Promise<string> {
  try {
    // Platform fee: 10%
    const fee = Math.round(amount * 0.1);
    const netAmount = amount - fee;

    const paymentData = {
      userId,
      type: PaymentType.GILLER_EARNING,
      amount,
      fee,
      netAmount,
      status: PaymentStatus.COMPLETED,
      requestId,
      description: '배송 완료 수익',
      metadata: {
        platformFeeRate: 0.1,
      },
      createdAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'payments'), paymentData);

    console.log('✅ Giller earning created:', docRef.id);

    // Update user's total earnings
    await updateUserEarnings(userId, netAmount);

    return docRef.id;
  } catch (error) {
    console.error('Error creating giller earning:', error);
    throw error;
  }
}

/**
 * Update user's total earnings (denormalized)
 * @param userId User ID
 * @param amount Amount to add
 */
async function updateUserEarnings(userId: string, amount: number): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);

    // Increment total earnings
    // Note: This requires a transaction or a Firestore increment
    await updateDoc(userRef, {
      totalEarnings: amount, // This should be FieldValue.increment(amount)
      earningsUpdatedAt: serverTimestamp(),
    });

    console.log(`✅ Updated earnings for user ${userId}: +${amount}원`);
  } catch (error) {
    console.error('Error updating user earnings:', error);
  }
}

/**
 * Get user's payment history
 * @param userId User ID
 * @param limit Max number of items
 * @returns Array of payments
 */
export async function getUserPayments(
  userId: string,
  limit: number = 50
): Promise<Payment[]> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const payments: Payment[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      payments.push({
        paymentId: docSnapshot.id,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        fee: data.fee,
        netAmount: data.netAmount,
        status: data.status,
        requestId: data.requestId,
        deliveryId: data.deliveryId,
        description: data.description,
        metadata: data.metadata,
        createdAt: data.createdAt?.toDate() || new Date(),
        completedAt: data.completedAt?.toDate(),
      });
    });

    return payments.slice(0, limit);
  } catch (error) {
    console.error('Error getting user payments:', error);
    return [];
  }
}

/**
 * Get user's total earnings
 * @param userId User ID
 * @returns Total earnings
 */
export async function getUserTotalEarnings(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);

    let total = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      total += data.netAmount || 0;
    });

    return total;
  } catch (error) {
    console.error('Error getting user total earnings:', error);
    return 0;
  }
}

/**
 * Get user's earnings by month
 * @param userId User ID
 * @param year Year
 * @param month Month (1-12)
 * @returns Earnings for the month
 */
export async function getUserMonthlyEarnings(
  userId: string,
  year: number,
  month: number
): Promise<{
  total: number;
  count: number;
  average: number;
}> {
  try {
    // Query all earnings for the user
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.GILLER_EARNING),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);

    let total = 0;
    let count = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const createdAt = data.createdAt?.toDate();

      if (createdAt) {
        const createdAtYear = createdAt.getFullYear();
        const createdAtMonth = createdAt.getMonth() + 1;

        if (createdAtYear === year && createdAtMonth === month) {
          total += data.netAmount || 0;
          count++;
        }
      }
    });

    const average = count > 0 ? total / count : 0;

    return {
      total,
      count,
      average: Math.round(average),
    };
  } catch (error) {
    console.error('Error getting user monthly earnings:', error);
    return {
      total: 0,
      count: 0,
      average: 0,
    };
  }
}

/**
 * Request withdrawal
 * @param userId User ID
 * @param amount Amount to withdraw
 * @param bankInfo Bank information
 * @returns Payment ID
 */
export async function requestWithdrawal(
  userId: string,
  amount: number,
  bankInfo: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }
): Promise<string> {
  try {
    // Check if user has enough balance
    const totalEarnings = await getUserTotalEarnings(userId);

    // Get previous withdrawals
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      where('type', '==', PaymentType.WITHDRAWAL),
      where('status', '==', PaymentStatus.COMPLETED)
    );

    const snapshot = await getDocs(q);
    let withdrawnAmount = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      withdrawnAmount += data.amount;
    });

    const availableBalance = totalEarnings - withdrawnAmount;

    if (amount > availableBalance) {
      throw new Error(`출금 가능 금액: ${availableBalance.toLocaleString()}원`);
    }

    // Create withdrawal request
    const paymentData = {
      userId,
      type: PaymentType.WITHDRAWAL,
      amount,
      status: PaymentStatus.PENDING,
      description: '출금 요청',
      metadata: {
        bankName: bankInfo.bankName,
        accountNumber: bankInfo.accountNumber,
        accountHolder: bankInfo.accountHolder,
      },
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'payments'), paymentData);

    console.log('✅ Withdrawal requested:', docRef.id);

    return docRef.id;
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    throw error;
  }
}

/**
 * Get payment by ID
 * @param paymentId Payment ID
 * @returns Payment or null
 */
export async function getPayment(paymentId: string): Promise<Payment | null> {
  try {
    const docRef = doc(db, 'payments', paymentId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      return null;
    }

    const data = docSnapshot.data();
    return {
      paymentId: docSnapshot.id,
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      fee: data.fee,
      netAmount: data.netAmount,
      status: data.status,
      requestId: data.requestId,
      deliveryId: data.deliveryId,
      description: data.description,
      metadata: data.metadata,
      createdAt: data.createdAt?.toDate() || new Date(),
      completedAt: data.completedAt?.toDate(),
    };
  } catch (error) {
    console.error('Error getting payment:', error);
    return null;
  }
}
