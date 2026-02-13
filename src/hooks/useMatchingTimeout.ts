/**
 * Matching Timeout Hook
 * 30초 타임아웃 처리 및 자동 재시도
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseMatchingTimeoutOptions {
  timeoutSeconds?: number;
  onTimeout?: () => void;
  onTick?: (remainingSeconds: number) => void;
  autoRetry?: boolean;
  maxRetries?: number;
}

interface UseMatchingTimeoutResult {
  remainingSeconds: number;
  isActive: boolean;
  isExpired: boolean;
  retryCount: number;
  start: () => void;
  reset: () => void;
  cancel: () => void;
  retry: () => void;
}

export function useMatchingTimeout({
  timeoutSeconds = 30,
  onTimeout,
  onTick,
  autoRetry = false,
  maxRetries = 3,
}: UseMatchingTimeoutOptions = {}): UseMatchingTimeoutResult {
  const [remainingSeconds, setRemainingSeconds] = useState(timeoutSeconds);
  const [isActive, setIsActive] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    setIsActive(true);
    setIsExpired(false);
    setRemainingSeconds(timeoutSeconds);

    // 1초마다 타이머 감소
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const newRemaining = prev - 1;
        onTick?.(newRemaining);

        if (newRemaining <= 0) {
          clearInterval(intervalRef.current!);
          setIsActive(false);
          setIsExpired(true);
          onTimeout?.();
          return 0;
        }

        return newRemaining;
      });
    }, 1000);
  }, [timeoutSeconds, onTick, onTimeout]);

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsActive(false);
    setIsExpired(false);
    setRemainingSeconds(timeoutSeconds);
  }, [timeoutSeconds]);

  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  const retry = useCallback(() => {
    if (retryCount >= maxRetries) {
      return;
    }

    reset();
    setRetryCount((prev) => prev + 1);
    setTimeout(() => {
      start();
    }, 1000);
  }, [retryCount, maxRetries, reset, start]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    remainingSeconds,
    isActive,
    isExpired,
    retryCount,
    start,
    reset,
    cancel,
    retry,
  };
}

/**
 * 매칭 결과 관리 Hook
 * 여러 길러 매칭 및 수락/거절 처리
 */

import { Match } from '../types/matching'; // 경로에 맞게 수정 필요

interface UseMatchingResultsOptions {
  onAccept?: (matchId: string) => Promise<void>;
  onReject?: (matchId: string) => Promise<void>;
  onTimeout?: (matchId: string) => void;
}

export function useMatchingResults({
  onAccept,
  onReject,
  onTimeout,
}: UseMatchingResultsOptions) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expiredIds, setExpiredIds] = useState<Set<string>>(new Set());

  const acceptMatch = async (matchId: string) => {
    if (processingIds.has(matchId)) return;

    setProcessingIds((prev) => new Set(prev).add(matchId));

    try {
      await onAccept?.(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (error) {
      console.error('Failed to accept match:', error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const rejectMatch = async (matchId: string) => {
    if (processingIds.has(matchId)) return;

    setProcessingIds((prev) => new Set(prev).add(matchId));

    try {
      await onReject?.(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (error) {
      console.error('Failed to reject match:', error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const markAsExpired = (matchId: string) => {
    setExpiredIds((prev) => new Set(prev).add(matchId));
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    onTimeout?.(matchId);
  };

  const isProcessing = (matchId: string) => processingIds.has(matchId);
  const isExpired = (matchId: string) => expiredIds.has(matchId);

  return {
    matches,
    setMatches,
    acceptMatch,
    rejectMatch,
    markAsExpired,
    isProcessing,
    isExpired,
  };
}
