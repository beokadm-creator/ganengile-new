/**
 * Role Switcher Component
 * Animated slider for switching between gller/giller roles
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from './theme';
import { UserRole } from '../types/user';

const { width } = Dimensions.get('window');

export interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  disabled?: boolean;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  onRoleChange,
  disabled = false,
}) => {
  const translateX = React.useRef(
    new Animated.Value(currentRole === UserRole.GLER ? 0 : width * 0.5 - 80)
  ).current;

  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: currentRole === UserRole.GLER ? 0 : (width * 0.5 - 80),
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentRole, translateX]);

  const handlePress = (role: UserRole) => {
    if (!disabled) {
      onRoleChange(role);
    }
  };

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.sliderContainer}>
        <Animated.View
          style={[
            styles.slider,
            {
              transform: [{ translateX }],
            },
          ]}
        />
        <TouchableOpacity
          style={styles.option}
          onPress={() => handlePress(UserRole.GLER)}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Text
            style={[
              styles.optionText,
              currentRole === UserRole.GLER && styles.activeText,
            ]}
          >
            글러
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => handlePress(UserRole.GILLER)}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Text
            style={[
              styles.optionText,
              currentRole === UserRole.GILLER && styles.activeText,
            ]}
          >
            길러
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.description}>
        {currentRole === UserRole.GLER
          ? '배송을 요청하여 물건을 보내세요'
          : '배송을 수행하여 수익을 창출하세요'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  sliderContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    position: 'relative',
    height: 56,
    overflow: 'hidden',
  },
  slider: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: '48%',
    height: 48,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md,
    zIndex: 1,
  },
  option: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  optionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold as any,
    color: Colors.text.secondary,
  },
  activeText: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
