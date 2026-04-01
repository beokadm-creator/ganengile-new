import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useUser } from '../../contexts/UserContext';
import {
  getBeta1HomeSnapshot,
  type Beta1HomeSnapshot,
} from '../../services/beta1-orchestration-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';

type MissionCard = Beta1HomeSnapshot['missionCards'][number];

function isImmediateMission(card: MissionCard): boolean {
  return card.windowLabel.includes('지금 수락 가능');
}

export default function GillerRequestsScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const { user } = useUser();
  const [snapshot, setSnapshot] = useState<Beta1HomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSnapshot = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!user?.uid) {
      setSnapshot(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const nextSnapshot = await getBeta1HomeSnapshot(user.uid, 'giller');
      setSnapshot(nextSnapshot);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadSnapshot('initial');
  }, [loadSnapshot]);

  const immediateMissions = useMemo(
    () => (snapshot?.missionCards ?? []).filter(isImmediateMission),
    [snapshot],
  );
  const suggestedMissions = useMemo(
    () => (snapshot?.missionCards ?? []).filter((card) => !isImmediateMission(card)),
    [snapshot],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>미션을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void loadSnapshot('refresh')} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>가는길에</Text>
        <Text style={styles.title}>미션 보드</Text>
        <Text style={styles.subtitle}>받을 미션만 빠르게 확인하세요.</Text>
      </View>

      <View style={styles.metricRow}>
        <MetricCard label="지금 수락 가능" value={immediateMissions.length} />
        <MetricCard label="검토해볼 제안" value={suggestedMissions.length} />
        <MetricCard
          label="예상 정산"
          value={`${(snapshot?.pendingRewardTotal ?? 0).toLocaleString()}원`}
        />
      </View>

      <Section
        title="지금 수락 가능"
        subtitle="바로 움직일 수 있는 미션입니다."
        items={immediateMissions}
        emptyTitle="지금 바로 받을 미션이 없습니다"
        emptySubtitle="새 제안이 들어오면 여기에 먼저 보여드릴게요."
        onPress={(_missionId) => navigation.navigate('ChatList')}
      />

      <Section
        title="검토해볼 제안"
        subtitle="동선은 맞지만 시간 확인이 더 필요한 제안입니다."
        items={suggestedMissions}
        emptyTitle="검토할 제안이 없습니다"
        emptySubtitle="지금은 바로 수락 가능한 미션만 열려 있습니다."
        onPress={(_missionId) => navigation.navigate('ChatList')}
      />
    </ScrollView>
  );
}

function Section({
  title,
  subtitle,
  items,
  emptyTitle,
  emptySubtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  items: MissionCard[];
  emptyTitle: string;
  emptySubtitle: string;
  onPress: (missionId: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      {items.length ? (
        items.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.card}
            activeOpacity={0.88}
            onPress={() => onPress(card.id)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <StatusBadge label={card.status} />
            </View>
            <Text style={styles.windowLabel}>{card.windowLabel}</Text>
            <Text style={styles.rewardLabel}>{card.rewardLabel}</Text>
            <Text style={styles.cardBody}>{card.strategyTitle}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
        </View>
      )}
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <View style={styles.statusBadge}>
      <MaterialIcons name="flash-on" size={14} color={Colors.primaryDark} />
      <Text style={styles.statusBadgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing['5xl'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
  },
  header: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
    gap: 6,
  },
  kicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  metricLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    marginBottom: 6,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 8,
    ...Shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: Colors.primaryDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
  },
  windowLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  rewardLabel: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  cardBody: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: 6,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
});
