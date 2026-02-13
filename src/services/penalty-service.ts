/**
 * Penalty Service
 * 페널티 부과 서비스
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  requireUserId,
} from './firebase';
import type {
  Penalty,
  PenaltyType,
  PenaltySeverity,
  PenaltySummary,
  Warning,
} from '../types/penalty';
import {
  LATE_ARRIVAL_PENALTIES,
  NO_SHOW_PENALTIES,
  RATING_PENALTIES,
  CANCELLATION_PENALTIES,
} from '../types/penalty';

const PENALTIES_COLLECTION = 'penalties';
const WARNINGS_COLLECTION = 'warnings';

export class PenaltyService {
  private userId: string;

  constructor(userId?: string) {
    this.userId = userId || this.getCurrentUserId();
  }

  private getCurrentUserId(): string {
    return requireUserId();
  }

  /**
   * 지연 페널티 부과
   */
  async applyLateArrivalPenalty(
    lateMinutes: number,
    requestId: string
  ): Promise<Penalty> {
    // 해당 페널티 기준 찾기
    let penalty = LATE_ARRIVAL_PENALTIES[0]; // 기본: 5분 미만 (경고)
    
    for (const p of LATE_ARRIVAL_PENALTIES) {
      if (lateMinutes >= p.minutes) {
        penalty = p;
      }
    }

    // 페널티 생성
    const penaltyData = {
      userId: this.userId,
      type: PenaltyType.LATE_ARRIVAL,
      severity: penalty.severity,
      reason: `${lateMinutes}분 지연`,
      lateMinutes,
      fine: penalty.fine,
      suspensionDays: penalty.suspensionDays,
      isPermanent: false,
      createdAt: serverTimestamp(),
      createdBy: 'system',
    };

    const docRef = await addDoc(collection(db, PENALTIES_COLLECTION), penaltyData);

    // 사용자 평점 업데이트
    if (penalty.ratingPenalty !== 0) {
      // TODO: GillerService의 updateGillerStats 호출
      // await gillerService.updateRating(this.userId, penalty.ratingPenalty);
    }

    // 정지가 필요하면 경고 생성
    if (penalty.suspensionDays && penalty.suspensionDays > 0) {
      await this.createWarning(
        PenaltyType.LATE_ARRIVAL,
        penalty.severity,
        `${lateMinutes}분 지연으로 ${penalty.suspensionDays}일 정지`
      );
    }

    return {
      penaltyId: docRef.id,
      ...penaltyData,
    } as Penalty;
  }

  /**
   * 노쇼 페널티 부과
   */
  async applyNoShowPenalty(
    requestId: string
  ): Promise<Penalty> {
    // 최근 30일간 노쇼 횟수 조회
    const recentNoShows = await this.getRecentPenaltyCount(
      PenaltyType.NO_SHOW,
      30
    );
    const count = recentNoShows + 1; // 현재 노쇼 포함

    // 해당 페널티 기준 찾기
    let penalty = NO_SHOW_PENALTIES[0]; // 기본: 1회
    for (const p of NO_SHOW_PENALTIES) {
      if (count === p.count) {
        penalty = p;
      }
    }

    // 페널티 생성
    const penaltyData = {
      userId: this.userId,
      type: PenaltyType.NO_SHOW,
      severity: count >= 3 ? PenaltySeverity.SEVERE : PenaltySeverity.MODERATE,
      reason: `${count}회 노쇼`,
      noShowCount: count,
      ratingPenalty: penalty.ratingPenalty,
      fine: 0,
      suspensionDays: penalty.suspensionDays,
      isPermanent: penalty.suspensionDays === 0, // 영구 정지
      compensation: penalty.compensation,
      createdAt: serverTimestamp(),
      createdBy: 'system',
    };

    const docRef = await addDoc(collection(db, PENALTIES_COLLECTION), penaltyData);

    // 사용자 평점 업데이트
    if (penalty.ratingPenalty !== 0) {
      // TODO: GillerService의 updateRating 호출
    }

    return {
      penaltyId: docRef.id,
      ...penaltyData,
    } as Penalty;
  }

  /**
   * 취소 페널티 부과
   */
  async applyCancellationPenalty(
    cancelledAtPickup: boolean,
    requestId: string
  ): Promise<Penalty> {
    // 최근 취소 횟수 조회
    const recentCancellations = await this.getRecentPenaltyCount(
      PenaltyType.CANCELLATION,
      30
    );
    const count = recentCancellations + 1;

    // 해당 페널티 기준 찾기
    let penalty = CANCELLATION_PENALTIES[0]; // 기본: 인수 전 1회
    for (const p of CANCELLATION_PENALTIES) {
      if (p.timing === (cancelledAtPickup ? 'after_pickup' : 'before_pickup') &&
          p.count === count) {
        penalty = p;
      }
    }

    // 페널티 생성
    const severity = cancelledAtPickup 
      ? (count >= 2 ? PenaltySeverity.MODERATE : PenaltySeverity.MILD)
      : (count >= 3 ? PenaltySeverity.MILD : PenaltySeverity.WARNING);

    const penaltyData = {
      userId: this.userId,
      type: PenaltyType.CANCELLATION,
      severity,
      reason: `${cancelledAtPickup ? '인수 후' : '인수 전'} 취소 (${count}회)`,
      cancelledAtPickup,
      fine: penalty.fine || 0,
      suspensionDays: penalty.suspensionDays,
      isPermanent: false,
      ratingPenalty: penalty.ratingPenalty,
      createdAt: serverTimestamp(),
      createdBy: 'system',
    };

    const docRef = await addDoc(collection(db, PENALTIES_COLLECTION), penaltyData);

    return {
      penaltyId: docRef.id,
      ...penaltyData,
    } as Penalty;
  }

  /**
   * 경고 생성
   */
  private async createWarning(
    type: PenaltyType,
    severity: PenaltySeverity,
    message: string
  ): Promise<Warning> {
    const warningData = {
      userId: this.userId,
      type,
      severity,
      message,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후 소멸
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, WARNINGS_COLLECTION), warningData);

    return {
      warningId: docRef.id,
      ...warningData,
    } as Warning;
  }

  /**
   * 사용자 페널티 요약 조회
   */
  async getPenaltySummary(userId?: string): Promise<PenaltySummary> {
    const targetUserId = userId || this.userId;

    // 최근 30일간 페널티 조회
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pQ = query(
      collection(db, PENALTIES_COLLECTION),
      where('userId', '==', targetUserId),
      where('createdAt', '>=', thirtyDaysAgo)
    );

    const pSnapshot = await getDocs(pQ);
    const penalties = pSnapshot.docs.map((doc) => ({
      penaltyId: doc.id,
      ...doc.data(),
    } as Penalty));

    // 총 페널티 계산
    const totalFines = penalties.reduce((sum, p) => sum + p.fine, 0);
    const totalSuspensionDays = penalties.reduce(
      (sum, p) => sum + (p.suspensionDays || 0),
      0
    );

    // 현재 정지 상태 확인
    const isSuspended = penalties.some((p) => {
      if (!p.suspensionEndsAt) return false;
      return new Date(p.suspensionEndsAt) > new Date();
    });

    // 가장 최근 정지 종료일
    const activeSuspension = penalties
      .filter((p) => p.suspensionEndsAt && new Date(p.suspensionEndsAt) > new Date())
      .sort((a, b) => new Date(b.suspensionEndsAt!).getTime() - new Date(a.suspensionEndsAt!).getTime())[0];

    // 경고 조회
    const wQ = query(
      collection(db, WARNINGS_COLLECTION),
      where('userId', '==', targetUserId)
    );

    const wSnapshot = await getDocs(wQ);
    const warnings: Warning[] = [];
    wSnapshot.forEach((doc) => {
      warnings.push({
        warningId: doc.id,
        ...doc.data(),
      } as Warning);
    });

    return {
      userId: targetUserId,
      totalPenalties: penalties.length,
      totalFines,
      totalSuspensionDays,
      isSuspended,
      suspensionEndsAt: activeSuspension?.suspensionEndsAt,
      warnings,
      recentPenalties: penalties,
    };
  }

  /**
   * 최근 페널티 횟수 조회
   */
  private async getRecentPenaltyCount(
    type: PenaltyType,
    days: number
  ): Promise<number> {
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, PENALTIES_COLLECTION),
      where('userId', '==', this.userId),
      where('type', '==', type),
      where('createdAt', '>=', daysAgo)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  }
}

export function createPenaltyService(userId?: string): PenaltyService {
  return new PenaltyService(userId);
}
