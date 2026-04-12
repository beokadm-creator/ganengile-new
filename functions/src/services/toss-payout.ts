import * as admin from 'firebase-admin';
// @ts-ignore
import fetch from 'node-fetch';

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

export async function executeTossPayout(
  bankCode: string,
  accountNumber: string,
  amount: number,
  transferMemo: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const db = admin.firestore();
    
    // Get Payment Integration Config
    const configDoc = await db.collection('config_integrations').doc('payment').get();
    const config = configDoc.data() || {};
    
    // Also need private config for the secret key
    const privateConfigDoc = await db.collection('config_private').doc('payment').get();
    const privateConfig = privateConfigDoc.data() || {};

    const enabled = config.enabled ?? false;
    const testMode = config.testMode ?? true;
    const liveReady = config.liveReady ?? false;
    const secretKey = privateConfig.secretKey;

    if (!enabled) {
      return { success: false, error: '관리자 설정에서 결제 연동이 비활성화되어 있습니다.' };
    }

    if (testMode || !liveReady) {
      console.warn(`[Payout Test Mode] Simulated transfer of ${amount} to ${bankCode} ${accountNumber}`);
      return { success: true, transactionId: `test_transfer_${Date.now()}` };
    }

    if (!secretKey) {
      throw new Error('Toss Payments 시크릿 키가 설정되지 않았습니다.');
    }

    const encodedKey = Buffer.from(`${secretKey}:`).toString('base64');
    
    // Toss Payments Payouts API
    // https://docs.tosspayments.com/reference/payout
    const response = await fetch(`${TOSS_API_URL}/payouts`, {
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
