/**
 * Typography Design Tokens
 * 폰트 사이즈, 굵기, 행간 토큰
 *
 * 디자인 원칙:
 * - 핵심 수치/상태: fontWeight extrabold(800) + 큰 fontSize
 * - 설명 텍스트: fontWeight regular(400) + gray 컬러
 * - body 기준: base(14px) — 모바일 한 손 조작 환경
 */

const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,   // body 기본
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
};

const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

const lineHeight = {
  tight: 1.2,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.75,
};

export const Typography = {
  // ─── Font Sizes ────────────────────────────────────────
  fontSize,

  // ─── Font Weights ──────────────────────────────────────
  fontWeight,

  // ─── Line Heights ──────────────────────────────────────
  lineHeight,

  // ─── Shorthand presets ─────────────────────────────────
  h1: { fontSize: fontSize['4xl'], fontWeight: fontWeight.extrabold, lineHeight: 36 },
  h2: { fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold, lineHeight: 30 },
  h3: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, lineHeight: 28 },
  h4: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, lineHeight: 24 },
  body: { fontSize: fontSize.base, fontWeight: fontWeight.regular, lineHeight: 22 },
  body1: { fontSize: fontSize.base, fontWeight: fontWeight.regular, lineHeight: 22 },
  body2: { fontSize: fontSize.sm, fontWeight: fontWeight.regular, lineHeight: 18 },
  bodyBold: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, lineHeight: 22 },
  bodyMedium: { fontSize: fontSize.base, fontWeight: fontWeight.medium, lineHeight: 22 },
  bodySmall: { fontSize: fontSize.sm, fontWeight: fontWeight.regular, lineHeight: 18 },
  bodyLarge: { fontSize: fontSize.lg, fontWeight: fontWeight.regular, lineHeight: 24 },
  caption: { fontSize: fontSize.xs, fontWeight: fontWeight.regular, lineHeight: 16 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 16 },
};

export const FontFamily = {
  default: 'System',
  ios: 'SF Pro Text',
  android: 'Roboto',
};
