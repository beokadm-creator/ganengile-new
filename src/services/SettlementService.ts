/**
 * Settlement Service (P4)
 * 정산 시스템 서비스
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
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../core/firebase';
import {
  Settlement,
  SettlementStatus,
  CreateSettlementData,
  SettlementFilterOptions,
  SettlementStatistics,
  Payment,
  PaymentStatus,
  GillerBankAccount,
  PAYMENT_COLLECTIONS,
} from '../types/payment';
import { User } from '../types/user';
import { CommissionService } from './CommissionService';

export class SettlementService {
  static async createSettlement(
    data: CreateSettlementData
  ): Promise<Settlement> {
    const settlementId = doc(collection(db, PAYMENT_COLLECTIONS.SETTLEMENTS)).id;
    const now = Timestamp.now();

    const { earnings, tax, netAmount } = CommissionService.calculateNetSettlement(
      data.totalPayment,
      data.platformFee
    );

    const settlement: Settlement = {
      settlementId,
      paymentId: data.paymentId,
      deliveryId: data.deliveryId,
      matchId: data.matchId,
      gillerId: data.gillerId,
      gillerName: data.gillerName,
      amount: {
        totalPayment: data.totalPayment,
        platformFee: data.platformFee,
        gillerEarnings: earnings,
        tax,
        netAmount,
      },
      bankAccount: {
        bankCode: data.bankAccount.bankCode,
        bankName: data.bankAccount.bankName,
        accountNumber: data.bankAccount.accountNumber,
        accountHolder: data.bankAccount.accountHolder,
      },
      status: SettlementStatus.PENDING,
      scheduledFor: data.scheduledFor,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const settlementRef = doc(db, PAYMENT_COLLECTIONS.SETTLEMENTS, settlementId);
    await setDoc(settlementRef, settlement);

    return settlement;
  }

  static async processSettlementAfterDelivery(
    paymentId: string,
    deliveryId: string,
    matchId: string
  ): Promise<Settlement> {
    const paymentRef = doc(db, PAYMENT_COLLECTIONS.PAYMENTS, paymentId);
    const paymentDoc = await getDoc(paymentRef);

    if (!paymentDoc.exists()) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const payment = paymentDoc.data() as Payment;

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error(`Payment not completed: ${paymentId}`);
    }

    const gillerRef = doc(db, 'users', payment.gllerId);
    const gillerDoc = await getDoc(gillerRef);

    if (!gillerDoc.exists()) {
      throw new Error(`Giller not found: ${payment.gllerId}`);
    }

    const giller = gillerDoc.data() as User;

    if (!giller.gillerInfo) {
      throw new Error(`User is not a giller: ${payment.gllerId}`);
    }

    const bankAccounts = await this.getGillerBankAccounts(payment.gllerId);
    const defaultAccount = bankAccounts.find((acc) => acc.isDefault);

    if (!defaultAccount) {
      throw new Error(`No default bank account found for giller: ${payment.gllerId}`);
    }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 1);

    const settlement = await this.createSettlement({
      paymentId,
      deliveryId,
      matchId,
      gillerId: payment.gllerId,
      gillerName: giller.name,
      totalPayment: payment.amount,
      platformFee: payment.commission.totalCommission,
      bankAccount: defaultAccount,
      scheduledFor,
    });

    console.log(`✅ Settlement created: ${settlement.settlementId} for giller: ${payment.gllerId}`);

    return settlement;
  }

  static async getSettlement(settlementId: string): Promise<Settlement | null> {
    const settlementRef = doc(db, PAYMENT_COLLECTIONS.SETTLEMENTS, settlementId);
    const settlementDoc = await getDoc(settlementRef);

    if (!settlementDoc.exists()) {
      return null;
    }

    return settlementDoc.data() as Settlement;
  }

  static async getSettlementsByGiller(
    gillerId: string,
    filterOptions?: SettlementFilterOptions
  ): Promise<Settlement[]> {
    const settlementsRef = collection(db, PAYMENT_COLLECTIONS.SETTLEMENTS);

    let q = query(
      settlementsRef,
      where('gillerId', '==', gillerId),
      orderBy('createdAt', 'desc')
    );

    if (filterOptions?.status && filterOptions.status.length > 0) {
      q = query(q, where('status', 'in', filterOptions.status));
    }

    if (filterOptions?.pagination?.limit) {
      q = query(q, limit(filterOptions.pagination.limit));
    }

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data() as Settlement);
  }

  static async updateSettlementStatus(
    settlementId: string,
    status: SettlementStatus,
    metadata?: { notes?: string; processedBy?: string }
  ): Promise<void> {
    const settlementRef = doc(db, PAYMENT_COLLECTIONS.SETTLEMENTS, settlementId);

    const updateData: Partial<Settlement> = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (status === SettlementStatus.COMPLETED) {
      updateData.completedAt = Timestamp.now();
    }

    if (metadata) {
      updateData.metadata = {
        ...metadata,
      };
    }

    await updateDoc(settlementRef, updateData);

    console.log(`📝 Settlement ${settlementId} status updated to: ${status}`);
  }

  static async processPendingSettlements(): Promise<number> {
    const settlementsRef = collection(db, PAYMENT_COLLECTIONS.SETTLEMENTS);

    const q = query(
      settlementsRef,
      where('status', '==', SettlementStatus.PENDING)
    );

    const querySnapshot = await getDocs(q);

    let processedCount = 0;

    for (const docSnapshot of querySnapshot.docs) {
      const settlement = docSnapshot.data() as Settlement;

      try {
        await this.updateSettlementStatus(
          settlement.settlementId,
          SettlementStatus.PROCESSING,
          { processedBy: 'system' }
        );

        await this.updateSettlementStatus(
          settlement.settlementId,
          SettlementStatus.COMPLETED,
          { processedBy: 'system' }
        );

        processedCount++;
      } catch (error) {
        console.error(`Failed to process settlement ${settlement.settlementId}:`, error);

        await updateDoc(doc(db, PAYMENT_COLLECTIONS.SETTLEMENTS, settlement.settlementId), {
          status: SettlementStatus.FAILED,
          failureReason: String(error),
          retryCount: settlement.retryCount + 1,
          updatedAt: Timestamp.now(),
        });
      }
    }

    console.log(`✅ Processed ${processedCount} settlements`);
    return processedCount;
  }

  static async getSettlementStatistics(gillerId: string): Promise<SettlementStatistics> {
    const settlements = await this.getSettlementsByGiller(gillerId);

    const stats: SettlementStatistics = {
      totalSettlements: settlements.length,
      totalEarnings: 0,
      totalTax: 0,
      totalNetAmount: 0,
      pendingAmount: 0,
      completedAmount: 0,
      onHoldAmount: 0,
      averageSettlementDays: 0,
      lastSettlementDate: undefined,
    };

    let totalDays = 0;
    let completedCount = 0;

    for (const settlement of settlements) {
      stats.totalEarnings += settlement.amount.gillerEarnings;
      stats.totalTax += settlement.amount.tax;
      stats.totalNetAmount += settlement.amount.netAmount;

      switch (settlement.status) {
        case SettlementStatus.PENDING:
        case SettlementStatus.PROCESSING:
          stats.pendingAmount += settlement.amount.netAmount;
          break;
        case SettlementStatus.COMPLETED:
          stats.completedAmount += settlement.amount.netAmount;
          completedCount++;

          if (settlement.completedAt && settlement.createdAt) {
            const createdDate = settlement.createdAt.toDate();
            const completedDate = settlement.completedAt.toDate();
            totalDays += Math.floor(
              (completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
            );
          }

          if (
            !stats.lastSettlementDate ||
            (settlement.completedAt &&
              settlement.completedAt.toDate() > stats.lastSettlementDate)
          ) {
            stats.lastSettlementDate = settlement.completedAt?.toDate();
          }
          break;
        case SettlementStatus.ON_HOLD:
          stats.onHoldAmount += settlement.amount.netAmount;
          break;
      }
    }

    stats.averageSettlementDays = completedCount > 0 ? totalDays / completedCount : 0;

    return stats;
  }

  static async addGillerBankAccount(
    gillerId: string,
    accountData: Omit<GillerBankAccount, 'createdAt' | 'status' | 'isDefault'>
  ): Promise<GillerBankAccount> {
    const accounts = await this.getGillerBankAccounts(gillerId);
    const isDefault = accounts.length === 0;

    const newAccount: GillerBankAccount = {
      ...accountData,
      status: 'active',
      isDefault,
      createdAt: Timestamp.now(),
    };

    const userRef = doc(db, 'users', gillerId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error(`User not found: ${gillerId}`);
    }

    const user = userDoc.data() as User;

    const existingAccounts = (user as any).bankAccounts || [];

    if (isDefault) {
      existingAccounts.forEach((acc: GillerBankAccount) => {
        acc.isDefault = false;
      });
    }

    existingAccounts.push(newAccount);

    await updateDoc(userRef, {
      bankAccounts: existingAccounts,
      updatedAt: Timestamp.now(),
    });

    return newAccount;
  }

  static async getGillerBankAccounts(gillerId: string): Promise<GillerBankAccount[]> {
    const userRef = doc(db, 'users', gillerId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return [];
    }

    const user = userDoc.data() as User;
    return (user as any).bankAccounts || [];
  }

  static async setDefaultBankAccount(
    gillerId: string,
    accountNumber: string
  ): Promise<void> {
    const userRef = doc(db, 'users', gillerId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error(`User not found: ${gillerId}`);
    }

    const user = userDoc.data() as User;
    const accounts = (user as any).bankAccounts || [];

    let found = false;
    accounts.forEach((acc: GillerBankAccount) => {
      if (acc.accountNumber === accountNumber) {
        acc.isDefault = true;
        found = true;
      } else {
        acc.isDefault = false;
      }
    });

    if (!found) {
      throw new Error(`Bank account not found: ${accountNumber}`);
    }

    await updateDoc(userRef, {
      bankAccounts: accounts,
      updatedAt: Timestamp.now(),
    });
  }
}
