/**
 * Onboarding Navigator
 * Stack navigator for onboarding screens after registration
 * 기획 문서에 맞춰 간소화: 슬라이드 형태의 온보딩만 사용
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { OnboardingStackParamList } from '../types/navigation';
import { Platform } from 'react-native';

// 슬라이드 형태 온보딩 (기획 문서에 맞춤)
import GllerOnboarding from '../screens/onboarding/GllerOnboarding';
import GillerOnboarding from '../screens/onboarding/GillerOnboarding';

// 신원 확인 (길러 필수)
import IdentityVerification from '../screens/onboarding/IdentityVerification';

const Stack = createStackNavigator<OnboardingStackParamList>();

// 화면 전환 애니메이션 설정
const screenOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: '#fff' },
  gestureEnabled: false, // Prevent swipe back during onboarding
  transitionSpec: {
    open: {
      animation: 'timing' as const,
      config: {
        duration: 300,
      },
    },
    close: {
      animation: 'timing' as const,
      config: {
        duration: 300,
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }: any) => {
    return {
      cardStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.width, 0],
            }),
          },
        ],
      },
    };
  },
};

interface OnboardingNavigatorProps {
  role: 'gller' | 'giller' | 'both';
}

export default function OnboardingNavigator({ role }: OnboardingNavigatorProps) {
  // Determine initial route based on role
  const getInitialRouteName = (): keyof OnboardingStackParamList => {
    if (role === 'gller') {
      return 'GllerOnboarding'; // 글러 3단계 슬라이드 온보딩
    } else if (role === 'giller') {
      return 'GillerOnboarding'; // 길러 4단계 슬라이드 온보딩
    } else {
      // 'both' starts with GllerOnboarding (글러 먼저)
      return 'GllerOnboarding';
    }
  };

  return (
    <Stack.Navigator
      initialRouteName={getInitialRouteName()}
      screenOptions={screenOptions}
    >
      {/* 글러 온보딩 (3단계 슬라이드) */}
      <Stack.Screen name="GllerOnboarding" component={GllerOnboarding} />

      {/* 길러 온보딩 (4단계 슬라이드) */}
      <Stack.Screen name="GillerOnboarding" component={GillerOnboarding} />

      {/* 신원 확인 (길러 필수) */}
      <Stack.Screen name="IdentityVerification" component={IdentityVerification} />
    </Stack.Navigator>
  );
}
