/**
 * Navigation Ref
 * Global navigation reference for deep linking from notifications
 */

import React from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
import type { MainStackParamList } from '../types/navigation';

export const navigationRef = React.createRef<NavigationContainerRef<MainStackParamList>>();

export function navigateFromNotification<RouteName extends keyof MainStackParamList>(
  screen: RouteName,
  params?: MainStackParamList[RouteName]
) {
  const current = navigationRef.current as
    | (NavigationContainerRef<MainStackParamList> & { navigate: (...args: unknown[]) => void })
    | null;

  if (current?.isReady()) {
    current.navigate(screen, params);
  }
}
