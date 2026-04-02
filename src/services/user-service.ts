/**
 * User Service
 * Provides a typed access layer for user profile and activity data.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { auth, db } from './firebase';
import { getRequestsByRequester as getRequestsByRequesterFromRequestService } from './request-service';
import type { Request } from '../types/request';
import { AuthProviderType, UserRole, type Badge, type User } from '../types/user';

type TimestampLike = {
  toDate?: () => Date;
};

interface UserDoc extends DocumentData {
  email?: string;
  name?: string;
  phoneNumber?: string;
  phoneVerification?: User['phoneVerification'];
  emailVerification?: User['emailVerification'];
  authProvider?: AuthProviderType;
  authProviderUserId?: string;
  signupMethod?: 'email' | 'google' | 'kakao' | 'unknown';
  providerLinkedAt?: unknown;
  role?: UserRole;
  agreedTerms?: User['agreedTerms'];
  createdAt?: unknown;
  updatedAt?: unknown;
  isActive?: boolean;
  hasCompletedOnboarding?: boolean;
  rating?: number;
  totalRatings?: number;
  profilePhoto?: string;
  fcmToken?: string;
  isVerified?: boolean;
  gillerApplicationStatus?: User['gillerApplicationStatus'];
  gillerInfo?: User['gillerInfo'];
  gllerInfo?: User['gllerInfo'];
  pointBalance?: number;
  totalEarnedPoints?: number;
  totalSpentPoints?: number;
  stats?: User['stats'];
  badges?: User['badges'];
  badgeBenefits?: User['badgeBenefits'];
}

interface DeliveryDoc extends DocumentData {
  fee?: {
    gillerFee?: number;
  };
  completedAt?: unknown;
}

interface RatingDoc extends DocumentData {
  rating?: number;
}

type UserStatsResult = {
  totalRequests: number;
  totalDeliveries: number;
  totalEarnings: number;
  averageRating: number;
  completionRate: number;
};

type DetailedUserStatsResult = UserStatsResult & {
  recent30DaysDeliveries: number;
  recentPenalties: number;
  accountAgeDays: number;
};

type UserHistoryItem = Record<string, unknown> & {
  requestId: string;
  createdAt: Date | null;
};

const DEFAULT_AGREED_TERMS: NonNullable<User['agreedTerms']> = {
  giller: false,
  gller: false,
  privacy: false,
  marketing: false,
};

const DEFAULT_STATS: NonNullable<User['stats']> = {
  completedDeliveries: 0,
  totalEarnings: 0,
  rating: 0,
  recentPenalties: 0,
  accountAgeDays: 0,
  recent30DaysDeliveries: 0,
};

const DEFAULT_BADGES: NonNullable<User['badges']> = {
  activity: [],
  quality: [],
  expertise: [],
  community: [],
};

const DEFAULT_BADGE_BENEFITS: NonNullable<User['badgeBenefits']> = {
  profileFrame: 'none',
  totalBadges: 0,
  currentTier: 'none',
};

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as TimestampLike;
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate();
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function mapUser(docId: string, data: UserDoc): User {
  return {
    uid: docId,
    email: data.email ?? '',
    name: data.name ?? '',
    phoneNumber: data.phoneNumber,
    phoneVerification: data.phoneVerification,
    emailVerification: data.emailVerification,
    authProvider: data.authProvider ?? AuthProviderType.UNKNOWN,
    authProviderUserId: data.authProviderUserId,
    signupMethod: data.signupMethod ?? 'unknown',
    providerLinkedAt: data.providerLinkedAt as User['providerLinkedAt'],
    role: data.role ?? UserRole.GLER,
    agreedTerms: data.agreedTerms ?? DEFAULT_AGREED_TERMS,
    createdAt: (data.createdAt ?? null) as User['createdAt'],
    updatedAt: (data.updatedAt ?? null) as User['updatedAt'],
    isActive: data.isActive ?? true,
    hasCompletedOnboarding: data.hasCompletedOnboarding ?? false,
    rating: data.rating,
    totalRatings: data.totalRatings,
    profilePhoto: data.profilePhoto,
    fcmToken: data.fcmToken,
    isVerified: data.isVerified,
    gillerApplicationStatus: data.gillerApplicationStatus,
    gillerInfo: data.gillerInfo,
    gllerInfo: data.gllerInfo,
    pointBalance: data.pointBalance ?? 0,
    totalEarnedPoints: data.totalEarnedPoints ?? 0,
    totalSpentPoints: data.totalSpentPoints ?? 0,
    stats: data.stats ?? DEFAULT_STATS,
    badges: data.badges ?? DEFAULT_BADGES,
    badgeBenefits: data.badgeBenefits ?? DEFAULT_BADGE_BENEFITS,
  };
}

function getDefaultUserStats(): UserStatsResult {
  return {
    totalRequests: 0,
    totalDeliveries: 0,
    totalEarnings: 0,
    averageRating: 0,
    completionRate: 0,
  };
}

function getDefaultDetailedUserStats(): DetailedUserStatsResult {
  return {
    ...getDefaultUserStats(),
    recent30DaysDeliveries: 0,
    recentPenalties: 0,
    accountAgeDays: 0,
  };
}

export function getCurrentUser(): Partial<User> | null {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  return {
    uid: currentUser.uid,
    email: currentUser.email ?? '',
    name: currentUser.displayName ?? '',
    role: UserRole.GLER,
    createdAt: new Date() as unknown as User['createdAt'],
    updatedAt: new Date() as unknown as User['updatedAt'],
    isActive: true,
    agreedTerms: DEFAULT_AGREED_TERMS,
  };
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const docSnapshot = await getDoc(doc(db, 'users', userId));
    if (!docSnapshot.exists()) {
      return null;
    }

    const data = docSnapshot.data() as UserDoc | undefined;
    if (!data) {
      return null;
    }

    return mapUser(docSnapshot.id, data);
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

export async function updateUserProfile(
  userId: string,
  userData: Partial<Pick<User, 'name' | 'email' | 'phoneNumber'>>
): Promise<User> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...userData,
      updatedAt: serverTimestamp(),
    });

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

export async function getUserStats(userId: string): Promise<UserStatsResult> {
  try {
    const completedRequestsQuery = query(
      collection(db, 'requests'),
      where('requesterId', '==', userId),
      where('status', '==', 'completed')
    );
    const completedRequestsSnapshot = await getDocs(completedRequestsQuery);

    const deliveriesQuery = query(
      collection(db, 'deliveries'),
      where('gillerId', '==', userId),
      where('status', '==', 'delivered')
    );
    const deliveriesSnapshot = await getDocs(deliveriesQuery);

    let totalEarnings = 0;
    deliveriesSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as DeliveryDoc;
      totalEarnings += data.fee?.gillerFee ?? 0;
    });

    const ratingsQuery = query(collection(db, 'ratings'), where('ratedUserId', '==', userId));
    const ratingsSnapshot = await getDocs(ratingsQuery);
    let averageRating = 0;

    if (!ratingsSnapshot.empty) {
      let totalRating = 0;
      ratingsSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as RatingDoc;
        totalRating += data.rating ?? 0;
      });
      averageRating = totalRating / ratingsSnapshot.size;
    }

    const allGillerRequestsQuery = query(collection(db, 'requests'), where('gllerId', '==', userId));
    const allGillerRequestsSnapshot = await getDocs(allGillerRequestsQuery);
    const completionRate =
      allGillerRequestsSnapshot.size > 0
        ? (completedRequestsSnapshot.size / allGillerRequestsSnapshot.size) * 100
        : 0;

    return {
      totalRequests: completedRequestsSnapshot.size,
      totalDeliveries: deliveriesSnapshot.size,
      totalEarnings,
      averageRating: Math.round(averageRating * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
    };
  } catch (error) {
    const permissionError =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'permission-denied';

    if (!permissionError) {
      console.error('Error fetching user stats:', error);
    }

    return getDefaultUserStats();
  }
}

export async function getDetailedUserStats(userId: string): Promise<DetailedUserStatsResult> {
  try {
    const baseStats = await getUserStats(userId);
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as UserDoc | undefined;
    const createdAt = toDate(userData?.createdAt);

    const accountAgeDays = createdAt
      ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDeliveriesQuery = query(
      collection(db, 'deliveries'),
      where('gillerId', '==', userId),
      where('status', '==', 'delivered'),
      where('completedAt', '>=', thirtyDaysAgo)
    );
    const recentDeliveriesSnapshot = await getDocs(recentDeliveriesQuery);

    const recentPenaltiesQuery = query(
      collection(db, 'penalties'),
      where('userId', '==', userId),
      where('createdAt', '>=', thirtyDaysAgo)
    );
    const recentPenaltiesSnapshot = await getDocs(recentPenaltiesQuery);

    return {
      ...baseStats,
      recent30DaysDeliveries: recentDeliveriesSnapshot.size,
      recentPenalties: recentPenaltiesSnapshot.size,
      accountAgeDays,
    };
  } catch (error) {
    console.error('Error fetching detailed user stats:', error);
    return getDefaultDetailedUserStats();
  }
}

export async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      fcmToken: token,
      fcmTokenUpdatedAt: serverTimestamp(),
    });
    console.warn('FCM token saved for user:', userId);
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw error;
  }
}

export async function getUserDeliveryHistory(userId: string, limitCount: number = 20): Promise<UserHistoryItem[]> {
  try {
    const requestsQuery = query(collection(db, 'requests'), where('gllerId', '==', userId));
    const snapshot = await getDocs(requestsQuery);

    const history = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return {
        requestId: docSnapshot.id,
        ...data,
        createdAt: toDate(data.createdAt),
      };
    });

    history.sort((left, right) => {
      const leftTime = left.createdAt?.getTime() ?? 0;
      const rightTime = right.createdAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });

    return history.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching delivery history:', error);
    return [];
  }
}

export async function updateLastActive(userId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      lastActiveAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating last active:', error);
  }
}

export async function createUser(
  userId: string,
  email: string,
  name: string,
  role: UserRole = UserRole.GLER,
  authProvider: AuthProviderType = AuthProviderType.UNKNOWN
): Promise<User> {
  try {
    const userRef = doc(db, 'users', userId);

    const userDoc: User = {
      uid: userId,
      email,
      name,
      phoneNumber: '',
      authProvider,
      authProviderUserId: userId,
      signupMethod:
        authProvider === AuthProviderType.GOOGLE
          ? 'google'
          : authProvider === AuthProviderType.KAKAO
            ? 'kakao'
            : authProvider === AuthProviderType.EMAIL
              ? 'email'
              : 'unknown',
      providerLinkedAt: serverTimestamp() as User['providerLinkedAt'],
      role,
      agreedTerms: {
        giller: true,
        gller: true,
        privacy: true,
        marketing: false,
      },
      rating: 5,
      totalRatings: 0,
      isActive: true,
      isVerified: false,
      gillerInfo: {
        totalDeliveries: 0,
        totalEarnings: 0,
        equipment: {
          hasInsulatedBag: false,
          hasHeatedBag: false,
          vehicleType: 'walk',
        },
      },
      gllerInfo: {
        totalRequests: 0,
        successfulDeliveries: 0,
      },
      stats: {
        completedDeliveries: 0,
        totalEarnings: 0,
        rating: 5,
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
      pointBalance: 0,
      totalEarnedPoints: 0,
      totalSpentPoints: 0,
      createdAt: serverTimestamp() as User['createdAt'],
      updatedAt: serverTimestamp() as User['updatedAt'],
    };

    await setDoc(userRef, userDoc);
    console.warn('User created in Firestore:', userId);
    return userDoc;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function getRequestsByRequester(requesterId: string): Promise<Request[]> {
  return await getRequestsByRequesterFromRequestService(requesterId);
}

export type { Badge };
