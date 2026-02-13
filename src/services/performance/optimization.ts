/**
 * React Performance Optimization Utilities
 * memo, useMemo, useCallback helpers
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { FlatList } from 'react-native';

/**
 * Deep comparison utility for useMemo/useCallback dependencies
 */
export function shallowEqual(objA: any, objB: any): boolean {
  if (objA === objB) return true;

  if (typeof objA !== 'object' || objA === null ||
      typeof objB !== 'object' || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (let key of keysA) {
    if (!objB.hasOwnProperty(key) || objA[key] !== objB[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Stable callback hook that only updates when dependencies change
 * Uses useRef to maintain function reference
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: any[] = []
): T {
  const callbackRef = useRef(callback);

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...deps]);

  // Return memoized callback
  return useCallback((...args: any[]) => {
    return callbackRef.current(...args);
  }, deps);
}

/**
 * Memoized component factory with display name support
 */
export function memoized<P extends object>(
  Component: React.ComponentType<P>,
  areEqual?: (prevProps: P, nextProps: P) => boolean
) {
  const MemoizedComponent = React.memo(Component, areEqual);
  
  // Preserve component name for debugging
  const name = Component.displayName || Component.name || 'MemoizedComponent';
  MemoizedComponent.displayName = `Memo(${name})`;
  
  return MemoizedComponent;
}

/**
 * Expensive computation hook with cache key
 */
export function useComputation<T>(
  key: string,
  computation: () => T,
  deps: any[] = []
): T {
  const cacheRef = useRef<Map<string, T>>(new Map());

  const result = useMemo(() => {
    const cache = cacheRef.current;
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const value = computation();
    cache.set(key, value);

    // Cleanup old cache entries (keep last 10)
    if (cache.size > 10) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return value;
  }, [key, ...deps]);

  return result;
}

/**
 * Debounce hook for expensive operations
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

/**
 * Throttle hook for frequent events (scrolling, resizing)
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 100
): T {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: any[]) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRunRef.current;

    if (timeSinceLastRun >= delay) {
      callback(...args);
      lastRunRef.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastRunRef.current = Date.now();
      }, delay - timeSinceLastRun);
    }
  }, [callback, delay]) as T;
}

/**
 * Lazy load component (code splitting)
 */
export function lazyLoad<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(importFn);
}

/**
 * Performance measurement utility
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();

  start(markName: string): void {
    this.marks.set(markName, performance.now());
  }

  end(markName: string): number {
    const startTime = this.marks.get(markName);
    if (!startTime) {
      console.warn(`Performance mark "${markName}" not found`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`⏱️ ${markName}: ${duration.toFixed(2)}ms`);
    this.marks.delete(markName);

    return duration;
  }

  measure<T>(
    markName: string,
    fn: () => T
  ): T {
    this.start(markName);
    const result = fn();
    this.end(markName);
    return result;
  }

  async measureAsync<T>(
    markName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.start(markName);
    const result = await fn();
    this.end(markName);
    return result;
  }
}

export const perfMonitor = new PerformanceMonitor();
