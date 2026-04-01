/**
 * Firebase Core Module
 * Re-export the canonical Firebase instance and helpers.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore';

import { db } from '../services/firebase';

export {
  auth,
  db,
  storage,
  messaging,
  getCurrentUserId,
  requireUserId,
  firebaseApp as app,
} from '../services/firebase';

export function getCollection<T>(collectionPath: string): CollectionReference<T> {
  return collection(db, collectionPath) as CollectionReference<T>;
}

export function getDocumentRef<T>(collectionPath: string, docId: string): DocumentReference<T> {
  return doc(db, collectionPath, docId) as DocumentReference<T>;
}

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

export type {
  CollectionReference,
  DocumentReference,
  DocumentData,
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
export type { Auth, User } from 'firebase/auth';
