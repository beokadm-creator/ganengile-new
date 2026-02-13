/**
 * Payment Service Tests
 * 결제 시스템 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createRequestPayment,
  createGillerEarning,
  getUserPayments,
  getUserTotalEarnings,
  getUserMonthlyEarnings,
  requestWithdrawal,
  getPayment,
} from '../src/services/payment-service';
import { doc, getDoc, deleteDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';

describe('Payment Service', () => {
  const testUserId = 'test-user-payment-001';
  const testRequestId = 'test-request-payment-001';
  const createdPaymentIds: string[] = [];

  beforeEach(async () => {
    // Clear all mock data
    global.__clearMockFirestore();

    // Cleanup: Delete test payments
    const snapshot = await getDocs(
      query(
        collection(db, 'payments'),
        where('userId', '==', testUserId)
      )
    );

    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  });

  afterEach(async () => {
    // Cleanup: Delete all test payments
    for (const paymentId of createdPaymentIds) {
      try {
        await deleteDoc(doc(db, 'payments', paymentId));
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    }
    createdPaymentIds.length = 0;
  });

  describe('createRequestPayment', () => {
    test('should create request payment', async () => {
      const amount = 5830;

      const paymentId = await createRequestPayment(
        testUserId,
        testRequestId,
        amount
      );

      expect(paymentId).toBeDefined();
      expect(typeof paymentId).toBe('string');

      createdPaymentIds.push(paymentId);

      // Verify payment was saved
      const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
      expect(paymentDoc.exists).toBe(true);

      const paymentData = paymentDoc.data();
      expect(paymentData?.userId).toBe(testUserId);
      expect(paymentData?.type).toBe('request_fee');
      expect(paymentData?.amount).toBe(amount);
      expect(paymentData?.fee).toBe(Math.round(amount * 0.1)); // 10% fee
      expect(paymentData?.netAmount).toBe(Math.round(amount * 0.9)); // 90% net
      expect(paymentData?.status).toBe('pending');
    });

    test('should calculate platform fee correctly', async () => {
      const amount = 10000;

      const paymentId = await createRequestPayment(
        testUserId,
        testRequestId,
        amount
      );

      createdPaymentIds.push(paymentId);

      const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
      const paymentData = paymentDoc.data();

      expect(paymentData?.fee).toBe(1000); // 10% of 10000
      expect(paymentData?.netAmount).toBe(9000); // 90% of 10000
    });
  });

  describe('createGillerEarning', () => {
    test('should create giller earning payment', async () => {
      const amount = 5830;

      const paymentId = await createGillerEarning(
        testUserId,
        testRequestId,
        amount
      );

      expect(paymentId).toBeDefined();

      createdPaymentIds.push(paymentId);

      // Verify payment was saved
      const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
      expect(paymentDoc.exists).toBe(true);

      const paymentData = paymentDoc.data();
      expect(paymentData?.userId).toBe(testUserId);
      expect(paymentData?.type).toBe('giller_earning');
      expect(paymentData?.amount).toBe(amount);
      expect(paymentData?.status).toBe('completed');
      expect(paymentData?.description).toBe('배송 완료 수익');
    });

    test('should create earning with correct fee breakdown', async () => {
      const amount = 5000;

      const paymentId = await createGillerEarning(
        testUserId,
        testRequestId,
        amount
      );

      createdPaymentIds.push(paymentId);

      const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
      const paymentData = paymentDoc.data();

      // Platform fee: 10% (500원)
      // Net to giller: 4500원
      expect(paymentData?.fee).toBe(500);
      expect(paymentData?.netAmount).toBe(4500);
    });
  });

  describe('getUserPayments', () => {
    beforeEach(async () => {
      // Create test payments
      const paymentIds = await Promise.all([
        createRequestPayment(testUserId, 'req-001', 5830),
        createGillerEarning(testUserId, 'req-002', 4500),
        createRequestPayment(testUserId, 'req-003', 6200),
      ]);

      createdPaymentIds.push(...paymentIds);
    });

    test('should get all user payments', async () => {
      const payments = await getUserPayments(testUserId, 10);

      expect(Array.isArray(payments)).toBe(true);
      expect(payments.length).toBeGreaterThanOrEqual(3);

      // Check if sorted by date (newest first)
      for (let i = 0; i < payments.length - 1; i++) {
        expect(payments[i].createdAt.getTime()).toBeGreaterThanOrEqual(payments[i + 1].createdAt.getTime());
      }
    });

    test('should limit results', async () => {
      const payments = await getUserPayments(testUserId, 2);

      expect(payments.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getUserTotalEarnings', () => {
    beforeEach(async () => {
      // Create test earnings
      const paymentIds = await Promise.all([
        createGillerEarning(testUserId, 'req-earn-001', 5000),
        createGillerEarning(testUserId, 'req-earn-002', 3000),
        createGillerEarning(testUserId, 'req-earn-003', 4000),
      ]);

      createdPaymentIds.push(...paymentIds);
    });

    test('should calculate total earnings correctly', async () => {
      const totalEarnings = await getUserTotalEarnings(testUserId);

      // Sum of net amounts: (4500 + 2700 + 3600) = 10800
      expect(totalEarnings).toBe(10800);
    });

    test('should return zero for user with no earnings', async () => {
      const totalEarnings = await getUserTotalEarnings('user-with-no-earnings');
      expect(totalEarnings).toBe(0);
    });
  });

  describe('getUserMonthlyEarnings', () => {
    beforeEach(async () => {
      // Create earnings for current month
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Create some test earnings
      const paymentIds = await Promise.all([
        createGillerEarning(testUserId, 'req-month-001', 5000),
        createGillerEarning(testUserId, 'req-month-002', 3000),
        createGillerEarning(testUserId, 'req-month-003', 4000),
      ]);

      createdPaymentIds.push(...paymentIds);
    });

    test('should get monthly earnings', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const { total, count, average } = await getUserMonthlyEarnings(testUserId, year, month);

      expect(count).toBeGreaterThanOrEqual(3);
      expect(total).toBeGreaterThan(0);
      expect(average).toBeGreaterThan(0);
    });
  });

  describe('requestWithdrawal', () => {
    test('should create withdrawal request', async () => {
      const amount = 10000;
      const bankInfo = {
        bankName: '국민은행',
        accountNumber: '1234567890123456',
        accountHolder: '김길동',
      };

      const paymentId = await requestWithdrawal(testUserId, amount, bankInfo);

      expect(paymentId).toBeDefined();

      createdPaymentIds.push(paymentId);

      // Verify withdrawal was saved
      const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
      const paymentData = paymentDoc.data();

      expect(paymentData?.type).toBe('withdrawal');
      expect(paymentData?.amount).toBe(amount);
      expect(paymentData?.status).toBe('pending');
      expect(paymentData?.metadata?.bankName).toBe(bankInfo.bankName);
      expect(paymentData?.metadata?.accountNumber).toBe(bankInfo.accountNumber);
    });

    test('should fail to withdraw more than available balance', async () => {
      // First, create some earnings
      const earningIds = await Promise.all([
        createGillerEarning(testUserId, 'req-withdraw-001', 5000),
      ]);

      createdPaymentIds.push(...earningIds);

      // Try to withdraw more than earnings
      const amount = 100000; // Much more than available
      const bankInfo = {
        bankName: '국민은행',
        accountNumber: '1234567890123456',
        accountHolder: '김길동',
      };

      await expect(
        requestWithdrawal(testUserId, amount, bankInfo)
      ).rejects.toThrow();
    });
  });

  describe('getPayment', () => {
    test('should get payment by ID', async () => {
      const paymentId = await createRequestPayment(
        testUserId,
        testRequestId,
        5830
      );

      createdPaymentIds.push(paymentId);

      const payment = await getPayment(paymentId);

      expect(payment).toBeDefined();
      expect(payment?.paymentId).toBe(paymentId);
      expect(payment?.userId).toBe(testUserId);
    });

    test('should return null for non-existent payment', async () => {
      const payment = await getPayment('non-existent-payment');
      expect(payment).toBeNull();
    });
  });
});
