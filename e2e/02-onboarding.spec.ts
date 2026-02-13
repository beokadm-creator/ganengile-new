/**
 * Onboarding E2E Tests
 * Role selection, Giller/Gller onboarding, Route registration
 */

import { by, element } from 'detox';

describe('Onboarding Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
    // Login first (use existing account)
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  describe('Role Selection', () => {
    it('should display role selection screen', async () => {
      await expect(element(by.id('role-selection-screen'))).toBeVisible();
      await expect(element(by.text('어떤 역할로 시작하시겠습니까?'))).toBeVisible();
      await expect(element(by.id('gller-role-button'))).toBeVisible();
      await expect(element(by.id('giller-role-button'))).toBeVisible();
    });

    it('should highlight selected role on slider', async () => {
      const slider = element(by.id('role-slider'));

      // Slide to Giller (left)
      await slider.tap({ x: 20, y: 50 });

      await expect(element(by.text('기러 (배송 requester)'))).toBeVisible();
    });

    it('should proceed to onboarding after role selection', async () => {
      await element(by.id('gller-role-button')).tap();

      await expect(element(by.id('gller-onboarding-screen'))).toBeVisible();
    });
  });

  describe('Gller Onboarding', () => {
    it('should display gller onboarding steps', async () => {
      await expect(element(by.id('gller-onboarding-screen'))).toBeVisible();
      await expect(element(by.text('기러로 시작하기'))).toBeVisible();
      await expect(element(by.text('1/3'))).toBeVisible();
    });

    it('should validate required information', async () => {
      // Try to proceed without entering name
      await element(by.id('next-button')).tap();

      await expect(element(by.text('이름을 입력해주세요'))).toBeVisible();
    });

    it('should complete onboarding successfully', async () => {
      await element(by.id('name-input')).tap();
      await element(by.id('name-input')).typeText('테스터');

      await element(by.id('next-button')).tap();

      // Step 2: Terms
      await expect(element(by.id('terms-checkbox')).tap();
      await element(by.id('next-button')).tap();

      // Step 3: Complete
      await expect(element(by.text('환영합니다, 테스터님!'))).toBeVisible();

      // Should navigate to home
      await expect(element(by.id('home-screen'))).toBeVisible();
    });
  });

  describe('Giller Onboarding', () => {
    it('should display giller onboarding steps', async () => {
      // Go back to role selection
      await device.launchApp();
      await element(by.id('giller-role-button')).tap();

      await expect(element(by.id('giller-onboarding-screen'))).toBeVisible();
      await expect(element(by.text('기일러로 시작하기'))).toBeVisible();
    });

    it('should validate delivery preferences', async () => {
      // Try to proceed without selecting days
      await element(by.id('next-button')).tap();

      await expect(element(by.text('요일을 선택해주세요'))).toBeVisible();
    });

    it('should complete onboarding successfully', async () => {
      // Step 1: Profile
      await element(by.id('name-input')).typeText('테스트 기일러');
      await element(by.id('next-button')).tap();

      // Step 2: Delivery preferences
      await element(by.id('monday-checkbox')).tap();
      await element(by.id('tuesday-checkbox')).tap();
      await element(by.id('wednesday-checkbox')).tap();
      await element(by.id('thursday-checkbox')).tap();
      await element(by.id('friday-checkbox')).tap();
      await element(by.id('next-button')).tap();

      // Step 3: Identity verification
      await expect(element(by.id('verification-screen'))).toBeVisible();
      // Skip verification for testing
      await element(by.id('skip-verification-button')).tap();

      // Should navigate to home
      await expect(element(by.id('home-screen'))).toBeVisible();
    });
  });

  describe('Route Registration', () => {
    beforeEach(async () => {
      // Make sure we're logged in as giller
      await device.launchApp();
      await element(by.id('giller-home-tab')).tap();
    });

    it('should display route management screen', async () => {
      await element(by.id('route-management-button')).tap();

      await expect(element(by.id('route-management-screen'))).toBeVisible();
      await expect(element(by.text('내 동선'))).toBeVisible();
    });

    it('should display add route form', async () => {
      await element(by.id('add-route-button')).tap();

      await expect(element(by.id('add-route-screen'))).toBeVisible();
      await expect(element(by.id('start-station-input'))).toBeVisible();
      await expect(element(by.id('end-station-input'))).toBeVisible();
      await expect(element(by.id('departure-time-picker'))).toBeVisible();
      await expect(element(by.id('days-selector'))).toBeVisible();
    });

    it('should validate route inputs', async () => {
      // Try to save without selecting stations
      await element(by.id('save-route-button')).tap();

      await expect(element(by.text('출발역을 선택해주세요'))).toBeVisible();
    });

    it('should add route successfully', async () => {
      // Select start station
      await element(by.id('start-station-input')).tap();
      await element(by.text('서울역')).tap();

      // Select end station
      await element(by.id('end-station-input')).tap();
      await element(by.text('강남역')).tap();

      // Select time
      await element(by.id('departure-time-picker')).tap();
      await element(by.text('08:30')).tap();

      // Select days
      await element(by.id('monday-checkbox')).tap();
      await element(by.id('tuesday-checkbox')).tap();
      await element(by.id('wednesday-checkbox')).tap();
      await element(by.id('thursday-checkbox')).tap();
      await element(by.id('friday-checkbox')).tap();

      await element(by.id('save-route-button')).tap();

      await expect(element(by.text('동선이 추가되었습니다'))).toBeVisible();
    });

    it('should display saved routes in list', async () => {
      // After adding route, go back to list
      await device.pressBack();

      await expect(element(by.text('서울역 → 강남역'))).toBeVisible();
      await expect(element(by.text('월 화금 08:30'))).toBeVisible();
    });

    it('should edit existing route', async () => {
      // Tap on route to edit
      await element(by.id('route-item-0')).tap();

      await expect(element(by.id('edit-route-screen'))).toBeVisible();

      // Change time
      await element(by.id('departure-time-picker')).tap();
      await element(by.text('09:00')).tap();

      await element(by.id('save-route-button')).tap();

      await expect(element(by.text('동선이 수정되었습니다'))).toBeVisible();
    });

    it('should delete route with confirmation', async () => {
      await element(by.id('route-item-0')).swipe({ x: -200, y: 0, speed: 'fast' });

      await element(by.id('delete-route-button')).tap();

      // Confirmation dialog
      await expect(element(by.text('정말 삭제하시겠습니까?'))).toBeVisible();
      await element(by.id('confirm-delete-button')).tap();

      await expect(element(by.text('동선이 삭제되었습니다'))).toBeVisible();
    });
  });
});
