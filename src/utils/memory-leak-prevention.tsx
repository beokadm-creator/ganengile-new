/**
 * Memory Leak Prevention Utilities
 * 메모리 누수 방지를 위한 유틸리티 함수
 */

import React, { useEffect, useRef } from 'react';

/**
 * 메모리 누수 감지 훅
 */
export const useMemoryLeakDetection = () => {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      // Component unmounted, cleanup performed
    };
  }, []);

  return mountedRef;
};

/**
 * 타이머/인터벌 정리 훅
 */
export const useInterval = (
  callback: () => void,
  delay: number | null
) => {
  const savedCallback = useRef(callback);
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = () => savedCallback.current();
    intervalRef.current = setInterval(tick, delay) as unknown as number;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        // Interval cleared
      }
    };
  }, [delay]);
};

/**
 * 타임아웃 정리 훅
 */
export const useTimeout = (
  callback: () => void,
  delay: number | null
) => {
  const savedCallback = useRef(callback);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    timeoutRef.current = setTimeout(() => {
      savedCallback.current();
    }, delay) as unknown as number;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        // Timeout cleared
      }
    };
  }, [delay]);
};

/**
 * 이벤트 리스너 정리 훅
 */
export const useEventListener = (
  target: EventTarget | null,
  type: string,
  callback: EventListenerOrEventListenerObject
) => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!target) return;

    const listener: EventListenerObject = typeof savedCallback.current === 'function'
      ? { handleEvent: savedCallback.current }
      : savedCallback.current;

    target.addEventListener(type, listener);

    return () => {
      target.removeEventListener(type, listener);
      // Event listener removed
    };
  }, [target, type, callback]);
};

/**
 * Firestore 리얼타임 리스너 정리 훅
 */
export const useFirestoreRealtime = (
  query: any,
  onNext: (snapshot: any) => void,
  onError?: (error: Error) => void
) => {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const unsubscribe = query.onSnapshot(
      (snapshot: any) => {
        if (mountedRef.current) {
          onNext(snapshot);
        }
      },
      (error: Error) => {
        if (mountedRef.current) {
          console.error('Firestore realtime error:', error);
          onError?.(error);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      unsubscribe();
      // Firestore listener detached
    };
  }, [query, onNext, onError]);
};

/**
 * 애니메이션 정리 훅
 */
export const useAnimation = (
  animate: () => any,
  deps: any[] = []
) => {
  useEffect(() => {
    const animation = animate();
    return () => {
      if (animation?.stop) {
        animation.stop();
        // Animation stopped
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

/**
 * 이미지 프리로딩 최적화
 */
export const useImagePreload = (imageUrls: string[]) => {
  useEffect(() => {
    if (typeof Image === 'undefined') return;

    const abortController = new AbortController();

    const preloadImages = async () => {
      try {
        await Promise.all(
           imageUrls.map(url => (Image as any).prefetch?.(url))
         );
         // Images preloaded
       } catch (error) {
        if (abortController.signal.aborted) {
          console.warn('⚠️ Image preload aborted');
        } else {
          console.error('❌ Image preload error:', error);
        }
      }
    };

    preloadImages();

    return () => {
      abortController.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, imageUrls);
};

/**
 * 메모리 사용량 모니터링
 */
export const useMemoryMonitor = (intervalMs: number = 10000) => {
  useEffect(() => {
    if (typeof performance === 'undefined') return;

    const intervalId = setInterval(() => {
      if ((performance as any).memory) {
        const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = (performance as any).memory;

        const _usedMB = (usedJSHeapSize / 1024 / 1024).toFixed(2);
        const _totalMB = (totalJSHeapSize / 1024 / 1024).toFixed(2);
        const _limitMB = (jsHeapSizeLimit / 1024 / 1024).toFixed(2);
        const percentage = ((usedJSHeapSize / jsHeapSizeLimit) * 100).toFixed(2);

        // Memory usage logged

        // 80% 이상 사용 시 경고
        if (parseFloat(percentage) > 80) {
          console.warn('⚠️ High memory usage detected!');
        }
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [intervalMs]);
};

/**
 * 컴포넌트 메모리 누수 감지 HOC
 */
export const withMemoryLeakDetection = <P extends object>(
  WrappedComponent: React.ComponentType<P>
) => {
  return (props: P) => {
    const mountedRef = useRef(true);

    useEffect(() => {
      mountedRef.current = true;
      // Component mounted

      return () => {
        mountedRef.current = false;
        // Component unmounted
      };
    }, []);

    // 개발 모드에서만 메모리 경고
    if (__DEV__) {
      useEffect(() => {
        const checkInterval = setInterval(() => {
          if (!mountedRef.current) {
            console.warn(`⚠️ ${WrappedComponent.name} still running after unmount!`);
          }
        }, 5000);

        return () => clearInterval(checkInterval);
      }, []);
    }

    return <WrappedComponent {...props} />;
  };
};

/**
 * WeakMap을 활용한 캐시 (자동 정리)
 */
export const createAutoCleanupCache = <K extends object, V>() => {
  const cache = new WeakMap<K, V>();

  return {
    get: (key: K) => cache.get(key),
    set: (key: K, value: V) => {
      cache.set(key, value);
      // WeakMap entry added
    },
    has: (key: K) => cache.has(key),
    delete: (key: K) => cache.delete(key)
  };
};

/**
 * 메모리 누수 방지 패턴
 */
export const memoryLeakPreventionPatterns = {
  // ✅ 정답: 정리 함수 사용
  correct: `
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, []);
`,

  // ❌ 오답: 정리 없음
  incorrect: `
useEffect(() => {
  const subscription = subscribe();
}, []);
`
};
