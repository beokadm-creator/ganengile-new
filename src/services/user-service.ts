/**
 * User Service
 * Firebase Users Collection 관리 서비스
 * @version 2.1.0 - 통계 계산 로직 개선
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  sum,
  avg,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';
import type { User } from '../types/user';
import { UserRole } from '../types/user';

/**
 * Get current authenticated user
 * @returns Current user or null (partial user object)
 */
export function getCurrentUser(): Partial<User> | null {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  return {
    uid: currentUser.uid,
    email: currentUser.email || '',
    name: currentUser.displayName || '',
    role: UserRole.GILLER, // Default role
    createdAt: new Date() as any, // Placeholder
    updatedAt: new Date() as any,
    isActive: true,
    agreedTerms: {
      giller: false,
      gller: false,
      privacy: false,
      marketing: false,
    },
  };
}

/**
 * Get user by ID from Firestore
 * @param userId User ID
 * @returns User data or null
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists) {
      return null;
    }

    const data = docSnapshot.data();
    return {
      uid: docSnapshot.id,
      email: data.email || '',
      name: data.name || '',
      role: data.role || UserRole.GILLER,
      agreedTerms: data.agreedTerms || {
        giller: false,
        gller: false,
        privacy: false,
        marketing: false,
      },
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
      isActive: data.isActive ?? true,
      hasCompletedOnboarding: data.hasCompletedOnboarding || false,
      rating: data.rating,
      totalRatings: data.totalRatings,
      profilePhoto: data.profilePhoto,
      fcmToken: data.fcmToken,
      isVerified: data.isVerified,
      gillerInfo: data.gillerInfo,
      gllerInfo: data.gllerInfo,
      // P1 추가 필드
      stats: data.stats || {
        completedDeliveries: 0,
        totalEarnings: 0,
        rating: 0,
        recentPenalties: 0,
        accountAgeDays: 0,
        recent30DaysDeliveries: 0,
      },
      badges: data.badges || {
        activity: [],
        quality: [],
        expertise: [],
        community: [],
      },
      badgeBenefits: data.badgeBenefits || {
        profileFrame: 'none',
        totalBadges: 0,
        currentTier: 'none',
      },
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

/**
 * Create or update user profile
 * @param userId User ID
 * @param userData User data
 * @returns Updated user
 */
export async function updateUserProfile(
  userId: string,
  userData: Partial<Pick<User, 'name' | 'email' | 'phoneNumber'>>
): Promise<User> {
  try {
    const userRef = doc(db, 'users', userId);

    const updateData: any = {
      ...userData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(userRef, updateData);

    const updated = await getUserById(userId);
    if (!updated) {
      throw new Error('Failed to fetch updated user');
    }

    return updated;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Get user statistics
 * @param userId User ID
 * @returns User statistics
 * @version 2.1.0 - 실제 데이터 계산 로직 구현
 */
export async function getUserStats(userId: string): Promise<{
  totalRequests: number;
  totalDeliveries: number;
  totalEarnings: number;
  averageRating: number;
  completionRate: number;
}> {
  try {
    // Get completed requests (as gller)
    const requestsQuery = query(
      collection(db, 'requests'),
      where('gllerId', '==', userId),
      where('status', '==', 'completed')
    );

    const requestsSnapshot = await getDocs(requestsQuery);
    const totalRequests = requestsSnapshot.size;

    // Get completed deliveries (as giller) from deliveries collection
    const deliveriesQuery = query(
      collection(db, 'deliveries'),
      where('gillerId', '==', userId),
      where('status', '==', 'delivered')
    );

    const deliveriesSnapshot = await getDocs(deliveriesQuery);
    const totalDeliveries = deliveriesSnapshot.size;

    // Calculate total earnings from completed deliveries
    let totalEarnings = 0;
    deliveriesSnapshot.forEach((doc) => {
      const data = doc.data();
      totalEarnings += data.fee?.gillerFee || 0;
    });

    // Get average rating from ratings collection
    const ratingsQuery = query(
      collection(db, 'ratings'),
      where('ratedUserId', '==', userId)
    );

    const ratingsSnapshot = await getDocs(ratingsQuery);
    let averageRating = 0;

    if (!ratingsSnapshot.empty) {
      let totalRating = 0;
      ratingsSnapshot.forEach((doc) => {
        const data = doc.data();
        totalRating += data.rating || 0;
      });
      averageRating = totalRating / ratingsSnapshot.size;
    }

    // Calculate completion rate (as gller)
    const allRequestsQuery = query(
      collection(db, 'requests'),
      where('gllerId', '==', userId)
    );

    const allRequestsSnapshot = await getDocs(allRequestsQuery);
    const completionRate = allRequestsSnapshot.size > 0
      ? (totalRequests / allRequestsSnapshot.size) * 100
      : 0;

    return {
      totalRequests,
      totalDeliveries,
      totalEarnings,
      averageRating: Math.round(averageRating * 10) / 10, // 소수점 1자리
      completionRate: Math.round(completionRate * 10) / 10,
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return {
      totalRequests: 0,
      totalDeliveries: 0,
      totalEarnings: 0,
      averageRating: 0,
      completionRate: 0,
    };
  }
}

/**
 * Get detailed user statistics (includes recent activity)
 * @param userId User ID
 * @returns Detailed user statistics
 */
export async function getDetailedUserStats(userId: string): Promise<{
  totalRequests: number;
  totalDeliveries: number;
  totalEarnings: number;
  averageRating: number;
  completionRate: number;
  recent30DaysDeliveries: number;
  recentPenalties: number;
  accountAgeDays: number;
}> {
  try {
    const baseStats = await getUserStats(userId);

    // Get user data for additional stats
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists) {
      return {
        ...baseStats,
        recent30DaysDeliveries: 0,
        recentPenalties: 0,
        accountAgeDays: 0,
      };
    }

    const userData = userDoc.data();
    const createdAt = userData.createdAt?.toDate();

    // Calculate account age in days
    let accountAgeDays = 0;
    if (createdAt) {
      accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Get recent 30 days deliveries
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDeliveriesQuery = query(
      collection(db, 'deliveries'),
      where('gillerId', '==', userId),
      where('status', '==', 'delivered'),
      where('completedAt', '>=', thirtyDaysAgo)
    );

    const recentDeliveriesSnapshot = await getDocs(recentDeliveriesQuery);
    const recent30DaysDeliveries = recentDeliveriesSnapshot.size;

    // Get recent penalties (last 30 days)
    const recentPenaltiesQuery = query(
      collection(db, 'penalties'),
      where('userId', '==', userId),
      where('createdAt', '>=', thirtyDaysAgo)
    );

    const recentPenaltiesSnapshot = await getDocs(recentPenaltiesQuery);
    const recentPenalties = recentPenaltiesSnapshot.size;

    return {
      ...baseStats,
      recent30DaysDeliveries,
      recentPenalties,
      accountAgeDays,
    };
  } catch (error) {
    console.error('Error fetching detailed user stats:', error);
    return {
      totalRequests: 0,
      totalDeliveries: 0,
      totalEarnings: 0,
      averageRating: 0,
      completionRate: 0,
      recent30DaysDeliveries: 0,
      recentPenalties: 0,
      accountAgeDays: 0,
    };
  }
}

/**
 * Save FCM token for push notifications
 * @param userId User ID
 * @param token FCM token
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      fcmToken: token,
      fcmTokenUpdatedAt: serverTimestamp(),
    });

    console.log('✅ FCM token saved for user:', userId);
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw error;
  }
}

/**
 * Get user's delivery history
 * @param userId User ID
 * @param limit Max number of items
 * @returns Array of delivery history
 */
export async function getUserDeliveryHistory(
  userId: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'requests'),
      where('gllerId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const history: any[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      history.push({
        requestId: docSnapshot.id,
        ...data,
        createdAt: data.createdAt?.toDate() ?? null,
      });
    });

    // Sort by created date (newest first)
    history.sort((a, b) => {
      const aTime = a.createdAt?.getTime?.() ?? 0;
      const bTime = b.createdAt?.getTime?.() ?? 0;
      return bTime - aTime;
    });

    return history.slice(0, limit);
  } catch (error) {
    console.error('Error fetching delivery history:', error);
    return [];
  }
}

/**
 * Update user's last active timestamp
 * @param userId User ID
 */
export async function updateLastActive(userId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      lastActiveAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating last active:', error);
  }
}

/**
 * Create user document in Firestore (for development/testing)
 * @param userId User ID from Firebase Auth
 * @param email User email
 * @param name User name
 * @param role User role (default: both for testing)
 * @returns Created user
 */
export async function createUser(
  userId: string,
  email: string,
  name: string,
  role: UserRole = UserRole.BOTH
): Promise<User> {
  try {
    const userRef = doc(db, 'users', userId);

    const userDoc: User = {
      uid: userId,
      email: email,
      name: name,
      phoneNumber: '',

      // 역할 (기본: both)
      role: role,

      // 약관 동의 (테스트용으로 모두 true)
      agreedTerms: {
        giller: true,
        gller: true,
        privacy: true,
        marketing: false,
      },

      // 기본 설정
      rating: 5.0,
      totalRatings: 0,
      isActive: true,
      isVerified: true,

      // 길러 정보
      gillerInfo: {
        totalDeliveries: 0,
        totalEarnings: 0,
        equipment: {
          hasInsulatedBag: false,
          hasHeatedBag: false,
          vehicleType: 'walk',
        },
      },

      // 이용자 정보
      gllerInfo: {
        totalRequests: 0,
        successfulDeliveries: 0,
      },

      // P1 추가 필드
      stats: {
        completedDeliveries: 0,
        totalEarnings: 0,
        rating: 5.0,
        recentPenalties: 0,
        accountAgeDays: 0,
        recent30DaysDeliveries: 0,
      },

      badges: {
        activity: [],
        quality: [],
        expertise: [],
        community: [],
      },

      badgeBenefits: {
        profileFrame: 'none',
        totalBadges: 0,
        currentTier: 'none',
      },

      // 타임스탬프
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    await setDoc(userRef, userDoc);

    console.log('✅ User created in Firestore:', userId);

    return userDoc;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}
