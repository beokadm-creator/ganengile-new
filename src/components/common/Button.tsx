import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);

  const buttonStyle = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    pressed && styles.pressed,
    Platform.OS === 'web' && { cursor: 'pointer' },
    style,
  ];

  const textStyleCustom = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  const handlePressIn = () => {
    setPressed(true);
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Ignore haptics errors
      }
    }
  };

  const handlePressOut = () => {
    setPressed(false);
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white}
          size={size === 'small' ? 'small' : 'small'}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={textStyleCustom}>{title}</Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </>
      )}
    </>
  );

  // 웹에서는 HTML button 요소 사용
  return (
    <button
      onClick={onPress}
      disabled={disabled || loading}
      aria-label={accessibilityLabel || title}
      style={{
        backgroundColor: variant === 'primary' ? Colors.primary :
                       variant === 'secondary' ? Colors.secondary :
                       variant === 'outline' ? 'transparent' :
                       variant === 'danger' ? Colors.error : 'transparent',
        borderColor: variant === 'outline' ? Colors.primary : 'transparent',
        borderRadius: `${BorderRadius.md}px`,
        borderWidth: variant === 'outline' ? '1px' : '0',
        color: variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'row',
        fontSize: size === 'large' ? '18px' : size === 'small' ? '14px' : '16px',
        fontWeight: size === 'large' ? 'bold' : '600',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: size === 'large' ? '52px' : size === 'small' ? '32px' : '44px',
        opacity: (disabled || loading) ? 0.6 : 1,
        padding: size === 'large' ? '16px 24px' : size === 'small' ? '8px 16px' : '12px 16px',
        width: fullWidth ? '100%' : 'auto',
        gap: '8px',
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white}
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <>{icon}</>}
          <span>{title}</span>
          {icon && iconPosition === 'right' && <>{icon}</>}
        </>
      )}
    </button>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Variants
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.error,
  },

  // Variant text colors
  primaryText: {
    color: Colors.white,
  },
  secondaryText: {
    color: Colors.white,
  },
  outlineText: {
    color: Colors.primary,
  },
  ghostText: {
    color: Colors.primary,
  },
  dangerText: {
    color: Colors.white,
  },

  // Sizes
  small: {
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  medium: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  large: {
    minHeight: 52,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },

  // Size text
  smallText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  mediumText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  largeText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },

  // States
  disabled: {
    backgroundColor: Colors.gray300,
    borderColor: Colors.gray300,
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabledText: {
    color: Colors.gray600,
  },

  // Layout
  fullWidth: {
    width: '100%',
  },
  iconLeft: {
    marginRight: Spacing.sm,
  } as ViewStyle,
  iconRight: {
    marginLeft: Spacing.sm,
  } as ViewStyle,
  text: {
    textAlign: 'center',
  },
});
