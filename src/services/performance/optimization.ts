import { lazy, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

export function shallowEqual(objA: Record<string, unknown>, objB: Record<string, unknown>): boolean {
  if (objA === objB) return true;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => objA[key] === objB[key]);
}

export function useStableCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });
  
  return useCallback(function(...args: Parameters<T>) {
    return callbackRef.current(...args);
  }, []) as unknown as T;
}

export function memoized<P extends object>(
  component: ComponentType<P>,
  areEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean,
): ComponentType<P> {
  const Memoized = memo(component, areEqual);
  Memoized.displayName = component.displayName ?? component.name ?? 'MemoizedComponent';
  return Memoized;
}

export function useComputation<T>(key: string, computation: () => T, _deps: readonly unknown[] = []): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => computation(), []);
}

export function useDebounce<T extends (...args: never[]) => void>(callback: T, delay = 300): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   
  const fn = useCallback(function(...args: Parameters<T>) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
  return fn as unknown as T;
}

export function useThrottle<T extends (...args: never[]) => void>(callback: T, delay = 100): T {
  const lastRunRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   
  const fn = useCallback(function(...args: Parameters<T>) {
    const now = Date.now();
    const remaining = delay - (now - lastRunRef.current);

    if (remaining <= 0) {
      lastRunRef.current = now;
      callback(...args);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      lastRunRef.current = Date.now();
      callback(...args);
    }, remaining);
  }, [callback, delay]);
  return fn as unknown as T;
}

export function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(importFn as () => Promise<{ default: ComponentType<any> }>) as LazyExoticComponent<T>;
}

export class PerformanceMonitor {
  private marks = new Map<string, number>();

  start(markName: string): void {
    this.marks.set(markName, Date.now());
  }

  end(markName: string): number {
    const startTime = this.marks.get(markName);
    if (typeof startTime !== 'number') {
      return 0;
    }
    const duration = Date.now() - startTime;
    this.marks.delete(markName);
    return duration;
  }

  measure<T>(markName: string, fn: () => T): T {
    this.start(markName);
    const result = fn();
    this.end(markName);
    return result;
  }

  async measureAsync<T>(markName: string, fn: () => Promise<T>): Promise<T> {
    this.start(markName);
    const result = await fn();
    this.end(markName);
    return result;
  }
}

export const perfMonitor = new PerformanceMonitor();

