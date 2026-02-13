/**
 * Navigation Ref
 * Global navigation reference for deep linking from notifications
 */

import React from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
import type { MainStackParamList } from '../types/navigation';

export const navigationRef = React.createRef<NavigationContainerRef<MainStackParamList>>();

export function navigateFromNotification(
  screen: keyof MainStackParamList,
  params?: any
) {
  if (navigationRef.current?.isReady()) {
    navigationRef.current?.navigate(screen, params);
  }
}
