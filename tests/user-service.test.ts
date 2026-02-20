/**
 * User Service Tests
 * 사용자 관리 테스트
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserRole } from '../src/types/user';

// Note: Firebase mocks are now in jest.setup.js
// Global mockFirestoreData is used for storage

// Import services
import {
  createUser,
  getUserById,
  updateUserProfile,
  getUserStats,
  updateLastActive,
} from '../src/services/user-service';

describe('User Service', () => {
  const testUserId = 'test-user-service-001';
  const testUserIds: string[] = [];

  beforeEach(() => {
    // Clear mock storage before each test
    (global as any).__clearMockFirestore();
  });

  afterEach(async () => {
    // Cleanup: Delete all test users
    for (const userId of testUserIds) {
      (global as any).__mockFirestoreData.delete(userId);
    }
    testUserIds.length = 0;
  });

  describe('createUser', () => {
    test('should create a user successfully', async () => {
      const userId = await createUser(
        testUserId,
        'test@example.com',
        'Test User',
        UserRole.GL
      );

      expect(userId).toBe(testUserId);
      testUserIds.push(userId);

      // Verify user was created in mock storage
      const mockUser = (global as any).__mockFirestoreData.get(testUserId);
      expect(mockUser).toBeDefined();
      expect(mockUser.email).toBe('test@example.com');
      expect(mockUser.name).toBe('Test User');
      expect(mockUser.role).toBe(UserRole.GL);
    });

    test('should overwrite existing user', async () => {
      // First creation
      await createUser(testUserId, 'test@example.com', 'Test User', UserRole.GL);
      testUserIds.push(testUserId);

      // Second creation (same ID = overwrite in Firebase)
      const userId2 = await createUser(
        testUserId,
        'test2@example.com',
        'Test User 2',
        UserRole.GL
      );

      expect(userId2).toBe(testUserId);

      const mockUser = (global as any).__mockFirestoreData.get(testUserId);
      // Overwritten
      expect(mockUser.email).toBe('test2@example.com');
      expect(mockUser.name).toBe('Test User 2');
    });
  });

  describe('getUserById', () => {
    test('should get user successfully', async () => {
      // First create a user
      await createUser(testUserId, 'test@example.com', 'Test User', UserRole.GL);
      testUserIds.push(testUserId);

      // Get user profile
      const user = await getUserById(testUserId);

      expect(user).toBeDefined();
      expect(user.uid).toBe(testUserId);
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    test('should return null for non-existent user', async () => {
      const user = await getUserById('non-existent-user-id');

      expect(user).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    test('should update user profile successfully', async () => {
      // First create a user
      await createUser(testUserId, 'test@example.com', 'Test User', UserRole.GL);
      testUserIds.push(testUserId);

      // Update profile
      const updates = {
        name: 'Updated Name',
        phoneNumber: '010-9876-5432',
      };

      await expect(updateUserProfile(testUserId, updates)).resolves.not.toThrow();

      const user = await getUserById(testUserId);
      expect(user.name).toBe(updates.name);
      expect(user.phoneNumber).toBe(updates.phoneNumber);
    });

    test('should fail to update non-existent user', async () => {
      const updates = {
        name: 'Updated Name',
      };

      await expect(updateUserProfile('non-existent-user', updates)).rejects.toThrow();
    });
  });

  describe('getUserStats', () => {
    test('should get user statistics', async () => {
      // First create a user
      await createUser(testUserId, 'test@example.com', 'Test User', UserRole.GILLER);
      testUserIds.push(testUserId);

      // Get user stats
      const stats = await getUserStats(testUserId);

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('totalDeliveries');
      expect(stats).toHaveProperty('totalWarnings');
      expect(stats).toHaveProperty('averageRating');
      expect(stats).toHaveProperty('completionRate');
    });

    test('should return zero stats for new user', async () => {
      await createUser(testUserId, 'new@example.com', 'New User', UserRole.GL);
      testUserIds.push(testUserId);

      const stats = await getUserStats(testUserId);

      expect(stats.totalRequests).toBe(0);
      expect(stats.totalDeliveries).toBe(0);
    });
  });

  describe('updateLastActive', () => {
    test('should update last active timestamp', async () => {
      await createUser(testUserId, 'test@example.com', 'Test User');
      testUserIds.push(testUserId);

      await expect(updateLastActive(testUserId)).resolves.not.toThrow();

      const user = await getUserById(testUserId);
      expect(user.lastActiveAt).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should handle full user lifecycle', async () => {
      // 1. Create
      const userId = await createUser(
        testUserId,
        'lifecycle@example.com',
        'Lifecycle User',
        UserRole.BOTH
      );
      testUserIds.push(userId);

      // 2. Read
      const user = await getUserById(userId);
      expect(user).toBeDefined();
      expect(user.name).toBe('Lifecycle User');

      // 3. Update
      await updateUserProfile(userId, { name: 'Updated Lifecycle User' });
      const updatedUser = await getUserById(userId);
      expect(updatedUser.name).toBe('Updated Lifecycle User');

      // 4. Stats
      const stats = await getUserStats(userId);
      expect(stats).toBeDefined();

      // 5. Last Active
      await updateLastActive(userId);
      const activeUser = await getUserById(userId);
      expect(activeUser.lastActiveAt).toBeDefined();
    });
  });
});
