/**
 * Typography Design Tokens
 * 폰트 사이즈, 굵기, 행간 토큰
 *
 * 디자인 원칙:
 * - 핵심 수치/상태: fontWeight extrabold(800) + 큰 fontSize
 * - 설명 텍스트: fontWeight regular(400) + gray 컬러
 * - body 기준: base(14px) — 모바일 한 손 조작 환경
 */

export const Typography = {
  // ─── Font Sizes ────────────────────────────────────────
  fontSize: {
    xs: 11,
    sm: 12,
    base: 14,   // body 기본
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
  },

  // ─── Font Weights ──────────────────────────────────────
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // ─── Line Heights ──────────────────────────────────────
  lineHeight: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.75,
  },

  // ─── Shorthand presets ─────────────────────────────────
  h1: { fontSize: 28, fontWeight: '800' as const, lineHeight: 36 },
  h2: { fontSize: 24, fontWeight: '800' as const, lineHeight: 30 },
  h3: { fontSize: 20, fontWeight: '700' as const, lineHeight: 28 },
  h4: { fontSize: 16, fontWeight: '700' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  body1: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  body2: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  bodyBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 22 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 16 },
  label: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
};

export const FontFamily = {
  default: 'System',
  ios: 'SF Pro Text',
  android: 'Roboto',
};
