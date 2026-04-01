import { AuthProviderType } from '../src/types/user';
import {
  buildUserAuthPatch,
  getSocialAuthActionMessage,
  normalizeKakaoProfile,
} from '../src/services/social-auth-service';

describe('social auth service', () => {
  it('normalizes kakao profiles into a common social auth profile', () => {
    const normalized = normalizeKakaoProfile({
      id: '12345',
      email: 'user@example.com',
      nickname: '카카오사용자',
      profileImageUrl: 'https://example.com/profile.png',
    });

    expect(normalized.provider).toBe(AuthProviderType.KAKAO);
    expect(normalized.providerUserId).toBe('12345');
    expect(normalized.email).toBe('user@example.com');
  });

  it('builds a user auth patch from a social auth profile', () => {
    const patch = buildUserAuthPatch({
      provider: AuthProviderType.KAKAO,
      providerUserId: 'kakao-1',
      email: 'user@example.com',
      name: '테스트',
      profileImage: 'https://example.com/profile.png',
    });

    expect(patch.authProvider).toBe(AuthProviderType.KAKAO);
    expect(patch.authProviderUserId).toBe('kakao-1');
    expect(patch.signupMethod).toBe('kakao');
    expect(patch.email).toBe('user@example.com');
  });

  it('returns provider-specific auth action guidance', () => {
    expect(getSocialAuthActionMessage(AuthProviderType.KAKAO)).toContain('카카오');
    expect(getSocialAuthActionMessage(AuthProviderType.GOOGLE)).toContain('Google');
  });
});
