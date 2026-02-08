/**
 * Firebase Core Module
 * Centralized Firebase exports for all services
 * 모든 서비스에서 사용하는 Firebase 모듈
 */

// Re-export from services/firebase
export {
  auth,
  db,
  storage,
  messaging,
  getCurrentUserId,
  requireUserId,
  default as app,
} from '../services/firebase';

// ==================== Firestore Helpers ====================

/**
 * Firestore collection helper
 * Type-safe collection reference 생성
 */
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { CollectionReference, DocumentReference, Query } from 'firebase/firestore';

/**
 * Get collection reference
 */
export function getCollection<T>(collectionPath: string): CollectionReference<T> {
  return collection(db, collectionPath) as CollectionReference<T>;
}

/**
 * Get document reference
 */
export function getDocumentRef<T>(collectionPath: string, docId: string): DocumentReference<T> {
  return doc(db, collectionPath, docId) as DocumentReference<T>;
}

/**
 * Commonly used Firestore functions (pre-bound with db)
 */
export const firestoreHelpers = {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  runTransaction,
};

// Re-export types
export type { Firestore, DocumentData, QueryDocumentSnapshot, CollectionReference, DocumentReference, Query } from 'firebase/firestore';
export type { Auth, User } from 'firebase/auth';
