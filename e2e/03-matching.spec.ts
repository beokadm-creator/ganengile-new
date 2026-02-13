/**
 * Matching E2E Tests
 * Request creation, Finding gillers, Accepting matches
 */

import { by, element } from 'detox';

describe('Matching Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
    // Login as gller (requester)
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
    await element(by.id('gller-home-tab')).tap();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  describe('Create Request', () => {
    it('should display create request screen', async () => {
      await element(by.id('create-request-button')).tap();

      await expect(element(by.id('create-request-screen'))).toBeVisible();
      await expect(element(by.id('pickup-station-input'))).toBeVisible();
      await expect(element(by.id('delivery-station-input'))).toBeVisible();
      await expect(element(by.id('package-size-selector'))).toBeVisible();
      await expect(element(by.id('package-weight-selector'))().toBeVisible();
    });

    it('should validate required fields', async () => {
      // Try to submit without entering stations
      await element(by.id('submit-request-button')).tap();

      await expect(element(by.text('출발역을 선택해주세요'))).toBeVisible();
    });

    it('should select pickup and delivery stations', async () => {
      // Select pickup station
      await element(by.id('pickup-station-input')).tap();
      await element(by.text('서울역')).tap();

      // Select delivery station
      await element(by.id('delivery-station-input')).tap();
      await element(by.text('강남역')).tap();

      // Verify route display
      await expect(element(by.text('예상 소요시간: 18분'))).toBeVisible();
    });

    it('should select package size and weight', async () => {
      // Select package size
      await element(by.id('package-size-selector')).tap();
      await element(by.text('중 (30x30x20cm)')).tap();

      // Select package weight
      await element(by.id('package-weight-selector')).tap();
      await element(by.text('가벼움 (1kg 미만)')).tap();

      // Verify fee calculation
      await expect(element(by.text(/예상 배송비:.*원/)).toBeVisible();
    });

    it('should submit request successfully', async () => {
      // Fill in all required fields
      await element(by.id('pickup-station-input')).tap();
      await element(by.text('서울역')).tap();

      await element(by.id('delivery-station-input')).tap();
      await element(by.text('강남역')).tap();

      await element(by.id('package-size-selector')).tap();
      await element(by.text('소 (20x20x10cm)')).tap();

      await element(by.id('package-weight-selector')).tap();
      await element(by.text('가벼움 (1kg 미만)')).tap();

      // Submit request
      await element(by.id('submit-request-button')).tap();

      // Wait for matching screen
      await expect(element(by.id('matching-result-screen'))).toBeVisible();
      await expect(element(by.text('기일러를 찾고 있습니다...'))).toBeVisible();
    });
  });

  describe('Matching Process', () => {
    it('should display loading state during matching', async () => {
      await expect(element(by.id('loading-indicator')).().toVisible();

      // Wait for match (max 30 seconds)
      await waitFor(element(by.id('giller-profile-card')))
        .toBeVisible()
        .withTimeout({ interval: 1000, timeout: 35000 });
    });

    it('should timeout if no giller found', async () => {
      // This test simulates no gillers available
      // In real scenario, would show error after 30 seconds

      await expect(element(by.text('매칭 시간이 초과되었습니다'))).toBeVisible();
      await expect(element(by.id('retry-button'))).toBeVisible();
      await expect(element(by.id('cancel-button')).toBeVisible();
    });

    it('should display giller profile when matched', async () => {
      // Simulate successful matching (using mock data)
      await expect(element(by.id('giller-profile-card')).toBeVisible();
      await expect(element(by.text('홍길동'))).toBeVisible(); // Mocked giller name
      await expect(element(by.text('⭐ 4.5'))).toBeVisible(); // Rating
      await expect(element(by.text('완료 150건')).toBeVisible(); // Completed deliveries
    });

    it('should display estimated time and fee', async () => {
      await expect(element(by.text('예상 소요시간 18분')).toBeVisible();
      await expect(element(by.text('수수료 3,500원')).toBeVisible();
    });
  });

  describe('Match Acceptance', () => {
    it('should display accept and reject buttons', async () => {
      await expect(element(by.id('accept-button'))).toBeVisible();
      await expect(element(by.id('reject-button'))).toBeVisible();
    });

    it('should accept match successfully', async () => {
      await element(by.id('accept-button')).tap();

      // Wait for success alert
      await expect(element(by.text('매칭 성공'))).toBeVisible();
      await expect(element(by.text('기일러와 매칭되었습니다. 배송을 시작합니다.'))).toBeVisible();
    });

    it('should navigate to delivery tracking', async () => {
      await element(by.text('확인')).tap();

      await expect(element(by.id('delivery-tracking-screen'))).toBeVisible();
      await expect(element(by.text('배송 추적'))).toBeVisible();
    });

    it('should handle match rejection', async () => {
      // Go back and create new request
      await device.launchApp();
      await element(by.id('create-request-button')).tap();

      // Fill form
      await element(by.id('pickup-station-input')).tap();
      await element(by.text('서울역')).tap();
      await element(by.id('delivery-station-input')).tap();
      await element(by.text('강남역')).tap();

      await element(by.id('package-size-selector')).tap();
      await element(by.text('소 (20x20x10cm)')).tap();

      await element(by.id('submit-request-button')).tap();

      // Wait for match
      await waitFor(element(by.id('giller-profile-card')))
        .toBeVisible()
        .withTimeout({ interval: 1000, timeout: 35000 });

      // Reject match
      await element(by.id('reject-button')).tap();

      // Confirmation dialog
      await expect(element(by.text('이 기일러를 거절하시겠습니까?'))).toBeVisible();
      await element(by.text('거절')).tap();

      // Should find another giller
      await expect(element(by.id('loading-indicator')).toBeVisible();
    });
  });

  describe('Match Ranking', () => {
    it('should prioritize higher-rated gillers', async () => {
      // After rejection, should show next best match
      await waitFor(element(by.id('giller-profile-card')))
        .toBeVisible()
        .withTimeout({ interval: 1000, timeout: 35000 });

      // First giller should have highest rating
      await expect(element(by.text('⭐ 4.8'))).toBeVisible(); // Higher rating
      await expect(element(by.text('완료 200건')).toBeVisible();
    });

    it('should show rank indicator', async () => {
      // If ranking is enabled in UI
      await expect(element(by.text('추천 기일러 1순위'))).toBeVisible();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Simulate network error (disable network)
      // This would require Detox network mocking

      await expect(element(by.text('네트워크 오류가 발생했습니다'))).toBeVisible();
      await expect(element(by.id('retry-button'))).toBeVisible();
    });

    it('should allow canceling matching process', async () => {
      // During loading, tap back button
      await device.pressBack();

      // Confirmation dialog
      await expect(element(by.text('매칭을 취소하고 이전 화면으로 돌아가시겠습니까?'))).toBeVisible();
      await element(by.text('예')).tap();

      // Should return to home
      await expect(element(by.id('home-screen')).).toBeVisible();
    });
  });
});
