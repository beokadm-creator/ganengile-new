import * as admin from 'firebase-admin';
import { decrypt } from '../utils/crypto';

export interface FdsResult {
  isFraud: boolean;
  reason?: string;
  action: 'block' | 'flag' | 'pass';
}

/**
 * FDS (Fraud Detection System) Service
 * 포인트/쿠폰 현금화 목적의 어뷰징 탐지 및 차단 로직
 */
export class FdsService {
  
  /**
   * 매칭 단계 (사전) 검증: 
   * 요청자(gllerId)와 수행자(gillerId)가 동일 인물인지 확인하여 어뷰징(자전거래)을 차단합니다.
   */
  static async checkSelfMatching(requesterId: string, gillerId: string): Promise<FdsResult> {
    if (!requesterId || !gillerId) {
      return { isFraud: false, action: 'pass' };
    }

    if (requesterId === gillerId) {
      return { isFraud: true, reason: '본인 요청 배송건 자전거래 시도', action: 'block' };
    }

    const db = admin.firestore();
    const [requesterDoc, gillerDoc] = await Promise.all([
      db.collection('users').doc(requesterId).get(),
      db.collection('users').doc(gillerId).get()
    ]);

    if (!requesterDoc.exists || !gillerDoc.exists) {
      return { isFraud: false, action: 'pass' };
    }

    const requester = requesterDoc.data();
    const giller = gillerDoc.data();

    // 1. 전화번호 비교
    if (requester?.phoneNumber && giller?.phoneNumber && requester.phoneNumber === giller.phoneNumber) {
      return { isFraud: true, reason: '동일 전화번호 계정 간 매칭 시도', action: 'block' };
    }

    // 2. 본인인증 CI (Connected Information) 비교 (PASS 인증 시 저장됨)
    const reqCi = requester?.phoneVerification?.ci;
    const gilCi = giller?.phoneVerification?.ci;
    if (reqCi && gilCi && reqCi === gilCi) {
      return { isFraud: true, reason: '동일 명의(CI) 다중 계정 간 자전거래 시도', action: 'block' };
    }

    // 3. 세무 정보 (주민등록번호, 계좌) 비교
    const reqBank = requester?.taxInfo?.bankAccountNumber;
    const gilBank = giller?.taxInfo?.bankAccountNumber;
    if (reqBank && gilBank && reqBank === gilBank) {
      // 가족 계좌일 수 있으므로 차단 대신 플래깅(flag) 처리하여 출금 시 관리자 검토를 유도할 수 있음. 
      // 여기서는 엄격하게 block 처리.
      return { isFraud: true, reason: '동일 출금계좌 간 매칭 시도 (자전거래 의심)', action: 'block' };
    }

    const reqRrnEnc = requester?.taxInfo?.residentNumberEncrypted;
    const gilRrnEnc = giller?.taxInfo?.residentNumberEncrypted;
    if (reqRrnEnc && gilRrnEnc) {
      try {
        const reqRrn = decrypt(reqRrnEnc);
        const gilRrn = decrypt(gilRrnEnc);
        if (reqRrn === gilRrn) {
          return { isFraud: true, reason: '동일 주민등록번호 계정 간 자전거래 시도', action: 'block' };
        }
      } catch (e) {
        // 복호화 에러는 FDS 통과시킴 (레거시/오염 데이터로 인한 정상 거래 차단 방지)
      }
    }

    return { isFraud: false, action: 'pass' };
  }

  /**
   * 결제/정산 단계 (사후) 검증: 
   * 다중 계정 쿠폰깡, 비정상적 포인트 사용 패턴 등을 탐지합니다.
   * (현재는 스텁 형태로 제공, 필요시 확장)
   */
  static async checkPaymentFraud(userId: string, amount: number, couponId?: string | null): Promise<FdsResult> {
    // 1. 쿠폰 단기간 대량 사용 패턴 체크 (예: 동일 기기 IP)
    // 2. 비정상적으로 높은 결제 금액
    if (amount > 1000000) {
      return { isFraud: true, reason: '비정상적 고액 결제/정산 (어뷰징 의심)', action: 'flag' };
    }

    return { isFraud: false, action: 'pass' };
  }
}
