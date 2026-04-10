/**
 * Enterprise legacy giller tier service.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type {
  EnterpriseLegacyGillerBenefits,
  EnterpriseLegacyGillerCriteria,
  EnterpriseLegacyGillerStatus,
  EnterpriseLegacyGillerTier,
  EnterpriseLegacyGillerTierLevel,
} from '../types/enterprise-legacy-giller-tier';
import {
  ENTERPRISE_LEGACY_TIER_BENEFITS,
  ENTERPRISE_LEGACY_TIER_CRITERIA,
  ENTERPRISE_LEGACY_TIER_DETAILS,
} from '../types/enterprise-legacy-giller-tier';

const TIER_COLLECTION = 'b2b_giller_tiers';
const GILLER_COLLECTION = 'users';

type TierEvaluationResult = {
  tier: EnterpriseLegacyGillerTierLevel;
  criteria: EnterpriseLegacyGillerCriteria;
  benefits: EnterpriseLegacyGillerBenefits;
};

type FirestoreEnterpriseLegacyGillerHistory = {
  promotedAt?: Date | Timestamp | null;
  lastEvaluated?: Date | Timestamp | null;
  nextEvaluation?: Date | Timestamp | null;
};

type FirestoreEnterpriseLegacyGillerTierDoc = DocumentData & {
  gillerId?: string;
  tier?: EnterpriseLegacyGillerTierLevel;
  criteria?: Partial<EnterpriseLegacyGillerCriteria>;
  benefits?: Partial<EnterpriseLegacyGillerBenefits>;
  history?: FirestoreEnterpriseLegacyGillerHistory;
  status?: EnterpriseLegacyGillerStatus;
  updatedAt?: Date | Timestamp | null;
};

type FirestoreUserDoc = DocumentData & {
  rating?: number;
  createdAt?: Date | Timestamp | null;
  stats?: {
    rating?: number;
    completedDeliveries?: number;
    recent30DaysDeliveries?: number;
    accountAgeDays?: number;
  };
};

type GillerMetrics = {
  rating: number;
  monthlyDeliveries: number;
  tenureMonths: number;
};

const DEFAULT_TIER_LEVEL: EnterpriseLegacyGillerTierLevel = 'silver';
const DEFAULT_STATUS: EnterpriseLegacyGillerStatus = 'active';

function toDate(value: Date | Timestamp | null | undefined, fallback: Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  return fallback;
}

function toTierLevel(value: unknown): EnterpriseLegacyGillerTierLevel {
  return value === 'silver' || value === 'gold' || value === 'platinum' ? value : DEFAULT_TIER_LEVEL;
}

function toStatus(value: unknown): EnterpriseLegacyGillerStatus {
  return value === 'active' || value === 'suspended' ? value : DEFAULT_STATUS;
}

function mapTierCriteria(
  tierLevel: EnterpriseLegacyGillerTierLevel,
  criteria?: Partial<EnterpriseLegacyGillerCriteria>,
): EnterpriseLegacyGillerCriteria {
  const defaults = ENTERPRISE_LEGACY_TIER_CRITERIA[tierLevel];

  return {
    rating: typeof criteria?.rating === 'number' ? criteria.rating : defaults.rating,
    monthlyDeliveries:
      typeof criteria?.monthlyDeliveries === 'number'
        ? criteria.monthlyDeliveries
        : defaults.monthlyDeliveries,
    tenure: typeof criteria?.tenure === 'number' ? criteria.tenure : defaults.tenure,
  };
}

function mapTierBenefits(
  tierLevel: EnterpriseLegacyGillerTierLevel,
  benefits?: Partial<EnterpriseLegacyGillerBenefits>,
): EnterpriseLegacyGillerBenefits {
  const defaults = ENTERPRISE_LEGACY_TIER_BENEFITS[tierLevel];

  return {
    priorityLevel:
      typeof benefits?.priorityLevel === 'number' ? benefits.priorityLevel : defaults.priorityLevel,
    rateBonus: typeof benefits?.rateBonus === 'number' ? benefits.rateBonus : defaults.rateBonus,
    monthlyBonus:
      typeof benefits?.monthlyBonus === 'number' ? benefits.monthlyBonus : defaults.monthlyBonus,
  };
}

function mapTierDocument(snapshot: { id: string; data(): DocumentData }): EnterpriseLegacyGillerTier {
  const raw = snapshot.data() as FirestoreEnterpriseLegacyGillerTierDoc;
  const now = new Date();
  const tierLevel = toTierLevel(raw.tier);
  const history = raw.history ?? {};

  return {
    id: snapshot.id,
    gillerId: typeof raw.gillerId === 'string' ? raw.gillerId : '',
    tier: tierLevel,
    criteria: mapTierCriteria(tierLevel, raw.criteria),
    benefits: mapTierBenefits(tierLevel, raw.benefits),
    history: {
      promotedAt: history.promotedAt ? toDate(history.promotedAt, now) : undefined,
      lastEvaluated: toDate(history.lastEvaluated, now),
      nextEvaluation: toDate(history.nextEvaluation, EnterpriseLegacyGillerService.getNextEvaluationDate()),
    },
    status: toStatus(raw.status),
    updatedAt: toDate(raw.updatedAt, now),
  };
}

function diffMonths(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

export class EnterpriseLegacyGillerService {
  static getNextEvaluationDate(baseDate = new Date()): Date {
    const nextMonth = new Date(baseDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  }

  private static async getGillerMetrics(gillerId: string): Promise<GillerMetrics> {
    const gillerDoc = await getDoc(doc(db, GILLER_COLLECTION, gillerId));
    if (!gillerDoc.exists()) {
      throw new Error('길러 정보를 찾을 수 없습니다.');
    }

    const raw = gillerDoc.data() as FirestoreUserDoc;
    const stats = raw.stats ?? {};
    const rating =
      typeof stats.rating === 'number'
        ? stats.rating
        : typeof raw.rating === 'number'
          ? raw.rating
          : 0;
    const monthlyDeliveries =
      typeof stats.recent30DaysDeliveries === 'number'
        ? stats.recent30DaysDeliveries
        : typeof stats.completedDeliveries === 'number'
          ? stats.completedDeliveries
          : 0;

    const createdAt = toDate(raw.createdAt, new Date());
    const tenureMonths =
      typeof stats.accountAgeDays === 'number'
        ? Math.max(0, Math.floor(stats.accountAgeDays / 30))
        : diffMonths(createdAt, new Date());

    return {
      rating,
      monthlyDeliveries,
      tenureMonths,
    };
  }

  static async evaluateTierForGiller(gillerId: string): Promise<TierEvaluationResult> {
    const metrics = await this.getGillerMetrics(gillerId);

    if (this.meetsCriteria(metrics, ENTERPRISE_LEGACY_TIER_CRITERIA.platinum)) {
      return {
        tier: 'platinum',
        criteria: ENTERPRISE_LEGACY_TIER_CRITERIA.platinum,
        benefits: ENTERPRISE_LEGACY_TIER_BENEFITS.platinum,
      };
    }

    if (this.meetsCriteria(metrics, ENTERPRISE_LEGACY_TIER_CRITERIA.gold)) {
      return {
        tier: 'gold',
        criteria: ENTERPRISE_LEGACY_TIER_CRITERIA.gold,
        benefits: ENTERPRISE_LEGACY_TIER_BENEFITS.gold,
      };
    }

    if (this.meetsCriteria(metrics, ENTERPRISE_LEGACY_TIER_CRITERIA.silver)) {
      return {
        tier: 'silver',
        criteria: ENTERPRISE_LEGACY_TIER_CRITERIA.silver,
        benefits: ENTERPRISE_LEGACY_TIER_BENEFITS.silver,
      };
    }

    throw new Error('아직 기업 계약 길러 등급 기준을 충족하지 못했습니다.');
  }

  static async registerGiller(gillerId: string): Promise<void> {
    const initialTier = await this.evaluateTierForGiller(gillerId);
    const now = new Date();

    const tierData: Omit<EnterpriseLegacyGillerTier, 'id'> = {
      gillerId,
      tier: initialTier.tier,
      criteria: initialTier.criteria,
      benefits: initialTier.benefits,
      history: {
        lastEvaluated: now,
        nextEvaluation: this.getNextEvaluationDate(now),
      },
      status: 'active',
      updatedAt: now,
    };

    await addDoc(collection(db, TIER_COLLECTION), tierData);
  }

  private static meetsCriteria(metrics: GillerMetrics, criteria: EnterpriseLegacyGillerCriteria): boolean {
    return (
      metrics.tenureMonths >= criteria.tenure &&
      metrics.monthlyDeliveries >= criteria.monthlyDeliveries &&
      metrics.rating >= criteria.rating
    );
  }

  static async evaluateAllGillers(): Promise<void> {
    const tierQuery = query(collection(db, TIER_COLLECTION), where('status', '==', 'active'));
    const querySnapshot = await getDocs(tierQuery);

    for (const tierDoc of querySnapshot.docs) {
      const tier = mapTierDocument(tierDoc);
      if (new Date() >= tier.history.nextEvaluation) {
        await this.reevaluateGiller(tierDoc.id);
      }
    }
  }

  private static async reevaluateGiller(tierId: string): Promise<void> {
    const tierDoc = await getDoc(doc(db, TIER_COLLECTION, tierId));
    if (!tierDoc.exists()) {
      throw new Error('기업 계약 길러 등급 정보를 찾을 수 없습니다.');
    }

    const currentTier = mapTierDocument(tierDoc);
    const newTier = await this.evaluateTierForGiller(currentTier.gillerId);

    if (newTier.tier !== currentTier.tier) {
      await this.promoteGiller(tierId, newTier);
      return;
    }

    const now = new Date();
    await updateDoc(doc(db, TIER_COLLECTION, tierId), {
      'history.lastEvaluated': now,
      'history.nextEvaluation': this.getNextEvaluationDate(now),
      updatedAt: now,
    });
  }

  private static async promoteGiller(tierId: string, newTier: TierEvaluationResult): Promise<void> {
    const now = new Date();

    await updateDoc(doc(db, TIER_COLLECTION, tierId), {
      tier: newTier.tier,
      criteria: newTier.criteria,
      benefits: newTier.benefits,
      history: {
        promotedAt: now,
        lastEvaluated: now,
        nextEvaluation: this.getNextEvaluationDate(now),
      },
      updatedAt: now,
    });
  }

  static async demoteGiller(tierId: string, _reason: string): Promise<void> {
    await updateDoc(doc(db, TIER_COLLECTION, tierId), {
      status: 'suspended' as EnterpriseLegacyGillerStatus,
      updatedAt: new Date(),
    });
  }

  static async getGillerTier(gillerId: string): Promise<EnterpriseLegacyGillerTier | null> {
    const tierQuery = query(collection(db, TIER_COLLECTION), where('gillerId', '==', gillerId));
    const querySnapshot = await getDocs(tierQuery);

    if (querySnapshot.empty) {
      return null;
    }

    return mapTierDocument(querySnapshot.docs[0]);
  }

  static async getActiveGillers(): Promise<Array<EnterpriseLegacyGillerTier & { gillerId: string }>> {
    const tierQuery = query(collection(db, TIER_COLLECTION), where('status', '==', 'active'));
    const querySnapshot = await getDocs(tierQuery);
    return querySnapshot.docs.map((snapshot) => mapTierDocument(snapshot));
  }

  static async getTierStats(): Promise<Record<string, number>> {
    const snapshot = await getDocs(collection(db, TIER_COLLECTION));
    const stats: Record<EnterpriseLegacyGillerTierLevel, number> = {
      silver: 0,
      gold: 0,
      platinum: 0,
    };

    snapshot.docs.forEach((snapshotDoc) => {
      const tier = toTierLevel((snapshotDoc.data() as FirestoreEnterpriseLegacyGillerTierDoc).tier);
      stats[tier] += 1;
    });

    return stats;
  }

  static async checkEligibility(gillerId: string): Promise<{
    eligible: boolean;
    currentTier?: string;
    requiredFor?: Partial<Record<EnterpriseLegacyGillerTierLevel, EnterpriseLegacyGillerCriteria>>;
  }> {
    const tier = await this.getGillerTier(gillerId);

    if (tier) {
      return {
        eligible: true,
        currentTier: tier.tier,
      };
    }

    try {
      const preview = await this.evaluateTierForGiller(gillerId);
      return {
        eligible: true,
        currentTier: preview.tier,
      };
    } catch (error) {
      console.error('[enterprise-legacy-giller-service] 등급 평가 실패:', error);
      return {
        eligible: false,
        requiredFor: ENTERPRISE_LEGACY_TIER_CRITERIA,
      };
    }
  }

  static async deleteGillerTier(tierId: string): Promise<void> {
    await deleteDoc(doc(db, TIER_COLLECTION, tierId));
  }

  static calculateMonthlyBonus(tier: EnterpriseLegacyGillerTierLevel, _b2bDeliveries: number): number {
    return ENTERPRISE_LEGACY_TIER_BENEFITS[tier].monthlyBonus * 10000;
  }

  static calculateRateBonus(tier: EnterpriseLegacyGillerTierLevel, baseEarning: number): number {
    return Math.round(baseEarning * (ENTERPRISE_LEGACY_TIER_BENEFITS[tier].rateBonus / 100));
  }

  static calculateTotalEarning(
    tier: EnterpriseLegacyGillerTierLevel,
    baseEarning: number,
    b2bDeliveries: number,
  ): number {
    const rateBonus = this.calculateRateBonus(tier, baseEarning);
    const monthlyBonus = this.calculateMonthlyBonus(tier, b2bDeliveries);
    return baseEarning + rateBonus + monthlyBonus;
  }

  static getTierDetails(tier: EnterpriseLegacyGillerTierLevel): {
    name: string;
    description: string;
    criteria: EnterpriseLegacyGillerCriteria;
    benefits: EnterpriseLegacyGillerBenefits;
  } {
    return ENTERPRISE_LEGACY_TIER_DETAILS[tier];
  }

  static compareTierPriority(tier1: EnterpriseLegacyGillerTierLevel, tier2: EnterpriseLegacyGillerTierLevel): number {
    return ENTERPRISE_LEGACY_TIER_BENEFITS[tier1].priorityLevel - ENTERPRISE_LEGACY_TIER_BENEFITS[tier2].priorityLevel;
  }
}
