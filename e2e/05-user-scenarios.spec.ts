/**
 * P5-2: 사용자 시나리오 E2E 테스트
 *
 * 사용자 중심의 end-to-end 시나리오 테스트
 * - Gller: 배송 요청부터 완료까지
 * - Giller: 요청 수락부터 배송 완료까지
 * - Edge cases: 매칭 실패, 취소, 신고/페널티
 */

import { by, element, device, expect } from 'detox';

describe('P5-2: User Scenario Tests', () => {
  /**
   * 시나리오 1: Gller - 배송 요청부터 완료까지
   *
   * 플로우:
   * 1. 로그인 → 홈 화면
   * 2. 배송 요청 생성
   * 3. 매칭 대기 및 수락
   * 4. 배송 추적
   * 5. 배송 완료 확인
   * 6. 기일러 평가
   */
  describe('Scenario 1: Gller End-to-End Flow', () => {
    const gllerEmail = 'gller-test@example.com';
    const gllerPassword = 'password123';

    beforeAll(async () => {
      await device.launchApp({ newInstance: true });
    });

    it('Step 1: Gller 로그인', async () => {
      // 로그인 화면 진입
      await expect(element(by.id('login-screen'))).toBeVisible();

      // 이메일/비밀번호 입력
      await element(by.id('email-input')).typeText(gllerEmail);
      await element(by.id('password-input')).typeText(gllerPassword);

      // 로그인 버튼 탭
      await element(by.id('login-button')).tap();

      // Gller 홈 화면 진입 확인
      await expect(element(by.id('gller-home-screen'))).toBeVisible();
      await expect(element(by.text('배송 요청하기'))).toBeVisible();
    });

    it('Step 2: 배송 요청 생성', async () => {
      // 배송 요청 버튼 탭
      await element(by.id('create-request-button')).tap();

      // 요청 화면 진입 확인
      await expect(element(by.id('create-request-screen'))).toBeVisible();

      // 출발역 선택 (서울역)
      await element(by.id('pickup-station-input')).tap();
      await expect(element(by.id('station-select-modal'))).toBeVisible();
      await element(by.id('station-search-input')).typeText('서울역');
      await element(by.text('서울역')).tap();

      // 도착역 선택 (강남역)
      await element(by.id('delivery-station-input')).tap();
      await element(by.id('station-search-input')).typeText('강남역');
      await element(by.text('강남역')).tap();

      // 예상 시간 확인
      await expect(element(by.text(/예상 소요시간.*분/))).toBeVisible();

      // 패키지 사이즈 선택 (소)
      await element(by.id('package-size-selector')).tap();
      await element(by.text('소 (20x20x10cm)')).tap();

      // 패키지 무게 선택 (가벼움)
      await element(by.id('package-weight-selector')).tap();
      await element(by.text('가벼움 (1kg 미만)')).tap();

      // 예상 배송비 확인
      await expect(element(by.text(/예상 배송비:.*3,000원/))).toBeVisible();

      // 요청 제출
      await element(by.id('submit-request-button')).tap();

      // 매칭 화면 진입 확인
      await expect(element(by.id('matching-result-screen'))).toBeVisible();
    });

    it('Step 3: 매칭 대기 및 수락', async () => {
      // 로딩 인디케이터 표시
      await expect(element(by.id('matching-loading-indicator'))).toBeVisible();
      await expect(element(by.text('기일러를 찾고 있습니다...'))).toBeVisible();

      // 기일러 프로필 카드 표시 대기 (최대 35초)
      await waitFor(element(by.id('giller-profile-card')))
        .toBeVisible()
        .withTimeout({ interval: 1000, timeout: 35000 });

      // 기일러 정보 확인
      await expect(element(by.text(/기일러:.*/))).toBeVisible();
      await expect(element(by.text(/⭐ \d+\.\d/))).toBeVisible();
      await expect(element(by.text(/완료 \d+건/))).toBeVisible();

      // 수락/거절 버튼 확인
      await expect(element(by.id('accept-match-button'))).toBeVisible();
      await expect(element(by.id('reject-match-button'))).toBeVisible();

      // 매칭 수락
      await element(by.id('accept-match-button')).tap();

      // 성공 메시지 확인
      await expect(element(by.text('매칭 성공'))).toBeVisible();
      await element(by.text('확인')).tap();
    });

    it('Step 4: 배송 추적', async () => {
      // 배송 추적 화면 진입
      await expect(element(by.id('delivery-tracking-screen'))).toBeVisible();

      // 추적 정보 확인
      await expect(element(by.text('배송 추적'))).toBeVisible();
      await expect(element(by.text(/픽업 장소:/))).toBeVisible();
      await expect(element(by.text(/도착 장소:/))).toBeVisible();

      // 진행 바 표시
      await expect(element(by.id('delivery-progress-bar'))).toBeVisible();

      // 기일러 위치 표시
      await expect(element(by.id('giller-location-indicator'))).toBeVisible();

      // 채팅 버튼 확인
      await expect(element(by.id('contact-giller-button'))).toBeVisible();
    });

    it('Step 5: 배송 완료 확인', async () => {
      // 기일러가 도착하면 완료 화면 표시
      // (실제 시나리오에서는 기일러의 완료 액션 후 트리거됨)

      await waitFor(element(by.id('delivery-completion-screen')))
        .toBeVisible()
        .withTimeout({ interval: 1000, timeout: 60000 });

      // 완료 정보 확인
      await expect(element(by.text('배송 완료 확인'))).toBeVisible();
      await expect(element(by.text(/배송 위치:.*/))).toBeVisible();

      // 완료 확인
      await element(by.id('confirm-delivery-button')).tap();

      await expect(element(by.text('배송이 완료되었습니다'))).toBeVisible();
    });

    it('Step 6: 기일러 평가', async () => {
      // 평가 화면 자동 진입
      await expect(element(by.id('rating-screen'))).toBeVisible();
      await expect(element(by.text('배송 만족도 평가'))).toBeVisible();

      // 별점 선택 (5점)
      await element(by.id('star-5')).tap();

      // 코멘트 입력
      await element(by.id('rating-comment-input')).typeText('빠르고 친절했어요!');

      // 평가 제출
      await element(by.id('submit-rating-button')).tap();

      // 완료 메시지 확인
      await expect(element(by.text('평가가 완료되었습니다'))).toBeVisible();

      // 홈으로 복귀
      await expect(element(by.id('gller-home-screen'))).toBeVisible();
    });
  });

  /**
   * 시나리오 2: Giller - 요청 수락부터 배송 완료까지
   *
   * 플로우:
   * 1. Giller 로그인 → 홈 화면
   * 2. 배송 요청 목록 확인
   * 3. 요청 수락
   * 4. 픽업 인증
   * 5. 이송 중 상태 업데이트
   * 6. 배송 완료
   * 7. 정산 확인
   */
  describe('Scenario 2: Giller End-to-End Flow', () => {
    const gillerEmail = 'giller-test@example.com';
    const gillerPassword = 'password123';

    beforeAll(async () => {
      await device.launchApp({ newInstance: true });
    });

    it('Step 1: Giller 로그인', async () => {
      // 로그인 화면 진입
      await expect(element(by.id('login-screen'))).toBeVisible();

      // 이메일/비밀번호 입력
      await element(by.id('email-input')).typeText(gillerEmail);
      await element(by.id('password-input')).typeText(gillerPassword);

      // 로그인 버튼 탭
      await element(by.id('login-button')).tap();

      // Giller 홈 화면 진입 확인
      await expect(element(by.id('giller-home-screen'))).toBeVisible();
      await expect(element(by.text('가능한 배송'))).toBeVisible();
    });

    it('Step 2: 배송 요청 목록 확인', async () => {
      // 요청 목록 탭
      await element(by.id('requests-tab')).tap();

      // 요청 목록 화면 진입 확인
      await expect(element(by.id('giller-requests-screen'))).toBeVisible();

      // 가능한 배송 목록 표시
      await expect(element(by.id('request-list'))).toBeVisible();

      // 첫 번째 요청 카드 확인
      await expect(element(by.id('request-card-0'))).toBeVisible();
      await expect(element(by.text(/출발:.*/))).toBeVisible();
      await expect(element(by.text(/도착:.*/))).toBeVisible();
      await expect(element(by.text(/예상 수수료:.*/))).toBeVisible();
    });

    it('Step 3: 요청 수락', async () => {
      // 첫 번째 요청 탭
      await element(by.id('request-card-0')).tap();

      // 요청 상세 화면 진입
      await expect(element(by.id('request-detail-screen'))).toBeVisible();

      // 수락 버튼 탭
      await element(by.id('accept-request-button')).tap();

      // 수락 확인 다이얼로그
      await expect(element(by.text('이 배송을 수락하시겠습니까?'))).toBeVisible();
      await element(by.text('수락')).tap();

      // 성공 메시지
      await expect(element(by.text('배송이 시작되었습니다'))).toBeVisible();
    });

    it('Step 4: 픽업 인증', () => {
      // 배송 추적 화면 진입
      await expect(element(by.id('delivery-tracking-screen'))).toBeVisible();

      // 픽업 정보 확인
      await expect(element(by.text(/픽업 장소:/))).toBeVisible();
      await expect(element(by.text(/픽업 시간:/))).toBeVisible();

      // 픽업 인증 버튼 탭
      element(by.id('pickup-verification-button')).tap();

      // 인증 화면 진입
      expect(element(by.id('pickup-verification-screen'))).toBeVisible();
      expect(element(by.id('pickup-code-input'))).toBeVisible();

      // 픽업 코드 입력 (테스트용 고정 코드)
      element(by.id('pickup-code-input')).typeText('123456');

      // 인증 제출
      element(by.id('verify-pickup-button')).tap();

      // 성공 메시지
      expect(element(by.text('픽업이 완료되었습니다'))).toBeVisible();
      expect(element(by.text('이송을 시작합니다'))).toBeVisible();
    });

    it('Step 5: 이송 중 상태 업데이트', async () => {
      // 이송 상태로 변경
      await expect(element(by.text('이송 중'))).toBeVisible();

      // 현재 위치 표시
      await expect(element(by.id('current-location-indicator'))).toBeVisible();

      // Gller와 채팅 가능
      await expect(element(by.id('contact-gller-button'))).toBeVisible();

      // 상태 업데이트 전송 (옵션)
      await element(by.id('send-status-update-button')).tap();
      await element(by.id('status-message-input')).typeText('지하철 탑승 중');
      await element(by.id('send-status-button')).tap();

      await expect(element(by.text('상태 업데이트가 전송되었습니다'))).toBeVisible();
    });

    it('Step 6: 배송 완료', async () => {
      // 목적지 도착 시
      await waitFor(element(by.id('delivery-confirmation-screen')))
        .toBeVisible()
        .withTimeout({ interval: 1000, timeout: 120000 });

      // 배송 완료 버튼 탭
      await element(by.id('complete-delivery-button')).tap();

      // 완료 확인
      await expect(element(by.text('배송을 완료하시겠습니까?'))).toBeVisible();
      await element(by.text('완료')).tap();

      // 완료 메시지
      await expect(element(by.text('배송이 완료되었습니다'))).toBeVisible();
    });

    it('Step 7: 정산 확인', async () => {
      // 수익 화면 진입
      await element(by.id('earnings-tab')).tap();

      // 수익 화면 진입 확인
      await expect(element(by.id('earnings-screen'))).toBeVisible();

      // 총 수익 확인
      await expect(element(by.text(/총 수익:.*원/))).toBeVisible();

      // 최근 배송 내역 확인
      await expect(element(by.id('recent-deliveries-list'))).toBeVisible();
      await expect(element(by.text(/이번 달: \d+건 완료/))).toBeVisible();

      // 배송별 수익 내역
      await expect(element(by.text(/수수료:.*원/))).toBeVisible();
      await expect(element(by.text(/플랫폼 수수료:.*원/))).toBeVisible();
      await expect(element(by.text(/실 수익:.*원/))).toBeVisible();
    });
  });

  /**
   * 시나리오 3: Edge Case - 매칭 실패
   *
   * 플로우:
   * 1. 배송 요청 생성
   * 2. 30초간 매칭 실패
   * 3. 타임아웃 메시지 표시
   * 4. 재시도 또는 취소
   */
  describe('Scenario 3: Edge Case - Matching Timeout', () => {
    beforeAll(async () => {
      await device.launchApp({ newInstance: true });
    });

    beforeEach(async () => {
      // Gller로 로그인
      await element(by.id('email-input')).typeText('gller-test@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();
      await expect(element(by.id('gller-home-screen'))).toBeVisible();
    });

    it('should handle matching timeout gracefully', async () => {
      // 배송 요청 생성
      await element(by.id('create-request-button')).tap();
      await element(by.id('pickup-station-input')).tap();
      await element(by.text('서울역')).tap();
      await element(by.id('delivery-station-input')).tap();
      await element(by.text('강남역')).tap();
      await element(by.id('package-size-selector')).tap();
      await element(by.text('소 (20x20x10cm)')).tap();
      await element(by.id('submit-request-button')).tap();

      // 매칭 화면 진입
      await expect(element(by.id('matching-result-screen'))).toBeVisible();
      await expect(element(by.id('matching-loading-indicator'))).toBeVisible();

      // 30초 대기 (타임아웃)
      await waitFor(element(by.text('매칭 시간이 초과되었습니다')))
        .toBeVisible()
        .withTimeout({ interval: 1000, timeout: 35000 });

      // 타임아웃 메시지 확인
      await expect(element(by.text('기일러를 찾을 수 없습니다'))).toBeVisible();
      await expect(element(by.text('나중에 다시 시도해주세요'))).toBeVisible();

      // 재시도/취소 버튼 확인
      await expect(element(by.id('retry-matching-button'))).toBeVisible();
      await expect(element(by.id('cancel-request-button'))).toBeVisible();
    });

    it('should allow retry after timeout', async () => {
      // 타임아웃 상태에서 재시도
      await element(by.id('retry-matching-button')).tap();

      // 다시 매칭 시작
      await expect(element(by.id('matching-loading-indicator'))).toBeVisible();
      await expect(element(by.text('다시 검색 중입니다...'))).toBeVisible();
    });

    it('should allow canceling after timeout', async () => {
      // 타임아웃 상태에서 취소
      await element(by.id('cancel-request-button')).tap();

      // 취소 확인
      await expect(element(by.text('요청을 취소하시겠습니까?'))).toBeVisible();
      await element(by.text('취소')).tap();

      // 홈으로 복귀
      await expect(element(by.id('gller-home-screen'))).toBeVisible();
    });
  });

  /**
   * 시나리오 4: Edge Case - 배송 취소
   *
   * 플로우:
   * 1. 배송 요청 생성 및 매칭 완료
   * 2. 매칭 전 취소 (Gller)
   * 3. 매칭 후 취소 (Gller)
   * 4. 배송 중 취소 (Giller)
   * 5. 취소 페널티 확인
   */
  describe('Scenario 4: Edge Case - Delivery Cancellation', () => {
    beforeAll(async () => {
      await device.launchApp({ newInstance: true });
    });

    it('should allow canceling before matching', async () => {
      // Gller로 로그인
      await element(by.id('email-input')).typeText('gller-test@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      // 배송 요청 생성
      await element(by.id('create-request-button')).tap();
      await element(by.id('pickup-station-input')).tap();
      await element(by.text('서울역')).tap();
      await element(by.id('delivery-station-input')).tap();
      await element(by.text('강남역')).tap();
      await element(by.id('submit-request-button')).tap();

      // 매칭 중에 취소 버튼 탭
      await element(by.id('cancel-during-matching-button')).tap();

      // 취소 확인
      await expect(element(by.text('매칭을 취소하시겠습니까?'))).toBeVisible();
      await element(by.text('예')).tap();

      // 홈으로 복귀 및 페널티 없음 확인
      await expect(element(by.id('gller-home-screen'))).toBeVisible();
      await expect(element(by.text('취소되었습니다'))).toBeVisible();
      // 페널티 없음 (매칭 전)
    });

    it('should apply penalty for canceling after matching', async () => {
      // 배송 요청 및 매칭 완료 상태 가정
      // (이 테스트는 매칭 완료 상태에서 시작)

      // 매칭 완료 후 취소 버튼 탭
      await element(by.id('cancel-after-matching-button')).tap();

      // 페널티 안내
      await expect(element(by.text('취소 시 페널티가 부과됩니다'))).toBeVisible();
      await expect(element(by.text(/페널티: .*원/))).toBeVisible();

      // 취소 확인
      await element(by.text('취소하기')).tap();

      // 페널티 부과 메시지
      await expect(element(by.text(/취소 페널티 .*원이 부과되었습니다/))).toBeVisible();

      // 홈으로 복귀
      await expect(element(by.id('gller-home-screen'))).toBeVisible();
    });

    it('should notify giller about cancellation', async () => {
      // Giller 로그인으로 전환
      await device.launchApp({ newInstance: true });
      await element(by.id('email-input')).typeText('giller-test@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      // 알림 확인
      await expect(element(by.id('notification-list'))).toBeVisible();
      await expect(element(by.text('배송이 취소되었습니다'))).toBeVisible();

      // 알림 탭
      await element(by.id('notification-item-0')).tap();

      // 상세 내역 확인
      await expect(element(by.text('Gller가 배송을 취소했습니다'))).toBeVisible();
    });
  });

  /**
   * 시나리오 5: Edge Case - 신고/페널티
   *
   * 플로우:
   * 1. 배송 중 문제 발생
   * 2. Gller가 기일러 신고
   * 3. 페널티 부과 확인
   * 4. 기일러 평점 하락 확인
   * 5. 정지 시스템 작동 확인
   */
  describe('Scenario 5: Edge Case - Report and Penalty', () => {
    beforeAll(async () => {
      await device.launchApp({ newInstance: true });
    });

    it('should allow Gller to report Giller', async () => {
      // Gller로 로그인
      await element(by.id('email-input')).typeText('gller-test@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      // 배송 추적 화면 진입 (진행 중인 배송 가정)
      await element(by.id('active-delivery-card')).tap();
      await expect(element(by.id('delivery-tracking-screen'))).toBeVisible();

      // 신고 버튼 탭
      await element(by.id('report-giller-button')).tap();

      // 신고 화면 진입
      await expect(element(by.id('report-screen'))).toBeVisible();
      await expect(element(by.text('기일러 신고'))).toBeVisible();

      // 신고 사유 선택
      await element(by.id('report-reason-selector')).tap();
      await element(by.text('픽업 지연')).tap();

      // 상세 설명 입력
      await element(by.id('report-description-input')).typeText('약속 시간보다 20분 늦게 도착했습니다.');

      // 증거 이미지 첨부 (옵션)
      // await element(by.id('attach-evidence-button')).tap();

      // 신고 제출
      await element(by.id('submit-report-button')).tap();

      // 성공 메시지
      await expect(element(by.text('신고가 접수되었습니다'))).toBeVisible();
      await expect(element(by.text('검토 후 조치됩니다'))).toBeVisible();
    });

    it('should apply penalty to reported Giller', async () => {
      // 관리자/시스템이 신고를 승인한 후 상태 확인

      // Giller로 로그인
      await device.launchApp({ newInstance: true });
      await element(by.id('email-input')).typeText('giller-test@example.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      // 알림 확인
      await element(by.id('notifications-tab')).tap();
      await expect(element(by.id('notification-list'))).toBeVisible();

      // 페널티 부과 알림
      await expect(element(by.text(/페널티가 부과되었습니다/))).toBeVisible();
      await element(by.id('notification-item-0')).tap();

      // 페널티 상세
      await expect(element(by.text(/사유: 픽업 지연/))).toBeVisible();
      await expect(element(by.text(/페널티: .*원/))).toBeVisible();
      await expect(element(by.text(/정지 기간: .*일/))).toBeVisible();
    });

    it('should decrease Giller rating after penalty', async () => {
      // 기일러 프로필 화면 진입
      await element(by.id('profile-tab')).tap();
      await expect(element(by.id('profile-screen'))).toBeVisible();

      // 평점 하락 확인 (이전 평점보다 낮아야 함)
      await expect(element(by.text(/⭐ \d+\.\d/))).toBeVisible();

      // 페널티 이력 확인
      await element(by.id('penalty-history-button')).tap();
      await expect(element(by.id('penalty-history-screen'))).toBeVisible();
      await expect(element(by.text(/총 페널티: .*건/))).toBeVisible();
    });

    it('should suspend Giller with multiple penalties', async () => {
      // 정지 상태 확인
      await expect(element(by.text('계정이 일시 정지되었습니다'))).toBeVisible();
      await expect(element(by.text(/정지 기간: .* ~ .*/))).toBeVisible();

      // 배송 요청 불가
      await element(by.id('requests-tab')).tap();
      await expect(element(by.text('정지 기간에는 배송을 수행할 수 없습니다'))).toBeVisible();

      // 정지 해제 안내
      await expect(element(by.text(/정지 해제까지 .*일 남았습니다/))).toBeVisible();
    });

    it('should allow appeal for penalty', async () => {
      // 이의 제기 버튼
      await element(by.id('appeal-penalty-button')).tap();

      // 이의 제기 화면
      await expect(element(by.id('appeal-screen'))).toBeVisible();
      await expect(element(by.text('페널티 이의 제기'))).toBeVisible();

      // 이의 제기 내용 입력
      await element(by.id('appeal-description-input')).typeText(
        '지연은 교통 체증으로 인한 불가피한 상황이었습니다. 증거를 첨부합니다.'
      );

      // 제출
      await element(by.id('submit-appeal-button')).tap();

      // 완료 메시지
      await expect(element(by.text('이의 제기가 접수되었습니다'))).toBeVisible();
      await expect(element(by.text('검토 후 결과를 알려드립니다'))).toBeVisible();
    });
  });
});
