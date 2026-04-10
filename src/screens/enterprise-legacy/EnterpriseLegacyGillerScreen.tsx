import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { auth } from '../../services/firebase';
import {
  enterpriseLegacyFirestoreService,
  type EnterpriseLegacyMonthlyStats as MonthlyStats,
} from '../../services/enterprise-legacy-firestore-service';
import { EnterpriseLegacyGillerService } from '../../services/enterprise-legacy-giller-service';
import {
  ENTERPRISE_LEGACY_TIER_BENEFITS,
  ENTERPRISE_LEGACY_TIER_CRITERIA,
  ENTERPRISE_LEGACY_TIER_DETAILS,
  type EnterpriseLegacyGillerTierLevel,
} from '../../types/enterprise-legacy-giller-tier';
import type { EnterpriseLegacyStackParamList } from '../../types/navigation';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

type NavigationProp = StackNavigationProp<EnterpriseLegacyStackParamList, 'EnterpriseLegacyGiller'>;

type Props = {
  navigation: NavigationProp;
};

type DeliveryStatus = 'pending' | 'matched' | 'in_progress' | 'completed';

type GillerDelivery = {
  id: string;
  requestId: string;
  pickupStation: string;
  deliveryStation: string;
  status: DeliveryStatus;
  fee: number;
  createdAt: string;
};

type MonthlyEarnings = {
  totalDeliveries: number;
  totalEarnings: number;
  tierBonus: number;
  monthlyBonus: number;
  netEarnings: number;
  currentTier: EnterpriseLegacyGillerTierLevel;
  nextTier?: EnterpriseLegacyGillerTierLevel;
  progressToNext?: number;
};

type RecentDeliveryDoc = {
  id?: string;
  requestId?: string;
  pickupStation?: string;
  deliveryStation?: string;
  status?: DeliveryStatus;
  fee?: number;
  pricing?: {
    totalFee?: number;
  };
  createdAt?: {
    toDate?: () => Date;
  };
};

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function getStatusColor(status: DeliveryStatus): string {
  switch (status) {
    case 'pending':
      return Colors.textSecondary;
    case 'matched':
      return Colors.primary;
    case 'in_progress':
      return Colors.warning;
    case 'completed':
      return Colors.success;
  }
}

function getStatusText(status: DeliveryStatus): string {
  switch (status) {
    case 'pending':
      return '대기 중';
    case 'matched':
      return '매칭 완료';
    case 'in_progress':
      return '배송 중';
    case 'completed':
      return '완료';
  }
}

function mapRecentDelivery(rawId: string, raw: RecentDeliveryDoc): GillerDelivery {
  const createdAt = raw.createdAt?.toDate?.() ?? new Date();
  const status: DeliveryStatus =
    raw.status === 'pending' || raw.status === 'matched' || raw.status === 'in_progress' || raw.status === 'completed'
      ? raw.status
      : 'pending';

  return {
    id: rawId,
    requestId: raw.requestId ?? '',
    pickupStation: raw.pickupStation ?? '출발역 미기록',
    deliveryStation: raw.deliveryStation ?? '도착역 미기록',
    status,
    fee: raw.fee ?? raw.pricing?.totalFee ?? 0,
    createdAt: createdAt.toLocaleString('ko-KR'),
  };
}

function getNextTier(currentTier: EnterpriseLegacyGillerTierLevel): EnterpriseLegacyGillerTierLevel | undefined {
  if (currentTier === 'silver') {
    return 'gold';
  }
  if (currentTier === 'gold') {
    return 'platinum';
  }
  return undefined;
}

function getProgressToNextTier(currentTier: EnterpriseLegacyGillerTierLevel, totalDeliveries: number): number {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) {
    return 100;
  }

  const currentRequirement = ENTERPRISE_LEGACY_TIER_CRITERIA[currentTier].monthlyDeliveries;
  const nextRequirement = ENTERPRISE_LEGACY_TIER_CRITERIA[nextTier].monthlyDeliveries;
  const progress = ((totalDeliveries - currentRequirement) / Math.max(1, nextRequirement - currentRequirement)) * 100;

  return Math.max(0, Math.min(99, Math.round(progress)));
}

export default function EnterpriseLegacyGillerScreen({ navigation: _navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<GillerDelivery[]>([]);
  const [stats, setStats] = useState<MonthlyStats>({
    totalDeliveries: 0,
    totalAmount: 0,
    avgCostPerDelivery: 0,
  });
  const [currentTier, setCurrentTier] = useState<EnterpriseLegacyGillerTierLevel>('silver');

  useEffect(() => {
    void loadGillerData();
  }, []);

  async function loadGillerData(): Promise<void> {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const gillerId = currentUser.uid;
      const { year, month } = enterpriseLegacyFirestoreService.getCurrentYearMonth();

      const [statsData, recentDeliveries, savedTier, evaluatedTier] = await Promise.all([
        enterpriseLegacyFirestoreService.getMonthlyStats(gillerId, year, month),
        enterpriseLegacyFirestoreService.getRecentDeliveries(gillerId, 10),
        EnterpriseLegacyGillerService.getGillerTier(gillerId),
        EnterpriseLegacyGillerService.evaluateTierForGiller(gillerId).catch(() => null),
      ]);

      if (statsData) {
        setStats(statsData);
      }

      const tierLevel = savedTier?.tier ?? evaluatedTier?.tier ?? 'silver';
      setCurrentTier(tierLevel);

      const normalizedDeliveries = Array.isArray(recentDeliveries)
        ? (recentDeliveries as RecentDeliveryDoc[]).map((item, index) =>
            mapRecentDelivery(typeof item.id === 'string' ? item.id : `recent-${index}`, item ?? {}),
          )
        : [];

      setDeliveries(normalizedDeliveries);
    } catch (error) {
      console.error('Failed to load enterprise legacy giller dashboard', error);
    } finally {
      setLoading(false);
    }
  }

  const earnings = useMemo<MonthlyEarnings>(() => {
    const benefits = ENTERPRISE_LEGACY_TIER_BENEFITS[currentTier];
    const nextTier = getNextTier(currentTier);
    const tierBonus = Math.round(stats.totalAmount * (benefits.rateBonus / 100));
    const monthlyBonus = EnterpriseLegacyGillerService.calculateMonthlyBonus(currentTier, stats.totalDeliveries);

    return {
      totalDeliveries: stats.totalDeliveries,
      totalEarnings: stats.totalAmount,
      tierBonus,
      monthlyBonus,
      netEarnings: stats.totalAmount + tierBonus + monthlyBonus,
      currentTier,
      nextTier,
      progressToNext: nextTier ? getProgressToNextTier(currentTier, stats.totalDeliveries) : 100,
    };
  }, [currentTier, stats]);

  const tierInfo = ENTERPRISE_LEGACY_TIER_DETAILS[earnings.currentTier];
  const progressWidth = `${earnings.progressToNext ?? 100}%` as DimensionValue;
  const tierCardColor =
    tierInfo.benefits.priorityLevel >= 10 ? Colors.accent : tierInfo.benefits.priorityLevel >= 7 ? Colors.warning : Colors.textSecondary;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>기업 계약 길러 홈</Text>
        <Text style={styles.subtitle}>기업 고객 계약 흐름에서의 최근 배송, 월 수익, 등급 기준을 한 화면에서 확인합니다.</Text>
      </View>

      <View style={[styles.tierCard, { backgroundColor: tierCardColor }]}>
        <Text style={styles.tierName}>{tierInfo.name}</Text>
        <Text style={styles.tierBonus}>등급 보너스 {tierInfo.benefits.rateBonus}% · 월 보너스 {tierInfo.benefits.monthlyBonus}만원</Text>
        <Text style={styles.tierDescription}>{tierInfo.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>이번 달 수익 현황</Text>
        <EarningRow label="배송 건수" value={`${earnings.totalDeliveries}건`} />
        <EarningRow label="기본 수익" value={formatCurrency(earnings.totalEarnings)} />
        <EarningRow label="등급 추가 수익" value={formatCurrency(earnings.tierBonus)} />
        <EarningRow label="월 보너스" value={formatCurrency(earnings.monthlyBonus)} />
        <EarningRow label="세전 합계" value={formatCurrency(earnings.netEarnings)} emphasize />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>다음 등급 진행률</Text>
        <Text style={styles.progressLabel}>
          {earnings.nextTier
            ? `${earnings.nextTier.toUpperCase()} 등급까지 ${earnings.progressToNext ?? 0}%`
            : '최상위 등급을 유지하고 있습니다.'}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        {earnings.nextTier ? (
          <Text style={styles.criteriaText}>
            다음 기준: 평점 {ENTERPRISE_LEGACY_TIER_CRITERIA[earnings.nextTier].rating.toFixed(1)}점 이상 · 월 배송 {ENTERPRISE_LEGACY_TIER_CRITERIA[earnings.nextTier].monthlyDeliveries}건 · 가입 {ENTERPRISE_LEGACY_TIER_CRITERIA[earnings.nextTier].tenure}개월 이상
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>최근 배송</Text>
        {deliveries.length > 0 ? (
          deliveries.map((delivery) => (
            <View key={delivery.id} style={styles.deliveryItem}>
              <View style={styles.deliveryHeader}>
                <Text style={styles.deliveryRoute}>
                  {delivery.pickupStation} → {delivery.deliveryStation}
                </Text>
                <Text style={[styles.deliveryStatus, { color: getStatusColor(delivery.status) }]}>
                  {getStatusText(delivery.status)}
                </Text>
              </View>
              <Text style={styles.deliveryMeta}>{delivery.createdAt}</Text>
              <Text style={styles.deliveryFee}>{formatCurrency(delivery.fee)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>아직 표시할 최근 배송이 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function EarningRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, emphasize ? styles.emphasizeLabel : null]}>{label}</Text>
      <Text style={[styles.rowValue, emphasize ? styles.emphasizeValue : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  tierCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  tierName: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.white,
  },
  tierBonus: {
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    opacity: 0.9,
  },
  tierDescription: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    color: Colors.white,
    opacity: 0.8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  rowLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emphasizeLabel: {
    color: Colors.primary,
    fontWeight: '700',
  },
  emphasizeValue: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  progressLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  progressTrack: {
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  criteriaText: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  deliveryItem: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryRoute: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  deliveryStatus: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  deliveryMeta: {
    marginTop: 6,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  deliveryFee: {
    marginTop: 8,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
    color: Colors.textTertiary,
  },
});
