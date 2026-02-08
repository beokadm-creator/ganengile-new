/**
 * Firebase Configuration & Initialization
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Initialize Messaging (may return null in React Native, requires additional setup)
let messagingInstance: Messaging | null = null;
try {
  messagingInstance = getMessaging(app);
} catch (error) {
  // Messaging may not be supported in all environments
  console.warn('Firebase Messaging not available:', error);
}
export const messaging: Messaging | null = messagingInstance;

// ==================== Auth Helpers ====================

/**
 * 현재 로그인된 사용자의 ID를 가져옵니다.
 * @returns 사용자 ID 또는 null (로그인되지 않은 경우)
 */
export function getCurrentUserId(): string | null {
  return auth.currentUser?.uid || null;
}

/**
 * 현재 로그인된 사용자의 ID를 가져옵니다.
 * 로그인되지 않은 경우 에러를 던집니다.
 * @returns 사용자 ID
 * @throws 로그인되지 않은 경우 에러
 */
export function requireUserId(): string {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('로그인이 필요합니다.');
  }
  return userId;
}

// Export app instance
export default app;
