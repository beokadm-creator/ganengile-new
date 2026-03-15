/**
 * Onboarding Navigator
 * 온보딩 화면 전용 Stack Navigator
 * 기본 정보 입력 → 서비스 소개 슬라이드
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import BasicInfoOnboarding from '../screens/onboarding/BasicInfoOnboarding';
import GllerOnboardingScreen from '../screens/onboarding/GllerOnboardingScreen';

const Stack = createStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#fff' },
      }}
    >
      {/* Step 1: 기본 정보 입력 (이름, 연락처, 약관) */}
      <Stack.Screen
        name="BasicInfoOnboarding"
        component={BasicInfoOnboarding}
        options={{ gestureEnabled: false }}
      />

      {/* Step 2: 서비스 소개 슬라이드 */}
      <Stack.Screen
        name="GllerOnboarding"
        component={GllerOnboardingScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
