import type { User } from '../types/user';
import { AuthProviderType } from '../types/user';
import type { KakaoUserInfo } from './kakao-auth';

export interface SocialAuthProfile {
  provider: AuthProviderType;
  providerUserId: string;
  email?: string;
  name?: string;
  profileImage?: string;
}

export function normalizeKakaoProfile(profile: KakaoUserInfo): SocialAuthProfile {
  return {
    provider: AuthProviderType.KAKAO,
    providerUserId: profile.id,
    email: profile.email ?? undefined,
    name: profile.nickname ?? undefined,
    profileImage: profile.profileImageUrl,
  };
}

export function buildUserAuthPatch(profile: SocialAuthProfile): Partial<User> {
  return {
    authProvider: profile.provider,
    authProviderUserId: profile.providerUserId,
    signupMethod:
      profile.provider === AuthProviderType.KAKAO
        ? 'kakao'
        : profile.provider === AuthProviderType.GOOGLE
          ? 'google'
          : profile.provider === AuthProviderType.EMAIL
            ? 'email'
            : 'unknown',
    providerLinkedAt: undefined as never,
    email: profile.email ?? '',
    name: profile.name ?? '사용자',
    profilePhoto: profile.profileImage,
  };
}

export function getSocialAuthActionMessage(provider: AuthProviderType): string {
  switch (provider) {
    case AuthProviderType.KAKAO:
      return '카카오 간편가입을 우선 사용하고, 길러 승인과 위험 거래에서만 별도 본인인증을 진행합니다.';
    case AuthProviderType.GOOGLE:
      return 'Google 로그인은 fallback 로그인 수단으로 유지합니다.';
    case AuthProviderType.EMAIL:
    default:
      return '이메일 로그인은 보조 로그인 수단으로 유지합니다.';
  }
}
