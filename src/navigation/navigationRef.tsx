/**
 * Navigation Ref
 * Global navigation reference for deep linking from notifications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
import type { MainStackParamList, RootStackParamList } from '../types/navigation';

export const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

export function navigateFromNotification<RouteName extends keyof MainStackParamList>(
  screen: RouteName,
  params?: MainStackParamList[RouteName]
) {
  const current = navigationRef.current as
    | (NavigationContainerRef<RootStackParamList> & { navigate: (...args: unknown[]) => void })
    | null;

  if (current?.isReady()) {
    current.navigate('Main', {
      screen,
      params,
    });
  }
}


// ---------------------------------------------------------------------------
// Pending deep-link - restore original URL after onboarding
// ---------------------------------------------------------------------------

const PENDING_URL_KEY = '@pending_deep_link';
let _pendingUrl: string | null = null;

/** Save the URL the user intended to visit before onboarding redirected them */
export async function savePendingDeepLink(url: string): Promise<void> {
  _pendingUrl = url;
  try {
    await AsyncStorage.setItem(PENDING_URL_KEY, url);
  } catch {
    // Storage write failed - in-memory fallback is already set
  }
}

/** Read and clear the saved pending URL */
export async function consumePendingDeepLink(): Promise<string | null> {
  const inMemory = _pendingUrl;
  _pendingUrl = null;
  try {
    const stored = await AsyncStorage.getItem(PENDING_URL_KEY);
    await AsyncStorage.removeItem(PENDING_URL_KEY);
    return stored ?? inMemory;
  } catch {
    return inMemory;
  }
}