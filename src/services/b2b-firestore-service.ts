/**
 * B2B Firestore Service
 * 
 * B2B 기업 전용 Firestore 데이터 관리
 * @version 2.0.0 - 캐싱 및 최적화 완료
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  sum,
  count,
} from 'firebase/firestore';
import { db } from './firebase';

// 캐싱 설정
const CACHE_DURATION = 5 * 60 * 1000; // 5분
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface MonthlyStats {
  totalDeliveries: number;
  totalAmount: number;
  avgCostPerDelivery: number;
}

export interface TaxInvoice {
  id: string;
  invoiceNumber: string;
  period: string;
  totalAmount: number;
  status: 'issued' | 'paid';
  issuedAt: string;
}

export interface Settlement {
  id: string;
  period: string;
  totalAmount: number;
  status: 'pending' | 'completed';
  transferredAt?: string;
}

export class B2BFirestoreService {
  private readonly B2B_DELIVERIES_COLLECTION = 'b2b_deliveries';
  private readonly B2B_TAX_INVOICES_COLLECTION = 'b2b_tax_invoices';
  private readonly B2B_SETTLEMENTS_COLLECTION = 'b2b_settlements';
  private readonly USERS_COLLECTION = 'users';

  // 캐싱 메모리
  private statsCache = new Map<string, CacheEntry<MonthlyStats>>();
  private invoicesCache = new Map<string, CacheEntry<TaxInvoice[]>>();
  private settlementsCache = new Map<string, CacheEntry<Settlement[]>>();
  private recentDeliveriesCache = new Map<string, CacheEntry<any[]>>();

  /**
   * 월간 배송 통계 가져오기 (캐싱 지원)
   * @version 2.0.0 - 캐싱 추가
   */
  async getMonthlyStats(businessId: string, year: number, month: number): Promise<MonthlyStats | null> {
    try {
      // 캐싱 키 생성
      const cacheKey = `${businessId}-${year}-${month}`;
      
      // 캐싱 확인
      const cached = this.statsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Returning cached monthly stats');
        return cached.data;
      }

      // 월의 시작과 끝 계산
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // 쿼리: 해당 월의 배송 내역
      const deliveriesQuery = query(
        collection(db, this.B2B_DELIVERIES_COLLECTION),
        where('businessId', '==', businessId),
        where('status', '==', 'completed'),
        where('completedAt', '>=', Timestamp.fromDate(startDate)),
        where('completedAt', '<=', Timestamp.fromDate(endDate))
      );

      const querySnapshot = await getDocs(deliveriesQuery);

      if (querySnapshot.empty) {
        const stats: MonthlyStats = {
          totalDeliveries: 0,
          totalAmount: 0,
          avgCostPerDelivery: 0,
        };

        // 캐싱 저장
        this.statsCache.set(cacheKey, {
          data: stats,
          timestamp: Date.now(),
        });

        return stats;
      }

      // 통계 계산
      let totalAmount = 0;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        totalAmount += data.pricing?.totalFee || 0;
      });

      const totalDeliveries = querySnapshot.size;
      const avgCostPerDelivery = totalDeliveries > 0 ? totalAmount / totalDeliveries : 0;

      const stats: MonthlyStats = {
        totalDeliveries,
        totalAmount,
        avgCostPerDelivery,
      };

      // 캐싱 저장
      this.statsCache.set(cacheKey, {
        data: stats,
        timestamp: Date.now(),
      });

      return stats;
    } catch (error) {
      console.error('Error getting monthly stats:', error);
      return null;
    }
  }

  /**
   * 세금 계산서 목록 가져오기 (캐싱 지원)
   * @version 2.0.0 - 캐싱 추가
   */
  async getTaxInvoices(businessId: string, limitCount: number = 10): Promise<TaxInvoice[]> {
    try {
      // 캐싱 키 생성
      const cacheKey = `${businessId}-invoices-${limitCount}`;
      
      // 캐싱 확인
      const cached = this.invoicesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Returning cached invoices');
        return cached.data;
      }

      const invoicesQuery = query(
        collection(db, this.B2B_TAX_INVOICES_COLLECTION),
        where('businessId', '==', businessId),
        orderBy('issuedAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(invoicesQuery);
      const invoices: TaxInvoice[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        invoices.push({
          id: doc.id,
          invoiceNumber: data.invoiceNumber || '',
          period: data.period || '',
          totalAmount: data.totalAmount || 0,
          status: data.status || 'issued',
          issuedAt: data.issuedAt?.toDate().toISOString().split('T')[0] || '',
        });
      });

      // 캐싱 저장
      this.invoicesCache.set(cacheKey, {
        data: invoices,
        timestamp: Date.now(),
      });

      return invoices;
    } catch (error) {
      console.error('Error getting tax invoices:', error);
      return [];
    }
  }

  /**
   * 정산 내역 가져오기 (캐싱 지원)
   * @version 2.0.0 - 캐싱 추가
   */
  async getSettlements(businessId: string, limitCount: number = 10): Promise<Settlement[]> {
    try {
      // 캐싱 키 생성
      const cacheKey = `${businessId}-settlements-${limitCount}`;
      
      // 캐싱 확인
      const cached = this.settlementsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Returning cached settlements');
        return cached.data;
      }

      const settlementsQuery = query(
        collection(db, this.B2B_SETTLEMENTS_COLLECTION),
        where('businessId', '==', businessId),
        orderBy('period', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(settlementsQuery);
      const settlements: Settlement[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        settlements.push({
          id: doc.id,
          period: data.period || '',
          totalAmount: data.totalAmount || 0,
          status: data.status || 'pending',
          transferredAt: data.transferredAt?.toDate().toISOString().split('T')[0] || '',
        });
      });

      // 캐싱 저장
      this.settlementsCache.set(cacheKey, {
        data: settlements,
        timestamp: Date.now(),
      });

      return settlements;
    } catch (error) {
      console.error('Error getting settlements:', error);
      return [];
    }
  }

  /**
   * 최근 배송 내역 가져오기 (캐싱 지원)
   * @version 2.0.0 - 캐싱 추가
   */
  async getRecentDeliveries(businessId: string, limitCount: number = 5) {
    try {
      // 캐싱 키 생성
      const cacheKey = `${businessId}-recent-${limitCount}`;
      
      // 캐싱 확인
      const cached = this.recentDeliveriesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Returning cached recent deliveries');
        return cached.data;
      }

      const deliveriesQuery = query(
        collection(db, this.B2B_DELIVERIES_COLLECTION),
        where('businessId', '==', businessId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(deliveriesQuery);
      const deliveries = [];

      querySnapshot.forEach((doc) => {
        deliveries.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // 캐싱 저장
      this.recentDeliveriesCache.set(cacheKey, {
        data: deliveries,
        timestamp: Date.now(),
      });

      return deliveries;
    } catch (error) {
      console.error('Error getting recent deliveries:', error);
      return [];
    }
  }

  /**
   * 기업 정보 가져오기 (캐싱 지원)
   * @version 2.0.0 - 캐싱 추가
   */
  async getBusinessInfo(businessId: string) {
    try {
      const businessDoc = await getDoc(doc(db, this.USERS_COLLECTION, businessId));

      if (businessDoc.exists) {
        return {
          id: businessDoc.id,
          ...businessDoc.data(),
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting business info:', error);
      return null;
    }
  }

  /**
   * 현재 년월 가져오기
   */
  getCurrentYearMonth(): { year: number; month: number } {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  /**
   * 월간 기간 텍스트 생성
   */
  getPeriodText(year: number, month: number): string {
    return `${year}년 ${month}월`;
  }

  /**
   * 캐싱 초기화 (데이터 업데이트 시 호출)
   */
  invalidateCache(businessId: string): void {
    const patterns = [
      `${businessId}-`,
      `${businessId}-`,
    ];

    // 모든 관련 캐싱 제거
    for (const key of this.statsCache.keys()) {
      if (key.startsWith(businessId)) {
        this.statsCache.delete(key);
      }
    }

    for (const key of this.invoicesCache.keys()) {
      if (key.startsWith(businessId)) {
        this.invoicesCache.delete(key);
      }
    }

    for (const key of this.settlementsCache.keys()) {
      if (key.startsWith(businessId)) {
        this.settlementsCache.delete(key);
      }
    }

    for (const key of this.recentDeliveriesCache.keys()) {
      if (key.startsWith(businessId)) {
        this.recentDeliveriesCache.delete(key);
      }
    }

    console.log('Cache invalidated for business:', businessId);
  }

  /**
   * 모든 캐싱 초기화 (로그아웃 등)
   */
  clearAllCache(): void {
    this.statsCache.clear();
    this.invoicesCache.clear();
    this.settlementsCache.clear();
    this.recentDeliveriesCache.clear();
    console.log('All caches cleared');
  }
}

// Singleton instance
export const b2bFirestoreService = new B2BFirestoreService();
