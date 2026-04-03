import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useUser } from '../../contexts/UserContext';
import {
  acceptMissionBundleForGiller,
  getBeta1HomeSnapshot,
  type Beta1HomeSnapshot,
} from '../../services/beta1-orchestration-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

type MissionCard = Beta1HomeSnapshot['missionCards'][number];

function isImmediateMission(card: MissionCard): boolean {
  return card.selectionState === 'available' || card.windowLabel.includes('지금');
}

export default function GillerRequestsScreen() {
  const { user } = useUser();
  const [snapshot, setSnapshot] = useState<Beta1HomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingBundleId, setSubmittingBundleId] = useState<string | null>(null);

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

  const handleAccept = useCallback((card: MissionCard) => {
    if (!user?.uid || !card.bundleId || card.selectionState === 'accepted') {
      return;
    }

    Alert.alert(
      '이 구간을 맡을까요?',
      `${card.title}\n${card.legSummary ?? card.strategyBody}\n\n선택하지 않은 주소 구간은 B2B fallback으로 전환될 수 있습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '수행하기',
          onPress: async () => {
            try {
              setSubmittingBundleId(card.bundleId ?? null);
              await acceptMissionBundleForGiller(card.bundleId!, user.uid);
              await loadSnapshot('refresh');
            } catch (error) {
              const message = error instanceof Error ? error.message : '구간 수락에 실패했습니다.';
              Alert.alert('수락 실패', message);
            } finally {
              setSubmittingBundleId(null);
            }
          },
        },
      ],
    );
  }, [loadSnapshot, user?.uid]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>선택 가능한 배송 구간을 불러오는 중입니다.</Text>
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
        <Text style={styles.kicker}>GOING BOARD</Text>
        <Text style={styles.title}>미션 보드</Text>
        <Text style={styles.subtitle}>어디서부터 어디까지 맡을지 구간 카드로 바로 선택하세요.</Text>
      </View>

      <View style={styles.metricRow}>
        <MetricCard label="즉시 선택" value={immediateMissions.length} />
        <MetricCard label="추가 제안" value={suggestedMissions.length} />
        <MetricCard
          label="예상 보상"
          value={`${(snapshot?.pendingRewardTotal ?? 0).toLocaleString()}원`}
        />
      </View>

      <Section
        title="지금 선택 가능"
        subtitle="바로 맡을 수 있는 구간 카드입니다."
        items={immediateMissions}
        emptyTitle="지금 바로 맡을 수 있는 구간이 없습니다"
        emptySubtitle="새 카드가 도착하면 여기에서 가장 먼저 보여드립니다."
        submittingBundleId={submittingBundleId}
        onPress={handleAccept}
      />

      <Section
        title="검토해볼 제안"
        subtitle="시간 확인이 필요하거나 fallback이 함께 걸린 카드입니다."
        items={suggestedMissions}
        emptyTitle="검토할 제안이 없습니다"
        emptySubtitle="현재는 바로 수락 가능한 카드만 열려 있습니다."
        submittingBundleId={submittingBundleId}
        onPress={handleAccept}
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
  submittingBundleId,
  onPress,
}: {
  title: string;
  subtitle: string;
  items: MissionCard[];
  emptyTitle: string;
  emptySubtitle: string;
  submittingBundleId: string | null;
  onPress: (card: MissionCard) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      {items.length ? (
        items.map((card) => {
          const disabled = card.selectionState === 'accepted' || !card.bundleId || submittingBundleId === card.bundleId;
          const actionLabel =
            submittingBundleId === card.bundleId
              ? '처리 중...'
              : card.actionLabel ?? (card.selectionState === 'accepted' ? '수락 완료' : '이 구간 수행하기');

          return (
            <View key={card.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <StatusBadge label={card.status} />
              </View>
              <Text style={styles.windowLabel}>{card.windowLabel}</Text>
              <Text style={styles.rewardLabel}>{card.rewardLabel}</Text>
              <Text style={styles.cardBody}>{card.strategyTitle}</Text>
              <Text style={styles.cardSummary}>{card.strategyBody}</Text>
              {card.fallbackLabel ? <Text style={styles.fallbackLabel}>{card.fallbackLabel}</Text> : null}
              <TouchableOpacity
                style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
                activeOpacity={0.88}
                disabled={disabled}
                onPress={() => onPress(card)}
              >
                <Text style={[styles.actionButtonText, disabled && styles.actionButtonTextDisabled]}>
                  {actionLabel}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
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
      <MaterialIcons name="bolt" size={14} color={Colors.primaryDark} />
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
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
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
    gap: 4,
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
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
    fontWeight: Typography.fontWeight.bold,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  cardTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  windowLabel: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  rewardLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  cardBody: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  cardSummary: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  fallbackLabel: {
    color: Colors.warning,
    fontSize: Typography.fontSize.sm,
  },
  actionButton: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.border,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  actionButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: Colors.primaryDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
});
