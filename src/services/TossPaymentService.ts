export class TossPaymentService {
  private static readonly CLIENT_KEY = process.env.EXPO_PUBLIC_TOSSPAYMENTS_CLIENT_KEY || '';

  static chargePayment(
    amount: number,
    orderId: string,
    orderName: string
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    try {
      console.log(`💳 TossPayments charge: ${amount}원, orderId: ${orderId}, orderName: ${orderName}`);

      const paymentId = `toss_${orderId}_${Date.now()}`;

      return Promise.resolve({ success: true, paymentId });
    } catch (error: any) {
      console.error('TossPayments charge failed:', error);
      return Promise.resolve({ success: false, error: error.message });
    }
  }

  static getPayment(paymentId: string) {
    try {
      console.log(`💳 TossPayments getPayment: ${paymentId}`);
      return Promise.resolve(null);
    } catch (error) {
      console.error('Get TossPayments payment failed:', error);
      return Promise.reject(error);
    }
  }

  static async refundPayment(
    paymentId: string,
    refundAmount: number,
    refundReason?: string
  ) {
    try {
      console.log(`💸 TossPayments refund: ${paymentId}, amount: ${refundAmount}, reason: ${refundReason}`);
      return { success: true };
    } catch (error) {
      console.error('Refund TossPayments payment failed:', error);
      throw error;
    }
  }
}
