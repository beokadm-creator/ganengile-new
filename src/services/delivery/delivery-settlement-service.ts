import { DeliveryStatus } from '../../types/delivery';
import type { DeliveryDoc } from './delivery-repository';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { DepositService } from '../DepositService';
import { createGillerEarning } from '../payment-service';

export interface RequesterConfirmationData {
  deliveryId: string;
  requesterId: string;
  requestId: string;
}

export const deliverySettlementService = {
  async confirmDeliveryByRequester(data: RequesterConfirmationData): Promise<{ success: boolean; message: string }> {
    const { deliveryId, requesterId, requestId } = data;
    const deliveryRef = doc(db, 'deliveries', deliveryId);
    const snap = await getDoc(deliveryRef);

    if (!snap.exists()) {
      throw new Error('배송 정보를 찾을 수 없습니다.');
    }

    const deliveryData = snap.data() as DeliveryDoc;

    if (deliveryData.requesterId !== requesterId && deliveryData.gllerId !== requesterId) {
      throw new Error('요청자 본인만 수령 확인할 수 있습니다.');
    }

    if (deliveryData.status === 'completed') {
      throw new Error('이미 완료된 배송입니다.');
    }

    const updates: Partial<DeliveryDoc> = {
      status: 'completed' as DeliveryStatus,
      updatedAt: new Date(),
      completedAt: new Date(),
    };

    const tracking = deliveryData.tracking || { events: [] };
    tracking.events.push({
      type: 'delivered',
      description: '수령 확인 완료',
      timestamp: new Date(),
    });
    updates.tracking = tracking;

    try {
      await updateDoc(deliveryRef, updates);

      // 1. 보증금 환불 처리
      const deposit = await DepositService.getDepositByRequestId(requestId);
      if (deposit && deposit.status === 'paid' && deposit.depositId) {
        try {
          await DepositService.refundDeposit(deposit.depositId);
        } catch (e) {
          console.error('보증금 환불 실패:', e);
        }
      }

      // 2. 길러 수익 정산 (payment-service 위임)
      if (deliveryData.gillerId) {
        try {
          const totalFee = deliveryData.fee?.totalFee || 0;
          await createGillerEarning(
            deliveryData.gillerId,
            requestId,
            totalFee,
            true
          );
        } catch (e) {
          console.error('길러 수익 창출 실패:', e);
        }
      }

      return { success: true, message: '물품 수령이 확인되었습니다.' };
    } catch (error) {
      console.error('confirmDeliveryByRequester 오류:', error);
      throw error;
    }
  },
};
