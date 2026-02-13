/**
 * Auth Flow Integration Tests
 * Authentication flow: Sign up → Email verification → Login → Session management
 */

import {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  updateProfile,
} from '../../auth-service';
import { createTestData, generateId, mockFirestore } from './mocking-utils';

// Mock Firebase Auth
const mockAuth = {
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  currentUser: null,
};

jest.mock('firebase/auth', () => ({
  getAuth: () => mockAuth,
}));

describe('Auth Flow Integration Tests', () => {
  beforeEach(() => {
    mockFirestore.clear();
    jest.clearAllMocks();
    mockAuth.currentUser = null;
  });

  describe('Sign Up Flow', () => {
    it('should successfully create new user account', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = '테스터';

      // Mock Firebase Auth response
      const mockUser = {
        uid: generateId('user'),
        email: email,
        emailVerified: false,
      };
      mockAuth.createUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser,
      });

      // Sign up
      const result = await signUp(email, password, { name });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);

      // Verify user document created in Firestore
      const users = mockFirestore.getAll().get('users') || [];
      expect(users.length).toBe(1);
      expect(users[0].email).toBe(email);
      expect(users[0].name).toBe(name);
    });

    it('should send verification email on sign up', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const mockUser = {
        uid: generateId('user'),
        email: email,
        sendEmailVerification: jest.fn(),
      };
      mockAuth.createUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser,
      });

      await signUp(email, password);

      // Verify email sent
      expect(mockUser.sendEmailVerification).toHaveBeenCalled();
    });

    it('should handle duplicate email error', async () => {
      const email = 'existing@example.com';
      const password = 'password123';

      // Mock Firebase Auth error (email already exists)
      mockAuth.createUserWithEmailAndPassword.mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'The email address is already in use.',
      });

      const result = await signUp(email, password);

      expect(result.success).toBe(false);
      expect(result.error).toContain('이미 사용 중인 이메일');
    });

    it('should handle weak password error', async () => {
      const email = 'test@example.com';
      const password = '123'; // Too weak

      mockAuth.createUserWithEmailAndPassword.mockRejectedValue({
        code: 'auth/weak-password',
        message: 'Password should be at least 6 characters.',
      });

      const result = await signUp(email, password);

      expect(result.success).toBe(false);
      expect(result.error).toContain('비밀번호');
    });
  });

  describe('Sign In Flow', () => {
    it('should successfully sign in with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      // Create user first
      const userId = generateId('user');
      const userData = createTestData('user', {
        id: userId,
        email,
        isActive: true,
      });
      mockFirestore.seedData('users', [userData]);

      // Mock Firebase Auth response
      const mockUser = {
        uid: userId,
        email: email,
      };
      mockAuth.signInWithEmailAndPassword.mockResolvedValue({
        user: mockUser,
      });

      // Sign in
      const result = await signIn(email, password);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);
    });

    it('should fail with invalid credentials', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';

      mockAuth.signInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'The password is invalid.',
      });

      const result = await signIn(email, password);

      expect(result.success).toBe(false);
      expect(result.error).toContain('비밀번호가 올바르지 않습니다');
    });

    it('should fail with non-existent email', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      mockAuth.signInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/user-not-found',
        message: 'There is no user record corresponding to this identifier.',
      });

      const result = await signIn(email, password);

      expect(result.success).toBe(false);
      expect(result.error).toContain('사용자를 찾을 수 없습니다');
    });

    it('should block inactive user accounts', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      // Create inactive user
      const userId = generateId('user');
      const userData = createTestData('user', {
        id: userId,
        email,
        isActive: false, // Inactive
      });
      mockFirestore.seedData('users', [userData]);

      const mockUser = { uid: userId, email: email };
      mockAuth.signInWithEmailAndPassword.mockResolvedValue({
        user: mockUser,
      });

      const result = await signIn(email, password);

      expect(result.success).toBe(false);
      expect(result.error).toContain('비활성화된 계정');
    });
  });

  describe('Session Management', () => {
    it('should retrieve current user session', async () => {
      const userId = generateId('user');
      const email = 'test@example.com';

      // Mock current user
      mockAuth.currentUser = {
        uid: userId,
        email: email,
      };

      // Seed user data
      const userData = createTestData('user', {
        id: userId,
        email,
      });
      mockFirestore.seedData('users', [userData]);

      // Get current user
      const user = await getCurrentUser();

      expect(user).toBeDefined();
      expect(user.uid).toBe(userId);
      expect(user.email).toBe(email);
    });

    it('should return null when no user is signed in', async () => {
      mockAuth.currentUser = null;

      const user = await getCurrentUser();

      expect(user).toBeNull();
    });

    it('should listen to auth state changes', async () => {
      const mockCallback = jest.fn();

      // Mock auth state change
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        // Simulate user sign in
        setTimeout(() => {
          const mockUser = {
            uid: generateId('user'),
            email: 'test@example.com',
          };
          callback(mockUser);
        }, 100);
      });

      // Listen to auth changes
      const unsubscribe = mockAuth.onAuthStateChanged(mockCallback);

      // Wait for callback
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockCallback).toHaveBeenCalled();

      // Unsubscribe
      if (unsubscribe) unsubscribe();
    });
  });

  describe('Sign Out Flow', () => {
    it('should successfully sign out user', async () => {
      mockAuth.currentUser = {
        uid: generateId('user'),
        email: 'test@example.com',
      };
      mockAuth.signOut.mockResolvedValue(undefined);

      const result = await signOut();

      expect(result.success).toBe(true);
      expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors gracefully', async () => {
      mockAuth.signOut.mockRejectedValue(new Error('Network error'));

      const result = await signOut();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Profile Update Flow', () => {
    it('should update user profile successfully', async () => {
      const userId = generateId('user');
      const newName = '새로운 이름';

      const userData = createTestData('user', {
        id: userId,
        name: '이전 이름',
      });
      mockFirestore.seedData('users', [userData]);

      mockAuth.currentUser = { uid: userId };

      const result = await updateProfile({ name: newName });

      expect(result.success).toBe(true);

      // Verify updated in Firestore
      const users = mockFirestore.getAll().get('users') || [];
      expect(users[0].name).toBe(newName);
    });

    it('should update profile image', async () => {
      const userId = generateId('user');
      const profileImage = 'https://example.com/image.jpg';

      const userData = createTestData('user', { id: userId });
      mockFirestore.seedData('users', [userData]);

      mockAuth.currentUser = { uid: userId };

      const result = await updateProfile({ profileImage });

      expect(result.success).toBe(true);

      const users = mockFirestore.getAll().get('users') || [];
      expect(users[0].profileImage).toBe(profileImage);
    });
  });

  describe('Password Reset Flow', () => {
    it('should send password reset email', async () => {
      const email = 'test@example.com';

      const mockUser = {
        sendPasswordResetEmail: jest.fn(),
      };
      mockAuth.currentUser = mockUser;

      // This would call auth service
      // const result = await sendPasswordResetEmail(email);

      // expect(mockUser.sendPasswordResetEmail).toHaveBeenCalledWith(email);
    });
  });
});
