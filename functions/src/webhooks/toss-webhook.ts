import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const tossWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();

    // 1. IP Whitelisting or Secret verification can be done here.
    // For now, we process the webhook payload.

    const payload = req.body;
    if (!payload || !payload.paymentKey || !payload.status) {
      res.status(400).send('Invalid payload');
      return;
    }

    const { paymentKey, status, totalAmount, cancels } = payload;
    
    // We update the request document matching the orderId
    // Typically, orderId corresponds to our request or deposit ID.
    // In our system, deposit orderId is generated uniquely, but we might store paymentKey in `deposits` collection.

    const depositsQuery = await db.collection('deposits').where('paymentId', '==', paymentKey).get();
    
    if (depositsQuery.empty) {
      // If we don't find it in deposits, it might be something else.
      console.warn(`Webhook received for unknown paymentKey: ${paymentKey}`);
      res.status(200).send('OK'); // Acknowledge Toss to stop retrying
      return;
    }

    const depositDoc = depositsQuery.docs[0];
    const depositRef = depositDoc.ref;
    const deposit = depositDoc.data();

    // 멱등성 보장 (Idempotency) - 이미 처리된 상태면 무시
    if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
      if (deposit.status === 'refunded' || deposit.status === 'deducted') {
        res.status(200).send('OK');
        return;
      }
      
      const canceledAmount = cancels?.[0]?.cancelAmount ?? totalAmount;

      await depositRef.update({
        status: 'refunded',
        tossRefundedAmount: canceledAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.warn(`[Webhook] Deposit ${depositDoc.id} refunded due to Toss cancellation.`);
    }

    // DONE 상태는 일반적으로 결제 완료 시점에 클라이언트에서 먼저 처리하므로 동기화 용도로만 사용
    if (status === 'DONE' && deposit.status === 'pending') {
      await depositRef.update({
        status: 'paid',
        tossAmount: totalAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.warn(`[Webhook] Deposit ${depositDoc.id} marked as paid.`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Toss Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
});
