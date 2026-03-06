import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit as limitQuery,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../core/firebase';
import type {
  PointTransaction,
  PointType,
  PointCategory,
  PointTransactionStatus,
  PointTransactionFilter,
  WithdrawRequestData,
  WithdrawRequest,
} from '../types/point';
import { DEPOSIT_RATE, WITHDRAW_MIN_AMOUNT } from '../types/point';

const TRANSACTIONS_COLLECTION = 'PointTransactions';
const WITHDRAW_COLLECTION = 'WithdrawRequests';
const USERS_COLLECTION = 'Users';

interface PointBalance {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

interface PointSummary {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  recentTransactions: PointTransaction[];
}

export class PointService {
  static async earnPoints(
    userId: string,
    amount: number,
    category: PointCategory,
    description: string,
    metadata?: {
      relatedPaymentId?: string;
      relatedDeliveryId?: string;
      relatedRequestId?: string;
      relatedDepositId?: string;
      [key: string]: any;
    }
  ): Promise<PointTransaction> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const result = await runTransaction(db, async (transaction) => {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const balanceBefore = userData?.pointBalance || 0;
      const balanceAfter = balanceBefore + amount;

      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const transactionData: PointTransaction = {
        transactionId: transactionRef.id,
        userId,
        amount,
        type: 'earn' as PointType,
        category,
        balanceBefore,
        balanceAfter,
        status: 'completed' as PointTransactionStatus,
        description,
        ...metadata,
        createdAt: Timestamp.now(),
        completedAt: Timestamp.now(),
      };

      transaction.set(transactionRef, transactionData);

      transaction.update(userRef, {
        pointBalance: balanceAfter,
        totalEarnedPoints: (userData?.totalEarnedPoints || 0) + amount,
        updatedAt: Timestamp.now(),
      });

      return transactionData;
    });

    console.log(`💰 Points earned: ${amount} for user ${userId} (${description})`);
    return result as PointTransaction;
  }

  static async spendPoints(
    userId: string,
    amount: number,
    category: PointCategory,
    description: string,
    metadata?: {
      relatedPaymentId?: string;
      relatedDeliveryId?: string;
      relatedRequestId?: string;
      relatedDepositId?: string;
      [key: string]: any;
    }
  ): Promise<PointTransaction> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const result = await runTransaction(db, async (transaction) => {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const balanceBefore = userData?.pointBalance || 0;

      if (balanceBefore < amount) {
        throw new Error(`Insufficient points. Balance: ${balanceBefore}, Required: ${amount}`);
      }

      const balanceAfter = balanceBefore - amount;

      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const transactionData: PointTransaction = {
        transactionId: transactionRef.id,
        userId,
        amount: -amount,
        type: category === 'withdraw' ? 'withdraw' as PointType : 'spend' as PointType,
        category,
        balanceBefore,
        balanceAfter,
        status: 'completed' as PointTransactionStatus,
        description,
        ...metadata,
        createdAt: Timestamp.now(),
        completedAt: Timestamp.now(),
      };

      transaction.set(transactionRef, transactionData);

      transaction.update(userRef, {
        pointBalance: balanceAfter,
        totalSpentPoints: (userData?.totalSpentPoints || 1) + amount,
        updatedAt: Timestamp.now(),
      });

      return transactionData;
    });

    console.log(`💸 Points spent: ${amount} for user ${userId} (${description})`);
    return result as PointTransaction;
  }

  static async getBalance(userId: string): Promise<number> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return 0;
    }

    return userDoc.data()?.pointBalance || 0;
  }

  static async getTransactions(
    userId: string,
    filter?: PointTransactionFilter
  ): Promise<PointTransaction[]> {
    let q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('userId', '==', userId)
    );

    if (filter?.type) {
      q = query(q, where('type', '==', filter.type));
    }

    if (filter?.category) {
      q = query(q, where('category', '==', filter.category));
    }

    if (filter?.startDate) {
      q = query(q, where('createdAt', '>=', Timestamp.fromDate(filter.startDate)));
    }

    if (filter?.endDate) {
      q = query(q, where('createdAt', '<=', Timestamp.fromDate(filter.endDate)));
    }

    q = query(q, orderBy('createdAt', 'desc'));

    if (filter?.limit) {
      q = query(q, limitQuery(filter.limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as PointTransaction);
  }

  static async getSummary(userId: string): Promise<PointSummary> {
    const balance = await this.getBalance(userId);

    const recentQ = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limitQuery(20)
    );

    const recentSnapshot = await getDocs(recentQ);
    const recentTransactions = recentSnapshot.docs.map(
      (doc) => doc.data() as PointTransaction
    );

    const userRef = doc(db, USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return {
        balance,
        totalEarned: 0,
        totalSpent: 0,
        recentTransactions,
      };
    }

    const userData = userDoc.data();

    return {
      balance,
      totalEarned: userData?.totalEarnedPoints || 0,
      totalSpent: userData?.totalSpentPoints || 0,
      recentTransactions
    };
  }

  static async requestWithdrawal(
    data: WithdrawRequestData
  ): Promise<WithdrawRequest> {
    if (data.amount < WITHDRAW_MIN_AMOUNT) {
      throw new Error(`Minimum withdrawal amount is ${WITHDRAW_MIN_AMOUNT.toLocaleString()}원`);
    }

    if (data.amount > (await this.getBalance(data.userId))) {
      throw new Error('Insufficient points');
    }

    const withdrawsCollection = collection(db, WITHDRAW_COLLECTION);
    const withdrawRef = doc(withdrawsCollection);
    const withdrawData: WithdrawRequest = {
      requestId: withdrawRef.id,
      userId: data.userId,
      amount: data.amount,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountHolder: data.accountHolder,
      status: 'pending',
      createdAt: Timestamp.now()
    };

    await setDoc(withdrawRef, withdrawData);

    await this.spendPoints(
      data.userId,
      data.amount,
      'withdraw' as PointCategory,
      'Point withdrawal request',
      {
        relatedRequestId: withdrawRef.id,
      }
    );

    console.log(`💸 Withdrawal requested: ${data.amount} for user ${data.userId}`);
    return withdrawData;
  }

  static async getWithdrawRequests(
    userId: string
  ): Promise<WithdrawRequest[]> {
    const q = query(
      collection(db, WITHDRAW_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as WithdrawRequest);
  }
}
