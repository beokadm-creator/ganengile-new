/**
 * Firestore Query Optimization Guide
 * Indexes, Cursors, and Best Practices
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

// ==================== Index Composition ====================

/**
 * Recommended Firestore Indexes for this app
 * 
 * Create these indexes in Firebase Console:
 * 1. routes: {isActive, userId}
 * 2. routes: {isActive, daysOfWeek}
 * 3. requests: {requesterId, createdAt}
 * 4. requests: {status, createdAt}
 * 5. matches: {requestId, status}
 * 6. matches: {gillerId, status}
 * 7. deliveries: {gillerId, status}
 * 8. deliveries: {requesterId, status}
 */

// ==================== Cursor Pagination ====================

export interface PaginationResult<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: any;
}

/**
 * Paginated query with cursor
 * More efficient than offset-based pagination
 */
export async function paginatedQuery<T>(
  collectionName: string,
  constraints: any[],
  pageSize: number = 20,
  lastDoc?: any
): Promise<PaginationResult<T>> {
  try {
    let q = query(collection(db, collectionName), ...constraints);

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    q = query(q, limit(pageSize));

    const snapshot = await getDocs(q);
    const data: T[] = [];

    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() } as T);
    });

    return {
      data,
      hasMore: data.length === pageSize,
      lastDoc: snapshot.docs[snapshot.docs.length - 1],
    };
  } catch (error) {
    console.error('Pagination error:', error);
    return {
      data: [],
      hasMore: false,
    };
  }
}

// ==================== Optimized Query Builders ====================

/**
 * Get active routes for a user with pagination
 */
export async function getUserActiveRoutes(
  userId: string,
  pageSize: number = 20,
  lastDoc?: any
): Promise<PaginationResult<any>> {
  const constraints = [
    where('userId', '==', userId),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
  ];

  return paginatedQuery('routes', constraints, pageSize, lastDoc);
}

/**
 * Get pending requests with pagination
 */
export async function getPendingRequests(
  pageSize: number = 20,
  lastDoc?: any
): Promise<PaginationResult<any>> {
  const constraints = [
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  ];

  return paginatedQuery('requests', constraints, pageSize, lastDoc);
}

/**
 * Get active matches for a request
 */
export async function getActiveMatches(
  requestId: string,
  pageSize: number = 10,
  lastDoc?: any
): Promise<PaginationResult<any>> {
  const constraints = [
    where('requestId', '==', requestId),
    where('status', '==', 'pending'),
    orderBy('matchScore', 'desc'),
  ];

  return paginatedQuery('matches', constraints, pageSize, lastDoc);
}

/**
 * Get deliveries for giller with status filter
 */
export async function getGillerDeliveries(
  gillerId: string,
  status?: string,
  pageSize: number = 20,
  lastDoc?: any
): Promise<PaginationResult<any>> {
  const constraints = [
    where('gillerId', '==', gillerId),
  ];

  if (status) {
    constraints.push(where('status', '==', status));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  return paginatedQuery('deliveries', constraints, pageSize, lastDoc);
}

// ==================== Query Optimization Tips ====================

/**
 * OPTIMIZATION CHECKLIST:
 * 
 * 1. USE INDEXES
 *    - Create composite indexes for frequently queried field combinations
 *    - Use Firebase Console to analyze slow queries
 * 
 * 2. LIMIT RESULTS
 *    - Always use limit() to prevent fetching too much data
 *    - Use pagination for large datasets
 * 
 * 3. SELECTIVE QUERIES
 *    - Only query fields you need
 *    - Avoid fetching entire documents when possible
 * 
 * 4. USE CURSORS
 *    - Use startAfter() for pagination instead of offset()
 *    - More efficient than skipping documents
 * 
 * 5. AVOID OR QUERIES
 *    - Firestore doesn't support OR queries natively
 *    - Use separate queries or use array-contains for arrays
 * 
 * 6. BATCH OPERATIONS
 *    - Use batched writes for multiple documents
 *    - Limit batch size to 500 operations
 * 
 * 7. LISTEN STRATEGY
 *    - Use onSnapshot for real-time updates selectively
 *    - Unsubscribe listeners when not needed
 * 
 * 8. OFFLINE SUPPORT
 *    - Enable offline persistence for better UX
 *    - Handle offline states gracefully
 * 
 * EXAMPLES:
 */

// ❌ BAD: Fetches all documents
const badQuery1 = query(
  collection(db, 'routes'),
  where('userId', '==', userId)
);

// ✅ GOOD: Limits results and uses index
const goodQuery1 = query(
  collection(db, 'routes'),
  where('userId', '==', userId),
  where('isActive', '==', true),
  orderBy('createdAt', 'desc'),
  limit(20)
);

// ❌ BAD: Multiple round trips
const badQuery2 = await getDocs(
  query(collection(db, 'requests'), where('status', '==', 'pending'))
);
const requests1 = badQuery2.docs.map(doc => doc.data());

const badQuery3 = await getDocs(
  query(collection(db, 'requests'), where('status', '==', 'matched'))
);
const requests2 = badQuery3.docs.map(doc => doc.data());

// ✅ GOOD: Single query with in operator (if possible)
const goodQuery2 = await getDocs(
  query(
    collection(db, 'requests'),
    where('status', 'in', ['pending', 'matched'])
  )
);

// ❌ BAD: No index, slow on large collections
const badQuery4 = query(
  collection(db, 'deliveries'),
  where('gillerId', '==', gillerId),
  where('status', '==', 'completed'),
  orderBy('createdAt', 'desc')
);

// ✅ GOOD: Uses composite index
// Index needed: {gillerId, status, createdAt}
const goodQuery3 = query(
  collection(db, 'deliveries'),
  where('gillerId', '==', gillerId),
  where('status', '==', 'completed'),
  orderBy('createdAt', 'desc'),
  limit(50)
);

// ==================== Firestore Index Setup Guide ====================

/**
 * HOW TO CREATE COMPOSITE INDEXES:
 * 
 * 1. Go to Firebase Console → Firestore → Indexes
 * 2. Click "Add Index"
 * 3. Select collection and fields:
 * 
 * Example: routes collection
 * - Field 1: isActive (Ascending)
 * - Field 2: userId (Ascending)
 * 
 * Example: matches collection
 * - Field 1: requestId (Ascending)
 * - Field 2: matchScore (Descending)
 * 
 * AUTO-CREATED INDEXES:
 * - Single field indexes are auto-created
 * - Only need to create composite indexes
 * 
 * INDEX SIZING:
 * - Each index entry adds to storage
 * - Only index frequently queried fields
 * - Remove unused indexes periodically
 */

// ==================== Query Performance Monitoring ====================

export class QueryPerformanceMonitor {
  private queryStats: Map<string, number[]> = new Map();

  recordQuery(collectionName: string, duration: number): void {
    if (!this.queryStats.has(collectionName)) {
      this.queryStats.set(collectionName, []);
    }

    this.queryStats.get(collectionName)!.push(duration);

    // Warn if query takes too long
    if (duration > 1000) {
      console.warn(`⚠️ Slow query detected in ${collectionName}: ${duration}ms`);
    }
  }

  getStats(collectionName: string) {
    const durations = this.queryStats.get(collectionName) || [];
    if (durations.length === 0) return null;

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);

    return {
      count: durations.length,
      avg: avg.toFixed(2),
      max: max.toFixed(2),
      min: min.toFixed(2),
    };
  }

  getAllStats() {
    const stats: any = {};
    for (const [collection, durations] of this.queryStats.entries()) {
      stats[collection] = this.getStats(collection);
    }
    return stats;
  }
}

export const queryMonitor = new QueryPerformanceMonitor();
