/**
 * Color Design Tokens
 * 앱 전체에서 사용하는 색상 토큰
 */

export const Colors = {
  // Primary
  primary: '#00BCD4',        // Cyan (new primary)
  primaryDark: '#0097A7',
  primaryLight: '#B2EBF2',

  // Secondary
  secondary: '#4CAF50',      // Green (existing)
  secondaryDark: '#388E3C',
  secondaryLight: '#C8E6C9',

  // Accent
  accent: '#FF9800',         // Orange (existing)
  accentDark: '#F57C00',
  accentLight: '#FFE0B2',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',        // Background
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',

  // Functional
  success: '#4CAF50',
  successLight: '#C8E6C9',
  successDark: '#388E3C',
  warning: '#FF9800',
  warningLight: '#FFE0B2',
  warningDark: '#F57C00',
  error: '#F44336',
  errorLight: '#FFCDD2',
  errorDark: '#D32F2F',
  info: '#00BCD4',
  infoLight: '#B2EBF2',
  infoDark: '#0097A7',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)' as const,

  // Text
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textWhite: '#FFFFFF',
};

export type ColorKeys = keyof typeof Colors;
