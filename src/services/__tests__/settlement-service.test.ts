/**
 * Settlement Service Unit Tests
 */

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      toDate: () => new Date('2026-04-10'),
      toMillis: () => Date.now(),
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  },
}));

// Mock firebase core module
jest.mock('../../core/firebase', () => ({
  db: {},
}));

// Mock CommissionService
jest.mock('../CommissionService', () => ({
  CommissionService: {
    calculateNetSettlement: jest.fn(),
  },
}));

// Mock bank-account utilities
jest.mock('../../../shared/bank-account', () => ({
  createProtectedBankAccount: jest.fn(),
  getAccountLast4: jest.fn(),
  maskAccountNumber: jest.fn(),
}));

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { SettlementService } from '../SettlementService';
import { CommissionService } from '../CommissionService';
import { createProtectedBankAccount, getAccountLast4, maskAccountNumber } from '../../../shared/bank-account';
import { SettlementStatus, PaymentStatus } from '../../types/payment';

describe('SettlementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockReturnValue({});
  });

  describe('createSettlement', () => {
    it('정산을 생성하고 Firestore에 저장해야 한다', async () => {
      (CommissionService.calculateNetSettlement as jest.Mock).mockReturnValue({
        earnings: 4500,
        tax: 450,
        netAmount: 4050,
      });
      (createProtectedBankAccount as jest.Mock).mockReturnValue({
        bankName: '신한은행',
        accountNumberMasked: '****5678',
        accountLast4: '5678',
        accountHolder: '홍길동',
      });
      (collection as jest.Mock).mockReturnValue({});
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await SettlementService.createSettlement({
        paymentId: 'pay-1',
        deliveryId: 'del-1',
        matchId: 'match-1',
        gillerId: 'giller-1',
        gillerName: '길러A',
        totalPayment: 5000,
        platformFee: 500,
        bankAccount: {
          bankName: '신한은행',
          accountNumber: '11012345678',
          accountHolder: '홍길동',
          bankCode: '088',
        },
        scheduledFor: new Date('2026-04-11'),
      });

      expect(result.gillerId).toBe('giller-1');
      expect(result.status).toBe(SettlementStatus.PENDING);
      expect(result.amount.netAmount).toBe(4050);
      expect(result.amount.gillerEarnings).toBe(4500);
      expect(setDoc).toHaveBeenCalled();
    });

    it('계좌 정보를 마스킹해서 저장해야 한다', async () => {
      (CommissionService.calculateNetSettlement as jest.Mock).mockReturnValue({
        earnings: 4500,
        tax: 450,
        netAmount: 4050,
      });
      (createProtectedBankAccount as jest.Mock).mockReturnValue({
        bankName: '신한은행',
        accountNumberMasked: '****5678',
        accountLast4: '5678',
        accountHolder: '홍길동',
      });
      (collection as jest.Mock).mockReturnValue({});
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await SettlementService.createSettlement({
        paymentId: 'pay-1',
        deliveryId: 'del-1',
        matchId: 'match-1',
        gillerId: 'giller-1',
        gillerName: '길러A',
        totalPayment: 5000,
        platformFee: 500,
        bankAccount: {
          bankName: '신한은행',
          accountNumber: '11012345678',
          accountHolder: '홍길동',
          bankCode: '088',
        },
        scheduledFor: new Date('2026-04-11'),
      });

      expect(result.bankAccount.accountNumberMasked).toBe('****5678');
      expect(result.bankAccount.accountLast4).toBe('5678');
    });
  });

  describe('processSettlementAfterDelivery', () => {
    it('결제 완료 후 정산을 생성해야 한다', async () => {
      const mockPaymentDoc = {
        exists: () => true,
        data: () => ({
          paymentId: 'pay-1',
          status: PaymentStatus.COMPLETED,
          gllerId: 'giller-1',
          amount: 5000,
          commission: { totalCommission: 500 },
        }),
      };
      const mockGillerDoc = {
        exists: () => true,
        data: () => ({
          name: '길러A',
          gillerInfo: { totalDeliveries: 10 },
          bankAccounts: [{
            bankCode: '088',
            bankName: '신한은행',
            accountNumberMasked: '****5678',
            accountLast4: '5678',
            accountHolder: '홍길동',
            isDefault: true,
            status: 'active',
            createdAt: {},
          }],
        }),
      };

      (CommissionService.calculateNetSettlement as jest.Mock).mockReturnValue({
        earnings: 4500,
        tax: 450,
        netAmount: 4050,
      });
      (createProtectedBankAccount as jest.Mock).mockReturnValue({
        bankName: '신한은행',
        accountNumberMasked: '****5678',
        accountLast4: '5678',
        accountHolder: '홍길동',
      });
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockPaymentDoc)
        .mockResolvedValueOnce(mockGillerDoc)
        .mockResolvedValue(mockGillerDoc);
      (collection as jest.Mock).mockReturnValue({});
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await SettlementService.processSettlementAfterDelivery('pay-1', 'del-1', 'match-1');

      expect(result.gillerId).toBe('giller-1');
      expect(result.status).toBe(SettlementStatus.PENDING);
    });

    it('결제가 없으면 에러를 던져야 한다', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      await expect(SettlementService.processSettlementAfterDelivery('pay-1', 'del-1', 'match-1'))
        .rejects.toThrow('Payment not found');
    });

    it('결제가 완료되지 않았으면 에러를 던져야 한다', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: PaymentStatus.PENDING,
          gllerId: 'giller-1',
        }),
      });

      await expect(SettlementService.processSettlementAfterDelivery('pay-1', 'del-1', 'match-1'))
        .rejects.toThrow();
    });

    it('길러가 없으면 에러를 던져야 한다', async () => {
      (getDoc as jest.Mock)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            status: PaymentStatus.COMPLETED,
            gllerId: 'giller-1',
            amount: 5000,
            commission: { totalCommission: 500 },
          }),
        })
        .mockResolvedValueOnce({ exists: () => false });

      await expect(SettlementService.processSettlementAfterDelivery('pay-1', 'del-1', 'match-1'))
        .rejects.toThrow('Giller not found');
    });
  });

  describe('getSettlement', () => {
    it('정산이 존재하면 반환해야 한다', async () => {
      const mockSettlement = {
        settlementId: 'set-1',
        status: SettlementStatus.PENDING,
        amount: { netAmount: 4050 },
      };
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => mockSettlement,
      });

      const result = await SettlementService.getSettlement('set-1');

      expect(result).not.toBeNull();
      expect(result!.settlementId).toBe('set-1');
    });

    it('정산이 없으면 null을 반환해야 한다', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const result = await SettlementService.getSettlement('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateSettlementStatus', () => {
    it('정산 상태를 업데이트해야 한다', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await SettlementService.updateSettlementStatus('set-1', SettlementStatus.COMPLETED);

      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          status: SettlementStatus.COMPLETED,
          completedAt: expect.any(Object),
        })
      );
    });

    it('COMPLETED 상태에서 completedAt을 설정해야 한다', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await SettlementService.updateSettlementStatus('set-1', SettlementStatus.COMPLETED, {
        notes: '정산 완료',
        processedBy: 'admin',
      });

      const callArgs = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(callArgs).toHaveProperty('completedAt');
      expect(callArgs.metadata).toEqual({ notes: '정산 완료', processedBy: 'admin' });
    });

    it('PENDING 상태에서는 completedAt을 설정하지 않아야 한다', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await SettlementService.updateSettlementStatus('set-1', SettlementStatus.PROCESSING);

      const callArgs = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('completedAt');
    });
  });

  describe('getSettlementStatistics', () => {
    it('정산 통계를 올바르게 계산해야 한다', async () => {
      const mockQuery = {};
      const mockSettlements = [
        {
          id: 'set-1',
          data: () => ({
            settlementId: 'set-1',
            gillerId: 'giller-1',
            status: SettlementStatus.COMPLETED,
            amount: { gillerEarnings: 4500, tax: 450, netAmount: 4050 },
            createdAt: { toDate: () => new Date('2026-04-08') },
            completedAt: { toDate: () => new Date('2026-04-09') },
          }),
        },
        {
          id: 'set-2',
          data: () => ({
            settlementId: 'set-2',
            gillerId: 'giller-1',
            status: SettlementStatus.PENDING,
            amount: { gillerEarnings: 3000, tax: 300, netAmount: 2700 },
            createdAt: { toDate: () => new Date('2026-04-10') },
          }),
        },
      ];

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (orderBy as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockSettlements });

      const stats = await SettlementService.getSettlementStatistics('giller-1');

      expect(stats.totalSettlements).toBe(2);
      expect(stats.totalEarnings).toBe(7500);
      expect(stats.completedAmount).toBe(4050);
      expect(stats.pendingAmount).toBe(2700);
      expect(stats.totalNetAmount).toBe(6750);
    });

    it('정산이 없으면 빈 통계를 반환해야 한다', async () => {
      const mockQuery = {};

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (orderBy as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      const stats = await SettlementService.getSettlementStatistics('giller-1');

      expect(stats.totalSettlements).toBe(0);
      expect(stats.totalEarnings).toBe(0);
      expect(stats.totalNetAmount).toBe(0);
    });
  });

  describe('addGillerBankAccount', () => {
    it('첫 계좌를 기본 계좌로 추가해야 한다', async () => {
      const mockGillerDoc = {
        exists: () => true,
        data: () => ({
          name: '길러A',
          bankAccounts: [],
        }),
      };
      (createProtectedBankAccount as jest.Mock).mockReturnValue({
        bankName: '신한은행',
        accountNumberMasked: '****5678',
        accountLast4: '5678',
        accountHolder: '홍길동',
      });
      (getDoc as jest.Mock).mockResolvedValue(mockGillerDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await SettlementService.addGillerBankAccount('giller-1', {
        bankName: '신한은행',
        accountNumber: '11012345678',
        accountHolder: '홍길동',
        bankCode: '088',
      });

      expect(result.isDefault).toBe(true);
      expect(result.status).toBe('active');
    });

    it('사용자가 없으면 에러를 던져야 한다', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      await expect(SettlementService.addGillerBankAccount('nonexistent', {
        bankName: '신한은행',
        accountNumber: '11012345678',
        accountHolder: '홍길동',
        bankCode: '088',
      })).rejects.toThrow('User not found');
    });
  });

  describe('getGillerBankAccounts', () => {
    it('길러의 계좌 목록을 반환해야 한다', async () => {
      const mockAccounts = [
        { bankCode: '088', bankName: '신한은행', isDefault: true },
      ];
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ bankAccounts: mockAccounts }),
      });

      const result = await SettlementService.getGillerBankAccounts('giller-1');

      expect(result).toHaveLength(1);
      expect(result[0].bankName).toBe('신한은행');
    });

    it('사용자가 없으면 빈 배열을 반환해야 한다', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const result = await SettlementService.getGillerBankAccounts('nonexistent');

      expect(result).toEqual([]);
    });

    it('계좌가 없으면 빈 배열을 반환해야 한다', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({}),
      });

      const result = await SettlementService.getGillerBankAccounts('giller-1');

      expect(result).toEqual([]);
    });
  });

  describe('setDefaultBankAccount', () => {
    it('기본 계좌를 변경해야 한다', async () => {
      (maskAccountNumber as jest.Mock).mockReturnValue('****5678');
      (getAccountLast4 as jest.Mock).mockReturnValue('5678');
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          bankAccounts: [
            { bankCode: '088', accountNumber: '11012345678', isDefault: false },
            { bankCode: '088', accountNumber: '11019876543', isDefault: true },
          ],
        }),
      });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await SettlementService.setDefaultBankAccount('giller-1', '11012345678');

      expect(updateDoc).toHaveBeenCalled();
      const callArgs = (updateDoc as jest.Mock).mock.calls[0][1];
      const accounts = callArgs.bankAccounts;
      expect(accounts[0].isDefault).toBe(true);
      expect(accounts[1].isDefault).toBe(false);
    });

    it('계좌를 찾지 못하면 에러를 던져야 한다', async () => {
      (maskAccountNumber as jest.Mock).mockReturnValue('****9999');
      (getAccountLast4 as jest.Mock).mockReturnValue('9999');
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          bankAccounts: [
            { bankCode: '088', accountNumber: '11012345678', isDefault: true },
          ],
        }),
      });

      await expect(SettlementService.setDefaultBankAccount('giller-1', 'nonexistent'))
        .rejects.toThrow('Bank account not found');
    });

    it('사용자가 없으면 에러를 던져야 한다', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      await expect(SettlementService.setDefaultBankAccount('nonexistent', '1234'))
        .rejects.toThrow('User not found');
    });
  });
});
