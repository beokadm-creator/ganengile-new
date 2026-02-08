import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Pressable,
  Animated,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../theme';

type CardVariant = 'default' | 'elevated' | 'outlined';
type CardPadding = 'none' | 'small' | 'medium' | 'large';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export default function Card({
  children,
  variant = 'default',
  padding = 'medium',
  onPress,
  style,
  testID,
}: CardProps) {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    if (onPress) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }).start();
    }
  };

  const cardStyle = [
    styles.card,
    styles[variant],
    styles[padding],
    onPress && styles.pressable,
    style,
  ];

  const content = <View style={styles.content}>{children}</View>;

  if (onPress) {
    return (
      <Animated.View style={[cardStyle, { transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          testID={testID}
          accessibilityRole="button"
        >
          {content}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={cardStyle} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
  },

  // Variants
  default: {
    borderColor: Colors.gray200,
    borderWidth: 1,
  },
  elevated: {
    ...Shadows.md,
  },
  outlined: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },

  // Padding
  none: {
    padding: 0,
  },
  small: {
    padding: Spacing.sm,
  },
  medium: {
    padding: Spacing.md,
  },
  large: {
    padding: Spacing.lg,
  },

  // Pressable
  pressable: {
    cursor: 'pointer',
  },

  content: {
    width: '100%',
  },
});
