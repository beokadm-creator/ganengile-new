/**
 * B2B E2E Test
 * B2B 기업 고객 플로우
 */

describe('B2B E2E: 신규 기업 고객 플로우', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('TC-E2E-B2B-001: B2B 신규 기업 고객 플로우', async () => {
    // 회원가입
    await element(by.id('email-input')).typeText('company@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.text('회원가입')).tap();

    // B2B 진입
    await element(by.id('b2b-service')).tap();

    // 사업자등록
    await element(by.id('registration-number')).typeText('000-00-00000');
    await element(by.text('인증하기')).tap();

    // 대시보드 진입
    await expect(element(by.text('대시보드'))).toBeVisible();

    // 배송 요청 생성
    await element(by.id('b2b-request')).tap();
    await element(by.id('start-station')).tap();
    await element(by.text('서울역')).tap();
    await element(by.id('end-station')).tap();
    await element(by.text('강남역')).tap();
    await element(by.id('immediate-delivery')).tap();
    await element(by.id('package-medium')).tap();
    await element(by.text('요청하기')).tap();

    // 매칭 완료 (1분 대기)
    await waitFor(element(by.text('길러 매칭 완료')))
      .toBeVisible()
      .withTimeout(60000);
    await element(by.id('giller-profile')).tap();

    // 배송 완료
    await element(by.id('start-delivery')).tap();
    await element(by.id('complete-delivery')).tap();

    // 정산서 확인
    await element(by.id('settlements')).tap();
    await expect(element(by.text('500,000원')).toBeVisible();

    // 세금 처리
    await element(by.id('tax-processing')).tap();
    await expect(element(by.text('50,000원')).toBeVisible();
  });
});
