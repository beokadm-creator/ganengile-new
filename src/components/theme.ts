/**
 * Design Tokens & Theme Configuration
 * 가는길에 Design System
 */

export const Colors = {
  // Primary Colors
  primary: '#00BCD4',        // Cyan - Main brand color
  primaryDark: '#0097A7',    // Darker cyan
  primaryLight: '#B2EBF2',   // Lighter cyan

  // Secondary Colors
  secondary: '#4CAF50',      // Green - Success/Active states
  secondaryDark: '#388E3C',
  secondaryLight: '#C8E6C9',

  // Accent Colors
  accent: '#FF9800',         // Orange - Highlights/CTA
  accentDark: '#F57C00',
  accentLight: '#FFE0B2',

  // Semantic Colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Neutral Colors
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#BDBDBD',
    inverse: '#FFFFFF',
  },

  background: {
    primary: '#FFFFFF',
    secondary: '#F5F5F5',
    tertiary: '#EEEEEE',
  },

  border: {
    default: '#E0E0E0',
    light: '#F5F5F5',
    dark: '#BDBDBD',
  },

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

export const Typography = {
  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Font Weights
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const theme = {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
};

export type Theme = typeof theme;
