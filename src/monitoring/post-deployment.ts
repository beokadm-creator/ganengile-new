/**
 * 배포 후 모니터링 설정
 * Firebase Crashlytics, Performance 모니터링, 사용자 피드백 수집
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Analytics from 'expo-firebase-analytics';
import * as Crashlytics from '@sentry/react-native';

/**
 * 에러 로그 모니터링
 */
export const setupErrorMonitoring = () => {
  if (__DEV__) {
    console.log('🔧 Development mode - error monitoring disabled');
    return;
  }

  // Sentry Crashlytics 초기화
  Crashlytics.init({
    dsn: __SENTRY_DSN__,
    environment: __NODE_ENV__,
    enableAutoSessionTracking: true,
    enableOutOfMemoryTracking: true,
    enableCaptureFailedRequests: true,
    tracesSampleRate: 1.0, // 프로덕션에서는 100%
  });

  console.log('✅ Error monitoring initialized');
};

/**
 * 성능 메트릭 수집
 */
export const setupPerformanceMonitoring = () => {
  if (__DEV__) return;

  // Firebase Analytics 초기화
  Analytics.initializeAnalytics();

  // 화면 전환 성능 측정
  const trackScreenPerformance = (screenName: string) => {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      
      // 500ms 이상이면 경고
      if (duration > 500) {
        console.warn(`⚠️ Slow screen transition: ${screenName} (${duration}ms)`);
        
        Analytics.logEvent('screen_performance', {
          screen: screenName,
          duration: duration.toString(),
          is_slow: duration > 500 ? 'true' : 'false'
        });
      }
    };
  };

  return { trackScreenPerformance };
};

/**
 * 사용자 피드백 수집
 */
export const setupUserFeedback = () => {
  // In-app 피드백 버튼 표시 로직
  const shouldShowFeedback = (lastShownAt: Date): boolean => {
    const daysSinceLastShown = (Date.now() - lastShownAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastShown >= 7; // 7일마다
  };

  // 배송 완료 후 피드백 요청
  const requestDeliveryFeedback = (deliveryId: string, rating: number) => {
    if (rating >= 4) {
      // 높은 평점이면 피드백 요청 (선택사항)
      console.log(`📝 Feedback requested for delivery ${deliveryId}`);
      
      Analytics.logEvent('feedback_request', {
        delivery_id: deliveryId,
        rating: rating.toString(),
        type: 'post_delivery'
      });
    }
  };

  return { shouldShowFeedback, requestDeliveryFeedback };
};

/**
 * Firebase Crashlytics 통합
 */
export const setupFirebaseCrashlytics = () => {
  useEffect(() => {
    if (__DEV__) return;

    // Firebase Crashlytics 초기화
    const crashlytics = require('@sentry/react-native');
    
    // 자동 크래시 리포트 활성화
    if (crashlytics.enableAutoSessionTracking) {
      crashlytics.enableAutoSessionTracking({
        sessionSamplingRate: 1.0
      });
    }

    console.log('✅ Firebase Crashlytics enabled');
  }, []);
};

/**
 * 앱 충돌 보고
 */
export const setupNativeCrashReporting = () => {
  useEffect(() => {
    if (__DEV__) return;

    // 네이티브 충돌 리포트 설정
    const crashHandler = (error: Error, isFatal: boolean) => {
      Crashlytics.captureException(error, {
        level: isFatal ? 'fatal' : 'error'
      });
    };

    // 전역 에러 핸들러
    global.ErrorUtils = global.ErrorUtils || {};
    global.ErrorUtils.setGlobalHandler(crashHandler);

    console.log('✅ Native crash reporting enabled');
  }, []);
};

/**
 * 배포 후 체크리스트
 */
export const runPostDeploymentChecks = async () => {
  const checks = [
    {
      name: 'Firebase 연결 확인',
      check: async () => {
        try {
          const firebase = require('firebase/app');
          await firebase.initializeApp();
          console.log('✅ Firebase connection OK');
          return true;
        } catch (error) {
          console.error('❌ Firebase connection failed:', error);
          return false;
        }
      }
    },
    {
      name: 'API 엔드포인트 확인',
      check: async () => {
        try {
          const response = await fetch('https://api.ganengile.com/health');
          if (response.ok) {
            console.log('✅ API endpoint OK');
            return true;
          } else {
            console.error('❌ API endpoint error:', response.status);
            return false;
          }
        } catch (error) {
          console.error('❌ API endpoint check failed:', error);
          return false;
        }
      }
    },
    {
      name: 'FCM 토큰 확인',
      check: async () => {
        try {
          const messaging = require('firebase/messaging');
          const token = await messaging.getToken();
          if (token) {
            console.log('✅ FCM token OK');
            return true;
          } else {
            console.error('❌ FCM token missing');
            return false;
          }
        } catch (error) {
          console.error('❌ FCM check failed:', error);
          return false;
        }
      }
    }
  ];

  const results = await Promise.all(checks.map(c => c.check()));
  const passed = results.filter(r => r).length;
  
  console.log(`\n📊 Post-deployment checks: ${passed}/${checks.length} passed`);
  
  if (passed === checks.length) {
    console.log('✅ All checks passed!');
  } else {
    console.warn('⚠️ Some checks failed - review logs above');
  }
};

/**
 * 성능 모니터링 Hook
 */
export const usePerformanceMonitor = () => {
  useEffect(() => {
    if (__DEV__) return;

    const performanceMonitor = setInterval(async () => {
      // 메모리 사용량 확인
      if (performance.memory) {
        const used = performance.memory.usedJSHeapSize / 1024 / 1024;
        const total = performance.memory.totalJSHeapSize / 1024 / 1024;
        const percentage = (used / total) * 100;

        if (percentage > 80) {
          console.warn(`⚠️ High memory usage: ${percentage.toFixed(1)}%`);
          
          Analytics.logEvent('memory_warning', {
            used_mb: used.toFixed(2),
            total_mb: total.toFixed(2),
            percentage: percentage.toFixed(1)
          });
        }
      }
    }, 60000); // 1분마다

    return () => clearInterval(performanceMonitor);
  }, []);

  return { monitorActive: true };
};

/**
 * 배포 버전 추적
 */
export const trackDeploymentVersion = (version: string) => {
  if (__DEV__) return;

  // 배포 버전 저장
  const deploymentKey = `deployment_${version}`;
  const lastVersion = localStorage.getItem('last_deployment_version');
  
  if (lastVersion !== version) {
    console.log(`📦 New deployment detected: ${lastVersion} → ${version}`);
    
    Analytics.logEvent('app_update', {
      old_version: lastVersion || 'none',
      new_version: version
    });

    localStorage.setItem('last_deployment_version', version);
  }

  // 첫 실행인 경우 온보딩 이벤트
  const firstRunKey = 'first_run_' + version;
  if (!localStorage.getItem(firstRunKey)) {
    console.log('🎉 First run after deployment');
    
    Analytics.logEvent('first_run', {
      version: version,
      platform: Platform.OS
    });

    localStorage.setItem(firstRunKey, 'true');
  }
};
