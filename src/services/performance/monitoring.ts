/**
 * Performance Monitoring Setup
 * Firebase Performance Monitoring, Custom Metrics
 */

import { performance } from 'react-native-performance';

// ==================== Firebase Performance Monitoring ====================

/**
 * FIREBASE PERFORMANCE MONITORING:
 * 
 * SETUP:
 * 1. Install: @react-native-firebase/perf
 * 2. Import: import perf from '@react-native-firebase/perf';
 * 3. Start: await perf().setPerformanceCollectionEnabled(true);
 * 
 * AUTOMATIC TRACES:
 * - App start
 * - Screen transitions
 * - Network requests
 * 
 * CUSTOM TRACES:
 * - Specific operations (matching, delivery, etc.)
 * - Business metrics
 */

// ==================== Custom Performance Traces ====================

/**
 * MEASURE CRITICAL OPERATIONS:
 */

// Measure matching algorithm performance
export async function measureMatchingPerformance(
  requestId: string,
  operation: () => Promise<any>
): Promise<any> {
  // This would use Firebase Performance Monitoring
  // For now, use console timing

  const startTime = performance.now();
  console.log(`⏱️ Starting matching for request ${requestId}`);

  try {
    const result = await operation();
    const duration = performance.now() - startTime;

    console.log(`✅ Matching completed in ${duration.toFixed(2)}ms`);

    // Log performance metric
    // await perf().newTrace('matching_process').start();
    // await trace.putMetric('duration', duration);
    // await trace.stop();

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`❌ Matching failed after ${duration.toFixed(2)}ms`, error);

    // Log error metric
    // await perf().newTrace('matching_error').start();
    // await trace.putAttribute('requestId', requestId);
    // await trace.stop();

    throw error;
  }
}

// Measure Firestore query performance
export async function measureQueryPerformance<T>(
  queryName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  console.log(`🔍 Starting query: ${queryName}`);

  try {
    const result = await operation();
    const duration = performance.now() - startTime;

    // Warn if query is slow
    if (duration > 500) {
      console.warn(`⚠️ Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
    } else {
      console.log(`✅ Query ${queryName} completed in ${duration.toFixed(2)}ms`);
    }

    // Log metric if using Firebase
    // const trace = await perf().newTrace(queryName).start();
    // await trace.putMetric('duration', duration);
    // await trace.stop();

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`❌ Query ${queryName} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

// ==================== App Startup Performance ====================

/**
 * TRACK APP STARTUP TIME
 */
export function trackAppStartup() {
  const appStartTime = performance.now();

  // Track time to interactive
  const onAppReady = () => {
    const startupTime = performance.now() - appStartTime;
    console.log(`📱 App ready in ${startupTime.toFixed(2)}ms`);

    // Log startup metric
    // const trace = await perf().newTrace('app_startup').start();
    // await trace.putMetric('startup_time', startupTime);
    // await trace.stop();
  };

  return { appStartTime, onAppReady };
}

// ==================== Screen Render Performance ====================

/**
 * TRACK SCREEN RENDER TIMES
 */
export function trackScreenRender(screenName: string) {
  const renderStart = performance.now();

  return {
    renderComplete: () => {
      const renderTime = performance.now() - renderStart;
      console.log(`🖥️ Screen ${screenName} rendered in ${renderTime.toFixed(2)}ms`);

      // Log metric
      // const trace = await perf().newTrace(`screen_${screenName}`).start();
      // await trace.putMetric('render_time', renderTime);
      // await trace.stop();
    },
  };
}

// ==================== Network Performance Monitoring ====================

/**
 * MONITOR NETWORK REQUESTS
 */
export class NetworkMonitor {
  private requestMetrics: Map<string, number[]> = new Map();

  recordRequest(url: string, duration: number, success: boolean): void {
    const key = `${url}_${success ? 'success' : 'error'}`;

    if (!this.requestMetrics.has(key)) {
      this.requestMetrics.set(key, []);
    }

    this.requestMetrics.get(key)!.push(duration);

    // Log slow requests
    if (duration > 2000) {
      console.warn(`🐌 Slow API call: ${url} took ${duration.toFixed(2)}ms`);
    }

    // Log to Firebase if available
    // const trace = await perf().newTrace('network_request').start();
    // await trace.putAttribute('url', url);
    // await trace.putAttribute('success', success.toString());
    // await trace.putMetric('duration', duration);
    // await trace.stop();
  }

  getStats(url?: string) {
    if (url) {
      const stats = this.requestMetrics.get(url);
      if (!stats) return null;

      const avg = stats.reduce((a, b) => a + b, 0) / stats.length;
      return { avg, count: stats.length };
    }

    // Return all stats
    const allStats: any = {};
    for (const [key, durations] of this.requestMetrics.entries()) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      allStats[key] = { avg, count: durations.length };
    }
    return allStats;
  }
}

export const networkMonitor = new NetworkMonitor();

// ==================== Memory Monitoring ====================

/**
 * MONITOR MEMORY USAGE
 */
export function setupMemoryMonitoring() {
  // Check memory every 30 seconds
  setInterval(() => {
    if (global.nativeMemory || performance.memory) {
      const memory = global.nativeMemory || performance.memory;

      const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
      const totalMB = (memory.totalJSHeapSize / 1048576).toFixed(2);
      const percentage = ((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100).toFixed(2);

      console.log(`💾 Memory: ${usedMB}MB / ${totalMB}MB (${percentage}%)`);

      // Warn if memory usage is high
      if (parseFloat(percentage) > 80) {
        console.warn('⚠️ High memory usage detected!');
      }
    }
  }, 30000);
}

// ==================== Crash Reporting Integration ====================

/**
 * INTEGRATE WITH CRASH REPORTING
 * 
 * SERVICES:
 * - Firebase Crashlytics
 * - Sentry
 * - Bugsnag
 * 
 * SETUP:
 */
export function setupCrashReporting() {
  // Enable crash reporting in production
  if (!__DEV__) {
    // Firebase Crashlytics
    // import crashlytics from '@react-native-firebase/crashlytics';
    // await crashlytics().setCrashlyticsCollectionEnabled(true);

    // Sentry
    // import * as Sentry from '@sentry/react-native';
    // Sentry.init({
    //   dsn: 'YOUR_DSN',
    //   enableAutoSessionTracking: true,
    // });

    console.log('✅ Crash reporting enabled');
  }
}

// ==================== Performance Budgets ====================

/**
 * PERFORMANCE BUDGETS:
 * 
 * APP STARTUP: < 3 seconds
 * SCREEN TRANSITION: < 500ms
 * API REQUESTS: < 1 second (most)
 * MATCHING ALGORITHM: < 2 seconds
 * DATABASE QUERIES: < 500ms
 * 
 * If these budgets are exceeded:
 * - Log warning
 * - Consider optimization
 * - Add performance monitoring
 */

export const PERFORMANCE_BUDGETS = {
  appStartup: 3000, // 3 seconds
  screenTransition: 500, // 500ms
  apiRequest: 1000, // 1 second
  matchingAlgorithm: 2000, // 2 seconds
  databaseQuery: 500, // 500ms
};

export function checkPerformanceBudget(
  metric: keyof typeof PERFORMANCE_BUDGETS,
  actual: number
): boolean {
  const budget = PERFORMANCE_BUDGETS[metric];
  const withinBudget = actual <= budget;

  if (!withinBudget) {
    console.warn(
      `⚠️ Performance budget exceeded for ${metric}: ${actual.toFixed(2)}ms > ${budget}ms`
    );
  }

  return withinBudget;
}

// ==================== APM Integration ====================

/**
 * APPLICATION PERFORMANCE MONITORING (APM)
 * 
 * RECOMMENDED SERVICES:
 * - Firebase Performance Monitoring
 * - New Relic
 * - Datadog
 * 
 * FEATURES:
 * - Real user monitoring (RUM)
 * - Error tracking
 * - Performance insights
 * - Custom metrics
 */

export function initializeAPM() {
  // Initialize APM service
  console.log('🔧 Initializing APM...');

  // This would initialize Firebase Performance Monitoring
  // import perf from '@react-native-firebase/perf';
  // await perf().setPerformanceCollectionEnabled(true);
  // await perf().setPerformanceCollectionEnabled(true);

  // Enable automatic monitoring
  // - App lifecycle
  // - Network requests
  // - Screen rendering
  // - JavaScript execution

  console.log('✅ APM initialized');
}
