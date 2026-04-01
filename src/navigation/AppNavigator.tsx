import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { UserProvider, useUser } from '../contexts/UserContext';
import { AuthProvider } from '../contexts/AuthContext';
import type { RootStackParamList } from '../types/navigation';
import AuthNavigator from './AuthNavigator';
import BasicInfoOnboarding from '../screens/onboarding/BasicInfoOnboarding';
import MainNavigator from './MainNavigator';
import B2BNavigator from './B2BNavigator';
import { AppDownloadBanner } from '../components/AppDownloadBanner';
import { navigationRef } from './navigationRef';
import { getInitialNotification, handleNotificationResponse } from './notificationHandler';

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigatorContent() {
  const { user, loading } = useUser();
  const notificationResponseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const notificationReceivedListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationResponse(response);
      }
    );

    void getInitialNotification();

    const responseSubscription = notificationResponseListener.current;
    const receivedSubscription = notificationReceivedListener.current;

    return () => {
      responseSubscription?.remove();
      receivedSubscription?.remove();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {Platform.OS === 'web' && user?.hasCompletedOnboarding ? <AppDownloadBanner /> : null}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !user.hasCompletedOnboarding ? (
          <Stack.Screen name="Onboarding" component={BasicInfoOnboarding} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="B2B" component={B2BNavigator} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserProvider>
          <AppNavigatorContent />
        </UserProvider>
      </AuthProvider>
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
