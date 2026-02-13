/**
 * App Navigator
 * Root navigator that switches between Auth, Onboarding, and Main based on Firebase Auth state
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { UserProvider, useUser } from '../contexts/UserContext';
import type { RootStackParamList } from '../types/navigation';

import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import { AppDownloadBanner } from '../components/AppDownloadBanner';
import { navigationRef } from './navigationRef';
import { handleNotificationResponse, getInitialNotification } from './notificationHandler';

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigatorContent() {
  const { user, loading } = useUser();
  const notificationResponseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const notificationReceivedListener = useRef<Notifications.Subscription | undefined>(undefined);

  // Set up notification listeners on mount - run once on app startup
  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationResponse(response);
      }
    );

    getInitialNotification();

    return () => {
      notificationResponseListener.current?.remove();
      notificationReceivedListener.current?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  console.log('AppNavigator 렌더링:', {
    userExists: !!user,
    hasCompletedOnboarding: user?.hasCompletedOnboarding,
    role: user?.role,
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {Platform.OS === 'web' && user?.hasCompletedOnboarding && (
        <AppDownloadBanner />
      )}
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!user ? (
          // No user - show Auth flow
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !user.hasCompletedOnboarding && user.role ? (
          // User signed in but hasn't completed onboarding
          <Stack.Screen name="Onboarding">
            {() => <OnboardingNavigator role={user.role} />}
          </Stack.Screen>
        ) : (
          // User signed in and completed onboarding - show Main app
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  return (
    <SafeAreaProvider>
      <UserProvider>
        <AppNavigatorContent />
      </UserProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
});
