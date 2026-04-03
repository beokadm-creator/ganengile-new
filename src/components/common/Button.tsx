import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
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
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
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
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      activeOpacity={0.86}
      style={[
        styles.button,
        styles[variant],
        styles[`${size}Size`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' ? <View style={styles.iconLeft}>{icon}</View> : null}
          <Text
            style={[
              styles.text,
              styles[`${variant}Text`],
              styles[`${size}Text`],
              isDisabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' ? <View style={styles.iconRight}>{icon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
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
  smallSize: {
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  mediumSize: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  largeSize: {
    minHeight: 52,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
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
  disabled: {
    backgroundColor: Colors.gray300,
    borderColor: Colors.gray300,
    opacity: 0.6,
  },
  disabledText: {
    color: Colors.gray600,
  },
  fullWidth: {
    width: '100%',
  },
  iconLeft: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginLeft: Spacing.sm,
  },
  text: {
    textAlign: 'center',
  },
});
