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
import type { WalletBalances } from '../types/beta1-wallet';
import { getBankIntegrationConfig } from './integration-config-service';
import { createProtectedBankAccount } from '../../shared/bank-account';
import { allocateWalletSpend, getWalletSummary } from '../utils/wallet-balance';

const TRANSACTIONS_COLLECTION = 'point_transactions';
const WALLET_ENTRIES_COLLECTION = 'wallet_entries';
const WALLET_LEDGERS_COLLECTION = 'wallet_ledgers';
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
      const ledgerRef = doc(db, WALLET_LEDGERS_COLLECTION, userId);

      const [userDoc, ledgerDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(ledgerRef),
      ]);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
      const ledgerData = ledgerDoc.exists() ? ledgerDoc.data() : null;

      const rawBalances = ledgerData?.balances ?? userData.walletBalances ?? {};
      const currentBalances = {
        chargeBalance: Number(rawBalances.chargeBalance ?? 0),
        earnedBalance: Number(rawBalances.earnedBalance ?? userData.pointBalance ?? 0),
        promoBalance: Number(rawBalances.promoBalance ?? 0),
        lockedChargeBalance: Number(rawBalances.lockedChargeBalance ?? 0),
        lockedEarnedBalance: Number(rawBalances.lockedEarnedBalance ?? 0),
        lockedPromoBalance: Number(rawBalances.lockedPromoBalance ?? 0),
        pendingWithdrawalBalance: Number(rawBalances.pendingWithdrawalBalance ?? 0),
      };

      const oldSummary = getWalletSummary(currentBalances as WalletBalances);

      // Decide funding source based on category
      let fundingSource: 'charge' | 'earned' | 'promo' = 'earned';
      if (category === PointCategory.CHARGE) {
        fundingSource = 'charge';
      }

      const newBalances = { ...currentBalances };
      if (fundingSource === 'charge') {
        newBalances.chargeBalance += amount;
      } else {
        newBalances.earnedBalance += amount;
      }

      const newSummary = getWalletSummary(newBalances as WalletBalances);

      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const transactionData = createTransactionRecord({
        transactionId: transactionRef.id,
        userId,
        amount,
        type: 'earn' as PointType,
        category,
        balanceBefore: oldSummary.totalUsableBalance,
        balanceAfter: newSummary.totalUsableBalance,
        description,
        metadata,
      });

      const now = Timestamp.now();

      // Legacy transaction
      transaction.set(transactionRef, transactionData);

      // Wallet Entry
      const entryRef = doc(collection(db, WALLET_ENTRIES_COLLECTION));
      transaction.set(entryRef, {
        walletLedgerId: userId,
        userId,
        type: 'earn',
        fundingSource,
        amount,
        balanceBefore: oldSummary,
        balanceAfter: newSummary,
        description,
        metadata: metadata ?? null,
        createdAt: now,
      });

      // Update User (Legacy)
      transaction.update(userRef, {
        pointBalance: newSummary.totalUsableBalance,
        walletBalances: newBalances,
        totalEarnedPoints: asNumber(userData.totalEarnedPoints) + amount,
        updatedAt: now,
      });

      // Update Ledger
      transaction.set(ledgerRef, {
        userId,
        balances: newBalances,
        summary: newSummary,
        updatedAt: now,
      }, { merge: true });

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
      const ledgerRef = doc(db, WALLET_LEDGERS_COLLECTION, userId);

      const [userDoc, ledgerDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(ledgerRef),
      ]);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
      const ledgerData = ledgerDoc.exists() ? ledgerDoc.data() : null;

      const rawBalances = ledgerData?.balances ?? userData.walletBalances ?? {};
      const currentBalances = {
        chargeBalance: Number(rawBalances.chargeBalance ?? 0),
        earnedBalance: Number(rawBalances.earnedBalance ?? userData.pointBalance ?? 0),
        promoBalance: Number(rawBalances.promoBalance ?? 0),
        lockedChargeBalance: Number(rawBalances.lockedChargeBalance ?? 0),
        lockedEarnedBalance: Number(rawBalances.lockedEarnedBalance ?? 0),
        lockedPromoBalance: Number(rawBalances.lockedPromoBalance ?? 0),
        pendingWithdrawalBalance: Number(rawBalances.pendingWithdrawalBalance ?? 0),
      };

      const oldSummary = getWalletSummary(currentBalances as WalletBalances);

      if (oldSummary.totalUsableBalance < amount) {
        throw new Error(`Insufficient points. Usable: ${oldSummary.totalUsableBalance}, Required: ${amount}`);
      }

      // Advanced: Allocate spend across charge -> earned -> promo
      const breakdown = allocateWalletSpend(currentBalances as WalletBalances, amount);

      const newBalances = {
        ...currentBalances,
        chargeBalance: breakdown.remainingChargeBalance,
        earnedBalance: breakdown.remainingEarnedBalance,
        promoBalance: breakdown.remainingPromoBalance,
      };

      const newSummary = getWalletSummary(newBalances as WalletBalances);

      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const transactionData = createTransactionRecord({
        transactionId: transactionRef.id,
        userId,
        amount: -amount,
        type: (category === PointCategory.WITHDRAW ? 'withdraw' : 'spend') as PointType,
        category,
        balanceBefore: oldSummary.totalUsableBalance,
        balanceAfter: newSummary.totalUsableBalance,
        description,
        metadata,
      });

      const now = Timestamp.now();

      // Legacy transaction
      transaction.set(transactionRef, transactionData);

      // Wallet Entries for each funding source deducted
      if (breakdown.fromChargeBalance > 0) {
        transaction.set(doc(collection(db, WALLET_ENTRIES_COLLECTION)), {
          walletLedgerId: userId,
          userId,
          type: 'spend',
          fundingSource: 'charge',
          amount: -breakdown.fromChargeBalance,
          balanceBefore: oldSummary,
          balanceAfter: newSummary, // Simplified
          description: `${description} (충전금 차감)`,
          metadata: metadata ?? null,
          createdAt: now,
        });
      }
      if (breakdown.fromEarnedBalance > 0) {
        transaction.set(doc(collection(db, WALLET_ENTRIES_COLLECTION)), {
          walletLedgerId: userId,
          userId,
          type: 'spend',
          fundingSource: 'earned',
          amount: -breakdown.fromEarnedBalance,
          balanceBefore: oldSummary,
          balanceAfter: newSummary,
          description: `${description} (정산금 차감)`,
          metadata: metadata ?? null,
          createdAt: now,
        });
      }
      if (breakdown.fromPromoBalance > 0) {
        transaction.set(doc(collection(db, WALLET_ENTRIES_COLLECTION)), {
          walletLedgerId: userId,
          userId,
          type: 'spend',
          fundingSource: 'promo',
          amount: -breakdown.fromPromoBalance,
          balanceBefore: oldSummary,
          balanceAfter: newSummary,
          description: `${description} (프로모션 차감)`,
          metadata: metadata ?? null,
          createdAt: now,
        });
      }

      // Update User (Legacy)
      transaction.update(userRef, {
        pointBalance: newSummary.totalUsableBalance,
        walletBalances: newBalances,
        totalSpentPoints: asNumber(userData.totalSpentPoints) + amount,
        updatedAt: now,
      });

      // Update Ledger
      transaction.set(ledgerRef, {
        userId,
        balances: newBalances,
        summary: newSummary,
        updatedAt: now,
      }, { merge: true });

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
          requiresAccountHolderMatch: true, // Always required since we use taxInfo
          manualReviewFallback: bankConfig.manualReviewFallback,
        },
      },
    };

    // 트랜잭션으로 출금 문서 생성과 포인트 차감을 원자적으로 처리
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, USERS_COLLECTION, data.userId);
      const ledgerRef = doc(db, WALLET_LEDGERS_COLLECTION, data.userId);

      const [userDoc, ledgerDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(ledgerRef),
      ]);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
      const ledgerData = ledgerDoc.exists() ? ledgerDoc.data() : null;

      const rawBalances = ledgerData?.balances ?? userData.walletBalances ?? {};
      const currentBalances = {
        chargeBalance: Number(rawBalances.chargeBalance ?? 0),
        earnedBalance: Number(rawBalances.earnedBalance ?? userData.pointBalance ?? 0),
        promoBalance: Number(rawBalances.promoBalance ?? 0),
        lockedChargeBalance: Number(rawBalances.lockedChargeBalance ?? 0),
        lockedEarnedBalance: Number(rawBalances.lockedEarnedBalance ?? 0),
        lockedPromoBalance: Number(rawBalances.lockedPromoBalance ?? 0),
        pendingWithdrawalBalance: Number(rawBalances.pendingWithdrawalBalance ?? 0),
      };

      const oldSummary = getWalletSummary(currentBalances as WalletBalances);

      // Security Fix: Withdrawals MUST ONLY come from withdrawableBalance (which is purely earnedBalance minus locks)
      if (oldSummary.withdrawableBalance < data.amount) {
        throw new Error(`출금 가능 잔액이 부족합니다. (가능액: ${oldSummary.withdrawableBalance}원, 요청액: ${data.amount}원)`);
      }

      // Deduct from earnedBalance and add to pendingWithdrawalBalance
      const newBalances = {
        ...currentBalances,
        earnedBalance: currentBalances.earnedBalance - data.amount,
        pendingWithdrawalBalance: currentBalances.pendingWithdrawalBalance + data.amount,
      };

      const newSummary = getWalletSummary(newBalances as WalletBalances);
      const now = Timestamp.now();

      // 1. 포인트 차감 내역 생성 (Legacy)
      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const transactionData = createTransactionRecord({
        transactionId: transactionRef.id,
        userId: data.userId,
        amount: -data.amount,
        type: 'withdraw' as PointType,
        category: 'withdraw' as PointCategory,
        balanceBefore: oldSummary.totalUsableBalance,
        balanceAfter: newSummary.totalUsableBalance, // totalUsableBalance decreases because it moved to pending
        description: '출금 신청',
        metadata: { relatedRequestId: withdrawRef.id },
      });

      transaction.set(transactionRef, transactionData);

      // Wallet Entry
      transaction.set(doc(collection(db, WALLET_ENTRIES_COLLECTION)), {
        walletLedgerId: data.userId,
        userId: data.userId,
        type: 'withdraw_request',
        fundingSource: 'earned',
        amount: -data.amount,
        balanceBefore: oldSummary,
        balanceAfter: newSummary,
        description: '출금 신청 (정산금 차감 -> 출금 대기 전환)',
        metadata: { relatedRequestId: withdrawRef.id },
        createdAt: now,
      });
      
      // 2. 유저 잔액 업데이트 (Legacy)
      transaction.update(userRef, {
        pointBalance: newSummary.totalUsableBalance,
        walletBalances: newBalances,
        totalSpentPoints: asNumber(userData.totalSpentPoints) + data.amount,
        updatedAt: now,
      });

      // Update Ledger
      transaction.set(ledgerRef, {
        userId: data.userId,
        balances: newBalances,
        summary: newSummary,
        updatedAt: now,
      }, { merge: true });

      // 3. 출금 요청 문서 생성
      transaction.set(withdrawRef, withdrawData);
    });

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
