/**
 * Google Authentication Service
 * Firebase Auth Google Provider
 */

import { GoogleAuthProvider, signInWithCredential, signInWithPopup, User } from 'firebase/auth';
import { auth } from './firebase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Configure AuthSession
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Configuration
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: undefined, // Default scheme
});

/**
 * Google 로그인 (Web)
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    // Web 환경에서는 Firebase Auth의 Popup을 사용
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    throw new Error('Google 로그인에 실패했습니다.');
  }
}

/**
 * Google 로그인 (React Native - Expo AuthSession)
 */
export async function signInWithGoogleNative(): Promise<User> {
  try {
    // Expo AuthSession 사용
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: GOOGLE_REDIRECT_URI,
      scopes: ['openid', 'profile', 'email'],
      responseType: 'token',
    });

    const [result, response] = await request.promptAsync(discovery);

    if (result === 'success' && response.params) {
      const { access_token } = response.params;

      // Firebase credential 생성
      const credential = GoogleAuthProvider.credential(access_token);

      // Firebase에 로그인
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    } else {
      throw new Error('Google 인증이 취소되었습니다.');
    }
  } catch (error: any) {
    console.error('Google native sign-in error:', error);
    throw new Error('Google 로그인에 실패했습니다.');
  }
}

/**
 * 플랫폼에 따라 Google 로그인 수행
 */
export async function handleGoogleSignIn(): Promise<User> {
  // Web 환경 확인
  if (typeof window !== 'undefined' && window.location) {
    return signInWithGoogle();
  }

  // Native 환경
  return signInWithGoogleNative();
}
