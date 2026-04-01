/**
 * Color Design Tokens
 * 앱 전체에서 사용하는 색상 토큰
 *
 * 디자인 원칙:
 * - primary(틸 #0F766E)는 CTA·브랜드 강조에만 사용
 * - 층위: surface(#FFF) / appBg(#F4F7F5) / primaryMint(#D7F2EC)
 * - 장식 목적의 컬러 사용 금지
 */

export const Colors = {
  // ─── Brand ─────────────────────────────────────────────
  primary: '#0F766E',       // Dark teal — CTA, 브랜드 강조
  primaryDark: '#0D5F58',   // Pressed state
  primaryLight: '#14B8A6',  // Hover / active state
  primaryMint: '#D7F2EC',   // Hero bg, 강조 섹션 배경

  // ─── Secondary ─────────────────────────────────────────
  secondary: '#16A34A',     // Green — 성공, 완료 상태
  secondaryDark: '#15803D',
  secondaryLight: '#DCFCE7',

  // ─── Accent ────────────────────────────────────────────
  accent: '#D97706',        // Amber — 경고, 긴급 하이라이트
  accentDark: '#B45309',
  accentLight: '#FEF3C7',

  // ─── Semantic ──────────────────────────────────────────
  success: '#16A34A',
  successLight: '#DCFCE7',
  successDark: '#15803D',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningDark: '#B45309',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  errorDark: '#B91C1C',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  infoDark: '#1D4ED8',

  // ─── Gray scale (Tailwind Slate 기반) ──────────────────
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // ─── Base ──────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)' as const,

  // ─── Flat aliases (레이아웃 기본값) ────────────────────
  background: '#F4F7F5',    // 앱 전체 배경
  surface: '#FFFFFF',       // 카드, 모달 배경
  border: '#E2E8F0',        // 기본 구분선
  errorBackground: '#FEE2E2',

  // ─── Text ──────────────────────────────────────────────
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textWhite: '#FFFFFF',
  textDisabled: '#94A3B8',

  // 중첩 객체 alias (기존 호환)
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#64748B',
    white: '#FFFFFF',
    disabled: '#94A3B8',
    inverse: '#FFFFFF',
  },
};

export type ColorKeys = keyof typeof Colors;
