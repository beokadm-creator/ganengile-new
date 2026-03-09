/**
 * Typography Design Tokens
 * 폰트 사이즈, 굵기, 행간 토큰
 */

export const Typography = {
  // Font sizes
  fontSize: {
    xs: 11,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Flat aliases for compatibility
  h1: { fontSize: 24, fontWeight: '700' as const },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  h4: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  body1: { fontSize: 14, fontWeight: '400' as const }, // Alias for body
  body2: { fontSize: 12, fontWeight: '400' as const }, // Alias for bodySmall
  bodyBold: { fontSize: 14, fontWeight: '600' as const },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const },
  bodySmall: { fontSize: 12, fontWeight: '400' as const },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
};

export const FontFamily = {
  default: 'System',
  ios: 'SF Pro Text',
  android: 'Roboto',
};
