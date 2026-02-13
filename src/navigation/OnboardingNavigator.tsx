/**
 * Onboarding Navigator
 * 온보딩 화면 전용 Stack Navigator
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import GllerOnboardingScreen from '../screens/onboarding/GllerOnboardingScreen';
import GillerOnboardingScreen from '../screens/onboarding/GillerOnboardingScreen';
import RoleSelectionScreen from '../screens/onboarding/RoleSelectionScreen';

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
      {/* BOTH 역할 사용자는 먼저 역할을 선택함 */}
      {role === 'both' ? (
        <Stack.Screen
          name="RoleSelection"
          component={RoleSelectionScreen}
          options={{ gestureEnabled: false }}
        />
      ) : null}

      {role === 'gller' || role === 'both' ? (
        <Stack.Screen
          name="GllerOnboarding"
          component={GllerOnboardingScreen}
          options={{ gestureEnabled: false }}
          initialParams={{ role }}
        />
      ) : null}

      {role === 'giller' || role === 'both' ? (
        <Stack.Screen
          name="GillerOnboarding"
          component={GillerOnboardingScreen}
          options={{ gestureEnabled: false }}
          initialParams={{ role }}
        />
      ) : null}
    </Stack.Navigator>
  );
}
