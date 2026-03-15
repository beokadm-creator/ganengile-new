/**
 * Onboarding Navigator
 * 온보딩 화면 전용 Stack Navigator
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import BasicInfoOnboarding from '../screens/onboarding/BasicInfoOnboarding';
import GllerOnboardingScreen from '../screens/onboarding/GllerOnboardingScreen';
import GillerApplicationOnboarding from '../screens/onboarding/GillerApplicationOnboarding';
import RoleSelectionScreen from '../screens/onboarding/RoleSelectionScreen';
import IdentityVerification from '../screens/onboarding/IdentityVerification';

const Stack = createStackNavigator();

type Props = {
  role: string;
};

export default function OnboardingNavigator({ role }: Props) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#fff' },
      }}
    >
      {/* 모든 사용자: 기본 정보 입력 */}
      <Stack.Screen
        name="BasicInfoOnboarding"
        component={BasicInfoOnboarding}
        options={{ gestureEnabled: false }}
      />

      {/* 이용자 온보딩 */}
      <Stack.Screen
        name="GllerOnboarding"
        component={GllerOnboardingScreen}
        options={{ gestureEnabled: false }}
        initialParams={{ role }}
      />

      {/* 역할 선택 (BOTH 역할 사용자) */}
      <Stack.Screen
        name="RoleSelection"
        component={RoleSelectionScreen}
        options={{ gestureEnabled: false }}
      />

      {/* 길러 신청 온보딩 */}
      <Stack.Screen
        name="GillerApplication"
        component={GillerApplicationOnboarding}
        options={{ gestureEnabled: false }}
      />

      {/* 길러 신원 확인 */}
      <Stack.Screen
        name="IdentityVerification"
        component={IdentityVerification}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
