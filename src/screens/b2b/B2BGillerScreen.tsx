import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { auth } from '../../services/firebase';
import { b2bFirestoreService, type MonthlyStats } from '../../services/b2b-firestore-service';
import { B2BGillerService } from '../../services/b2b-giller-service';
import {
  B2B_TIER_BENEFITS,
  B2B_TIER_CRITERIA,
  B2B_TIER_DETAILS,
  type B2BGillerTierLevel,
} from '../../types/b2b-giller-tier';
import type { B2BStackParamList } from '../../types/navigation';

type NavigationProp = StackNavigationProp<B2BStackParamList, 'B2BGiller'>;

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
  currentTier: B2BGillerTierLevel;
  nextTier?: B2BGillerTierLevel;
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
      return '#64748B';
    case 'matched':
      return '#2563EB';
    case 'in_progress':
      return '#D97706';
    case 'completed':
      return '#16A34A';
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

function getNextTier(currentTier: B2BGillerTierLevel): B2BGillerTierLevel | undefined {
  if (currentTier === 'silver') {
    return 'gold';
  }
  if (currentTier === 'gold') {
    return 'platinum';
  }
  return undefined;
}

function getProgressToNextTier(currentTier: B2BGillerTierLevel, totalDeliveries: number): number {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) {
    return 100;
  }

  const currentRequirement = B2B_TIER_CRITERIA[currentTier].monthlyDeliveries;
  const nextRequirement = B2B_TIER_CRITERIA[nextTier].monthlyDeliveries;
  const progress = ((totalDeliveries - currentRequirement) / Math.max(1, nextRequirement - currentRequirement)) * 100;

  return Math.max(0, Math.min(99, Math.round(progress)));
}

export default function B2BGillerScreen({ navigation: _navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<GillerDelivery[]>([]);
  const [stats, setStats] = useState<MonthlyStats>({
    totalDeliveries: 0,
    totalAmount: 0,
    avgCostPerDelivery: 0,
  });
  const [currentTier, setCurrentTier] = useState<B2BGillerTierLevel>('silver');

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
      const { year, month } = b2bFirestoreService.getCurrentYearMonth();

      const [statsData, recentDeliveries, savedTier, evaluatedTier] = await Promise.all([
        b2bFirestoreService.getMonthlyStats(gillerId, year, month),
        b2bFirestoreService.getRecentDeliveries(gillerId, 10),
        B2BGillerService.getB2BGillerTier(gillerId),
        B2BGillerService.evaluateTierForGiller(gillerId).catch(() => null),
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
      console.error('Failed to load B2B giller dashboard', error);
    } finally {
      setLoading(false);
    }
  }

  const earnings = useMemo<MonthlyEarnings>(() => {
    const benefits = B2B_TIER_BENEFITS[currentTier];
    const nextTier = getNextTier(currentTier);
    const tierBonus = Math.round(stats.totalAmount * (benefits.rateBonus / 100));
    const monthlyBonus = B2BGillerService.calculateMonthlyBonus(currentTier, stats.totalDeliveries);

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

  const tierInfo = B2B_TIER_DETAILS[earnings.currentTier];
  const progressWidth = `${earnings.progressToNext ?? 100}%` as DimensionValue;
  const tierCardColor =
    tierInfo.benefits.priorityLevel >= 10 ? '#7C3AED' : tierInfo.benefits.priorityLevel >= 7 ? '#D97706' : '#475569';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>B2B 길러 홈</Text>
        <Text style={styles.subtitle}>최근 배송, 월 수익, 등급 기준을 한 화면에서 확인합니다.</Text>
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
            다음 기준: 평점 {B2B_TIER_CRITERIA[earnings.nextTier].rating.toFixed(1)}점 이상 · 월 배송 {B2B_TIER_CRITERIA[earnings.nextTier].monthlyDeliveries}건 · 가입 {B2B_TIER_CRITERIA[earnings.nextTier].tenure}개월 이상
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
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  tierCard: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tierBonus: {
    fontSize: 15,
    color: '#F8FAFC',
  },
  tierDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#E2E8F0',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rowLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emphasizeLabel: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  emphasizeValue: {
    color: '#1D4ED8',
    fontSize: 18,
  },
  progressLabel: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  criteriaText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  deliveryItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryRoute: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 12,
  },
  deliveryStatus: {
    fontSize: 13,
    fontWeight: '700',
  },
  deliveryMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
  },
  deliveryFee: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
  },
});
