import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface RoleSliderProps {
  currentRole: 'gller' | 'giller' | null;
  onRoleChange: (role: 'gller' | 'giller') => void;
  disabled?: boolean;
}

export default function RoleSlider({
  currentRole,
  onRoleChange,
  disabled = false,
}: RoleSliderProps) {
  const translateX = useRef(new Animated.Value(currentRole === 'gller' ? 0 : 1)).current;

  useEffect(() => {
    if (currentRole) {
      Animated.spring(translateX, {
        toValue: currentRole === 'gller' ? 0 : 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [currentRole, translateX]);

  const handleRoleChange = () => {
    if (disabled || !currentRole) return;

    const newRole: 'gller' | 'giller' = currentRole === 'gller' ? 'giller' : 'gller';
    onRoleChange(newRole);
  };

  const thumbTranslateX = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_WIDTH - 64],
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.sliderContainer}
        onPress={handleRoleChange}
        activeOpacity={0.9}
        disabled={disabled}
        accessibilityLabel="역할 전환"
        accessibilityHint="터치하여 이용자와 길러 모드 전환"
        accessibilityRole="switch"
        accessibilityState={{ checked: currentRole === 'giller' }}
      >
        <View style={styles.labelsContainer}>
          <View style={styles.labelColumn}>
            <Ionicons
              name="cube-outline"
              size={24}
              color={Colors.white}
              style={styles.labelIcon}
            />
            <Text
              style={[
                styles.label,
                currentRole === 'gller' && styles.activeLabel,
              ]}
            >
              이용자
            </Text>
            <Text
              style={[
                styles.subtitle,
                currentRole === 'gller' && styles.activeSubtitle,
              ]}
            >
              배송을 요청하려면
            </Text>
          </View>

          <View style={styles.labelColumn}>
            <Ionicons
              name="bicycle-outline"
              size={24}
              color={Colors.white}
              style={styles.labelIcon}
            />
            <Text
              style={[
                styles.label,
                currentRole === 'giller' && styles.activeLabel,
              ]}
            >
              길러 모드
            </Text>
            <Text
              style={[
                styles.subtitle,
                currentRole === 'giller' && styles.activeSubtitle,
              ]}
            >
              배송을 하려면
            </Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX: thumbTranslateX }],
            },
          ]}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  activeLabel: {
    opacity: 1,
  },
  activeSubtitle: {
    opacity: 0.9,
  },
  container: {
    marginTop: Spacing.md,
  },
  labelIcon: {
    marginBottom: Spacing.xs,
  },
  label: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.xs,
    opacity: 0.7,
    textAlign: 'center',
  },
  labelColumn: {
    alignItems: 'center',
    flex: 1,
  },
  labelsContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  sliderContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BorderRadius.lg,
    height: 80,
    overflow: 'hidden',
    padding: Spacing.md,
    position: 'relative',
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    opacity: 0.6,
    textAlign: 'center',
  },
  thumb: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BorderRadius.md,
    height: 72,
    left: Spacing.xs,
    position: 'absolute',
    top: Spacing.xs,
    width: SCREEN_WIDTH / 2 - 48,
    ...Shadows.sm,
  },
});
