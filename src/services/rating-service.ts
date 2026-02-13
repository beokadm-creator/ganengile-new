/**
 * Rating Service
 * 사용자 평가 시스템
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
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Rating,
  CreateRatingData,
  RatingTag,
  UserRatingStats,
  RatingSummary,
  ReviewItem,
} from '../types/rating';
import { notifyDeliveryEvent } from './notification-service';
import { NotificationType } from '../types/chat';

/**
 * Submit a rating with tags and anonymous option
 */
export async function submitRating(
  matchId: string,
  fromUserId: string,
  toUserId: string,
  rating: number,
  tags: RatingTag[],
  comment?: string,
  isAnonymous: boolean = false
): Promise<string> {
  try {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const existingQuery = query(
      collection(db, 'ratings'),
      where('matchId', '==', matchId),
      where('fromUserId', '==', fromUserId)
    );

    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new Error('Already rated this match');
    }

    const ratingData = {
      matchId,
      fromUserId,
      toUserId,
      rating,
      tags,
      comment: comment || '',
      isAnonymous,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'ratings'), ratingData);

    console.log('✅ Rating submitted:', docRef.id);

    await updateUserRatingStats(toUserId);
    await notifyDeliveryEvent(toUserId, NotificationType.RATING_RECEIVED, {
      rating: rating.toString(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error submitting rating:', error);
    throw error;
  }
}

/**
 * Get user's rating summary
 */
export async function getUserRating(userId: string): Promise<RatingSummary> {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('toUserId', '==', userId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        averageRating: 0,
        totalRatings: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    let total = 0;
    let count = 0;
    const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const ratingValue = data.rating as number;

      total += ratingValue;
      count++;
      distribution[ratingValue]++;
    });

    const averageRating = count > 0 ? total / count : 0;

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings: count,
      distribution,
    };
  } catch (error) {
    console.error('Error getting user rating:', error);
    return {
      averageRating: 0,
      totalRatings: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
}

/**
 * Get user's rating stats with tag statistics
 */
export async function getUserRatingStats(userId: string): Promise<UserRatingStats> {
  try {
    const summary = await getUserRating(userId);

    const q = query(
      collection(db, 'ratings'),
      where('toUserId', '==', userId)
    );

    const snapshot = await getDocs(q);

    const tagStats: { [key in RatingTag]: number } = {
      [RatingTag.FRIENDLY]: 0,
      [RatingTag.FAST]: 0,
      [RatingTag.TRUSTWORTHY]: 0,
      [RatingTag.COMMUNICATIVE]: 0,
      [RatingTag.PUNCTUAL]: 0,
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let recentRatings = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const tags = data.tags || [];

      tags.forEach((tag: RatingTag) => {
        if (tagStats[tag] !== undefined) {
          tagStats[tag]++;
        }
      });

      const createdAt = data.createdAt?.toDate();
      if (createdAt && createdAt > thirtyDaysAgo) {
        recentRatings++;
      }
    });

    return {
      userId,
      averageRating: summary.averageRating,
      totalRatings: summary.totalRatings,
      distribution: summary.distribution,
      tagStats,
      recentRatings,
      updatedAt: Timestamp.now(),
    };
  } catch (error) {
    console.error('Error getting user rating stats:', error);
    return {
      userId,
      averageRating: 0,
      totalRatings: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      tagStats: {
        [RatingTag.FRIENDLY]: 0,
        [RatingTag.FAST]: 0,
        [RatingTag.TRUSTWORTHY]: 0,
        [RatingTag.COMMUNICATIVE]: 0,
        [RatingTag.PUNCTUAL]: 0,
      },
      recentRatings: 0,
      updatedAt: Timestamp.now(),
    };
  }
}

/**
 * Update user's rating stats in users collection
 */
async function updateUserRatingStats(userId: string): Promise<void> {
  try {
    const stats = await getUserRatingStats(userId);

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      await updateDoc(userRef, {
        rating: stats.averageRating,
        totalRatings: stats.totalRatings,
        ratingStats: {
          distribution: stats.distribution,
          tagStats: stats.tagStats,
          recentRatings: stats.recentRatings,
        },
        ratingUpdatedAt: serverTimestamp(),
      });
    }

    const ratingStatsRef = doc(db, 'users', userId, 'ratingStats', 'stats');
    await setDoc(ratingStatsRef, {
      ...stats,
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Updated rating stats for user ${userId}: ${stats.averageRating} (${stats.totalRatings} ratings)`);
  } catch (error) {
    console.error('Error updating user rating stats:', error);
  }
}

/**
 * Get ratings for a user with user info
 */
export async function getUserReviews(userId: string, limit: number = 20): Promise<ReviewItem[]> {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const reviews: ReviewItem[] = [];

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const fromUserId = data.fromUserId;

      let fromUserName = '익명';
      let fromUserProfileImage;

      if (!data.isAnonymous) {
        try {
          const userDoc = await getDoc(doc(db, 'users', fromUserId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            fromUserName = userData.name || '사용자';
            fromUserProfileImage = userData.profileImage;
          }
        } catch (e) {
          console.error('Error fetching user data:', e);
        }
      }

      reviews.push({
        ratingId: docSnapshot.id,
        rating: data.rating,
        tags: data.tags || [],
        comment: data.comment,
        fromUser: {
          userId: fromUserId,
          name: fromUserName,
          profileImage: fromUserProfileImage,
        },
        isAnonymous: data.isAnonymous || false,
        createdAt: data.createdAt?.toDate() || new Date(),
        matchId: data.matchId,
      });

      if (reviews.length >= limit) break;
    }

    return reviews;
  } catch (error) {
    console.error('Error getting user reviews:', error);
    return [];
  }
}

/**
 * Get rating for a specific match
 */
export async function getMatchRating(
  matchId: string,
  fromUserId: string
): Promise<Rating | null> {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('matchId', '==', matchId),
      where('fromUserId', '==', fromUserId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();
    return {
      ratingId: snapshot.docs[0].id,
      matchId: data.matchId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      rating: data.rating,
      tags: data.tags || [],
      comment: data.comment,
      isAnonymous: data.isAnonymous || false,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error getting match rating:', error);
    return null;
  }
}

/**
 * Check if user can rate a match
 */
export async function canRateMatch(matchId: string, userId: string): Promise<boolean> {
  try {
    const existing = await getMatchRating(matchId, userId);
    return existing === null;
  } catch (error) {
    console.error('Error checking if can rate:', error);
    return false;
  }
}
