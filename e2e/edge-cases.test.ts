/**
 * Edge Case E2E Tests
 * 매칭 실패, 배송 취소, 네트워크 에러 등
 */

describe('Edge Case E2E: 실패 및 예외 시나리오', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('TC-E2E-EDGE-001: 매칭 가능한 길러 없음', async () => {
    // Given: 모든 길러 비활성 상태로 배송 요청 생성
    await element(by.id('create-request')).tap();
    await element(by.id('package-small')).tap();
    await element(by.text('요청하기')).tap();

    // When: 30초 대기 (실제로는 타임아웃 설정)
    await waitFor(element(by.text('매칭 실패')))
      .toBeVisible()
      .withTimeout(35000);

    // Then: 실패 알림 확인
    await expect(element(by.text('죄송합니다. 현재 매칭 가능한 길러가 없습니다.'))).toBeVisible();
    await element(by.id('home-button')).tap();

    // Verify: 요청 상태가 "failed"로 변경됨
    await element(by.id('request-history')).tap();
    await expect(element(by.text('실패'))).toBeVisible();
  });

  it('TC-E2E-EDGE-002: 매칭 전 배송 취소', async () => {
    // Given: 배송 요청 생성 및 매칭 완료
    await element(by.id('create-request')).tap();
    await element(by.id('package-small')).tap();
    await element(by.text('요청하기')).tap();
    await waitFor(element(by.text('매칭 완료'))).toBeVisible().withTimeout(10000);
    await element(by.id('giller-profile')).tap();
    await element(by.text('배송 시작')).tap();

    // When: 요청 취소 버튼 탭
    await element(by.id('cancel-request')).tap();
    await element(by.text('일정 변경')).tap();
    await element(by.text('취소하기')).tap();

    // Then: 요청 상태가 "cancelled"로 변경됨
    await element(by.id('request-history')).tap();
    await expect(element(by.text('취소됨'))).toBeVisible();
  });

  it('TC-E2E-EDGE-003: 배송 진행 중 취소', async () => {
    // Given: 배송이 진행 중
    await element(by.id('create-request')).tap();
    await element(by.id('package-small')).tap();
    await element(by.text('요청하기')).tap();
    await waitFor(element(by.text('매칭 완료'))).toBeVisible().withTimeout(10000);
    await element(by.id('giller-profile')).tap();
    await element(by.text('배송 시작')).tap();
    await element(by.id('pickup-complete')).tap();

    // When: 배송 추적 화면에서 취소 버튼 탭
    await element(by.id('cancel-in-progress')).tap();
    await element(by.text('예')).tap();

    // Then: 배송 상태가 "cancelled"로 변경되고 페널티 적용됨
    await element(by.id('penalty-check')).tap();
    await expect(element(by.text('-10점')).toBeVisible();
  });

  it('TC-E2E-EDGE-005: 오프라인 상태에서 요청', async () => {
    // Given: 기기를 오프라인 모드로 설정 (비행기 모드)
    await device.setNetwork('airplane');

    // When: 배송 요청 시도
    await element(by.id('create-request')).tap();
    await element(by.id('package-small')).tap();
    await element(by.id('start-station')).tap();
    await element(by.id('end-station')).tap();
    await element(by.text('요청하기')).tap();

    // Then: 에러 알림 표시됨
    await expect(element(by.text('네트워크 연결을 확인해주세요'))).toBeVisible();
    await expect(element(by.id('retry-button'))).toBeVisible();
  });

  it('TC-E2E-EDGE-006: 네트워크 연결 끊김', async () => {
    // Given: 배송 요청 화면으로 이동
    await element(by.id('create-request')).tap();

    // When: Wi-Fi 끄기
    await device.toggleNetwork('wifi');

    // Then: 네트워크 끊김 토스트 메시지 표시됨
    await expect(element(by.text('네트워크 연결이 끊겼습니다. 다시 시도해주세요.'))).toBeVisible();
  });

  it('TC-E2E-EDGE-009: 필수 필드 누락', async () => {
    // Given: 배송 요청 화면으로 이동
    await element(by.id('create-request')).tap();

    // When: 출발역, 도착역 선택 없이 "요청하기" 탭
    await element(by.text('요청하기')).tap();

    // Then: 에러 메시지 표시됨
    await expect(element(by.text('출발역을 선택해주세요'))).toBeVisible();
    await expect(element(by.text('도착역을 선택해주세요'))).toBeVisible();
    await expect(element(by.id('submit-button-disabled'))).toBeVisible();
  });

  it('TC-E2E-EDGE-010: 잘못된 데이터 타입', async () => {
    // Given: 신분증 입력 화면으로 이동
    await element(by.id('onboarding-identity')).tap();

    // When: 잘못된 형식의 사업자등록번호 입력 (123-456)
    await element(by.id('id-number')).typeText('123-456');
    await element(by.text('제출하기')).tap();

    // Then: 에러 메시지 표시됨
    await expect(element(by.text('사업자등록번호 형식이 올바르지 않습니다.'))).toBeVisible();
    await expect(element(by.id('format-guide')).toBeVisible();
    await expect(element(by.id('submit-button-disabled'))).toBeVisible();
  });
});
