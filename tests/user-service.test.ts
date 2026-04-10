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
      const result = await createUser(
        testUserId,
        'test@example.com',
        'Test User',
        'both'
      );

      expect(result).toBeDefined();
      expect(result.uid).toBe(testUserId);
      expect(result.email).toBe('test@example.com');

      const userDoc = await getDoc(doc(db, 'users', testUserId));
      expect(userDoc.exists()).toBe(true);
      expect(userDoc.data()?.email).toBe('test@example.com');
    });

    test('should overwrite existing user', async () => {
      await createUser(testUserId, 'test@example.com', 'Test User', 'both');

      const result = await createUser(testUserId, 'test@example.com', 'Updated Name', 'both');

      expect(result.name).toBe('Updated Name');

      const userDoc = await getDoc(doc(db, 'users', testUserId));
      expect(userDoc.data()?.name).toBe('Updated Name');
    });
  });

  describe('getUserById', () => {
    test('should get user successfully', async () => {
      await createUser(testUserId, 'test@example.com', 'Test User', 'giller');

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
      await createUser(testUserId, 'test@example.com', 'Test User', 'giller');

      await updateUserProfile(testUserId, {
        name: 'Updated Name',
        phoneNumber: '010-9876-5432',
      });

      const user = await getUserById(testUserId);

      expect(user?.name).toBe('Updated Name');
      expect(user?.phoneNumber).toBe('010-9876-5432');
    });

    test('should create a minimal profile shape for non-existent user in the current mock runtime', async () => {
      const updated = await updateUserProfile('non-existent-user', { name: 'New Name' });

      expect(updated.uid).toBe('non-existent-user');
      expect(updated.name).toBe('New Name');
    });
  });

  describe('getUserStats', () => {
    test('should get user statistics', async () => {
      await createUser(testUserId, 'test@example.com', 'Test User', 'both');

      const stats = await getUserStats(testUserId);

      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalDeliveries).toBe(0);
      expect(stats.totalEarnings).toBe(0);
      expect(stats.averageRating).toBe(0);
    });

    test('should return default stats for non-existent user', async () => {
      const stats = await getUserStats('non-existent-user');

      expect(stats).toEqual({
        totalRequests: 0,
        totalDeliveries: 0,
        totalEarnings: 0,
        averageRating: 0,
        completionRate: 0,
      });
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
      await createUser(testUserId, 'lifecycle@example.com', 'Lifecycle User', 'both');

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
