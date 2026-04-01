/**
 * Navigation Ref
 * Global navigation reference for deep linking from notifications
 */

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
