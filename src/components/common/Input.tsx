import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  Animated,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

type InputVariant = 'default' | 'outlined' | 'filled';
type InputState = 'default' | 'error' | 'success';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  state?: InputState;
  variant?: InputVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export default function Input({
  label,
  error,
  helperText,
  state = 'default',
  variant = 'default',
  leftIcon,
  rightIcon,
  containerStyle,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [borderAnim] = useState(new Animated.Value(0));

  const hasError = state === 'error' || !!error;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      hasError ? Colors.error : Colors.gray300,
      hasError ? Colors.error : Colors.primary,
    ],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            isFocused && styles.labelFocused,
          ]}
          accessible
          accessibilityLabel={label}
        >
          {label}
        </Text>
      )}

      <Animated.View
        style={[
          styles.inputContainer,
          styles[variant],
          { borderColor },
          hasError && styles.inputError,
          textInputProps.editable === false && styles.disabled,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[styles.input, styles[variant]]}
          placeholderTextColor={Colors.gray500}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...textInputProps}
        />

        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </Animated.View>

      {error && (
        <Text style={styles.errorText} accessible accessibilityRole="alert">
          {error}
        </Text>
      )}

      {!error && helperText && (
        <Text style={styles.helperText} accessible>
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  labelFocused: {
    color: Colors.primary,
  },
  inputContainer: {
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    minHeight: 48,
  },

  // Variants
  default: {
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderWidth: 1,
  },
  outlined: {
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderWidth: 2,
  },
  filled: {
    backgroundColor: Colors.gray100,
    borderWidth: 0,
  },

  // States
  inputError: {
    borderColor: Colors.error,
  },
  disabled: {
    backgroundColor: Colors.gray100,
    opacity: 0.6,
  },

  // Input
  input: {
    color: Colors.textPrimary,
    flex: 1,
    fontSize: Typography.fontSize.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },

  // Icons
  leftIcon: {
    marginRight: Spacing.xs,
    paddingLeft: Spacing.md,
  },
  rightIcon: {
    marginLeft: Spacing.xs,
    paddingRight: Spacing.md,
  },

  // Helper text
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
  },
  helperText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
  },
});
