/**
 * Toss Payment Service Unit Tests
 */

// Mock integration-config-service
jest.mock('../integration-config-service', () => ({
  getPaymentIntegrationConfig: jest.fn(),
}));

import { getPaymentIntegrationConfig } from '../integration-config-service';
import { TossPaymentService } from '../TossPaymentService';

describe('TossPaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chargePayment', () => {
    it('테스트 모드에서 결제 성공해야 한다', async () => {
      (getPaymentIntegrationConfig as jest.Mock).mockResolvedValue({
        enabled: true,
        testMode: true,
        allowTestBypass: false,
        liveReady: false,
      });

      const result = await TossPaymentService.chargePayment(5000, 'order-1', '배송비');

      expect(result.success).toBe(true);
      expect(result.paymentId).toMatch(/^toss_order-1_/);
      expect(result.mode).toBe('test');
    });

    it('결제가 비활성화되어 있으면 실패해야 한다', async () => {
      (getPaymentIntegrationConfig as jest.Mock).mockResolvedValue({
        enabled: false,
        testMode: true,
        allowTestBypass: false,
        liveReady: false,
      });

      const result = await TossPaymentService.chargePayment(5000, 'order-1', '배송비');

      expect(result.success).toBe(false);
      expect(result.error).toContain('비활성화');
    });

    it('allowTestBypass가 true이면 테스트 모드로 성공해야 한다', async () => {
      (getPaymentIntegrationConfig as jest.Mock).mockResolvedValue({
        enabled: true,
        testMode: false,
        allowTestBypass: true,
        liveReady: false,
      });

      const result = await TossPaymentService.chargePayment(5000, 'order-1', '배송비');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('test');
    });

    it('liveReady가 false이면 테스트 모드로 처리해야 한다', async () => {
      (getPaymentIntegrationConfig as jest.Mock).mockResolvedValue({
        enabled: true,
        testMode: false,
        allowTestBypass: false,
        liveReady: false,
      });

      const result = await TossPaymentService.chargePayment(5000, 'order-1', '배송비');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('test');
    });

    it('liveReady이고 testMode가 아니면 live 모드로 성공해야 한다', async () => {
      (getPaymentIntegrationConfig as jest.Mock).mockResolvedValue({
        enabled: true,
        testMode: false,
        allowTestBypass: false,
        liveReady: true,
      });

      const result = await TossPaymentService.chargePayment(5000, 'order-1', '배송비');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('live');
    });

    it('config 조회 에러 시 에러 메시지를 반환해야 한다', async () => {
      (getPaymentIntegrationConfig as jest.Mock).mockRejectedValue(new Error('Config error'));

      const result = await TossPaymentService.chargePayment(5000, 'order-1', '배송비');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Config error');
    });

    it('결제 금액이 0이어도 테스트 모드로 성공해야 한다', async () => {
      (getPaymentIntegrationConfig as jest.Mock).mockResolvedValue({
        enabled: true,
        testMode: true,
        allowTestBypass: false,
        liveReady: false,
      });

      const result = await TossPaymentService.chargePayment(0, 'order-zero', '무료');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('test');
    });

    it('paymentId에 orderId가 포함되어야 한다', async () => {
      (getPaymentIntegrationConfig as jest.Mock).mockResolvedValue({
        enabled: true,
        testMode: true,
        allowTestBypass: false,
        liveReady: false,
      });

      const result = await TossPaymentService.chargePayment(5000, 'my-order-123', '배송비');

      expect(result.paymentId).toContain('my-order-123');
    });
  });

  describe('getPayment', () => {
    it('항상 null을 반환해야 한다 (placeholder)', async () => {
      const result = await TossPaymentService.getPayment('pay-1');

      expect(result).toBeNull();
    });
  });

  describe('refundPayment', () => {
    it('환불을 성공해야 한다', () => {
      const result = TossPaymentService.refundPayment('pay-1', 5000, '사용자 요청');

      expect(result.success).toBe(true);
    });

    it('환불 사유 없이도 성공해야 한다', () => {
      const result = TossPaymentService.refundPayment('pay-1', 5000);

      expect(result.success).toBe(true);
    });

    it('환불 금액이 0이어도 성공해야 한다', () => {
      const result = TossPaymentService.refundPayment('pay-1', 0, '전액 환불');

      expect(result.success).toBe(true);
    });
  });
});
