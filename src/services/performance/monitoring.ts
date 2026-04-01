type AsyncOperation<T> = () => Promise<T>;

type MemoryLike = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
};

function getNow(): number {
  if (typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function logInfo(message: string): void {
  console.warn(message);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function measureMatchingPerformance<T>(
  requestId: string,
  operation: AsyncOperation<T>,
): Promise<T> {
  const startTime = getNow();
  logInfo(`[performance] matching start: ${requestId}`);

  try {
    const result = await operation();
    const duration = getNow() - startTime;
    logInfo(`[performance] matching complete: ${requestId} (${duration.toFixed(2)}ms)`);
    return result;
  } catch (error) {
    const duration = getNow() - startTime;
    console.error(
      `[performance] matching failed: ${requestId} (${duration.toFixed(2)}ms): ${getErrorMessage(error)}`,
    );
    throw error;
  }
}

export async function measureQueryPerformance<T>(
  queryName: string,
  operation: AsyncOperation<T>,
): Promise<T> {
  const startTime = getNow();

  try {
    const result = await operation();
    const duration = getNow() - startTime;
    if (duration > PERFORMANCE_BUDGETS.databaseQuery) {
      console.warn(`[performance] slow query: ${queryName} (${duration.toFixed(2)}ms)`);
    }
    return result;
  } catch (error) {
    const duration = getNow() - startTime;
    console.error(
      `[performance] query failed: ${queryName} (${duration.toFixed(2)}ms): ${getErrorMessage(error)}`,
    );
    throw error;
  }
}

export function trackAppStartup() {
  const appStartTime = getNow();

  return {
    appStartTime,
    onAppReady: () => {
      const startupTime = getNow() - appStartTime;
      logInfo(`[performance] app ready in ${startupTime.toFixed(2)}ms`);
      return startupTime;
    },
  };
}

export function trackScreenRender(screenName: string) {
  const renderStart = getNow();

  return {
    renderComplete: () => {
      const renderTime = getNow() - renderStart;
      logInfo(`[performance] screen rendered: ${screenName} (${renderTime.toFixed(2)}ms)`);
      return renderTime;
    },
  };
}

export class NetworkMonitor {
  private requestMetrics = new Map<string, number[]>();

  recordRequest(url: string, duration: number, success: boolean): void {
    const key = `${url}_${success ? 'success' : 'error'}`;
    const existing = this.requestMetrics.get(key) ?? [];
    existing.push(duration);
    this.requestMetrics.set(key, existing);

    if (duration > PERFORMANCE_BUDGETS.apiRequest) {
      console.warn(`[performance] slow request: ${url} (${duration.toFixed(2)}ms)`);
    }
  }

  getStats(url?: string): { avg: number; count: number } | Record<string, { avg: number; count: number }> | null {
    if (url) {
      const stats = this.requestMetrics.get(url);
      if (!stats?.length) {
        return null;
      }

      const avg = stats.reduce((total, duration) => total + duration, 0) / stats.length;
      return { avg, count: stats.length };
    }

    const allStats: Record<string, { avg: number; count: number }> = {};
    for (const [key, durations] of this.requestMetrics.entries()) {
      const avg = durations.reduce((total, duration) => total + duration, 0) / durations.length;
      allStats[key] = { avg, count: durations.length };
    }
    return allStats;
  }
}

export const networkMonitor = new NetworkMonitor();

function getMemorySnapshot(): MemoryLike | null {
  const candidate = (globalThis as { nativeMemory?: MemoryLike }).nativeMemory;
  if (candidate?.usedJSHeapSize && candidate?.totalJSHeapSize) {
    return candidate;
  }

  const perfCandidate = globalThis.performance as Performance & { memory?: MemoryLike };
  if (perfCandidate.memory?.usedJSHeapSize && perfCandidate.memory?.totalJSHeapSize) {
    return perfCandidate.memory;
  }

  return null;
}

export function setupMemoryMonitoring(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const memory = getMemorySnapshot();
    if (!memory) {
      return;
    }

    const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
    const totalMB = (memory.totalJSHeapSize / 1048576).toFixed(2);
    const percentage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;

    logInfo(`[performance] memory ${usedMB}MB / ${totalMB}MB (${percentage.toFixed(2)}%)`);
    if (percentage > 80) {
      console.warn('[performance] high memory usage detected');
    }
  }, 30000);
}

export function setupCrashReporting(): void {
  const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (!isDevelopment) {
    logInfo('[performance] crash reporting enabled');
  }
}

export const PERFORMANCE_BUDGETS = {
  appStartup: 3000,
  screenTransition: 500,
  apiRequest: 1000,
  matchingAlgorithm: 2000,
  databaseQuery: 500,
} as const;

export function checkPerformanceBudget(metric: keyof typeof PERFORMANCE_BUDGETS, actual: number): boolean {
  const budget = PERFORMANCE_BUDGETS[metric];
  const withinBudget = actual <= budget;

  if (!withinBudget) {
    console.warn(`[performance] budget exceeded for ${metric}: ${actual.toFixed(2)}ms > ${budget}ms`);
  }

  return withinBudget;
}

export function initializeAPM(): void {
  logInfo('[performance] APM initialized');
}
