import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const partnerWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();
    const payload = req.body;

    if (!payload || !payload.dispatchId || !payload.status) {
      res.status(400).send('Invalid payload');
      return;
    }

    const { dispatchId, status, rawResponse } = payload;

    // 1. partner_dispatches 업데이트
    const dispatchRef = db.collection('partner_dispatches').doc(dispatchId);
    const dispatchDoc = await dispatchRef.get();

    if (!dispatchDoc.exists) {
      console.warn(`Dispatch ${dispatchId} not found`);
      res.status(404).send('Dispatch not found');
      return;
    }

    const dispatchData = dispatchDoc.data();
    
    // 만약 이미 완료된 상태라면 멱등성 보장
    if (dispatchData?.status === 'completed' || dispatchData?.status === 'failed') {
      res.status(200).send('Already processed');
      return;
    }

    const newDispatchStatus = status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : dispatchData?.status;
    const deliveryId = dispatchData?.deliveryId;

    await db.runTransaction(async (transaction) => {
      // 파트너 위임 건 업데이트
      transaction.update(dispatchRef, {
        status: newDispatchStatus,
        completedAt: status === 'COMPLETED' ? admin.firestore.Timestamp.now() : null,
        failedAt: status === 'FAILED' ? admin.firestore.Timestamp.now() : null,
        rawResponse: rawResponse ?? null,
        updatedAt: admin.firestore.Timestamp.now()
      });

      if (deliveryId) {
        const deliveryRef = db.collection('deliveries').doc(deliveryId);
        const deliveryDoc = await transaction.get(deliveryRef);

        if (deliveryDoc.exists) {
          const deliveryData = deliveryDoc.data();
          const requestId = deliveryData?.requestId;
          
          if (newDispatchStatus === 'completed') {
            transaction.update(deliveryRef, {
              status: 'delivered',
              completedAt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now()
            });

            if (requestId) {
              const requestRef = db.collection('requests').doc(requestId);
              transaction.update(requestRef, {
                status: 'delivered',
                deliveredAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
              });
              
              // 알림 전송을 위해 notifications 컬렉션에 추가
              const notiRef = db.collection('notifications').doc();
              transaction.set(notiRef, {
                userId: deliveryData?.gllerId, // Requester
                type: 'DELIVERY_COMPLETED',
                title: '배송이 완료되었습니다',
                body: `파트너 배송업체가 배송을 완료했습니다.`,
                read: false,
                data: {
                  type: 'DELIVERY_COMPLETED',
                  requestId: requestId,
                  screen: 'RequestDetail'
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          } else if (newDispatchStatus === 'failed') {
            // 실패 시 예외 처리 (예: 관리자 확인 요망)
            transaction.update(deliveryRef, {
              status: 'issue_reported',
              updatedAt: admin.firestore.Timestamp.now()
            });
            
            if (requestId) {
              const requestRef = db.collection('requests').doc(requestId);
              transaction.update(requestRef, {
                status: 'issue_reported',
                updatedAt: admin.firestore.Timestamp.now()
              });
            }
          }
        }
      }
    });

    console.warn(`[Partner Webhook] Successfully processed dispatch ${dispatchId} to status ${newDispatchStatus}`);
    res.status(200).send('OK');

  } catch (error) {
    console.error('Partner Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
});
