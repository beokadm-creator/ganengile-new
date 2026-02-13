/**
 * Authentication E2E Tests
 * Sign up, Login, Password Reset
 */

import { by, element } from 'detox';

describe('Authentication Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  describe('Sign Up', () => {
    it('should display sign up screen', async () => {
      await expect(element(by.id('signup-screen'))).toBeVisible();
      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('name-input'))).toBeVisible();
      await expect(element(by.id('signup-button'))).toBeVisible();
    });

    it('should validate email format', async () => {
      const emailInput = element(by.id('email-input'));
      await emailInput.tap();
      await emailInput.typeText('invalid-email');

      await expect(element(by.text('올바른 이메일 형식을 입력해주세요'))).toBeVisible();
    });

    it('should validate password strength', async () => {
      const passwordInput = element(by.id('password-input'));
      await passwordInput.tap();
      await passwordInput.typeText('123'); // Too weak

      await expect(element(by.text('비밀번호는 6자 이상이어야 합니다'))).toBeVisible();
    });

    it('should create new account successfully', async () => {
      const timestamp = Date.now();
      const email = `test${timestamp}@example.com`;
      const password = 'password123';

      await element(by.id('email-input')).tap();
      await element(by.id('email-input')).typeText(email);

      await element(by.id('password-input')).tap();
      await element(by.id('password-input')).typeText(password);

      await element(by.id('name-input')).tap();
      await element(by.id('name-input')).typeText('테스터');

      await element(by.id('signup-button')).tap();

      // Wait for navigation to home
      await expect(element(by.id('home-screen'))).toBeVisible();
      await expect(element(by.text(`환영합니다, 테스터!`))).toBeVisible();
    });
  });

  describe('Login', () => {
    beforeEach(async () => {
      // Logout if logged in
      try {
        await element(by.id('logout-button')).tap();
      } catch (e) {
        // Already logged out
      }
    });

    it('should display login screen', async () => {
      await expect(element(by.id('login-screen'))).toBeVisible();
      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('login-button'))).toBeVisible();
    });

    it('should show error for invalid credentials', async () => {
      await element(by.id('email-input')).tap();
      await element(by.id('email-input')).typeText('wrong@example.com');

      await element(by.id('password-input')).tap();
      await element(by.id('password-input')).typeText('wrongpassword');

      await element(by.id('login-button')).tap();

      await expect(element(by.text('이메일 또는 비밀번호가 올바르지 않습니다'))).toBeVisible();
    });

    it('should login successfully with valid credentials', async () => {
      // Use the account created in sign up test
      const email = 'test@example.com';
      const password = 'password123';

      await element(by.id('email-input')).tap();
      await element(by.id('email-input')).typeText(email);

      await element(by.id('password-input')).tap();
      await element(by.id('password-input')).typeText(password);

      await element(by.id('login-button')).tap();

      // Wait for home screen
      await expect(element(by.id('home-screen'))).toBeVisible();
    });

    it('should remember user session', async () => {
      // Login and relaunch app
      await device.terminateApp();
      await device.launchApp();

      // Should still be logged in
      await expect(element(by.id('home-screen'))).toBeVisible();
    });
  });

  describe('Password Reset', () => {
    it('should display password reset screen', async () => {
      await element(by.id('forgot-password-link')).tap();

      await expect(element(by.id('password-reset-screen'))).toBeVisible();
      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('reset-button'))).toBeVisible();
    });

    it('should send reset email', async () => {
      const email = 'test@example.com';

      await element(by.id('email-input')).tap();
      await element(by.id('email-input')).typeText(email);

      await element(by.id('reset-button')).tap();

      await expect(element(by.text('비밀번호 재설정 이메일을 전송했습니다'))).toBeVisible();
    });
  });

  describe('Session Management', () => {
    it('should logout successfully', async () => {
      await element(by.id('logout-button')).tap();

      await expect(element(by.id('login-screen'))).toBeVisible();
    });

    it('should clear session data on logout', async () => {
      await element(by.id('logout-button')).tap();

      // Relaunch app
      await device.terminateApp();
      await device.launchApp();

      // Should show login screen
      await expect(element(by.id('login-screen'))).toBeVisible();
    });
  });
});
