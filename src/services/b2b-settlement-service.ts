/**
 * B2B 정산 서비스
 * 
 * 길러 월간 배송 집계, 수익, 보너스 정산
 */
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, addDoc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { 
  B2BSettlement,
  B2BSettlementStatus,
  SettlementPeriod,
  TransferInfo,
  CreateB2BSettlementData,
  SETTLEMENT_CYCLE_DAYS,
  TIER_MONTHLY_BONUSES
} from '../types/b2b-settlement';
import type { B2BDelivery } from '../types/b2b-delivery';
import type { B2BGillerTier } from '../types/b2b-giller-tier';
import { B2BGillerService } from './b2b-giller-service';

const SETTLEMENT_COLLECTION = 'b2b_settlements';
const DELIVERY_COLLECTION = 'b2b_deliveries';
const TIER_COLLECTION = 'b2b_giller_tiers';

/**
 * B2B 정산 서비스
 */
export class B2BSettlementService {
  /**
   * 월간 정산 생성 (매월 5일 실행)
   */
  static async generateMonthlySettlements(): Promise<void> {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. 활성 B2B 길러 조회
    const activeGillers = await B2BGillerService.getActiveB2BGillers();

    for (const giller of activeGillers) {
      // 2. 월간 B2B 배송 집계
      const { b2bDeliveries, deliveryEarnings } = await this.aggregateB2BDeliveries(
        giller.gillerId,
        lastMonth,
        thisMonth
      );

      if (b2bDeliveries === 0) continue; // 배송 건수 0이면 스킵

      // 3. 월 보너스 계산 (길러 등급 조회)
      const gillerTier = await B2BGillerService.getB2BGillerTier(giller.gillerId);
      if (!gillerTier) {
        console.error(`길러 등급을 찾을 수 없습니다: ${giller.gillerId}`);
        continue;
      }

      const monthlyBonus = TIER_MONTHLY_BONUSES[gillerTier.tier];

      // 4. 총 정산 금액
      const totalSettlement = deliveryEarnings + monthlyBonus;

      // 5. 정산 데이터 생성
      const settlementData: Omit<B2BSettlement, 'id' | 'status' | 'createdAt'> = {
        gillerId: giller.gillerId,
        period: {
          start: lastMonth,
          end: thisMonth
        },
        b2bDeliveries,
        deliveryEarnings,
        monthlyBonus,
        totalSettlement,
        status: 'pending_payment' as B2BSettlementStatus
      };

      const docRef = await addDoc(collection(db, SETTLEMENT_COLLECTION), settlementData);
      const settlementId = docRef.id;

      // 6. 계좌 정보 조회 (TODO: users 컬렉션에서)
      const transferInfo = await this.getGillerAccountInfo(giller.gillerId);

      // 7. 이체 실행 (TODO: 뱅킹 API 사용)
      if (transferInfo) {
        await this.executeTransfer(settlementId, totalSettlement, transferInfo);
      }
    }
  }

  /**
   * B2B 배송 집계
   */
  private static async aggregateB2BDeliveries(
    gillerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    b2bDeliveries: number;
    deliveryEarnings: number;
  }> {
    const q = query(
      collection(db, DELIVERY_COLLECTION),
      where('gillerId', '==', gillerId),
      where('completedAt', '>=', startDate),
      where('completedAt', '<', endDate)
    );

    const querySnapshot = await getDocs(q);
    const deliveries = querySnapshot.docs.map(doc => doc.data() as B2BDelivery);

    const b2bDeliveries = deliveries.length;
    let deliveryEarnings = 0;

    deliveries.forEach(delivery => {
      deliveryEarnings += delivery.pricing.gillerEarning;
    });

    return {
      b2bDeliveries,
      deliveryEarnings
    };
  }

  /**
   * 길러 계좌 정보 조회
   */
  private static async getGillerAccountInfo(gillerId: string): Promise<TransferInfo | null> {
    // TODO: users 컬렉션에서 길러 계좌 정보 조회
    // 임시: null 반환
    return null;
  }

  /**
   * 이체 실행
   */
  private static async executeTransfer(
    settlementId: string,
    amount: number,
    transferInfo: TransferInfo
  ): Promise<void> {
    // TODO: 뱅킹 API 연동 (실시 이체, CMS 등)
    console.log(`이체 실행: ${settlementId}, ${amount}원`);
    console.log('계좌:', transferInfo.accountNumber, transferInfo.bank);

    // 이체 완료 처리
    await this.markAsPaid(settlementId, {
      accountNumber: transferInfo.accountNumber,
      bank: transferInfo.bank,
      transferredAt: new Date(),
      transactionId: `TXN_${Date.now()}`
    });
  }

  /**
   * 정산 완료 처리
   */
  private static async markAsPaid(
    settlementId: string,
    transferInfo: {
      accountNumber: string;
      bank: string;
      transferredAt: Date;
      transactionId: string;
    }
  ): Promise<void> {
    const settlementRef = doc(db, SETTLEMENT_COLLECTION, settlementId);
    
    await updateDoc(settlementRef, {
      status: 'paid' as B2BSettlementStatus,
      transferInfo
    });
  }

  /**
   * 정산 실패 처리
   */
  static async markAsFailed(
    settlementId: string,
    reason: string
  ): Promise<void> {
    const settlementRef = doc(db, SETTLEMENT_COLLECTION, settlementId);
    
    await updateDoc(settlementRef, {
      status: 'failed' as B2BSettlementStatus
    });

    console.error(`정산 실패: ${settlementId}, reason: ${reason}`);
  }

  /**
   * 정산 조회
   */
  static async getSettlement(settlementId: string): Promise<B2BSettlement | null> {
    const settlementDoc = await getDoc(doc(db, SETTLEMENT_COLLECTION, settlementId));
    if (!settlementDoc.exists()) {
      return null;
    }
    return {
      id: settlementDoc.id,
      ...settlementDoc.data()
    } as B2BSettlement;
  }

  /**
   * 길러 정산 목록
   */
  static async getGillerSettlements(
    gillerId: string,
    status?: B2BSettlementStatus
  ): Promise<B2BSettlement[]> {
    let q = query(
      collection(db, SETTLEMENT_COLLECTION),
      where('gillerId', '==', gillerId)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as B2BSettlement));
  }

  /**
   * 미지급 정산 목록 (관리자 전용)
   */
  static async getPendingSettlements(): Promise<B2BSettlement[]> {
    const q = query(
      collection(db, SETTLEMENT_COLLECTION),
      where('status', '==', 'pending_payment')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as B2BSettlement));
  }

  /**
   * 수동 정산 생성 (테스트용)
   */
  static async createManualSettlement(data: CreateB2BSettlementData): Promise<string> {
    const now = new Date();
    const period: SettlementPeriod = {
      start: new Date(data.periodStart),
      end: new Date(data.periodEnd)
    };

    // 길러 등급 조회
    const gillerTier = await B2BGillerService.getB2BGillerTier(data.gillerId);
    const monthlyBonus = gillerTier ? TIER_MONTHLY_BONUSES[gillerTier.tier] : 0;

    const settlementData: Omit<B2BSettlement, 'id' | 'status' | 'createdAt'> = {
      gillerId: data.gillerId,
      period,
      b2bDeliveries: 0,
      deliveryEarnings: 0,
      monthlyBonus,
      totalSettlement: monthlyBonus,
      status: 'pending_payment' as B2BSettlementStatus
    };

    const docRef = await addDoc(collection(db, SETTLEMENT_COLLECTION), settlementData);
    return docRef.id;
  }

  /**
   * 정산 요약 생성
   */
  static createSummary(
    period: SettlementPeriod,
    settlements: B2BSettlement[]
  ): {
    period: SettlementPeriod;
    b2bDeliveries: number;
    deliveryEarnings: number;
    monthlyBonus: number;
    totalSettlement: number;
  } {
    const b2bDeliveries = settlements.reduce((sum, s) => sum + s.b2bDeliveries, 0);
    const deliveryEarnings = settlements.reduce((sum, s) => sum + s.deliveryEarnings, 0);
    const monthlyBonus = settlements.reduce((sum, s) => sum + s.monthlyBonus, 0);
    const totalSettlement = settlements.reduce((sum, s) => sum + s.totalSettlement, 0);

    return {
      period,
      b2bDeliveries,
      deliveryEarnings,
      monthlyBonus,
      totalSettlement
    };
  }

  /**
   * 정산 상태별 한글명 조회
   */
  static getSettlementStatusLabel(status: B2BSettlementStatus): string {
    const labels: Record<B2BSettlementStatus, string> = {
      pending_payment: '지급 대기',
      paid: '지급 완료',
      failed: '지급 실패'
    };
    return labels[status];
  }

  /**
   * 월간 총 정산 금액 (모든 길러 합계)
   */
  static async getTotalSettlementAmount(period: SettlementPeriod): Promise<number> {
    const q = query(
      collection(db, SETTLEMENT_COLLECTION)
    );

    const querySnapshot = await getDocs(q);
    let total = 0;

    querySnapshot.docs.forEach(doc => {
      const settlement = doc.data() as B2BSettlement;
      
      // 기간 필터링
      const periodStart = new Date(settlement.period.start);
      const periodEnd = new Date(settlement.period.end);
      const targetStart = new Date(period.start);
      const targetEnd = new Date(period.end);

      if (periodStart >= targetStart && periodStart <= targetEnd) {
        total += settlement.totalSettlement;
      }
    });

    return total;
  }

  /**
   * 정산 대기 목록 (지급 대기 중)
   */
  static async getPendingPaymentTotal(): Promise<number> {
    const pendingSettlements = await this.getPendingSettlements();
    return pendingSettlements.reduce((sum, s) => sum + s.totalSettlement, 0);
  }

  /**
   * 정산 재시도 (실패 시)
   */
  static async retrySettlement(settlementId: string, maxRetries: number = 3): Promise<{
    success: boolean;
    attempt: number;
    error?: string;
  }> {
    const settlement = await this.getSettlement(settlementId);
    if (!settlement) {
      return { success: false, attempt: 0, error: '정산을 찾을 수 없습니다' };
    }

    // 이미 성공한 정산은 재시도하지 않음
    if (settlement.status === 'paid') {
      return { success: true, attempt: 0, error: '이미 지급 완료된 정산입니다' };
    }

    // 계좌 정보 조회
    const transferInfo = await this.getGillerAccountInfo(settlement.gillerId);
    if (!transferInfo) {
      const error = '계좌 정보를 찾을 수 없습니다';
      await this.markAsFailed(settlementId, error);
      return { success: false, attempt: 0, error };
    }

    // 재시도 횟수 확인 (Firestore에 재시도 횟수 저장 필요)
    // 임시: 최대 3회까지 재시도
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`정산 재시도: ${settlementId}, 시도 ${attempt}/${maxRetries}`);

        // 이체 실행
        await this.executeTransfer(settlementId, settlement.totalSettlement, transferInfo);

        // 성공
        return { success: true, attempt };
      } catch (error) {
        console.error(`정산 재시도 실패 (시도 ${attempt}/${maxRetries}):`, error);

        // 마지막 시도 실패 시 실패 처리
        if (attempt === maxRetries) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          await this.markAsFailed(settlementId, `재시도 ${maxRetries}회 실패: ${errorMessage}`);
          await this.notifyTransferFailure(settlementId, errorMessage);
          return { success: false, attempt, error: errorMessage };
        }

        // 재시도 전 대기 (지수 백오프: 2초, 4초, 8초)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return { success: false, attempt: maxRetries, error: '최대 재시도 횟수 초과' };
  }

  /**
   * 정산 기간 계산 (다음 정산 일자)
   */
  static calculateNextSettlementDate(currentDate: Date = new Date()): Date {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(SETTLEMENT_CYCLE_DAYS);
    return nextMonth;
  }

  /**
   * 정산 통계 (관리자 대시보드용)
   */
  static async getSettlementStats(months: number = 6): Promise<{
    totalSettlements: number;
    totalAmount: number;
    averagePerSettlement: number;
    tierBreakdown: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const q = query(
      collection(db, SETTLEMENT_COLLECTION),
      where('createdAt', '>=', startDate)
    );

    const querySnapshot = await getDocs(q);
    const settlements = querySnapshot.docs.map(doc => doc.data() as B2BSettlement);

    const totalSettlements = settlements.length;
    const totalAmount = settlements.reduce((sum, s) => sum + s.totalSettlement, 0);
    const averagePerSettlement = totalSettlements > 0 ? Math.round(totalAmount / totalSettlements) : 0;

    // 등급별 분포
    const tierBreakdown: Record<string, number> = {
      silver: 0,
      gold: 0,
      platinum: 0
    };

    // 각 정산의 길러 등급 집계
    for (const s of settlements) {
      const gillerTier = await B2BGillerService.getB2BGillerTier(s.gillerId);
      if (gillerTier && gillerTier.tier in tierBreakdown) {
        tierBreakdown[gillerTier.tier]++;
      }
    }

    return {
      totalSettlements,
      totalAmount,
      averagePerSettlement,
      tierBreakdown
    };
  }

  /**
   * 정산 확인서 생성 (텍스트 기반, PDF는 선택 사항)
   */
  static async generateSettlementReport(settlementId: string): Promise<{
    success: boolean;
    reportUrl?: string;
    reportText?: string;
    error?: string;
  }> {
    const settlement = await this.getSettlement(settlementId);
    if (!settlement) {
      return { success: false, error: '정산을 찾을 수 없습니다' };
    }

    try {
      // 길러 정보 조회
      const gillerDoc = await getDoc(doc(db, 'users', settlement.gillerId));
      const giller = gillerDoc.data();

      // 길러 등급 조회
      const gillerTier = await B2BGillerService.getB2BGillerTier(settlement.gillerId);
      const tierName = gillerTier ? gillerTier.tier.toUpperCase() : 'N/A';

      // 정산 확인서 텍스트 생성
      const reportText = `
=================================================================
                    가는길에 B2B 정산 확인서
=================================================================

정산 ID: ${settlementId}
생성일자: ${new Date().toLocaleString('ko-KR')}

-----------------------------------------------------------------
[길러 정보]
-----------------------------------------------------------------
길러 ID: ${settlement.gillerId}
이름: ${giller?.name || 'N/A'}
등급: ${tierName}

-----------------------------------------------------------------
[정산 기간]
-----------------------------------------------------------------
시작일: ${new Date(settlement.period.start).toLocaleDateString('ko-KR')}
종료일: ${new Date(settlement.period.end).toLocaleDateString('ko-KR')}

-----------------------------------------------------------------
[정산 내역]
-----------------------------------------------------------------
B2B 배송 건수: ${settlement.b2bDeliveries}건
배송 수익: ${settlement.deliveryEarnings.toLocaleString('ko-KR')}원
월간 보너스: ${settlement.monthlyBonus.toLocaleString('ko-KR')}원
----------------------------------------
총 정산 금액: ${settlement.totalSettlement.toLocaleString('ko-KR')}원

-----------------------------------------------------------------
[지급 정보]
-----------------------------------------------------------------
상태: ${this.getSettlementStatusLabel(settlement.status)}
${settlement.status === 'paid' && settlement.transferInfo ? `
계좌번호: ${settlement.transferInfo.accountNumber}
은행: ${settlement.transferInfo.bank}
이체일자: ${new Date(settlement.transferInfo.transferredAt).toLocaleString('ko-KR')}
거래 ID: ${settlement.transferInfo.transactionId}
` : ''}

=================================================================
이 확인서는 가는길에 B2B 정산 시스템에 의해 자동 생성되었습니다.
문의: support@ganeungile.com
=================================================================
      `.trim();

      // TODO: PDF 라이브러리 (expo-pdf, react-native-html-to-pdf) 설치 시 PDF 생성
      // 현재는 텍스트를 반환하며, 향후 Firebase Storage에 PDF 업로드 가능

      return {
        success: true,
        reportText,
        reportUrl: `https://storage.googleapis.com/settlements/${settlementId}.txt` // 임시 URL
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      console.error('정산 확인서 생성 실패:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 정산 데이터 백업 (무결손 방지)
   */
  static async backupSettlementData(): Promise<void> {
    const snapshot = await getDocs(collection(db, SETTLEMENT_COLLECTION));
    console.log(`정산 데이터 백업: ${snapshot.size}건`);
    
    // TODO: Cloud Storage에 백업
  }

  /**
   * 이체 실패 알림 (관리자에게)
   */
  private static async notifyTransferFailure(settlementId: string, error: string): Promise<void> {
    // TODO: 이메일/슬랙 알림
    console.error(`이체 실패 알림: ${settlementId}, error: ${error}`);
  }
}
