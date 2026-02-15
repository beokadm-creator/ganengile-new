/**
 * Giller E2E Test
 * 길러 신규 사용자 플로우
 */

describe('Giller E2E: 신규 사용자 플로우', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('TC-E2E-GILLER-001: 길러 신규 사용자 전체 플로우', async () => {
    // 회원가입
    await element(by.id('email-input')).typeText('giller@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.text('회원가입')).tap();

    // 역할 선택
    await waitFor(element(by.id('role-selection')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('giller-role')).tap();

    // 온보딩 완료
    for (let i = 0; i < 4; i++) {
      await element(by.text('다음')).tap();
      await device.sleep(1000);
    }

    // 신원 확인
    await element(by.id('id-number')).typeText('910101-1234567');
    await element(by.id('bank-name')).typeText('국민은행');
    await element(by.id('account-number')).typeText('12345678901234567');
    await element(by.id('account-holder')).typeText('홍길동');
    await element(by.text('제출하기')).tap();

    // 배송 요청 목록
    await element(by.id('giller-requests')).tap();
    await waitFor(element(by.text('배송 요청 1')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('accept-delivery')).tap();

    // 픽업 완료
    await element(by.id('pickup-camera')).tap();
    await device.sleep(2000);
    await element(by.id('pickup-complete')).tap();

    // 배송 완료
    await element(by.id('delivery-complete')).tap();

    // 평가
    await expect(element(by.text('평가하기'))).toBeVisible();
    await element(by.id('rating-4')).tap();
    await element(by.id('rating-comment')).typeText('좋았어요!');
    await element(by.text('평가 완료')).tap();

    // 수익 정산
    await element(by.id('earnings')).tap();
    await expect(element(by.text('150,000원')).toBeVisible();
  });
});
