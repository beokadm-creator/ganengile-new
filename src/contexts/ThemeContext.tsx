/**
 * Dark Mode Theme Provider
 * 애니메이션이 적용된 Dark Mode 전환
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ColorScheme = 'light' | 'dark' | 'auto';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
}

interface ThemeContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = '@theme_preference';

// Light Mode 색상
const lightColors: ThemeColors = {
  primary: '#00BCD4',
  secondary: '#4CAF50',
  accent: '#FF9800',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  border: '#E0E0E0',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FF9800'
};

// Dark Mode 색상
const darkColors: ThemeColors = {
  primary: '#00BCD4',
  secondary: '#4CAF50',
  accent: '#FF9800',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  border: '#333333',
  error: '#EF5350',
  success: '#66BB6A',
  warning: '#FFA726'
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [storedScheme, setStoredScheme] = useState<ColorScheme>('auto');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 실제 색상 스킴 계산 (auto인 경우 시스템 설정 따름)
  const colorScheme: ColorSchemeName =
    storedScheme === 'auto' ? systemColorScheme : storedScheme;

  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // 초기 로드 시 저장된 환경 설정 불러오기
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setStoredScheme(stored as ColorScheme);
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    }
  };

  const setColorScheme = async (scheme: ColorScheme) => {
    // 애니메이션 시작
    setIsTransitioning(true);

    // 300ms 후 색상 스킵 변경 (부드러운 전환)
    setTimeout(() => {
      setStoredScheme(scheme);

      // 변경 후 300ms 더 대기 후 애니메이션 종료
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }, 300);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, scheme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const contextValue: ThemeContextType = {
    colorScheme: storedScheme,
    setColorScheme,
    colors,
    isDark,
    isTransitioning
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

/**
 * 애니메이션이 적용된 색상 전환 훅
 */
export const useAnimatedColors = () => {
  const { colors, isDark, isTransitioning } = useTheme();

  return {
    colors,
    isDark,
    // 전환 중일 때는 애니메이션 적용
    transitionDuration: isTransitioning ? 300 : 0,
    // 색상 보간을 위한 투명도 (전환 중에만 0.5)
    transitionOpacity: isTransitioning ? 0.5 : 1
  };
};
