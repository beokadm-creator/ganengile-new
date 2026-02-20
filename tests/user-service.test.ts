/**
 * User Service Tests
 * 사용자 관리 테스트
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createUser,
  getUserById,
  updateUserProfile,
  getUserStats,
  updateLastActive,
} from '../src/services/user-service';
import { doc, getDoc, deleteDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../src/services/firebase';

describe('User Service', () => {
  const testUserId = 'test-user-service-001';

  beforeEach(async () => {
    // Cleanup: Delete test user
    try {
      await deleteDoc(doc(db, 'users', testUserId));
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Cleanup: Delete test user
    try {
      await deleteDoc(doc(db, 'users', testUserId));
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  describe('createUser', () => {
    test('should create a user successfully', async () => {
      const userData = {
        uid: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        phoneNumber: '010-1234-5678',
        role: 'both' as const,
      };

      const result = await createUser(userData);

      expect(result).toBeDefined();
      expect(result.uid).toBe(testUserId);

      const userDoc = await getDoc(doc(db, 'users', testUserId));
      expect(userDoc.exists).toBe(true);
      expect(userDoc.data()?.email).toBe('test@example.com');
    });

    test('should overwrite existing user', async () => {
      const userData = {
        uid: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'both' as const,
      };

      await createUser(userData);

      userData.name = 'Updated Name';
      const result = await createUser(userData);

      expect(result.name).toBe('Updated Name');

      const userDoc = await getDoc(doc(db, 'users', testUserId));
      expect(userDoc.data()?.name).toBe('Updated Name');
    });
  });

  describe('getUserById', () => {
    test('should get user successfully', async () => {
      const userData = {
        uid: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'giller' as const,
      };

      await createUser(userData);

      const user = await getUserById(testUserId);

      expect(user).toBeDefined();
      expect(user?.uid).toBe(testUserId);
      expect(user?.email).toBe('test@example.com');
    });

    test('should return null for non-existent user', async () => {
      const user = await getUserById('non-existent-user');

      expect(user).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    test('should update user profile successfully', async () => {
      const userData = {
        uid: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'giller' as const,
      };

      await createUser(userData);

      await updateUserProfile(testUserId, {
        name: 'Updated Name',
        phoneNumber: '010-9876-5432',
      });

      const user = await getUserById(testUserId);

      expect(user?.name).toBe('Updated Name');
      expect(user?.phoneNumber).toBe('010-9876-5432');
    });

    test('should fail to update non-existent user', async () => {
      await expect(
        updateUserProfile('non-existent-user', { name: 'New Name' })
      ).rejects.toThrow();
    });
  });

  describe('getUserStats', () => {
    test('should get user statistics', async () => {
      const userData = {
        uid: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'both' as const,
      };

      await createUser(userData);

      const stats = await getUserStats(testUserId);

      expect(stats).toBeDefined();
      expect(stats?.completedDeliveries).toBeDefined();
      expect(stats?.rating).toBeDefined();
    });

    test('should return null for non-existent user', async () => {
      const stats = await getUserStats('non-existent-user');

      expect(stats).toBeNull();
    });
  });

  describe('updateLastActive', () => {
    test('should update last active timestamp', async () => {
      const userData = {
        uid: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'both' as const,
      };

      await createUser(userData);

      await updateLastActive(testUserId);

      // Just verify no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should handle full user lifecycle', async () => {
      // Create
      const userData = {
        uid: testUserId,
        email: 'lifecycle@example.com',
        name: 'Lifecycle User',
        role: 'both' as const,
      };

      await createUser(userData);

      // Read
      let user = await getUserById(testUserId);
      expect(user?.name).toBe('Lifecycle User');

      // Update
      await updateUserProfile(testUserId, { name: 'Updated Lifecycle' });
      user = await getUserById(testUserId);
      expect(user?.name).toBe('Updated Lifecycle');

      // Stats
      const stats = await getUserStats(testUserId);
      expect(stats).toBeDefined();
    });
  });
});
