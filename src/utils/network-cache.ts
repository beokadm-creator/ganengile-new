/**
 * Network Request Caching Strategy
 * 네트워크 요청 캐싱 전략
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size
}

class NetworkCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 100, defaultTTL: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;

    // 주기적으로 만료된 캐시 정리
    setInterval(() => this.cleanupExpired(), 60 * 1000);
  }

  /**
   * 캐시에서 데이터 조회
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 만료된 캐시 제거
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 캐시에 데이터 저장
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.defaultTTL;
    const now = Date.now();

    // 최대 사이즈 초과 시 가장 오래된 항목 제거
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    });
  }

  /**
   * 캐시 무효화
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 전체 캐시 비우기
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 만료된 캐시 정리
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * 캐시 상태 통계
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.expiresAt - entry.timestamp
      }))
    };
  }
}

// 전역 캐시 인스턴스
const globalCache = new NetworkCache(100, 5 * 60 * 1000); // 100개, 5분 TTL

/**
 * 캐싱된 fetch 래퍼
 */
export const cachedFetch = async (
  url: string,
  options: RequestInit = {},
  cacheOptions: CacheOptions = {}
): Promise<Response> => {
  const cacheKey = `${options.method || 'GET'}:${url}`;

  // GET 요청만 캐싱
  if ((options.method || 'GET') === 'GET') {
    const cachedData = globalCache.get(cacheKey);

    if (cachedData) {
      console.log(`✅ Cache hit: ${cacheKey}`);
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        statusText: 'OK (Cached)',
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 캐시 미스면 네트워크 요청
  console.log(`🌐 Cache miss: ${cacheKey}`);
  const response = await fetch(url, options);

  if (response.ok) {
    const clonedResponse = response.clone();
    const data = await clonedResponse.json();

    // 성공 응답만 캐싱
    globalCache.set(cacheKey, data, cacheOptions);
  }

  return response;
};

/**
 * Firestore 캐싱 래퍼
 */
export const cachedFirestoreQuery = async <T>(
  queryFn: () => Promise<T>,
  cacheKey: string,
  options: CacheOptions = {}
): Promise<T> => {
  const cachedData = globalCache.get(cacheKey);

  if (cachedData) {
    console.log(`✅ Firestore cache hit: ${cacheKey}`);
    return cachedData;
  }

  console.log(`🌐 Firestore cache miss: ${cacheKey}`);
  const result = await queryFn();

  globalCache.set(cacheKey, result, options);
  return result;
};

/**
 * 특정 패턴의 캐시 무효화
 */
export const invalidateCachePattern = (pattern: string): void => {
  const stats = globalCache.getStats();
  const keysToInvalidate = stats.entries
    .filter(entry => entry.key.includes(pattern))
    .map(entry => entry.key);

  keysToInvalidate.forEach(key => globalCache.invalidate(key));
  console.log(`🗑️ Invalidated ${keysToInvalidate.length} cache entries matching "${pattern}"`);
};

/**
 * 캐시 설정 상수
 */
export const CACHE_CONFIG = {
  SHORT: 1 * 60 * 1000, // 1분
  MEDIUM: 5 * 60 * 1000, // 5분
  LONG: 30 * 60 * 1000, // 30분
  VERY_LONG: 60 * 60 * 1000 // 1시간
} as const;

/**
 * API 엔드포인트별 캐시 설정
 */
export const API_CACHE_CONFIG: Record<string, number> = {
  '/api/stations': CACHE_CONFIG.VERY_LONG, // 역 데이터: 1시간
  '/api/config': CACHE_CONFIG.LONG, // 설정: 30분
  '/api/routes': CACHE_CONFIG.MEDIUM, // 동선: 5분
  '/api/requests': CACHE_CONFIG.SHORT, // 요청: 1분
  '/api/deliveries': CACHE_CONFIG.SHORT // 배송: 1분
};
