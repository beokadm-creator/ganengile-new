import * as WebBrowser from 'expo-web-browser';
import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';
import { AuthProviderType, UserRole, type User } from '../types/user';

const KAKAO_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_APP_KEY ?? '';
const KAKAO_REDIRECT_URI =
  process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI ?? 'https://ganengile.firebaseapp.com/__/auth/handler';

WebBrowser.maybeCompleteAuthSession();

type KakaoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type KakaoCallablePayload = {
  accessToken: string;
  expectedKakaoId: string;
  role?: UserRole;
  name?: string;
  phoneNumber?: string;
};

type KakaoCallableResult = {
  customToken: string;
  uid: string;
  isNewUser: boolean;
};

export interface KakaoUserInfo {
  id: string;
  email: string;
  nickname: string;
  profileImageUrl?: string;
  thumbnailImageUrl?: string;
  accessToken: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getKakaoAuthUrl(): string {
  const state = Math.random().toString(36).slice(2);
  return `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_APP_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code&state=${state}`;
}

async function exchangeKakaoCode(code: string): Promise<string> {
  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KAKAO_APP_KEY,
      redirect_uri: KAKAO_REDIRECT_URI,
      code,
    }).toString(),
  });

  const payload = (await response.json()) as KakaoTokenResponse;
  const accessToken = payload.access_token;
  if (!response.ok || !accessToken) {
    throw new Error(payload.error_description ?? '카카오 토큰 발급에 실패했습니다.');
  }

  return accessToken;
}

async function fetchKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
  const response = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json()) as Record<string, unknown>;
  const rawId = payload.id;
  if (!response.ok || (typeof rawId !== 'string' && typeof rawId !== 'number')) {
    throw new Error('카카오 사용자 정보를 불러오지 못했습니다.');
  }

  const kakaoAccount = typeof payload.kakao_account === 'object' && payload.kakao_account !== null
    ? (payload.kakao_account as Record<string, unknown>)
    : {};
  const properties = typeof payload.properties === 'object' && payload.properties !== null
    ? (payload.properties as Record<string, unknown>)
    : {};

  return {
    id: String(rawId),
    email: typeof kakaoAccount.email === 'string' ? kakaoAccount.email : '',
    nickname: typeof properties.nickname === 'string' ? properties.nickname : '카카오 사용자',
    profileImageUrl: typeof properties.profile_image === 'string' ? properties.profile_image : undefined,
    thumbnailImageUrl: typeof properties.thumbnail_image === 'string' ? properties.thumbnail_image : undefined,
    accessToken,
  };
}

async function issueCustomToken(payload: KakaoCallablePayload): Promise<KakaoCallableResult> {
  const callable = httpsCallable<KakaoCallablePayload, KakaoCallableResult>(getFunctions(), 'issueKakaoCustomToken');
  const result = await callable(payload);
  return result.data;
}

export async function signInWithKakao(): Promise<KakaoUserInfo> {
  if (!KAKAO_APP_KEY) {
    throw new Error('카카오 앱 키가 설정되지 않았습니다.');
  }

  const result = await WebBrowser.openAuthSessionAsync(getKakaoAuthUrl(), KAKAO_REDIRECT_URI);
  if (result.type !== 'success') {
    if (result.type === 'cancel') {
      throw new Error('카카오 로그인이 취소되었습니다.');
    }
    throw new Error('카카오 로그인에 실패했습니다.');
  }

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error('카카오 인증 코드를 받지 못했습니다.');
  }

  const accessToken = await exchangeKakaoCode(code);
  return fetchKakaoUserInfo(accessToken);
}

export async function loginWithKakao(): Promise<{ success: boolean; uid?: string; needsOnboarding?: boolean }> {
  const kakaoUser = await signInWithKakao();
  const issued = await issueCustomToken({
    accessToken: kakaoUser.accessToken,
    expectedKakaoId: kakaoUser.id,
  });

  await signInWithCustomToken(auth, issued.customToken);

  return {
    success: true,
    uid: issued.uid,
    needsOnboarding: issued.isNewUser,
  };
}

export async function signUpWithKakao(userInfo: {
  name: string;
  phoneNumber?: string;
  role: UserRole;
}): Promise<string> {
  const kakaoUser = await signInWithKakao();
  const issued = await issueCustomToken({
    accessToken: kakaoUser.accessToken,
    expectedKakaoId: kakaoUser.id,
    role: userInfo.role,
    name: userInfo.name,
    phoneNumber: userInfo.phoneNumber,
  });

  await signInWithCustomToken(auth, issued.customToken);
  return issued.uid;
}

export async function linkKakaoToFirebase(
  kakaoUserInfo: KakaoUserInfo,
  additionalInfo?: { name?: string; phoneNumber?: string; role?: UserRole }
): Promise<{ uid: string }> {
  const issued = await issueCustomToken({
    accessToken: kakaoUserInfo.accessToken,
    expectedKakaoId: kakaoUserInfo.id,
    role: additionalInfo?.role,
    name: additionalInfo?.name,
    phoneNumber: additionalInfo?.phoneNumber,
  });

  await signInWithCustomToken(auth, issued.customToken);
  return { uid: issued.uid };
}

export function getKakaoAuthSetupMessage(): string {
  return KAKAO_APP_KEY
    ? '카카오 로그인 설정이 연결되어 있습니다.'
    : '카카오 앱 키를 설정하면 카카오 로그인을 사용할 수 있습니다.';
}

export function buildKakaoAuthPatch(kakaoUserInfo: KakaoUserInfo): Partial<User> {
  return {
    authProvider: AuthProviderType.KAKAO,
    authProviderUserId: kakaoUserInfo.id,
    signupMethod: 'kakao',
    email: kakaoUserInfo.email,
    name: kakaoUserInfo.nickname,
    profilePhoto: kakaoUserInfo.profileImageUrl,
  };
}

export function getKakaoLoginErrorMessage(error: unknown): string {
  return getErrorMessage(error, '카카오 로그인에 실패했습니다.');
}
