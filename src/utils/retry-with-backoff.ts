/**
 * Retry with Exponential Backoff
 * 네트워크 요청 실패 시 지수 백오프로 재시도
 */

import { isNetworkError, isTimeoutError } from './error-handler';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
  timeoutMs?: number;
}

export interface RetryResult<T> {
  data: T | null;
  success: boolean;
  attempts: number;
  error?: any;
}

/**
 * 기본 재시도 옵션
 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1초
  maxDelay: 10000, // 10초
  backoffMultiplier: 2,
  shouldRetry: (error) => isNetworkError(error) || isTimeoutError(error),
  onRetry: () => {},
  timeoutMs: 30000, // 30초
};

/**
 * 지수 백오프로 지연 시간 계산
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = Math.min(
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1),
    options.maxDelay
  );

  // Add jitter (±25% random variation)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);

  return Math.max(0, delay + jitter);
}

/**
 * 타임아웓 래퍼
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    }),
  ]);
}

/**
 * 지수 백오프로 재시도하는 async 함수 래퍼
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: any;
  let attempt = 0;

  while (attempt < opts.maxAttempts) {
    attempt++;

    try {
      // Add timeout to the operation
      const result = await withTimeout(
        fn(),
        opts.timeoutMs,
        `Operation timed out after ${opts.timeoutMs}ms`
      );

      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (attempt >= opts.maxAttempts || !opts.shouldRetry(error)) {
        throw error;
      }

      // Call onRetry callback
      opts.onRetry(attempt, error);

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 재시도 결과 반환 버전 (에러를 throw하지 않음)
 */
export async function retryWithBackoffSafe<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  try {
    const data = await retryWithBackoff(fn, options);
    return {
      data,
      success: true,
      attempts: 1,
    };
  } catch (error) {
    return {
      data: null,
      success: false,
      attempts: options.maxAttempts || DEFAULT_OPTIONS.maxAttempts,
      error,
    };
  }
}

/**
 * Firebase 쿼리를 위한 재시도 래퍼
 */
export async function retryFirebaseQuery<T>(
  queryFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(queryFn, {
    ...options,
    shouldRetry: (error) => {
      // Retry on network errors, timeouts, and specific Firebase errors
      const errorCode = error?.code || '';
      const retryableCodes = [
        'firestore/unavailable',
        'firestore/deadline-exceeded',
        'firestore/resource-exhausted',
        'firestore/aborted',
        'firestore/internal',
        'firestore/unknown',
      ];

      return (
        isNetworkError(error) ||
        isTimeoutError(error) ||
        retryableCodes.some(code => errorCode.includes(code))
      );
    },
  });
}

/**
 * Firestore 트랜잭션 재시도
 */
export async function retryTransaction<T>(
  transactionFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(transactionFn, {
    maxAttempts: 5, // Transactions can have more contention
    initialDelay: 500,
    ...options,
    shouldRetry: (error) => {
      const errorCode = error?.code || '';
      // Retry on transaction-specific errors
      return (
        errorCode.includes('aborted') ||
        errorCode.includes('deadline-exceeded') ||
        errorCode.includes('unavailable') ||
        isNetworkError(error)
      );
    },
  });
}

/**
 * 여러 비동기 작업을 각각 재시도하며 병렬 실행
 */
export async function retryAll<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<RetryResult<T>>> {
  const results = await Promise.allSettled(
    fns.map(fn => retryWithBackoffSafe(fn, options))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        data: null,
        success: false,
        attempts: options.maxAttempts || DEFAULT_OPTIONS.maxAttempts,
        error: result.reason,
      };
    }
  });
}

/**
 * 지정된 시간(밀리초) 동안 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 활성 재시도 상태 추적 (중복 요청 방지)
 */
const activeRetries = new Map<string, Promise<any>>();

/**
 * 중복 제거된 재시도 (같은 키의 요청이 이미 진행 중이면 재사용)
 */
export async function deduplicatedRetry<T>(
  key: string,
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // If there's already an active retry for this key, return it
  if (activeRetries.has(key)) {
    return activeRetries.get(key)!;
  }

  // Create new retry promise
  const promise = retryWithBackoff(fn, options).finally(() => {
    // Clean up after completion
    activeRetries.delete(key);
  });

  // Store the promise
  activeRetries.set(key, promise);

  return promise;
}

/**
 * 백오프 전략 계산 유틸리티 (UI 표시용)
 */
export function getBackoffSchedule(
  maxAttempts: number = 3,
  initialDelay: number = 1000
): number[] {
  const schedule: number[] = [];
  for (let i = 0; i < maxAttempts - 1; i++) {
    schedule.push(Math.min(initialDelay * Math.pow(2, i), 10000));
  }
  return schedule;
}

/**
 * 예상 재시도 시간 계산
 */
export function estimateTotalRetryTime(
  options: RetryOptions = {}
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const schedule = getBackoffSchedule(opts.maxAttempts, opts.initialDelay);
  return schedule.reduce((sum, delay) => sum + delay, 0);
}
