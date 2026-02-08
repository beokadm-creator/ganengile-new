/**
 * Penalty Service
 * 페널티 계산, 적용, 기록, 조회 서비스
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
  orderBy,
  runTransaction,
  Timestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  CancelReason,
  CancelReasonCategory,
  PenaltySeverity,
  PenaltyStatus,
  ObjectionStatus,
  PenaltyType,
  type CancellationReasonInfo,
  type PenaltyValue,
  type CancellationRecord,
  type UserPenaltyStatus,
  type PenaltyPolicy,
  type PenaltyCalculationResult,
  type ObjectionRequest,
} from '../types/penalty';

// ==================== Cache Configuration ====================

const POLICY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const USER_STATUS_CACHE_TTL = 1 * 60 * 1000; // 1 minute

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class PenaltyCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new PenaltyCache();

// ==================== Helper Functions ====================

function convertTimestampToDate(timestamp: { seconds: number; nanoseconds?: number }): Date {
  return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
}

function convertDateToTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

// ==================== Penalty Matrix Constants ====================

export const PENALTY_MATRIX = {
  emergency: {
    isExempt: true,
  },
  agreedCancellation: {
    ratingPenalty: -0.1,
    monetaryPenalty: 0,
    suspensionDays: 0,
  },
  gillerNoShow: {
    ratingPenalty: -0.5,
    monetaryPenalty: 5000,
    suspensionDays: 3,
    severity: PenaltySeverity.HIGH,
  },
  glerNoShow: {
    ratingPenalty: -0.5,
    monetaryPenalty: 5000,
    suspensionDays: 3,
    severity: PenaltySeverity.HIGH,
  },
  systemError: {
    ratingPenalty: 0,
    monetaryPenalty: 0,
    suspensionDays: 0,
  },
} as const;

export const REPEAT_VIOLATION_MULTIPLIERS = {
  windowDays: 30,
  multipliers: {
    secondViolation: 1.5,
    thirdViolation: 2.0,
    fourthOrMore: 2.5,
  },
} as const;

export const WARNING_LEVELS = {
  level0: { threshold: 0, message: '정상 사용자입니다.' },
  level1: { threshold: 1, message: '취소 주의가 필요합니다. 연속 취소 시 페널티가 부과됩니다.' },
  level2: { threshold: 2, message: '취소 페널티 위험 단계입니다. 배송 취소를 신중해 주세요.' },
  level3: { threshold: 3, message: '정지 위험 단계입니다. 추가 취소 시 계정 정지가 될 수 있습니다.' },
} as const;

// ==================== Convert Functions ====================

function convertCancellationRecord(data: any, docId: string): CancellationRecord {
  return {
    recordId: docId,
    deliveryId: data.deliveryId,
    requestId: data.requestId,
    cancelledByUserId: data.cancelledByUserId,
    cancelledByRole: data.cancelledByRole,
    reason: data.reason,
    appliedPenalty: data.appliedPenalty,
    isRepeatViolation: data.isRepeatViolation,
    violationCount: data.violationCount,
    evidenceReductionApplied: data.evidenceReductionApplied,
    evidenceReductionRate: data.evidenceReductionRate,
    finalPenalty: data.finalPenalty,
    penaltyStatus: data.penaltyStatus,
    appealInfo: data.appealInfo,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
  };
}

function convertPenaltyPolicy(data: any, docId: string): PenaltyPolicy {
  return {
    policyId: docId,
    version: data.version,
    name: data.name,
    isActive: data.isActive,
    validPeriod: {
      startDate: convertTimestampToDate(data.validPeriod.startDate),
      endDate: data.validPeriod.endDate ? convertTimestampToDate(data.validPeriod.endDate) : undefined,
    },
    penaltyMatrix: data.penaltyMatrix,
    repeatViolationMultiplier: data.repeatViolationMultiplier,
    evidenceReduction: data.evidenceReduction,
    firstViolationWarning: data.firstViolationWarning,
    warningLevels: data.warningLevels,
    suspensionPeriods: data.suspensionPeriods,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt),
    createdBy: data.createdBy,
  };
}

// ==================== Category Mapping ====================

function getCancelReasonCategory(reason: CancelReason): CancelReasonCategory {
  const emergencyReasons = [
    CancelReason.MEDICAL_EMERGENCY,
    CancelReason.ACCIDENT,
    CancelReason.FAMILY_EMERGENCY,
    CancelReason.NATURAL_DISASTER,
  ];

  const agreedReasons = [
    CancelReason.MUTUAL_AGREEMENT,
    CancelReason.SCHEDULE_CONFLICT,
    CancelReason.CHANGE_OF_MIND,
  ];

  const noshowReasons = [
    CancelReason.COURIER_NO_SHOW,
    CancelReason.GLER_NO_SHOW,
  ];

  const systemErrorReasons = [
    CancelReason.APP_CRASH,
    CancelReason.SERVER_ERROR,
    CancelReason.MATCHING_ERROR,
  ];

  if (emergencyReasons.includes(reason)) return CancelReasonCategory.EMERGENCY;
  if (agreedReasons.includes(reason)) return CancelReasonCategory.AGREED;
  if (noshowReasons.includes(reason)) return CancelReasonCategory.NOSHOW;
  if (systemErrorReasons.includes(reason)) return CancelReasonCategory.SYSTEM_ERROR;
  return CancelReasonCategory.OTHER;
}

// ==================== Penalty Calculation ====================

export async function calculatePenalty(
  userId: string,
  userRole: 'gller' | 'giller',
  reason: CancelReason,
  description: string,
  evidenceUrls?: string[]
): Promise<PenaltyCalculationResult> {
  const category = getCancelReasonCategory(reason);
  const reasonInfo: CancellationReasonInfo = {
    reason,
    category,
    description,
    evidenceUrls,
    isEmergency: category === CancelReasonCategory.EMERGENCY,
  };

  // 시스템 오류면 페널티 없음
  if (category === CancelReasonCategory.SYSTEM_ERROR) {
    return {
      reason,
      category,
      basePenalty: PENALTY_MATRIX.systemError as PenaltyValue,
      isRepeatViolation: false,
      violationCount: 0,
      repeatMultiplier: 1,
      weightedPenalty: PENALTY_MATRIX.systemError as PenaltyValue,
      evidenceReductionAvailable: false,
      isFirstViolationWarning: false,
      finalPenalty: PENALTY_MATRIX.systemError as PenaltyValue,
    };
  }

  // 긴급 상황이면 페널티 면제
  if (category === CancelReasonCategory.EMERGENCY) {
    const exemptPenalty: PenaltyValue = {
      type: PenaltyType.RATING,
      severity: PenaltySeverity.LOW,
      ratingPenalty: 0,
      monetaryPenalty: 0,
      suspensionDays: 0,
      description: '긴급 상황으로 페널티 면제',
    };
    return {
      reason,
      category,
      basePenalty: exemptPenalty,
      isRepeatViolation: false,
      violationCount: 0,
      repeatMultiplier: 1,
      weightedPenalty: exemptPenalty,
      evidenceReductionAvailable: false,
      isFirstViolationWarning: false,
      finalPenalty: exemptPenalty,
    };
  }

  // 기본 페널티 결정
  let basePenalty: PenaltyValue;
  if (category === CancelReasonCategory.AGREED) {
    basePenalty = {
      type: PenaltyType.RATING,
      severity: PenaltySeverity.LOW,
      ratingPenalty: PENALTY_MATRIX.agreedCancellation.ratingPenalty,
      monetaryPenalty: PENALTY_MATRIX.agreedCancellation.monetaryPenalty,
      suspensionDays: PENALTY_MATRIX.agreedCancellation.suspensionDays,
      description: '합의 취소',
    };
  } else {
    // NOSHOW
    const noshowMatrix = userRole === 'giller'
      ? PENALTY_MATRIX.gillerNoShow
      : PENALTY_MATRIX.glerNoShow;
    basePenalty = {
      type: PenaltyType.MONETARY,
      severity: noshowMatrix.severity,
      ratingPenalty: noshowMatrix.ratingPenalty,
      monetaryPenalty: noshowMatrix.monetaryPenalty,
      suspensionDays: noshowMatrix.suspensionDays,
      description: userRole === 'giller' ? '길러 노쇼' : '글러 노쇼',
    };
  }

  // 최근 위반 횟수 확인
  const { violationCount, isRepeatViolation } = await getRecentViolationCount(
    userId,
    REPEAT_VIOLATION_MULTIPLIERS.windowDays
  );

  // 반복 위반 가중치 계산
  let repeatMultiplier = 1;
  if (violationCount >= 1) {
    if (violationCount === 1) {
      repeatMultiplier = REPEAT_VIOLATION_MULTIPLIERS.multipliers.secondViolation;
    } else if (violationCount === 2) {
      repeatMultiplier = REPEAT_VIOLATION_MULTIPLIERS.multipliers.thirdViolation;
    } else {
      repeatMultiplier = REPEAT_VIOLATION_MULTIPLIERS.multipliers.fourthOrMore;
    }
  }

  // 가중된 페널티 계산
  const weightedPenalty: PenaltyValue = {
    ...basePenalty,
    ratingPenalty: basePenalty.ratingPenalty! * repeatMultiplier,
    monetaryPenalty: basePenalty.monetaryPenalty! * repeatMultiplier,
    suspensionDays: Math.ceil(basePenalty.suspensionDays! * repeatMultiplier),
    description: `${basePenalty.description} (반복 ${repeatMultiplier}x)`,
  };

  // 첫 위반 경고 확인
  const isFirstViolationWarning = violationCount === 0 && category === CancelReasonCategory.AGREED;
  const warningMessage = isFirstViolationWarning
    ? '첫 위반입니다. 경고로 처리되며, 재위반 시 페널티가 부과됩니다.'
    : undefined;

  // 증빙 감면 가능 여부
  const evidenceReductionAvailable = category === CancelReasonCategory.NOSHOW && !evidenceUrls?.length;

  return {
    reason,
    category,
    basePenalty,
    isRepeatViolation,
    violationCount: violationCount + 1,
    repeatMultiplier,
    weightedPenalty,
    evidenceReductionAvailable,
    isFirstViolationWarning,
    warningMessage,
    finalPenalty: isFirstViolationWarning ? basePenalty : weightedPenalty,
  };
}

// ==================== Violation Count Helper ====================

async function getRecentViolationCount(
  userId: string,
  windowDays: number
): Promise<{ violationCount: number; isRepeatViolation: boolean }> {
  const cacheKey = `violations:${userId}:${windowDays}`;
  const cached = cache.get<{ count: number }>(cacheKey);
  if (cached) {
    return { violationCount: cached.count, isRepeatViolation: cached.count > 0 };
  }

  try {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const q = query(
      collection(db, 'cancellations'),
      where('cancelledByUserId', '==', userId),
      where('createdAt', '>=', convertDateToTimestamp(windowStart)),
      where('reason.category', '!=', CancelReasonCategory.EMERGENCY),
      where('reason.category', '!=', CancelReasonCategory.SYSTEM_ERROR)
    );

    const snapshot = await getDocs(q);
    const count = snapshot.size;

    cache.set(cacheKey, { count }, USER_STATUS_CACHE_TTL);

    return { violationCount: count, isRepeatViolation: count > 0 };
  } catch (error) {
    console.error('Error fetching violation count:', error);
    return { violationCount: 0, isRepeatViolation: false };
  }
}

// ==================== Apply Penalty ====================

export async function applyPenalty(
  deliveryId: string,
  requestId: string,
  userId: string,
  userRole: 'gller' | 'giller',
  reason: CancelReason,
  description: string,
  evidenceUrls?: string[]
): Promise<CancellationRecord> {
  // 페널티 계산
  const calculationResult = await calculatePenalty(
    userId,
    userRole,
    reason,
    description,
    evidenceUrls
  );

  const reasonInfo: CancellationReasonInfo = {
    reason,
    category: calculationResult.category,
    description,
    evidenceUrls,
    isEmergency: calculationResult.category === CancelReasonCategory.EMERGENCY,
  };

  // 취소 기록 생성
  const recordData = {
    deliveryId,
    requestId,
    cancelledByUserId: userId,
    cancelledByRole: userRole,
    reason: reasonInfo,
    appliedPenalty: calculationResult.weightedPenalty,
    isRepeatViolation: calculationResult.isRepeatViolation,
    violationCount: calculationResult.violationCount,
    evidenceReductionApplied: false,
    evidenceReductionRate: null,
    finalPenalty: calculationResult.finalPenalty,
    penaltyStatus: PenaltyStatus.ACTIVE,
    createdAt: convertDateToTimestamp(new Date()),
    updatedAt: convertDateToTimestamp(new Date()),
  };

  const docRef = await addDoc(collection(db, 'cancellations'), recordData);
  const record = convertCancellationRecord(recordData, docRef.id);

  // 캐시 무효화
  cache.clearPattern(`^violations:${userId}:`);
  cache.clearPattern(`^penaltyStatus:${userId}$`);

  return record;
}

// ==================== User Penalty Status ====================

export async function getUserPenaltyStatus(userId: string): Promise<UserPenaltyStatus> {
  const cacheKey = `penaltyStatus:${userId}`;
  const cached = cache.get<UserPenaltyStatus>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // 기본 사용자 정보 조회
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    const currentRating = userData?.rating ?? 5.0;
    const baseRating = userData?.baseRating ?? currentRating;

    // 활성 페널티 조회
    const activePenaltiesQuery = query(
      collection(db, 'cancellations'),
      where('cancelledByUserId', '==', userId),
      where('penaltyStatus', '==', PenaltyStatus.ACTIVE)
    );
    const activeSnapshot = await getDocs(activePenaltiesQuery);

    const activePenalties: PenaltyValue[] = [];
    let unpaidPenaltyAmount = 0;
    let isSuspended = false;
    let suspendedUntil: Date | undefined;
    let suspensionReason: string | undefined;

    activeSnapshot.forEach((docSnapshot) => {
      const record = convertCancellationRecord(docSnapshot.data(), docSnapshot.id);
      activePenalties.push(record.finalPenalty);

      if (record.finalPenalty.monetaryPenalty) {
        unpaidPenaltyAmount += record.finalPenalty.monetaryPenalty;
      }

      if (record.finalPenalty.suspensionDays && record.finalPenalty.suspensionDays > 0) {
        isSuspended = true;
        suspensionReason = record.finalPenalty.description;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + record.finalPenalty.suspensionDays);
        suspendedUntil = endDate;
      }
    });

    // 최근 취소 기록 계산
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const last30DaysQuery = query(
      collection(db, 'cancellations'),
      where('cancelledByUserId', '==', userId),
      where('createdAt', '>=', convertDateToTimestamp(thirtyDaysAgo))
    );
    const last30DaysSnapshot = await getDocs(last30DaysQuery);

    let last7DaysCount = 0;
    let todayCount = 0;
    let lastCancellationAt: Date | undefined;

    last30DaysSnapshot.forEach((docSnapshot) => {
      const record = convertCancellationRecord(docSnapshot.data(), docSnapshot.id);
      const createdAt = record.createdAt;

      if (createdAt >= sevenDaysAgo) last7DaysCount++;
      if (createdAt >= todayStart) todayCount++;
      if (!lastCancellationAt || createdAt > lastCancellationAt) {
        lastCancellationAt = createdAt;
      }
    });

    // 위반 이력 집계
    const allCancellationsQuery = query(
      collection(db, 'cancellations'),
      where('cancelledByUserId', '==', userId)
    );
    const allSnapshot = await getDocs(allCancellationsQuery);

    let totalViolations = 0;
    let noShowCount = 0;
    let agreedCount = 0;
    let emergencyCount = 0;

    allSnapshot.forEach((docSnapshot) => {
      const record = convertCancellationRecord(docSnapshot.data(), docSnapshot.id);
      totalViolations++;

      if (record.reason.category === CancelReasonCategory.NOSHOW) noShowCount++;
      else if (record.reason.category === CancelReasonCategory.AGREED) agreedCount++;
      else if (record.reason.category === CancelReasonCategory.EMERGENCY) emergencyCount++;
    });

    // 경고 레벨 계산
    let warningLevel = 0;
    let warningMessage: string = WARNING_LEVELS.level0.message;

    if (last7DaysCount >= WARNING_LEVELS.level3.threshold) {
      warningLevel = 3;
      warningMessage = WARNING_LEVELS.level3.message;
    } else if (last7DaysCount >= WARNING_LEVELS.level2.threshold) {
      warningLevel = 2;
      warningMessage = WARNING_LEVELS.level2.message;
    } else if (last7DaysCount >= WARNING_LEVELS.level1.threshold) {
      warningLevel = 1;
      warningMessage = WARNING_LEVELS.level1.message;
    }

    // 남은 정지 일수 계산
    let remainingDays: number | undefined;
    if (isSuspended && suspendedUntil) {
      remainingDays = Math.max(0, Math.ceil((suspendedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const status: UserPenaltyStatus = {
      userId,
      currentRating,
      baseRating,
      activePenalties,
      unpaidPenaltyAmount,
      suspensionStatus: {
        isSuspended,
        suspendedUntil,
        reason: suspensionReason,
        remainingDays,
      },
      recentCancellations: {
        last30Days: last30DaysSnapshot.size,
        last7Days: last7DaysCount,
        today: todayCount,
        lastCancellationAt,
      },
      violationHistory: {
        totalViolations,
        noShowCount,
        agreedCancellationCount: agreedCount,
        emergencyCancellationCount: emergencyCount,
      },
      warningLevel: {
        level: warningLevel,
        violationsUntilNextLevel: Math.max(0, WARNING_LEVELS.level3.threshold - last7DaysCount),
        message: warningMessage,
      },
      updatedAt: now,
    };

    cache.set(cacheKey, status, USER_STATUS_CACHE_TTL);
    return status;
  } catch (error) {
    console.error('Error fetching user penalty status:', error);
    throw error;
  }
}

// ==================== Cancellation History ====================

export async function getCancellationHistory(
  userId: string,
  limit: number = 20
): Promise<CancellationRecord[]> {
  try {
    const q = query(
      collection(db, 'cancellations'),
      where('cancelledByUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const records: CancellationRecord[] = [];

    snapshot.forEach((docSnapshot) => {
      records.push(convertCancellationRecord(docSnapshot.data(), docSnapshot.id));
    });

    return records.slice(0, limit);
  } catch (error) {
    console.error('Error fetching cancellation history:', error);
    throw error;
  }
}

// ==================== Penalty Policy ====================

export async function getActivePenaltyPolicy(): Promise<PenaltyPolicy | null> {
  const cacheKey = 'penaltyPolicy:active';
  const cached = cache.get<PenaltyPolicy>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const q = query(
      collection(db, 'penalty_policies'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // 기본 정책 반환
      return getDefaultPenaltyPolicy();
    }

    const policy = convertPenaltyPolicy(snapshot.docs[0].data(), snapshot.docs[0].id);
    cache.set(cacheKey, policy, POLICY_CACHE_TTL);
    return policy;
  } catch (error) {
    console.error('Error fetching penalty policy:', error);
    return getDefaultPenaltyPolicy();
  }
}

function getDefaultPenaltyPolicy(): PenaltyPolicy {
  return {
    policyId: 'default',
    version: '1.0',
    name: '기본 페널티 정책',
    isActive: true,
    validPeriod: {
      startDate: new Date(),
    },
    penaltyMatrix: PENALTY_MATRIX,
    repeatViolationMultiplier: REPEAT_VIOLATION_MULTIPLIERS,
    evidenceReduction: {
      maxReductionRate: 0.5,
      acceptedEvidenceTypes: ['medical_certificate', 'accident_report', 'official_document'],
      guidelines: [
        '진단서, 사고 확인서 등 공식 문제 제출 시 최대 50% 감면',
        '증빙 자료는 취소 후 24시간 이내 제출',
        '허위 증빙 적발 시 페널티 2배 부과',
      ],
    },
    firstViolationWarning: {
      enabled: true,
      message: '첫 위반은 경고로 처리됩니다. 재위반 시 페널티가 부과됩니다.',
    },
    warningLevels: WARNING_LEVELS,
    suspensionPeriods: {
      firstViolation: 3,
      secondViolation: 7,
      thirdViolation: 14,
      permanentBanThreshold: 5,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  };
}

// ==================== Evidence Reduction ====================

export async function submitEvidenceForReduction(
  recordId: string,
  evidenceUrls: string[]
): Promise<CancellationRecord> {
  try {
    const docRef = doc(db, 'cancellations', recordId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      throw new Error('Cancellation record not found');
    }

    const record = convertCancellationRecord(docSnapshot.data(), docSnapshot.id);
    const policy = await getActivePenaltyPolicy();

    if (!policy) {
      throw new Error('No active penalty policy found');
    }

    // 감면율 계산 (최대 50%)
    const reductionRate = policy.evidenceReduction.maxReductionRate;

    const reducedPenalty: PenaltyValue = {
      ...record.finalPenalty,
      ratingPenalty: record.finalPenalty.ratingPenalty! * (1 - reductionRate),
      monetaryPenalty: record.finalPenalty.monetaryPenalty! * (1 - reductionRate),
      suspensionDays: Math.ceil(record.finalPenalty.suspensionDays! * (1 - reductionRate)),
      description: `${record.finalPenalty.description} (증빙 감면 ${Math.round(reductionRate * 100)}%)`,
    };

    await updateDoc(docRef, {
      evidenceReductionApplied: true,
      evidenceReductionRate: reductionRate,
      finalPenalty: reducedPenalty,
      penaltyStatus: PenaltyStatus.REDUCED,
      updatedAt: convertDateToTimestamp(new Date()),
    });

    const updatedRecord = {
      ...record,
      evidenceReductionApplied: true,
      evidenceReductionRate: reductionRate,
      finalPenalty: reducedPenalty,
      penaltyStatus: PenaltyStatus.REDUCED,
      updatedAt: new Date(),
    };

    // 캐시 무효화
    cache.clearPattern(`^penaltyStatus:${record.cancelledByUserId}$`);

    return updatedRecord;
  } catch (error) {
    console.error('Error submitting evidence for reduction:', error);
    throw error;
  }
}

// ==================== Objection/Appeal ====================

export async function submitObjection(
  recordId: string,
  userId: string,
  reason: string,
  description: string,
  additionalEvidenceUrls?: string[]
): Promise<ObjectionRequest> {
  try {
    // 기존 기록 확인
    const recordRef = doc(db, 'cancellations', recordId);
    const recordSnapshot = await getDoc(recordRef);

    if (!recordSnapshot.exists()) {
      throw new Error('Cancellation record not found');
    }

    const objectionData = {
      cancellationRecordId: recordId,
      userId,
      reason,
      description,
      additionalEvidenceUrls,
      status: ObjectionStatus.PENDING,
      createdAt: convertDateToTimestamp(new Date()),
      updatedAt: convertDateToTimestamp(new Date()),
    };

    const docRef = await addDoc(collection(db, 'objections'), objectionData);

    // 취소 기록 상태 업데이트
    await updateDoc(recordRef, {
      penaltyStatus: PenaltyStatus.APPEALED,
      appealInfo: {
        isAppealed: true,
        appealReason: reason,
        appealDate: new Date(),
        status: 'pending',
      },
      updatedAt: convertDateToTimestamp(new Date()),
    });

    return {
      objectionId: docRef.id,
      ...objectionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ObjectionRequest;
  } catch (error) {
    console.error('Error submitting objection:', error);
    throw error;
  }
}

export async function reviewObjection(
  objectionId: string,
  reviewerId: string,
  status: 'approved' | 'rejected',
  adminNotes?: string
): Promise<ObjectionRequest> {
  try {
    const objectionRef = doc(db, 'objections', objectionId);
    const objectionSnapshot = await getDoc(objectionRef);

    if (!objectionSnapshot.exists()) {
      throw new Error('Objection not found');
    }

    const objection = objectionSnapshot.data();

    await updateDoc(objectionRef, {
      status: status === 'approved' ? ObjectionStatus.APPROVED : ObjectionStatus.REJECTED,
      reviewedBy: reviewerId,
      reviewedAt: convertDateToTimestamp(new Date()),
      adminNotes,
      updatedAt: convertDateToTimestamp(new Date()),
    });

    // 승인 시 페널티 취소
    if (status === 'approved') {
      const recordRef = doc(db, 'cancellations', objection.cancellationRecordId);
      await updateDoc(recordRef, {
        penaltyStatus: PenaltyStatus.CANCELLED,
        'appealInfo.status': 'approved',
        'appealInfo.reviewedBy': reviewerId,
        'appealInfo.reviewedAt': convertDateToTimestamp(new Date()),
        'appealInfo.adminNotes': adminNotes,
        updatedAt: convertDateToTimestamp(new Date()),
      });
    } else {
      const recordRef = doc(db, 'cancellations', objection.cancellationRecordId);
      await updateDoc(recordRef, {
        penaltyStatus: PenaltyStatus.ACTIVE,
        'appealInfo.status': 'rejected',
        'appealInfo.reviewedBy': reviewerId,
        'appealInfo.reviewedAt': convertDateToTimestamp(new Date()),
        'appealInfo.adminNotes': adminNotes,
        updatedAt: convertDateToTimestamp(new Date()),
      });
    }

    return {
      objectionId,
      ...objection,
      status: status === 'approved' ? ObjectionStatus.APPROVED : ObjectionStatus.REJECTED,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      adminNotes,
    } as ObjectionRequest;
  } catch (error) {
    console.error('Error reviewing objection:', error);
    throw error;
  }
}

// ==================== Cache Management ====================

export function clearPenaltyCache(userId?: string): void {
  if (userId) {
    cache.clearPattern(`^penaltyStatus:${userId}$`);
    cache.clearPattern(`^violations:${userId}:`);
  } else {
    cache.clear();
  }
}
