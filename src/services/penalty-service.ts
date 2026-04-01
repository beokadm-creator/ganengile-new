import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db, requireUserId } from './firebase';
import type {
  Penalty,
  PenaltySeverity,
  PenaltySummary,
  PenaltyType,
  Warning,
} from '../types/penalty';
import {
  CANCELLATION_PENALTIES,
  LATE_ARRIVAL_PENALTIES,
  NO_SHOW_PENALTIES,
  PenaltySeverity as PenaltySeverityEnum,
  PenaltyType as PenaltyTypeEnum,
} from '../types/penalty';

const PENALTIES_COLLECTION = 'penalties';
const WARNINGS_COLLECTION = 'warnings';

interface FirestorePenaltyDoc extends DocumentData {
  userId?: string;
  type?: PenaltyType;
  severity?: PenaltySeverity;
  reason?: string;
  lateMinutes?: number;
  noShowCount?: number;
  ratingAtTime?: number;
  cancelledAtPickup?: boolean;
  fine?: number;
  suspensionDays?: number;
  suspensionStartsAt?: unknown;
  suspensionEndsAt?: unknown;
  isPermanent?: boolean;
  warningId?: string;
  createdAt?: unknown;
  createdBy?: 'system' | 'admin';
}

interface FirestoreWarningDoc extends DocumentData {
  userId?: string;
  type?: PenaltyType;
  severity?: PenaltySeverity;
  message?: string;
  expiresAt?: unknown;
  createdAt?: unknown;
}

function toDateValue(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') {
      return toDate();
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
}

function mapPenalty(docSnapshot: QueryDocumentSnapshot<DocumentData>): Penalty {
  const data = docSnapshot.data() as FirestorePenaltyDoc;

  return {
    penaltyId: docSnapshot.id,
    userId: data.userId ?? '',
    type: data.type ?? PenaltyTypeEnum.LATE_ARRIVAL,
    severity: data.severity ?? PenaltySeverityEnum.WARNING,
    reason: data.reason ?? '',
    lateMinutes: data.lateMinutes,
    noShowCount: data.noShowCount,
    ratingAtTime: data.ratingAtTime,
    cancelledAtPickup: data.cancelledAtPickup,
    fine: data.fine ?? 0,
    suspensionDays: data.suspensionDays,
    suspensionStartsAt: toDateValue(data.suspensionStartsAt),
    suspensionEndsAt: toDateValue(data.suspensionEndsAt),
    isPermanent: data.isPermanent ?? false,
    warningId: data.warningId,
    createdAt: toDateValue(data.createdAt) ?? new Date(0),
    createdBy: data.createdBy ?? 'system',
  };
}

function mapWarning(docSnapshot: QueryDocumentSnapshot<DocumentData>): Warning {
  const data = docSnapshot.data() as FirestoreWarningDoc;

  return {
    warningId: docSnapshot.id,
    userId: data.userId ?? '',
    type: data.type ?? PenaltyTypeEnum.LATE_ARRIVAL,
    severity: data.severity ?? PenaltySeverityEnum.WARNING,
    message: data.message ?? '',
    expiresAt: toDateValue(data.expiresAt),
    createdAt: toDateValue(data.createdAt) ?? new Date(0),
  };
}

export class PenaltyService {
  private readonly userId: string;

  constructor(userId?: string) {
    this.userId = userId ?? requireUserId();
  }

  async applyLateArrivalPenalty(lateMinutes: number, requestId: string): Promise<Penalty> {
    let rule = LATE_ARRIVAL_PENALTIES[0];

    for (const candidate of LATE_ARRIVAL_PENALTIES) {
      if (lateMinutes >= candidate.minutes) {
        rule = candidate;
      }
    }

    const createdAt = new Date();
    const penaltyData = {
      userId: this.userId,
      type: PenaltyTypeEnum.LATE_ARRIVAL,
      severity: rule.severity,
      reason: `Late arrival by ${lateMinutes} minutes`,
      lateMinutes,
      fine: rule.fine,
      suspensionDays: rule.suspensionDays,
      isPermanent: false,
      createdAt: serverTimestamp(),
      createdBy: 'system' as const,
      requestId,
    };

    const docRef = await addDoc(collection(db, PENALTIES_COLLECTION), penaltyData);

    let warningId: string | undefined;
    if ((rule.suspensionDays ?? 0) > 0) {
      const warning = await this.createWarning(
        PenaltyTypeEnum.LATE_ARRIVAL,
        rule.severity,
        `Late arrival caused a ${rule.suspensionDays}-day suspension review.`
      );
      warningId = warning.warningId;
    }

    return {
      penaltyId: docRef.id,
      userId: this.userId,
      type: PenaltyTypeEnum.LATE_ARRIVAL,
      severity: rule.severity,
      reason: `Late arrival by ${lateMinutes} minutes`,
      lateMinutes,
      fine: rule.fine,
      suspensionDays: rule.suspensionDays,
      isPermanent: false,
      warningId,
      createdAt,
      createdBy: 'system',
    };
  }

  async applyNoShowPenalty(requestId: string): Promise<Penalty> {
    const recentNoShows = await this.getRecentPenaltyCount(PenaltyTypeEnum.NO_SHOW, 30);
    const noShowCount = recentNoShows + 1;
    let rule = NO_SHOW_PENALTIES[0];

    for (const candidate of NO_SHOW_PENALTIES) {
      if (noShowCount >= candidate.count) {
        rule = candidate;
      }
    }

    const createdAt = new Date();
    const suspensionStartsAt = rule.suspensionDays > 0 ? createdAt : undefined;
    const suspensionEndsAt =
      rule.suspensionDays > 0
        ? new Date(createdAt.getTime() + rule.suspensionDays * 24 * 60 * 60 * 1000)
        : undefined;

    const penaltyData = {
      userId: this.userId,
      type: PenaltyTypeEnum.NO_SHOW,
      severity: noShowCount >= 3 ? PenaltySeverityEnum.SEVERE : PenaltySeverityEnum.MODERATE,
      reason: `No-show count reached ${noShowCount}`,
      noShowCount,
      fine: 0,
      suspensionDays: rule.suspensionDays,
      suspensionStartsAt: suspensionStartsAt ?? null,
      suspensionEndsAt: suspensionEndsAt ?? null,
      isPermanent: rule.suspensionDays === 0,
      createdAt: serverTimestamp(),
      createdBy: 'system' as const,
      requestId,
    };

    const docRef = await addDoc(collection(db, PENALTIES_COLLECTION), penaltyData);

    return {
      penaltyId: docRef.id,
      userId: this.userId,
      type: PenaltyTypeEnum.NO_SHOW,
      severity: noShowCount >= 3 ? PenaltySeverityEnum.SEVERE : PenaltySeverityEnum.MODERATE,
      reason: `No-show count reached ${noShowCount}`,
      noShowCount,
      fine: 0,
      suspensionDays: rule.suspensionDays,
      suspensionStartsAt,
      suspensionEndsAt,
      isPermanent: rule.suspensionDays === 0,
      createdAt,
      createdBy: 'system',
    };
  }

  async applyCancellationPenalty(cancelledAtPickup: boolean, requestId: string): Promise<Penalty> {
    const recentCancellations = await this.getRecentPenaltyCount(PenaltyTypeEnum.CANCELLATION, 30);
    const cancellationCount = recentCancellations + 1;
    let rule = CANCELLATION_PENALTIES[0];

    for (const candidate of CANCELLATION_PENALTIES) {
      const timingMatches = candidate.timing === (cancelledAtPickup ? 'after_pickup' : 'before_pickup');
      if (timingMatches && cancellationCount >= candidate.count) {
        rule = candidate;
      }
    }

    const severity: PenaltySeverity = cancelledAtPickup
      ? (cancellationCount >= 2 ? PenaltySeverityEnum.MODERATE : PenaltySeverityEnum.MILD)
      : (cancellationCount >= 3 ? PenaltySeverityEnum.MILD : PenaltySeverityEnum.WARNING);

    const createdAt = new Date();
    const penaltyData = {
      userId: this.userId,
      type: PenaltyTypeEnum.CANCELLATION,
      severity,
      reason: cancelledAtPickup
        ? `Cancelled after pickup (${cancellationCount})`
        : `Cancelled before pickup (${cancellationCount})`,
      cancelledAtPickup,
      fine: rule.fine ?? 0,
      suspensionDays: rule.suspensionDays,
      isPermanent: false,
      createdAt: serverTimestamp(),
      createdBy: 'system' as const,
      requestId,
    };

    const docRef = await addDoc(collection(db, PENALTIES_COLLECTION), penaltyData);

    return {
      penaltyId: docRef.id,
      userId: this.userId,
      type: PenaltyTypeEnum.CANCELLATION,
      severity,
      reason: penaltyData.reason,
      cancelledAtPickup,
      fine: rule.fine ?? 0,
      suspensionDays: rule.suspensionDays,
      isPermanent: false,
      createdAt,
      createdBy: 'system',
    };
  }

  async getPenaltySummary(userId?: string): Promise<PenaltySummary> {
    const targetUserId = userId ?? this.userId;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const penaltiesQuery = query(
      collection(db, PENALTIES_COLLECTION),
      where('userId', '==', targetUserId),
      where('createdAt', '>=', since)
    );
    const penaltiesSnapshot = await getDocs(penaltiesQuery);
    const penalties = penaltiesSnapshot.docs.map(mapPenalty);

    const warningsQuery = query(
      collection(db, WARNINGS_COLLECTION),
      where('userId', '==', targetUserId)
    );
    const warningsSnapshot = await getDocs(warningsQuery);
    const warnings = warningsSnapshot.docs.map(mapWarning);

    const totalFines = penalties.reduce((sum, penalty) => sum + penalty.fine, 0);
    const totalSuspensionDays = penalties.reduce((sum, penalty) => sum + (penalty.suspensionDays ?? 0), 0);
    const activeSuspension = penalties
      .filter((penalty) => penalty.suspensionEndsAt && penalty.suspensionEndsAt > new Date())
      .sort((left, right) => (right.suspensionEndsAt?.getTime() ?? 0) - (left.suspensionEndsAt?.getTime() ?? 0))[0];

    return {
      userId: targetUserId,
      totalPenalties: penalties.length,
      totalFines,
      totalSuspensionDays,
      isSuspended: Boolean(activeSuspension),
      suspensionEndsAt: activeSuspension?.suspensionEndsAt,
      warnings,
      recentPenalties: penalties,
    };
  }

  private async createWarning(
    type: PenaltyType,
    severity: PenaltySeverity,
    message: string
  ): Promise<Warning> {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const warningData = {
      userId: this.userId,
      type,
      severity,
      message,
      expiresAt,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, WARNINGS_COLLECTION), warningData);

    return {
      warningId: docRef.id,
      userId: this.userId,
      type,
      severity,
      message,
      expiresAt,
      createdAt,
    };
  }

  private async getRecentPenaltyCount(type: PenaltyType, days: number): Promise<number> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const penaltiesQuery = query(
      collection(db, PENALTIES_COLLECTION),
      where('userId', '==', this.userId),
      where('type', '==', type),
      where('createdAt', '>=', since)
    );

    const snapshot = await getDocs(penaltiesQuery);
    return snapshot.size;
  }
}

export function createPenaltyService(userId?: string): PenaltyService {
  return new PenaltyService(userId);
}
