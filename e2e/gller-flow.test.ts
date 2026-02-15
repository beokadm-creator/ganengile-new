/**
 * Gller E2E Test
 * 글러 신규 사용자 플로우
 */

describe('Gller E2E: 신규 사용자 플로우', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('TC-E2E-GLLER-001: 글러 신규 사용자 전체 플로우', async () => {
    // 회원가입
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.text('회원가입')).tap();

    // 역할 선택
    await waitFor(element(by.id('role-selection')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('gller-role')).tap();

    // 온보딩 완료
    for (let i = 0; i < 3; i++) {
      await element(by.text('다음')).tap();
      await device.sleep(1000);
    }

    // 동선 등록
    await element(by.id('route-management')).tap();
    await element(by.id('add-route')).tap();

    await element(by.id('start-station')).tap();
    await element(by.text('서울역')).tap();
    await element(by.id('end-station')).tap();
    await element(by.text('강남역')).tap();
    await element(by.id('departure-time')).tap();
    await element(by.text('18:00')).tap();
    await element(by.id('monday')).tap();
    await element(by.id('tuesday')).tap();
    await element(by.id('wednesday')).tap();
    await element(by.id('thursday')).tap();
    await element(by.id('friday')).tap();
    await element(by.text('저장')).tap();

    // 배송 요청 생성
    await element(by.id('home')).tap();
    await element(by.id('create-request')).tap();
    await element(by.id('package-small')).tap();
    await element(by.text('요청하기')).tap();

    // 매칭 대기 (30초)
    await waitFor(element(by.text('매칭 중')))
      .toBeVisible()
      .withTimeout(35000);

    // 매칭 완료
    await expect(element(by.text('길러A'))).toBeVisible();
    await element(by.id('giller-profile')).tap();
    await expect(element(by.text('85점'))).toBeVisible();

    // 배송 완료
    await element(by.id('start-delivery')).tap();
    await element(by.id('complete-delivery')).tap();

    // 평가
    await expect(element(by.text('평가하기'))).toBeVisible();
    await element(by.id('rating-5')).tap();
    await element(by.id('rating-friendly')).tap();
    await element(by.id('rating-fast')).tap();
    await element(by.text('평가 완료')).tap();

    // 수익 확인
    await element(by.id('earnings')).tap();
    await expect(element(by.text('2,400원')).toBeVisible();
  });
});
