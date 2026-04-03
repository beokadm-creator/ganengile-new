import { Platform } from 'react-native';
import { useEffect } from 'react';

type PerformanceTracker = {
  trackScreenPerformance: (screenName: string) => () => void;
};

type FeedbackTools = {
  shouldShowFeedback: (lastShownAt: Date) => boolean;
  requestDeliveryFeedback: (deliveryId: string, rating: number) => void;
};

export const setupErrorMonitoring = (): void => {
  if (__DEV__) {
    return;
  }
};

export const setupPerformanceMonitoring = (): PerformanceTracker => ({
  trackScreenPerformance: (_screenName: string) => () => undefined,
});

export const setupUserFeedback = (): FeedbackTools => ({
  shouldShowFeedback: (lastShownAt: Date) => {
    const daysSinceLastShown = (Date.now() - lastShownAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastShown >= 7;
  },
  requestDeliveryFeedback: (_deliveryId: string, _rating: number) => undefined,
});

export const setupFirebaseCrashlytics = (): void => {
  if (__DEV__) {
    return;
  }
};

export const setupNativeCrashReporting = (): void => {
  if (__DEV__) {
    return;
  }
};

export const runPostDeploymentChecks = (): void => {
  if (__DEV__) {
    return;
  }
};

export const usePerformanceMonitor = (): { monitorActive: boolean; platform: string } => {
  useEffect(() => undefined, []);
  return { monitorActive: !__DEV__, platform: Platform.OS };
};

export const trackDeploymentVersion = (_version: string): void => {
  if (__DEV__) {
    return;
  }
};
