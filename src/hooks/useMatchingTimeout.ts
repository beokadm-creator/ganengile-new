import { useCallback, useEffect, useRef, useState } from 'react';
import type { Match } from '../types/matching';

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

interface UseMatchingResultsOptions {
  onAccept?: (matchId: string) => Promise<void>;
  onReject?: (matchId: string) => Promise<void>;
  onTimeout?: (matchId: string) => void;
}

type TimerHandle = ReturnType<typeof setInterval>;

function getMatchId(match: Match): string {
  return match.matchId;
}

export function useMatchingTimeout({
  timeoutSeconds = 30,
  onTimeout,
  onTick,
  autoRetry: _autoRetry = false,
  maxRetries = 3,
}: UseMatchingTimeoutOptions = {}): UseMatchingTimeoutResult {
  const [remainingSeconds, setRemainingSeconds] = useState(timeoutSeconds);
  const [isActive, setIsActive] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const intervalRef = useRef<TimerHandle | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const callbacksRef = useRef({ onTick, onTimeout });
  
  useEffect(() => {
    callbacksRef.current = { onTick, onTimeout };
  }, [onTick, onTimeout]);

  const start = useCallback(() => {
    clearTimers();
    setIsActive(true);
    setIsExpired(false);
    setRemainingSeconds(timeoutSeconds);

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => prev - 1);
    }, 1000);
  }, [clearTimers, timeoutSeconds]);

  useEffect(() => {
    if (!isActive) return;

    if (remainingSeconds < timeoutSeconds) {
      callbacksRef.current.onTick?.(remainingSeconds);
    }

    if (remainingSeconds <= 0) {
      clearTimers();
      setIsActive(false);
      setIsExpired(true);
      callbacksRef.current.onTimeout?.();
    }
  }, [remainingSeconds, isActive, timeoutSeconds, clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setIsActive(false);
    setIsExpired(false);
    setRemainingSeconds(timeoutSeconds);
  }, [clearTimers, timeoutSeconds]);

  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  const retry = useCallback(() => {
    if (retryCount >= maxRetries) {
      return;
    }

    reset();
    setRetryCount((prev) => prev + 1);
    timeoutRef.current = setTimeout(() => {
      start();
    }, 1000);
  }, [maxRetries, reset, retryCount, start]);

  useEffect(() => () => clearTimers(), [clearTimers]);

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
      setMatches((prev) => prev.filter((match) => getMatchId(match) !== matchId));
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
      setMatches((prev) => prev.filter((match) => getMatchId(match) !== matchId));
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
    setMatches((prev) => prev.filter((match) => getMatchId(match) !== matchId));
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
