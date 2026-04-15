import * as WebBrowser from 'expo-web-browser';
import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';
import { AuthProviderType, UserRole, type User } from '../types/user';
import { getIdentityIntegrationConfig } from './integration-config-service';

// Fallback to env if admin config is missing
const FALLBACK_KAKAO_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_APP_KEY ?? '';
const FALLBACK_KAKAO_REDIRECT_URI =
  process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI ?? 'https://ganengile.firebaseapp.com/__/auth/handler';

// State 파라미터 생성 헬퍼
function generateState(): string {
  return Math.random().toString(36).substring(2, 15);
}

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

// 1. 카카오 로그인 인가 코드(Auth Code)를 받아오기 위한 URL 생성
function getKakaoAuthUrl(clientId: string, redirectUri: string, state: string): string {
  return `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
}

// 2. 받아온 인가 코드로 카카오 Access Token 요청
async function exchangeKakaoCode(code: string, clientId: string, redirectUri: string): Promise<string> {
  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
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

/**
 * 카카오 로그인을 수행하고 사용자 정보를 반환합니다.
 */
export async function signInWithKakao(): Promise<KakaoUserInfo> {
  // 1. Get configs from Firestore Admin Settings
  const identityConfig = await getIdentityIntegrationConfig();
  const clientId = identityConfig?.providers?.kakao?.clientId || FALLBACK_KAKAO_APP_KEY;
  const redirectUri = identityConfig?.providers?.kakao?.redirectUri || identityConfig?.providers?.kakao?.callbackUrl || FALLBACK_KAKAO_REDIRECT_URI;

  if (!clientId) {
    throw new Error('카카오 API 키(Client ID)가 설정되어 있지 않습니다.');
  }

  // 2. 카카오 로그인 페이지(웹뷰) 오픈
  const state = generateState();
  const authUrl = getKakaoAuthUrl(clientId, redirectUri, state);
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
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

  const accessToken = await exchangeKakaoCode(code, clientId, redirectUri);
  return fetchKakaoUserInfo(accessToken);
}

/**
 * 카카오 로그인 (통합 파이프라인)
 * 1. 카카오 로그인 및 토큰 발급
 * 2. Firebase Cloud Function을 통한 Custom Token 발급 및 로그인
 */
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
  return FALLBACK_KAKAO_APP_KEY
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
