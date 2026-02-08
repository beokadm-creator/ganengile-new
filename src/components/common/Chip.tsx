import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

type ChipVariant = 'filled' | 'outlined';
type ChipSize = 'small' | 'medium';

interface ChipProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  onClose?: () => void;
  variant?: ChipVariant;
  size?: ChipSize;
  icon?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  style?: object;
}

export default function Chip({
  label,
  onPress,
  onClose,
  variant = 'filled',
  size = 'medium',
  icon,
  selected = false,
  disabled = false,
  style,
}: ChipProps) {
  const chipStyle = [
    styles.chip,
    styles[variant],
    styles[size],
    selected && styles.selected,
    disabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
  ];

  const content = (
    <>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={textStyle}>{label}</Text>
      {onClose && (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.closeIcon, styles[`${variant}CloseIcon`]]}>✕</Text>
        </TouchableOpacity>
      )}
    </>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        style={chipStyle}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={chipStyle} accessibilityLabel={label}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
  },

  // Variants
  filled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
  },

  // Variant text colors
  filledText: {
    color: Colors.white,
  },
  outlinedText: {
    color: Colors.primary,
  },

  // Variant close icon
  filledCloseIcon: {
    color: Colors.white,
  },
  outlinedCloseIcon: {
    color: Colors.primary,
  },

  // Sizes
  small: {
    minHeight: 24,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  medium: {
    minHeight: 32,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },

  // Size text
  smallText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  mediumText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },

  // States
  selected: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: Colors.gray500,
  },

  // Content layout
  icon: {
    marginRight: Spacing.xs,
  },
  closeButton: {
    marginLeft: Spacing.xs,
  },
  closeIcon: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  text: {
    textAlign: 'center',
  },
});
