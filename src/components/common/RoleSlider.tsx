import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
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
  const handleRoleChange = () => {
    if (disabled || !currentRole) return;

    const newRole: 'gller' | 'giller' = currentRole === 'gller' ? 'giller' : 'gller';
    onRoleChange(newRole);
  };

  const isGllerActive = currentRole === 'gller';

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
        <View style={styles.halvesContainer}>
          {/* 왼쪽 절반 - 이용자 */}
          <View style={[
            styles.half,
            isGllerActive && styles.activeHalf
          ]}>
            <View style={styles.labelColumn}>
              {Platform.OS === 'web' ? (
                <Text style={styles.emojiIcon}>📦</Text>
              ) : (
                <Ionicons
                  name="cube-outline"
                  size={24}
                  color={isGllerActive ? '#00BCD4' : Colors.white}
                  style={styles.labelIcon}
                />
              )}
              <Text
                style={[
                  styles.label,
                  isGllerActive && styles.activeLabel,
                ]}
              >
                이용자
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  isGllerActive && styles.activeSubtitle,
                ]}
              >
                배송을 요청하려면
              </Text>
            </View>
          </View>

          {/* 오른쪽 절반 - 길러 */}
          <View style={[
            styles.half,
            !isGllerActive && styles.activeHalf
          ]}>
            <View style={styles.labelColumn}>
              {Platform.OS === 'web' ? (
                <Text style={styles.emojiIcon}>🚴</Text>
              ) : (
                <Ionicons
                  name="bicycle-outline"
                  size={24}
                  color={!isGllerActive ? '#00BCD4' : Colors.white}
                  style={styles.labelIcon}
                />
              )}
              <Text
                style={[
                  styles.label,
                  !isGllerActive && styles.activeLabel,
                ]}
              >
                길러 모드
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  !isGllerActive && styles.activeSubtitle,
                ]}
              >
                배송을 하려면
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  activeLabel: {
    opacity: 1,
    color: '#00BCD4',
  },
  activeSubtitle: {
    opacity: 0.9,
  },
  activeHalf: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  container: {
    marginTop: 8,
    width: '100%',
  },
  emojiIcon: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  halvesContainer: {
    flexDirection: 'row',
    height: 90,
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
  sliderContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BorderRadius.lg,
    height: 90,
    overflow: 'hidden',
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    opacity: 0.6,
    textAlign: 'center',
  },
});
