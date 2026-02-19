/**
 * Loading States Utility
 * Centralized loading state management for better UX
 */

import { useState, useCallback, useRef } from 'react';

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface UseLoadingStateResult {
  state: LoadingState;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
  setLoading: () => void;
  setSuccess: () => void;
  setError: (error: string) => void;
  reset: () => void;
}

/**
 * Hook for managing loading state
 */
export function useLoadingState(): UseLoadingStateResult {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const setLoading = useCallback(() => {
    setState('loading');
    setError(null);
  }, []);

  const setSuccess = useCallback(() => {
    setState('success');
    setError(null);
  }, []);

  const setErrorState = useCallback((error: string) => {
    setState('error');
    setError(error);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return {
    state,
    isLoading: state === 'loading',
    isSuccess: state === 'success',
    isError: state === 'error',
    error,
    setLoading,
    setSuccess,
    setError: setErrorState,
    reset,
  };
}

/**
 * Hook for async operation with loading state
 */
export function useAsyncOperation<T = any>() {
  const [state, setState] = useState<LoadingState>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const execute = useCallback(async (
    operation: () => Promise<T>,
    options?: {
      onSuccess?: (data: T) => void;
      onError?: (error: string) => void;
    }
  ) => {
    setState('loading');
    setError(null);

    try {
      const result = await operation();

      if (isMounted.current) {
        setData(result);
        setState('success');

        if (options?.onSuccess) {
          options.onSuccess(result);
        }
      }
    } catch (err) {
      if (isMounted.current) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setState('error');

        if (options?.onError) {
          options.onError(errorMessage);
        }
      }
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setData(null);
    setError(null);
  }, []);

  return {
    state,
    isLoading: state === 'loading',
    isSuccess: state === 'success',
    isError: state === 'error',
    data,
    error,
    execute,
    reset,
  };
}

/**
 * Debounce utility
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay]
  );
}

/**
 * Throttle utility
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun.current;

      if (timeSinceLastRun >= delay) {
        fn(...args);
        lastRun.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          fn(...args);
          lastRun.current = Date.now();
        }, delay - timeSinceLastRun);
      }
    },
    [fn, delay]
  );
}
