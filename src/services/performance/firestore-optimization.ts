import {
  collection,
  getDocs,
  limit,
  query,
  startAfter,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface PaginationResult<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

export async function paginatedQuery<T extends Record<string, unknown>>(
  collectionName: string,
  constraints: QueryConstraint[],
  pageSize = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginationResult<T>> {
  const queryConstraints = [...constraints];
  if (lastDoc) {
    queryConstraints.push(startAfter(lastDoc));
  }
  queryConstraints.push(limit(pageSize));

  const snapshot = await getDocs(query(collection(db, collectionName), ...queryConstraints));
  const data = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }) as unknown as T);

  return {
    data,
    hasMore: data.length === pageSize,
    lastDoc: snapshot.docs.at(-1),
  };
}

export async function getUserActiveRoutes(
  userId: string,
  pageSize = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginationResult<Record<string, unknown>>> {
  return paginatedQuery('routes', [], pageSize, lastDoc);
}

export async function getPendingRequests(
  pageSize = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginationResult<Record<string, unknown>>> {
  return paginatedQuery('requests', [], pageSize, lastDoc);
}

export async function getActiveMatches(
  requestId: string,
  pageSize = 10,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginationResult<Record<string, unknown>>> {
  return paginatedQuery('matches', [], pageSize, lastDoc);
}

export async function getGillerDeliveries(
  gillerId: string,
  status?: string,
  pageSize = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginationResult<Record<string, unknown>>> {
  return paginatedQuery('deliveries', [], pageSize, lastDoc);
}

export class QueryPerformanceMonitor {
  private queryStats = new Map<string, number[]>();

  recordQuery(collectionName: string, duration: number): void {
    const current = this.queryStats.get(collectionName) ?? [];
    this.queryStats.set(collectionName, [...current, duration]);
  }

  getStats(collectionName: string) {
    const durations = this.queryStats.get(collectionName) ?? [];
    if (durations.length === 0) return null;

    const avg = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    return {
      count: durations.length,
      avg: avg.toFixed(2),
      max: Math.max(...durations).toFixed(2),
      min: Math.min(...durations).toFixed(2),
    };
  }

  getAllStats(): Record<string, ReturnType<QueryPerformanceMonitor['getStats']>> {
    const stats: Record<string, ReturnType<QueryPerformanceMonitor['getStats']>> = {};
    for (const collectionName of this.queryStats.keys()) {
      stats[collectionName] = this.getStats(collectionName);
    }
    return stats;
  }
}

export const queryMonitor = new QueryPerformanceMonitor();
