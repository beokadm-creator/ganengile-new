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
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Rating interface
 */
export interface Rating {
  ratingId: string;
  matchId: string;
  fromUserId: string;
  toUserId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

/**
 * Submit a rating
 * @param matchId Match/Request ID
 * @param fromUserId Rating from user ID
 * @param toUserId Rating to user ID
 * @param rating Rating (1-5)
 * @param comment Optional comment
 * @returns Created rating ID
 */
export async function submitRating(
  matchId: string,
  fromUserId: string,
  toUserId: string,
  rating: number,
  comment?: string
): Promise<string> {
  try {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Check if already rated
    const existingQuery = query(
      collection(db, 'ratings'),
      where('matchId', '==', matchId),
      where('fromUserId', '==', fromUserId)
    );

    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new Error('Already rated this match');
    }

    // Create rating
    const ratingData = {
      matchId,
      fromUserId,
      toUserId,
      rating,
      comment: comment || '',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'ratings'), ratingData);

    console.log('✅ Rating submitted:', docRef.id);

    // Update user's average rating (denormalize)
    await updateUserRating(toUserId);

    return docRef.id;
  } catch (error) {
    console.error('Error submitting rating:', error);
    throw error;
  }
}

/**
 * Get user's average rating
 * @param userId User ID
 * @returns Average rating and total count
 */
export async function getUserRating(userId: string): Promise<{
  averageRating: number;
  totalRatings: number;
  distribution: { [key: number]: number };
}> {
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
      const rating = data.rating as number;

      total += rating;
      count++;
      distribution[rating]++;
    });

    const averageRating = count > 0 ? total / count : 0;

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
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
 * Update user's denormalized rating in users collection
 * @param userId User ID
 */
async function updateUserRating(userId: string): Promise<void> {
  try {
    const { averageRating, totalRatings } = await getUserRating(userId);

    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      rating: averageRating,
      totalRatings,
      ratingUpdatedAt: serverTimestamp(),
    });

    console.log(`✅ Updated rating for user ${userId}: ${averageRating} (${totalRatings} ratings)`);
  } catch (error) {
    console.error('Error updating user rating:', error);
  }
}

/**
 * Get ratings for a user
 * @param userId User ID
 * @param limit Max number of ratings
 * @returns Array of ratings
 */
export async function getUserRatings(
  userId: string,
  limit: number = 20
): Promise<Rating[]> {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const ratings: Rating[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      ratings.push({
        ratingId: docSnapshot.id,
        matchId: data.matchId,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        rating: data.rating,
        comment: data.comment,
        createdAt: data.createdAt?.toDate() || new Date(),
      });
    });

    return ratings.slice(0, limit);
  } catch (error) {
    console.error('Error getting user ratings:', error);
    return [];
  }
}

/**
 * Get rating for a specific match
 * @param matchId Match ID
 * @param fromUserId From user ID
 * @returns Rating or null
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
      comment: data.comment,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error getting match rating:', error);
    return null;
  }
}

/**
 * Check if user can rate a match
 * @param matchId Match ID
 * @param userId User ID
 * @returns True if can rate
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
