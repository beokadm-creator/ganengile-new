/**
 * App Navigator
 * Root navigator that switches between Auth, Onboarding, and Main based on Firebase Auth state
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, User } from 'firebase/auth';

import { auth } from '../services/firebase';
import { UserProvider } from '../contexts/UserContext';
import { getUserById } from '../services/user-service';
import type { RootStackParamList } from '../types/navigation';

import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'gller' | 'giller' | 'both' | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        try {
          const userData = await getUserById(currentUser.uid);
          if (userData) {
            setUserRole(userData.role);
            setHasCompletedOnboarding(userData.hasCompletedOnboarding || false);
          }
        } catch (error) {
          console.error('Error loading user:', error);
        }
      } else {
        setUser(null);
        setUserRole(null);
        setHasCompletedOnboarding(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <UserProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
            }}
          >
            {!user ? (
              // No user - show Auth flow
              <Stack.Screen name="Auth" component={AuthNavigator} />
            ) : !hasCompletedOnboarding && userRole ? (
              // User signed in but hasn't completed onboarding
              <Stack.Screen name="Onboarding">
                {() => <OnboardingNavigator role={userRole} />}
              </Stack.Screen>
            ) : (
              // User signed in and completed onboarding - show Main app
              <Stack.Screen name="Main" component={MainNavigator} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
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
