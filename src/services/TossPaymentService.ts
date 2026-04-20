import { getPaymentIntegrationConfig } from './integration-config-service';

// Toss Payments API Base URL
const TOSS_API_URL = 'https://api.tosspayments.com/v1';

export class TossPaymentService {
  /**
   * 결제 승인 요청 (Charge)
   */
  static async chargePayment(
    paymentKey: string,
    orderId: string,
    amount: number
  ): Promise<{ success: boolean; paymentId?: string; error?: string; mode?: 'test' | 'live'; rawData?: any }> {
    try {
      const config = await getPaymentIntegrationConfig();

      if (!config.enabled) {
        return { success: false, error: '관리자 설정에서 결제 연동이 비활성화되어 있습니다.' };
      }

      if (config.testMode || config.allowTestBypass || !config.liveReady) {
        console.warn(`Payment test flow used: ${amount} / ${orderId}`);
        return { success: true, paymentId: `test_toss_${orderId}_${Date.now()}`, mode: 'test' };
      }

      // 보안: 시크릿 키는 클라이언트에서 접근할 수 없습니다.
      // 실제 Toss Payments API 호출은 Cloud Functions으로 이관해야 합니다.
      throw new Error('Toss Payments 라이브 결제는 서버를 통해서만 처리할 수 있습니다. 현재 테스트 모드를 사용하세요.');
    } catch (error: unknown) {
      console.error('TossPayments charge failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * 결제 내역 단건 조회
   */
  static async getPayment(paymentKey: string): Promise<any> {
    try {
      const config = await getPaymentIntegrationConfig();
      if (config.testMode || !config.liveReady || paymentKey.startsWith('test_')) {
        console.warn(`Get payment (Test Mode): ${paymentKey}`);
        return { paymentKey, status: 'DONE', totalAmount: 0 }; // Mock response
      }

      // 보안: 시크릿 키는 클라이언트에서 접근할 수 없습니다.
      // 실제 Toss Payments API 호출은 Cloud Functions으로 이관해야 합니다.
      throw new Error('Toss Payments 라이브 결제 조회는 서버를 통해서만 처리할 수 있습니다. 현재 테스트 모드를 사용하세요.');
    } catch (error) {
      console.error('Get payment failed:', error);
      throw error;
    }
  }

  /**
   * 결제 취소 (환불)
   */
  static async refundPayment(paymentKey: string, cancelAmount: number, cancelReason: string = '고객 요청'): Promise<{ success: boolean; error?: string; rawData?: any }> {
    try {
      const config = await getPaymentIntegrationConfig();

      if (config.testMode || !config.liveReady || paymentKey.startsWith('test_')) {
        console.warn(`Refund payment (Test Mode): ${paymentKey}, ${cancelAmount}, ${cancelReason}`);
        return { success: true };
      }

      // 보안: 시크릿 키는 클라이언트에서 접근할 수 없습니다.
      // 실제 Toss Payments API 호출은 Cloud Functions으로 이관해야 합니다.
      throw new Error('Toss Payments 라이브 환불은 서버를 통해서만 처리할 수 있습니다. 현재 테스트 모드를 사용하세요.');
    } catch (error) {
      console.error('Refund payment failed:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  /**
   * 파트너/길러 정산금 지급 (Payout/Firmbanking)
   * 참고: Toss Payments의 Payout API 또는 제휴된 펌뱅킹 API를 호출합니다.
   */
  static async executePayout(
    bankCode: string,
    accountNumber: string,
    amount: number,
    transferMemo: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const config = await getPaymentIntegrationConfig();

      if (config.testMode || !config.liveReady) {
        console.warn(`[Payout Test Mode] Simulated transfer of ${amount} to ${bankCode} ${accountNumber}`);
        return { success: true, transactionId: `test_transfer_${Date.now()}` };
      }

      // 보안: 시크릿 키는 클라이언트에서 접근할 수 없습니다.
      // 실제 Toss Payments API 호출은 Cloud Functions으로 이관해야 합니다.
      throw new Error('Toss Payments 라이브 정산 지급은 서버를 통해서만 처리할 수 있습니다. 현재 테스트 모드를 사용하세요.');
    } catch (error) {
      console.error('Execute payout failed:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }
}
