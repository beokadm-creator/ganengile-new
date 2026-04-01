import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  where,
  limit as limitQuery,
} from 'firebase/firestore';
import { db } from '../core/firebase';
import type {
  PointTransaction,
  PointTransactionFilter,
  PointTransactionStatus,
  PointType,
  WithdrawRequest,
  WithdrawRequestData,
} from '../types/point';
import { PointCategory, WITHDRAW_MIN_AMOUNT } from '../types/point';
import { getWithdrawalEligibility, getWalletLedger } from './beta1-wallet-service';
import { getBankIntegrationConfig } from './integration-config-service';
import { createProtectedBankAccount } from '../../shared/bank-account';

const TRANSACTIONS_COLLECTION = 'point_transactions';
const WITHDRAW_COLLECTION = 'withdraw_requests';
const USERS_COLLECTION = 'users';

type PointMetadata = {
  relatedPaymentId?: string;
  relatedDeliveryId?: string;
  relatedRequestId?: string;
  relatedDepositId?: string;
  [key: string]: unknown;
};

interface PointSummary {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  chargeBalance: number;
  earnedBalance: number;
  withdrawableBalance: number;
  pendingWithdrawalBalance: number;
  lockedBalance: number;
  withdrawalEligibility?: Awaited<ReturnType<typeof getWithdrawalEligibility>>;
  recentTransactions: PointTransaction[];
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function createTransactionRecord(input: {
  transactionId: string;
  userId: string;
  amount: number;
  type: PointType;
  category: PointCategory;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  metadata?: PointMetadata;
}): PointTransaction {
  return {
    transactionId: input.transactionId,
    userId: input.userId,
    amount: input.amount,
    type: input.type,
    category: input.category,
    balanceBefore: input.balanceBefore,
    balanceAfter: input.balanceAfter,
    status: 'completed' as PointTransactionStatus,
    description: input.description,
    ...input.metadata,
    createdAt: Timestamp.now(),
    completedAt: Timestamp.now(),
  };
}

export class PointService {
  static async earnPoints(
    userId: string,
    amount: number,
    category: PointCategory,
    description: string,
    metadata?: PointMetadata
  ): Promise<PointTransaction> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    return runTransaction(db, async (transaction) => {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
      const balanceBefore = asNumber(userData.pointBalance);
      const balanceAfter = balanceBefore + amount;
      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const transactionData = createTransactionRecord({
        transactionId: transactionRef.id,
        userId,
        amount,
        type: 'earn' as PointType,
        category,
        balanceBefore,
        balanceAfter,
        description,
        metadata,
      });

      transaction.set(transactionRef, transactionData);
      transaction.update(userRef, {
        pointBalance: balanceAfter,
        totalEarnedPoints: asNumber(userData.totalEarnedPoints) + amount,
        updatedAt: Timestamp.now(),
      });

      return transactionData;
    });
  }

  static async spendPoints(
    userId: string,
    amount: number,
    category: PointCategory,
    description: string,
    metadata?: PointMetadata
  ): Promise<PointTransaction> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    return runTransaction(db, async (transaction) => {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
      const balanceBefore = asNumber(userData.pointBalance);
      if (balanceBefore < amount) {
        throw new Error(`Insufficient points. Balance: ${balanceBefore}, Required: ${amount}`);
      }

      const balanceAfter = balanceBefore - amount;
      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const transactionData = createTransactionRecord({
        transactionId: transactionRef.id,
        userId,
        amount: -amount,
        type: (category === PointCategory.WITHDRAW ? 'withdraw' : 'spend') as PointType,
        category,
        balanceBefore,
        balanceAfter,
        description,
        metadata,
      });

      transaction.set(transactionRef, transactionData);
      transaction.update(userRef, {
        pointBalance: balanceAfter,
        totalSpentPoints: asNumber(userData.totalSpentPoints) + amount,
        updatedAt: Timestamp.now(),
      });

      return transactionData;
    });
  }

  static async getBalance(userId: string): Promise<number> {
    const walletLedger = await getWalletLedger(userId);
    return walletLedger.summary.totalUsableBalance;
  }

  static async getWithdrawableBalance(userId: string): Promise<number> {
    const walletLedger = await getWalletLedger(userId);
    return walletLedger.summary.withdrawableBalance;
  }

  static async getTransactions(
    userId: string,
    filter?: PointTransactionFilter
  ): Promise<PointTransaction[]> {
    let transactionQuery = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('userId', '==', userId)
    );

    if (filter?.type) {
      transactionQuery = query(transactionQuery, where('type', '==', filter.type));
    }

    if (filter?.category) {
      transactionQuery = query(transactionQuery, where('category', '==', filter.category));
    }

    if (filter?.startDate) {
      transactionQuery = query(
        transactionQuery,
        where('createdAt', '>=', Timestamp.fromDate(filter.startDate))
      );
    }

    if (filter?.endDate) {
      transactionQuery = query(
        transactionQuery,
        where('createdAt', '<=', Timestamp.fromDate(filter.endDate))
      );
    }

    transactionQuery = query(transactionQuery, orderBy('createdAt', 'desc'));

    if (filter?.limit) {
      transactionQuery = query(transactionQuery, limitQuery(filter.limit));
    }

    const snapshot = await getDocs(transactionQuery);
    return snapshot.docs.map((docSnap) => docSnap.data() as PointTransaction);
  }

  static async getSummary(userId: string): Promise<PointSummary> {
    const recentQuery = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limitQuery(20)
    );

    const [walletLedger, recentSnapshot, userDoc, withdrawalEligibility] = await Promise.all([
      getWalletLedger(userId),
      getDocs(recentQuery),
      getDoc(doc(db, USERS_COLLECTION, userId)),
      getWithdrawalEligibility(userId),
    ]);

    const recentTransactions = recentSnapshot.docs.map(
      (docSnap) => docSnap.data() as PointTransaction
    );

    if (!userDoc.exists()) {
      return {
        balance: walletLedger.summary.totalUsableBalance,
        totalEarned: 0,
        totalSpent: 0,
        chargeBalance: walletLedger.summary.chargeBalance,
        earnedBalance: walletLedger.summary.earnedBalance,
        withdrawableBalance: walletLedger.summary.withdrawableBalance,
        pendingWithdrawalBalance: walletLedger.summary.pendingWithdrawalBalance,
        lockedBalance: walletLedger.summary.lockedBalance,
        withdrawalEligibility,
        recentTransactions,
      };
    }

    const userData = (userDoc.data() ?? {}) as Record<string, unknown>;

    return {
      balance: walletLedger.summary.totalUsableBalance,
      totalEarned: asNumber(userData.totalEarnedPoints),
      totalSpent: asNumber(userData.totalSpentPoints),
      chargeBalance: walletLedger.summary.chargeBalance,
      earnedBalance: walletLedger.summary.earnedBalance,
      withdrawableBalance: walletLedger.summary.withdrawableBalance,
      pendingWithdrawalBalance: walletLedger.summary.pendingWithdrawalBalance,
      lockedBalance: walletLedger.summary.lockedBalance,
      withdrawalEligibility,
      recentTransactions,
    };
  }

  static async requestWithdrawal(data: WithdrawRequestData): Promise<WithdrawRequest> {
    if (data.amount < WITHDRAW_MIN_AMOUNT) {
      throw new Error(`Minimum withdrawal amount is ${WITHDRAW_MIN_AMOUNT.toLocaleString()}원`);
    }

    const eligibility = await getWithdrawalEligibility(data.userId, data.amount);
    if (!eligibility.allowed) {
      throw new Error(`Withdrawal not allowed: ${eligibility.reasons.join(', ')}`);
    }

    const bankConfig = await getBankIntegrationConfig();
    const withdrawRef = doc(collection(db, WITHDRAW_COLLECTION));
    const protectedBankAccount = createProtectedBankAccount({
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountHolder: data.accountHolder,
      bankCode: data.bankCode,
    });
    const withdrawData: WithdrawRequest = {
      requestId: withdrawRef.id,
      userId: data.userId,
      amount: data.amount,
      bankName: protectedBankAccount.bankName,
      accountNumberMasked: protectedBankAccount.accountNumberMasked,
      accountLast4: protectedBankAccount.accountLast4,
      accountHolder: protectedBankAccount.accountHolder,
      bankCode: protectedBankAccount.bankCode,
      status: 'pending',
      createdAt: Timestamp.now(),
      integrationSnapshot: {
        bank: {
          testMode: bankConfig.testMode,
          liveReady: bankConfig.liveReady,
          provider: bankConfig.provider,
          verificationMode: bankConfig.verificationMode,
          requiresAccountHolderMatch: bankConfig.requiresAccountHolderMatch,
          manualReviewFallback: bankConfig.manualReviewFallback,
        },
      },
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

    return withdrawData;
  }

  static async getWithdrawRequests(userId: string): Promise<WithdrawRequest[]> {
    const withdrawQuery = query(
      collection(db, WITHDRAW_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(withdrawQuery);
    return snapshot.docs.map((docSnap) => docSnap.data() as WithdrawRequest);
  }
}
