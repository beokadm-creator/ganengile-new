/**
 * Route Context
 * 동선 데이터 전역 상태 관리 + AsyncStorage 캐싱
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Route } from '../types/route';

const ROUTES_CACHE_KEY = 'cached_routes';
const ROUTES_CACHE_VERSION = 'v1';

interface CachedRoutesData {
  version: string;
  routes: Route[];
  timestamp: number;
}

interface RouteContextValue {
  routes: Route[];
  loading: boolean;
  error: string | null;
  refreshRoutes: () => Promise<void>;
  clearCache: () => Promise<void>;
}

const RouteContext = createContext<RouteContextValue | undefined>(undefined);

const ROUTE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function RouteProvider({ children, userId }: { children: React.ReactNode; userId: string }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * AsyncStorage에서 캐시된 동선 로드
   */
  const loadCachedRoutes = useCallback(async (): Promise<Route[] | null> => {
    try {
      const cachedData = await AsyncStorage.getItem(`${ROUTES_CACHE_KEY}_${userId}`);
      if (!cachedData) return null;

      const parsed: CachedRoutesData = JSON.parse(cachedData);

      // 버전 확인
      if (parsed.version !== ROUTES_CACHE_VERSION) {
        console.log('Cache version mismatch, clearing cache');
        await AsyncStorage.removeItem(`${ROUTES_CACHE_KEY}_${userId}`);
        return null;
      }

      // TTL 확인
      const now = Date.now();
      if (now - parsed.timestamp > ROUTE_CACHE_TTL) {
        console.log('Cache expired, clearing cache');
        await AsyncStorage.removeItem(`${ROUTES_CACHE_KEY}_${userId}`);
        return null;
      }

      // Date 객체 복원
      const restoredRoutes = parsed.routes.map(route => ({
        ...route,
        createdAt: new Date(route.createdAt),
        updatedAt: new Date(route.updatedAt),
      }));

      console.log(`Loaded ${restoredRoutes.length} routes from cache`);
      return restoredRoutes;
    } catch (err) {
      console.error('Error loading cached routes:', err);
      return null;
    }
  }, [userId]);

  /**
   * AsyncStorage에 동선 캐시 저장
   */
  const saveRoutesToCache = useCallback(async (routesToCache: Route[]) => {
    try {
      const cacheData: CachedRoutesData = {
        version: ROUTES_CACHE_VERSION,
        routes: routesToCache,
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(`${ROUTES_CACHE_KEY}_${userId}`, JSON.stringify(cacheData));
      console.log(`Saved ${routesToCache.length} routes to cache`);
    } catch (err) {
      console.error('Error saving routes to cache:', err);
    }
  }, [userId]);

  /**
   * Firestore에서 동선 로드
   */
  const loadRoutesFromFirestore = useCallback(async () => {
    try {
      const { getUserRoutes } = await import('../services/route-service');
      const userRoutes = await getUserRoutes(userId);
      return userRoutes;
    } catch (err) {
      console.error('Error loading routes from Firestore:', err);
      throw err;
    }
  }, [userId]);

  /**
   * 동선 새로고침 (Firestore → AsyncStorage → State)
   */
  const refreshRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Firestore에서 로드
      const freshRoutes = await loadRoutesFromFirestore();

      // 활성화된 동선만 필터링
      const activeRoutes = freshRoutes.filter(route => route.isActive);

      // 캐시 저장
      await saveRoutesToCache(activeRoutes);

      // State 업데이트
      setRoutes(activeRoutes);
    } catch (err: any) {
      console.error('Error refreshing routes:', err);
      setError(err.message || '동선 로드 실패');

      // 캐시된 데이터가 있으면 fallback
      const cachedRoutes = await loadCachedRoutes();
      if (cachedRoutes) {
        setRoutes(cachedRoutes);
        setError('네트워크 오류. 캐시된 데이터를 표시합니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [loadRoutesFromFirestore, saveRoutesToCache, loadCachedRoutes]);

  /**
   * 캐시 초기화
   */
  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(`${ROUTES_CACHE_KEY}_${userId}`);
      setRoutes([]);
      console.log('Route cache cleared');
    } catch (err) {
      console.error('Error clearing cache:', err);
    }
  }, [userId]);

  /**
   * 초기 로드: 캐시 먼저, 그 다음 Firestore
   */
  useEffect(() => {
    let mounted = true;

    const initializeRoutes = async () => {
      setLoading(true);

      // 1. 캐시 먼저 로드 (빠른 화면 표시)
      const cachedRoutes = await loadCachedRoutes();
      if (cachedRoutes && mounted) {
        setRoutes(cachedRoutes);
        setLoading(false);
      }

      // 2. Firestore에서 최신 데이터 로드
      await refreshRoutes();
    };

    initializeRoutes();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const value: RouteContextValue = {
    routes,
    loading,
    error,
    refreshRoutes,
    clearCache,
  };

  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

/**
 * useRoute Hook
 */
export function useRoutes() {
  const context = useContext(RouteContext);
  if (!context) {
    throw new Error('useRoutes must be used within RouteProvider');
  }
  return context;
}
