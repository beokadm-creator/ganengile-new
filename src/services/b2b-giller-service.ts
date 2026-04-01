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
  B2BGillerBenefits,
  B2BGillerCriteria,
  B2BGillerStatus,
  B2BGillerTier,
  B2BGillerTierLevel,
} from '../types/b2b-giller-tier';
import {
  B2B_TIER_BENEFITS,
  B2B_TIER_CRITERIA,
  B2B_TIER_DETAILS,
} from '../types/b2b-giller-tier';

const TIER_COLLECTION = 'b2b_giller_tiers';
const GILLER_COLLECTION = 'users';

type TierEvaluationResult = {
  tier: B2BGillerTierLevel;
  criteria: B2BGillerCriteria;
  benefits: B2BGillerBenefits;
};

type FirestoreB2BGillerHistory = {
  promotedAt?: Date | Timestamp | null;
  lastEvaluated?: Date | Timestamp | null;
  nextEvaluation?: Date | Timestamp | null;
};

type FirestoreB2BGillerTierDoc = DocumentData & {
  gillerId?: string;
  tier?: B2BGillerTierLevel;
  criteria?: Partial<B2BGillerCriteria>;
  benefits?: Partial<B2BGillerBenefits>;
  history?: FirestoreB2BGillerHistory;
  status?: B2BGillerStatus;
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

const DEFAULT_TIER_LEVEL: B2BGillerTierLevel = 'silver';
const DEFAULT_STATUS: B2BGillerStatus = 'active';

function toDate(value: Date | Timestamp | null | undefined, fallback: Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  return fallback;
}

function toTierLevel(value: unknown): B2BGillerTierLevel {
  return value === 'silver' || value === 'gold' || value === 'platinum' ? value : DEFAULT_TIER_LEVEL;
}

function toStatus(value: unknown): B2BGillerStatus {
  return value === 'active' || value === 'suspended' ? value : DEFAULT_STATUS;
}

function mapTierCriteria(
  tierLevel: B2BGillerTierLevel,
  criteria?: Partial<B2BGillerCriteria>,
): B2BGillerCriteria {
  const defaults = B2B_TIER_CRITERIA[tierLevel];

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
  tierLevel: B2BGillerTierLevel,
  benefits?: Partial<B2BGillerBenefits>,
): B2BGillerBenefits {
  const defaults = B2B_TIER_BENEFITS[tierLevel];

  return {
    priorityLevel:
      typeof benefits?.priorityLevel === 'number' ? benefits.priorityLevel : defaults.priorityLevel,
    rateBonus: typeof benefits?.rateBonus === 'number' ? benefits.rateBonus : defaults.rateBonus,
    monthlyBonus:
      typeof benefits?.monthlyBonus === 'number' ? benefits.monthlyBonus : defaults.monthlyBonus,
  };
}

function mapTierDocument(snapshot: { id: string; data(): DocumentData }): B2BGillerTier {
  const raw = snapshot.data() as FirestoreB2BGillerTierDoc;
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
      nextEvaluation: toDate(history.nextEvaluation, B2BGillerService.getNextEvaluationDate()),
    },
    status: toStatus(raw.status),
    updatedAt: toDate(raw.updatedAt, now),
  };
}

function diffMonths(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

export class B2BGillerService {
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

    if (this.meetsCriteria(metrics, B2B_TIER_CRITERIA.platinum)) {
      return {
        tier: 'platinum',
        criteria: B2B_TIER_CRITERIA.platinum,
        benefits: B2B_TIER_BENEFITS.platinum,
      };
    }

    if (this.meetsCriteria(metrics, B2B_TIER_CRITERIA.gold)) {
      return {
        tier: 'gold',
        criteria: B2B_TIER_CRITERIA.gold,
        benefits: B2B_TIER_BENEFITS.gold,
      };
    }

    if (this.meetsCriteria(metrics, B2B_TIER_CRITERIA.silver)) {
      return {
        tier: 'silver',
        criteria: B2B_TIER_CRITERIA.silver,
        benefits: B2B_TIER_BENEFITS.silver,
      };
    }

    throw new Error('아직 B2B 길러 등급 기준을 충족하지 못했습니다.');
  }

  static async registerB2BGiller(gillerId: string): Promise<void> {
    const initialTier = await this.evaluateTierForGiller(gillerId);
    const now = new Date();

    const tierData: Omit<B2BGillerTier, 'id'> = {
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

  private static meetsCriteria(metrics: GillerMetrics, criteria: B2BGillerCriteria): boolean {
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
      throw new Error('B2B 길러 등급 정보를 찾을 수 없습니다.');
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
      status: 'suspended' as B2BGillerStatus,
      updatedAt: new Date(),
    });
  }

  static async getB2BGillerTier(gillerId: string): Promise<B2BGillerTier | null> {
    const tierQuery = query(collection(db, TIER_COLLECTION), where('gillerId', '==', gillerId));
    const querySnapshot = await getDocs(tierQuery);

    if (querySnapshot.empty) {
      return null;
    }

    return mapTierDocument(querySnapshot.docs[0]);
  }

  static async getActiveB2BGillers(): Promise<Array<B2BGillerTier & { gillerId: string }>> {
    const tierQuery = query(collection(db, TIER_COLLECTION), where('status', '==', 'active'));
    const querySnapshot = await getDocs(tierQuery);
    return querySnapshot.docs.map((snapshot) => mapTierDocument(snapshot));
  }

  static async getTierStats(): Promise<Record<string, number>> {
    const snapshot = await getDocs(collection(db, TIER_COLLECTION));
    const stats: Record<B2BGillerTierLevel, number> = {
      silver: 0,
      gold: 0,
      platinum: 0,
    };

    snapshot.docs.forEach((snapshotDoc) => {
      const tier = toTierLevel((snapshotDoc.data() as FirestoreB2BGillerTierDoc).tier);
      stats[tier] += 1;
    });

    return stats;
  }

  static async checkB2BEligibility(gillerId: string): Promise<{
    eligible: boolean;
    currentTier?: string;
    requiredFor?: Partial<Record<B2BGillerTierLevel, B2BGillerCriteria>>;
  }> {
    const tier = await this.getB2BGillerTier(gillerId);

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
    } catch {
      return {
        eligible: false,
        requiredFor: B2B_TIER_CRITERIA,
      };
    }
  }

  static async deleteB2BGillerTier(tierId: string): Promise<void> {
    await deleteDoc(doc(db, TIER_COLLECTION, tierId));
  }

  static calculateMonthlyBonus(tier: B2BGillerTierLevel, _b2bDeliveries: number): number {
    return B2B_TIER_BENEFITS[tier].monthlyBonus * 10000;
  }

  static calculateRateBonus(tier: B2BGillerTierLevel, baseEarning: number): number {
    return Math.round(baseEarning * (B2B_TIER_BENEFITS[tier].rateBonus / 100));
  }

  static calculateTotalEarning(
    tier: B2BGillerTierLevel,
    baseEarning: number,
    b2bDeliveries: number,
  ): number {
    const rateBonus = this.calculateRateBonus(tier, baseEarning);
    const monthlyBonus = this.calculateMonthlyBonus(tier, b2bDeliveries);
    return baseEarning + rateBonus + monthlyBonus;
  }

  static getTierDetails(tier: B2BGillerTierLevel): {
    name: string;
    description: string;
    criteria: B2BGillerCriteria;
    benefits: B2BGillerBenefits;
  } {
    return B2B_TIER_DETAILS[tier];
  }

  static compareTierPriority(tier1: B2BGillerTierLevel, tier2: B2BGillerTierLevel): number {
    return B2B_TIER_BENEFITS[tier1].priorityLevel - B2B_TIER_BENEFITS[tier2].priorityLevel;
  }
}
