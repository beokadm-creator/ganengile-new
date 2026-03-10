/**
 * Dark Mode 전환 애니메이션 적용 예시
 * Animated.View와 함께 사용
 */

import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useAnimatedColors, ThemeProvider, useTheme } from '../contexts/ThemeContext';

const HomeScreenContent: React.FC = () => {
  const { colors, isDark, transitionDuration, transitionOpacity: _transitionOpacity } = useAnimatedColors();
  const [fadeAnim] = React.useState(new Animated.Value(1));

  // Dark Mode 전환 시 fade 애니메이션
  React.useEffect(() => {
    if (transitionDuration > 0) {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0.8,
        duration: transitionDuration / 2,
        useNativeDriver: true
      }).start(() => {
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: transitionDuration / 2,
          useNativeDriver: true
        }).start();
      });
    }
  }, [isDark, transitionDuration]);

  const backgroundColorAnim = fadeAnim.interpolate({
    inputRange: [0.8, 1],
    outputRange: [colors.background + 'CC', colors.background] // 20% 투명도 적용
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: backgroundColorAnim }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          가는길에
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </Text>
      </View>

      {/* Dark Mode 토글 버튼 */}
      <DarkModeToggle />

      <View style={styles.content}>
        <Text style={[styles.text, { color: colors.text }]}>
          색상 테마가 부드럽게 전환됩니다.
        </Text>
      </View>
    </Animated.View>
  );
};

const DarkModeToggle: React.FC = () => {
  const { colorScheme, setColorScheme, colors } = useTheme();

  return (
    <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          colorScheme !== 'dark' && styles.toggleButtonActive
        ]}
        onPress={() => setColorScheme('light')}
      >
        <Text
          style={[
            styles.toggleButtonText,
            colorScheme !== 'dark' && styles.toggleButtonTextActive
          ]}
        >
          Light
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.toggleButton,
          colorScheme === 'dark' && styles.toggleButtonActive
        ]}
        onPress={() => setColorScheme('dark')}
      >
        <Text
          style={[
            styles.toggleButtonText,
            colorScheme === 'dark' && styles.toggleButtonTextActive
          ]}
        >
          Dark
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setColorScheme('auto')}
      >
        <Text style={styles.toggleButtonText}>
          Auto
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export const HomeScreenWithTheme: React.FC = () => {
  return (
    <ThemeProvider>
      <HomeScreenContent />
    </ThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold'
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    padding: 4
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6
  },
  toggleButtonActive: {
    backgroundColor: '#00BCD4'
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  toggleButtonTextActive: {
    color: '#fff'
  },
  content: {
    padding: 16
  },
  text: {
    fontSize: 16,
    lineHeight: 24
  }
});
