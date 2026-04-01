import { getPaymentIntegrationConfig } from './integration-config-service';

export class TossPaymentService {
  static async chargePayment(
    amount: number,
    orderId: string,
    orderName: string
  ): Promise<{ success: boolean; paymentId?: string; error?: string; mode?: 'test' | 'live' }> {
    try {
      const config = await getPaymentIntegrationConfig();
      const paymentId = `toss_${orderId}_${Date.now()}`;

      if (!config.enabled) {
        return {
          success: false,
          error: '관리자 설정에서 결제 연동이 비활성화되어 있습니다.',
        };
      }

      if (config.testMode || config.allowTestBypass || !config.liveReady) {
        console.warn(`Payment test flow used: ${amount} / ${orderId} / ${orderName}`);
        return { success: true, paymentId, mode: 'test' };
      }

      console.warn(`Payment live-ready placeholder used: ${amount} / ${orderId} / ${orderName}`);
      return { success: true, paymentId, mode: 'live' };
    } catch (error: unknown) {
      console.error('TossPayments charge failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.',
      };
    }
  }

  static getPayment(paymentId: string): Promise<null> {
    try {
      console.warn(`Get payment: ${paymentId}`);
      return Promise.resolve(null);
    } catch (error) {
      console.error('Get payment failed:', error);
      return Promise.reject(error instanceof Error ? error : new Error('결제 조회에 실패했습니다.'));
    }
  }

  static refundPayment(paymentId: string, refundAmount: number, refundReason?: string): { success: boolean } {
    try {
      console.warn(`Refund payment: ${paymentId}, ${refundAmount}, ${refundReason ?? 'no-reason'}`);
      return { success: true };
    } catch (error) {
      console.error('Refund payment failed:', error);
      throw error;
    }
  }
}
