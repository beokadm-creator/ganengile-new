/**
 * Deposit Service Unit Tests
 */

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  Timestamp: {
    now: jest.fn(() => 'mock-timestamp'),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  },
  updateDoc: jest.fn(),
  where: jest.fn(),
}));

// Mock firebase module
jest.mock('../firebase', () => ({
  db: {},
}));

// Mock PointService
jest.mock('../PointService', () => ({
  PointService: {
    getBalance: jest.fn(),
    spendPoints: jest.fn(),
  },
}));

// Mock TossPaymentService
jest.mock('../TossPaymentService', () => ({
  TossPaymentService: {
    chargePayment: jest.fn(),
  },
}));

// Mock DepositCompensationService
jest.mock('../deposit-compensation-service', () => ({
  DepositCompensationService: {
    refundDeposit: jest.fn(),
    deductCompensation: jest.fn(),
  },
}));

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { DepositService } from '../DepositService';
import { PointService } from '../PointService';
import { TossPaymentService } from '../TossPaymentService';
import { DepositCompensationService } from '../deposit-compensation-service';
import { DEPOSIT_RATE } from '../../types/point';

describe('DepositService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('payDeposit', () => {
    it('포인트 잔액이 충분하면 포인트만 결제해야 한다', async () => {
      const mockDepositRef = { id: 'deposit-1' };
      (PointService.getBalance as jest.Mock).mockResolvedValue(10000);
      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDepositRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (PointService.spendPoints as jest.Mock).mockResolvedValue(undefined);

      const result = await DepositService.payDeposit('giller-1', 'requester-1', 'req-1', 5000);

      expect(result.success).toBe(true);
      expect(result.deposit).toBeDefined();
      expect(result.deposit!.paymentMethod).toBe('point_only');
      expect(result.deposit!.pointAmount).toBe(5000);
      expect(result.deposit!.tossAmount).toBeUndefined();
      expect(TossPaymentService.chargePayment).not.toHaveBeenCalled();
    });

    it('포인트 잔액이 부족하면 혼합 결제해야 한다', async () => {
      const mockDepositRef = { id: 'deposit-2' };
      const depositAmount = Math.round(100000 * DEPOSIT_RATE);
      const pointBalance = 1000;

      (PointService.getBalance as jest.Mock).mockResolvedValue(pointBalance);
      (TossPaymentService.chargePayment as jest.Mock).mockResolvedValue({
        success: true,
        paymentId: 'toss-pay-1',
      });
      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDepositRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (PointService.spendPoints as jest.Mock).mockResolvedValue(undefined);

      const result = await DepositService.payDeposit('giller-1', 'requester-1', 'req-1', 100000);

      expect(result.success).toBe(true);
      expect(result.deposit!.paymentMethod).toBe('mixed');
      expect(result.deposit!.pointAmount).toBe(pointBalance);
      expect(result.deposit!.tossAmount).toBe(depositAmount - pointBalance);
      expect(TossPaymentService.chargePayment).toHaveBeenCalledWith(
        depositAmount - pointBalance,
        'deposit_req-1',
        expect.stringContaining('보증금')
      );
      expect(PointService.spendPoints).toHaveBeenCalledWith(
        'giller-1',
        pointBalance,
        expect.anything(),
        expect.stringContaining('보증금')
      );
    });

    it('Toss 결제 실패 시 실패해야 한다', async () => {
      (PointService.getBalance as jest.Mock).mockResolvedValue(0);
      (TossPaymentService.chargePayment as jest.Mock).mockResolvedValue({
        success: false,
        error: '카드 결제 실패',
      });

      const result = await DepositService.payDeposit('giller-1', 'requester-1', 'req-1', 100000);

      expect(result.success).toBe(false);
      expect(result.error).toBe('카드 결제 실패');
      expect(addDoc).not.toHaveBeenCalled();
    });

    it('에러 발생 시 에러 메시지를 반환해야 한다', async () => {
      (PointService.getBalance as jest.Mock).mockRejectedValue(new Error('서버 에러'));

      const result = await DepositService.payDeposit('giller-1', 'requester-1', 'req-1', 100000);

      expect(result.success).toBe(false);
      expect(result.error).toBe('서버 에러');
    });

    it('포인트가 0이면 전액 Toss 결제해야 한다', async () => {
      const mockDepositRef = { id: 'deposit-3' };
      (PointService.getBalance as jest.Mock).mockResolvedValue(0);
      (TossPaymentService.chargePayment as jest.Mock).mockResolvedValue({
        success: true,
        paymentId: 'toss-pay-2',
      });
      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDepositRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await DepositService.payDeposit('giller-1', 'requester-1', 'req-1', 50000);

      expect(result.success).toBe(true);
      expect(result.deposit!.paymentMethod).toBe('mixed');
      expect(result.deposit!.pointAmount).toBeUndefined();
      expect(result.deposit!.tossAmount).toBe(50000);
      expect(PointService.spendPoints).not.toHaveBeenCalled();
    });

    it('depositId가 올바르게 설정되어야 한다', async () => {
      const mockDepositRef = { id: 'deposit-id-abc' };
      (PointService.getBalance as jest.Mock).mockResolvedValue(100000);
      (collection as jest.Mock).mockReturnValue({});
      (addDoc as jest.Mock).mockResolvedValue(mockDepositRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (PointService.spendPoints as jest.Mock).mockResolvedValue(undefined);

      const result = await DepositService.payDeposit('giller-1', 'requester-1', 'req-1', 100000);

      expect(result.deposit!.depositId).toBe('deposit-id-abc');
      expect(updateDoc).toHaveBeenCalledWith(
        mockDepositRef,
        expect.objectContaining({ depositId: 'deposit-id-abc' })
      );
    });
  });

  describe('refundDeposit', () => {
    it('DepositCompensationService에 위임해야 한다', async () => {
      (DepositCompensationService.refundDeposit as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await DepositService.refundDeposit('deposit-1');

      expect(result.success).toBe(true);
      expect(DepositCompensationService.refundDeposit).toHaveBeenCalledWith('deposit-1');
    });

    it('위임 실패 시 실패해야 한다', async () => {
      (DepositCompensationService.refundDeposit as jest.Mock).mockResolvedValue({
        success: false,
        error: '보증금을 찾을 수 없습니다.',
      });

      const result = await DepositService.refundDeposit('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('보증금을 찾을 수 없습니다.');
    });
  });

  describe('deductCompensation', () => {
    it('DepositCompensationService에 위임해야 한다', async () => {
      (DepositCompensationService.deductCompensation as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await DepositService.deductCompensation('deposit-1');

      expect(result.success).toBe(true);
      expect(DepositCompensationService.deductCompensation).toHaveBeenCalledWith('deposit-1');
    });
  });

  describe('getDeposits', () => {
    it('사용자의 보증금 목록을 반환해야 한다', async () => {
      const mockDeposits = [
        { id: 'dep-1', data: () => ({ userId: 'user-1', status: 'paid' }) },
        { id: 'dep-2', data: () => ({ userId: 'user-1', status: 'refunded' }) },
      ];
      const mockQuery = {};

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (orderBy as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDeposits });

      const result = await DepositService.getDeposits('user-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getDepositByRequestId', () => {
    it('요청 ID로 보증금을 찾아야 한다', async () => {
      const mockDoc = { id: 'dep-1', data: () => ({ requestId: 'req-1', status: 'paid', depositAmount: 10000 }) };
      const mockQuery = {};

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (orderBy as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue({ empty: false, docs: [mockDoc] });

      const result = await DepositService.getDepositByRequestId('req-1');

      expect(result).not.toBeNull();
      expect(result!.depositId).toBe('dep-1');
      expect(result!.requestId).toBe('req-1');
    });

    it('보증금이 없으면 null을 반환해야 한다', async () => {
      const mockQuery = {};

      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue(mockQuery);
      (orderBy as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue({ empty: true });

      const result = await DepositService.getDepositByRequestId('nonexistent');

      expect(result).toBeNull();
    });

    it('에러 발생 시 null을 반환해야 한다', async () => {
      (collection as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (orderBy as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      const result = await DepositService.getDepositByRequestId('req-1');

      expect(result).toBeNull();
    });
  });
});
