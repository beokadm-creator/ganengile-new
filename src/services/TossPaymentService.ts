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

      // 실제 Toss Payments API 호출
      const secretKey = config.secretKey || '';
      if (!secretKey) throw new Error('Toss Payments 시크릿 키가 설정되지 않았습니다.');

      const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');
      
      const response = await fetch(`${TOSS_API_URL}/payments/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encodedKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || '결제 승인에 실패했습니다.', rawData: data };
      }

      return { success: true, paymentId: data.paymentKey, mode: 'live', rawData: data };
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

      const secretKey = config.secretKey || '';
      if (!secretKey) throw new Error('Toss Payments 시크릿 키가 설정되지 않았습니다.');

      const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');
      const response = await fetch(`${TOSS_API_URL}/payments/${paymentKey}`, {
        headers: { Authorization: `Basic ${encodedKey}` },
      });

      if (!response.ok) {
        throw new Error('결제 내역을 불러오지 못했습니다.');
      }
      return await response.json();
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

      const secretKey = config.secretKey || '';
      if (!secretKey) throw new Error('Toss Payments 시크릿 키가 설정되지 않았습니다.');

      const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');
      
      const response = await fetch(`${TOSS_API_URL}/payments/${paymentKey}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encodedKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `cancel_${paymentKey}_${Date.now()}` // 멱등성 보장
        },
        body: JSON.stringify({
          cancelReason,
          cancelAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || '결제 취소에 실패했습니다.', rawData: data };
      }

      return { success: true, rawData: data };
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

      const secretKey = config.secretKey || '';
      if (!secretKey) throw new Error('Toss Payments 시크릿 키가 설정되지 않았습니다.');

      // TODO: 실제 토스 펌뱅킹(지급 대행) API 엔드포인트 및 페이로드 규격에 맞게 연동
      // 여기서는 일반적인 REST 지급 API 구조를 가정하여 작성합니다.
      const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');
      const payoutUrl = 'https://api.tosspayments.com/v1/payouts'; // 가상의 지급 API 엔드포인트
      
      const response = await fetch(payoutUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encodedKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bank: bankCode,
          accountNumber,
          amount,
          description: transferMemo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || '이체 처리에 실패했습니다.' };
      }

      return { success: true, transactionId: data.transactionId };
    } catch (error) {
      console.error('Execute payout failed:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }
}
