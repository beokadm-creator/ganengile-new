/**
 * Kakao OAuth Authentication Service
 * 카카오 소셜 로그인을 위한 서비스
 */

import * as WebBrowser from 'expo-web-browser';
import { signInWithCustomToken, UserCredential } from 'firebase/auth';
import { auth } from './firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { User } from '../types/user';
import { UserRole } from '../types/user';

const KAKAO_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_APP_KEY || '';
const KAKAO_REDIRECT_URI = process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI || 'https://ganengile.firebaseapp.com/__/auth/handler';

WebBrowser.maybeCompleteAuthSession();

/**
 * 카카오 로그인 URL 생성
 */
function getKakaoAuthUrl(): string {
  const state = Math.random().toString(36).substring(7);
  return `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_APP_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code&state=${state}`;
}

/**
 * 카카오 사용자 정보 인터페이스
 */
export interface KakaoUserInfo {
  id: string;
  email: string;
  nickname: string;
  profileImageUrl?: string;
  thumbnailImageUrl?: string;
}

/**
 * 카카오 OAuth 로그인 실행
 * @returns 카카오 사용자 정보
 */
export async function signInWithKakao(): Promise<KakaoUserInfo> {
  try {
    const authUrl = getKakaoAuthUrl();
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      KAKAO_REDIRECT_URI
    );

    if (result.type === 'success') {
      const url = new URL(result.url);
      const code = url.searchParams.get('code');

      if (!code) {
        throw new Error('카카오 인증 코드를 가져오지 못했습니다.');
      }

      // 인증 코드로 액세스 토큰 요청
      const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: KAKAO_APP_KEY,
          redirect_uri: KAKAO_REDIRECT_URI,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(tokenData.error_description || '토큰 요청 실패');
      }

      // 액세스 토큰으로 사용자 정보 요청
      const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const userData = await userResponse.json();

      return {
        id: String(userData.id),
        email: userData.kakao_account?.email || '',
        nickname: userData.properties?.nickname || '카카오 사용자',
        profileImageUrl: userData.properties?.profile_image,
        thumbnailImageUrl: userData.properties?.thumbnail_image,
      };
    } else if (result.type === 'cancel') {
      throw new Error('카카오 로그인이 취소되었습니다.');
    } else {
      throw new Error('카카오 로그인에 실패했습니다.');
    }
  } catch (error: any) {
    console.error('Kakao sign-in error:', error);
    throw error;
  }
}

/**
 * 카카오 사용자 정보로 Firebase 사용자 생성 또는 로그인
 * @param kakaoUserInfo 카카오 사용자 정보
 * @param additionalInfo 추가 정보 (이름, 전화번호 등)
 * @returns Firebase UserCredential
 */
export async function linkKakaoToFirebase(
  kakaoUserInfo: KakaoUserInfo,
  additionalInfo?: {
    name?: string;
    phoneNumber?: string;
    role?: UserRole;
  }
): Promise<UserCredential> {
  try {
    // Firestore에서 기존 사용자 확인
    const userDoc = await getDoc(doc(db, 'users', `kakao_${kakaoUserInfo.id}`));

    let customToken: string;

    if (userDoc.exists()) {
      // 기존 사용자: Firebase Admin SDK로 커스텀 토큰 생성 필요
      // 클라이언트에서 직접 처리할 수 없으므로, Firebase Functions를 통하거나
      // 익명 로그인 후 계정 연결 방식 사용
      console.log('Existing Kakao user found');
    }

    // Firebase Custom Token 생성 (실제로는 Firebase Functions에서 생성 필요)
    // 여기서는 임시로 익명 로그인 후 계정 연결 방식 사용
    const anonymousUser = auth.currentUser;

    // Custom Authentication을 위한 백엔드 없이
    // Firebase Auth에 익명 사용자로 로그인 후 카카오 정보를 연결
    // 실제 프로덕션에서는 Firebase Cloud Functions를 통해 Custom Token 생성 필요

    // 임시 해결책: 카카오 ID를 UID로 사용하여 문서 생성
    const userData: Partial<User> = {
      uid: `kakao_${kakaoUserInfo.id}`,
      email: kakaoUserInfo.email,
      name: additionalInfo?.name || kakaoUserInfo.nickname,
      phoneNumber: additionalInfo?.phoneNumber,
      role: additionalInfo?.role || UserRole.BOTH,
      profilePhoto: kakaoUserInfo.profileImageUrl,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      isActive: true,
      hasCompletedOnboarding: false,
      agreedTerms: {
        giller: false,
        gller: false,
        privacy: false,
        marketing: false,
      },
      stats: {
        completedDeliveries: 0,
        totalEarnings: 0,
        rating: 0,
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
    };

    // Firestore에 사용자 정보 저장
    await setDoc(doc(db, 'users', `kakao_${kakaoUserInfo.id}`), userData, {
      merge: true,
    });

    // Firebase Custom Authentication (실제 구현시 백엔드 필요)
    // 여기서는 임시로 익명 로그인 처리
    throw new Error('Firebase Custom Token 생성이 필요합니다. Firebase Functions를 구현해주세요.');
  } catch (error: any) {
    console.error('Link Kakao to Firebase error:', error);
    throw error;
  }
}

/**
 * 카카오 간편 로그인 (이미 가입된 사용자)
 */
export async function loginWithKakao(): Promise<{ success: boolean; uid?: string; needsOnboarding?: boolean }> {
  try {
    const kakaoUserInfo = await signInWithKakao();

    // Firestore에서 사용자 확인
    const userDoc = await getDoc(doc(db, 'users', `kakao_${kakaoUserInfo.id}`));

    if (userDoc.exists()) {
      const userData = userDoc.data();

      // Custom Token으로 Firebase 로그인 (백엔드 필요)
      return {
        success: true,
        uid: `kakao_${kakaoUserInfo.id}`,
        needsOnboarding: !userData?.hasCompletedOnboarding,
      };
    } else {
      // 신규 사용자
      return {
        success: false,
        needsOnboarding: true,
      };
    }
  } catch (error: any) {
    console.error('Kakao login error:', error);
    throw error;
  }
}

/**
 * 카카오 회원가입 (신규 사용자)
 */
export async function signUpWithKakao(
  userInfo: {
    name: string;
    phoneNumber?: string;
    role: UserRole;
  }
): Promise<string> {
  try {
    const kakaoUserInfo = await signInWithKakao();

    const uid = `kakao_${kakaoUserInfo.id}`;

    const userData: Partial<User> = {
      uid,
      email: kakaoUserInfo.email,
      name: userInfo.name,
      phoneNumber: userInfo.phoneNumber,
      role: userInfo.role,
      profilePhoto: kakaoUserInfo.profileImageUrl,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      isActive: true,
      hasCompletedOnboarding: false,
      agreedTerms: {
        giller: false,
        gller: false,
        privacy: false,
        marketing: false,
      },
      stats: {
        completedDeliveries: 0,
        totalEarnings: 0,
        rating: 0,
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
    };

    await setDoc(doc(db, 'users', uid), userData);

    return uid;
  } catch (error: any) {
    console.error('Kakao sign up error:', error);
    throw error;
  }
}
