import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ExpoLinking from 'expo-linking';
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
import { useAuth } from '../contexts/AuthContext';
import {
  buildLinkingConfig,
  captureChannelAttributionFromUrl,
  syncStoredChannelAttributionToUser,
} from '../services/channel-attribution-service';

const Stack = createStackNavigator<RootStackParamList>();
const linking = buildLinkingConfig();

function AppNavigatorContent() {
  const { user, loading } = useUser();
  const { user: authUser } = useAuth();
  const notificationResponseListener = useRef<{ remove: () => void } | undefined>(undefined);
  const notificationReceivedListener = useRef<{ remove: () => void } | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;

    void (async () => {
      const Notifications = await import('expo-notifications');
      if (!isMounted) {
        return;
      }

      notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          handleNotificationResponse(response);
        }
      );

      await getInitialNotification();
    })();

    return () => {
      isMounted = false;
      const responseListener = notificationResponseListener.current;
      const receivedListener = notificationReceivedListener.current;
      responseListener?.remove();
      receivedListener?.remove();
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const initialUrl = await ExpoLinking.getInitialURL();
      if (initialUrl) {
        await captureChannelAttributionFromUrl(initialUrl, 'initial_url');
      }
    })();

    const subscription = ExpoLinking.addEventListener('url', ({ url }) => {
      void captureChannelAttributionFromUrl(url, 'url_event');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!authUser?.uid) {
      return;
    }

    void syncStoredChannelAttributionToUser(authUser.uid);
  }, [authUser?.uid]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
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
