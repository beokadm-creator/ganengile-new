import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useUser } from '../../contexts/UserContext';
import { useGillerAccess } from '../../hooks/useGillerAccess';
import {
  getBeta1HomeSnapshot,
  type Beta1HomeSnapshot,
} from '../../services/beta1-orchestration-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';
import { UserRole } from '../../types/user';

export default function HomeScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, currentRole, switchRole } = useUser();
  const { canAccessGiller } = useGillerAccess();
  const [snapshot, setSnapshot] = useState<Beta1HomeSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const role = canAccessGiller && currentRole === UserRole.GILLER ? 'giller' : 'requester';
  const showRoleSwitch =
    canAccessGiller && (user?.role === UserRole.BOTH || user?.role === UserRole.GLER);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      if (!user?.uid) {
        return;
      }

      const nextSnapshot = await getBeta1HomeSnapshot(user.uid, role);
      if (mounted) {
        setSnapshot(nextSnapshot);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [role, user]);

  const refresh = async () => {
    if (!user?.uid) {
      return;
    }

    setRefreshing(true);
    const nextSnapshot = await getBeta1HomeSnapshot(user.uid, role);
    setSnapshot(nextSnapshot);
    setRefreshing(false);
  };

  if (!user) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>사용자 정보를 불러오지 못했습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>가는길에</Text>
            <Text style={styles.heroTitle}>{snapshot?.headline ?? '결정만 하면 되는 배송'}</Text>
            <Text style={styles.heroSubtitle}>
              {snapshot?.subheadline ?? '지금 필요한 흐름만 바로 확인하세요.'}
            </Text>
          </View>

          {showRoleSwitch ? (
            <TouchableOpacity
              style={styles.roleChip}
              onPress={() => switchRole(role === 'requester' ? UserRole.GILLER : UserRole.GLER)}
            >
              <MaterialIcons name="swap-horiz" size={18} color={Colors.textPrimary} />
              <Text style={styles.roleChipText}>{role === 'requester' ? '길러 모드' : '요청자 모드'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.metricRow}>
          <MetricCard label="진행 요청" value={`${snapshot?.activeRequestCount ?? 0}`} />
          <MetricCard label="진행 미션" value={`${snapshot?.activeMissionCount ?? 0}`} />
          <MetricCard label="정산 예정" value={`${(snapshot?.pendingRewardTotal ?? 0).toLocaleString()}원`} />
        </View>

        <View style={styles.strategyPanel}>
          <Text style={styles.strategyKicker}>{role === 'requester' ? '지금 필요한 선택' : '지금 확인할 미션'}</Text>
          <Text style={styles.strategyTitle}>
            {role === 'requester'
              ? '급하면 바로, 아니면 예약으로.'
              : '받을 미션만 빠르게 확인하세요.'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 실행</Text>
        <View style={styles.actionGrid}>
          <ActionCard
            icon="add-box"
            title="배송 요청 만들기"
            subtitle="바로 요청"
            onPress={() => navigation.navigate('CreateRequest')}
          />
          <ActionCard
            icon="chat"
            title="채팅 보기"
            subtitle="대화 확인"
            onPress={() => navigation.navigate('ChatList')}
          />
          <ActionCard
            icon="account-balance-wallet"
            title="지갑 보기"
            subtitle="잔액 확인"
            onPress={() => navigation.navigate('PointHistory')}
          />
          {role === 'giller' ? (
            <ActionCard
              icon="alt-route"
              title="미션 보드 열기"
              subtitle="미션 확인"
              onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
            />
          ) : (
            <ActionCard
              icon="schedule-send"
              title="예약 요청 만들기"
              subtitle="예약 접수"
              onPress={() => navigation.navigate('CreateRequest', { mode: 'reservation' })}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>추천</Text>
        <View style={styles.panel}>
          {(snapshot?.recommendations ?? []).map((item) => (
            <View key={item} style={styles.recommendationRow}>
              <MaterialIcons name="auto-awesome" size={18} color={Colors.primary} />
              <Text style={styles.recommendationText}>{item}</Text>
            </View>
          ))}
          {!canAccessGiller ? (
            <View style={styles.recommendationRow}>
              <MaterialIcons name="two-wheeler" size={18} color={Colors.primary} />
              <Text style={styles.recommendationText}>
                길러를 해보려면 프로필에서 본인인증 후 신청을 진행해보세요.
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>요청</Text>
        {(snapshot?.requestCards ?? []).length ? (
          snapshot?.requestCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.boardCard}
              onPress={() => navigation.navigate('RequestDetail', { requestId: card.id })}
            >
              <View style={styles.boardHeader}>
                <Text style={styles.boardTitle}>{card.title}</Text>
                <View style={styles.boardHeaderRight}>
                  <ModeBadge label={card.modeLabel} />
                  <StatusPill label={card.status} tone="request" />
                </View>
              </View>
              <Text style={styles.boardBody}>{card.detail}</Text>
              <Text style={styles.boardMeta}>{card.etaLabel}</Text>

              <View style={styles.strategyCard}>
                <Text style={styles.strategyCardTitle}>{card.strategyTitle}</Text>
                <Text style={styles.strategyCardBody}>{card.strategyBody}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <EmptyCard title="진행 중인 요청이 없습니다" subtitle="필요한 배송이 생기면 새 요청부터 시작하세요." />
        )}
      </View>

      {canAccessGiller ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>미션</Text>
          {(snapshot?.missionCards ?? []).length ? (
            snapshot?.missionCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={styles.boardCard}
                onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
              >
                <View style={styles.boardHeader}>
                  <Text style={styles.boardTitle}>{card.title}</Text>
                  <StatusPill label={card.status} tone="mission" />
                </View>
                <Text style={styles.boardMeta}>{card.windowLabel}</Text>
                <Text style={styles.rewardText}>{card.rewardLabel}</Text>

                <View style={styles.strategyCard}>
                  <Text style={styles.strategyCardTitle}>{card.strategyTitle}</Text>
                  <Text style={styles.strategyCardBody}>{card.strategyBody}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyCard
              title="지금 받을 수 있는 미션이 없습니다"
              subtitle="조건에 맞는 미션이 생기면 여기에서 바로 확인할 수 있습니다."
            />
          )}
        </View>
      ) : null}

      <View style={styles.walletCard}>
        <Text style={styles.sectionTitle}>지갑</Text>
        <WalletRow label="충전금" value={snapshot?.wallet.chargeBalance ?? 0} />
        <WalletRow label="정산금" value={snapshot?.wallet.earnedBalance ?? 0} />
        <WalletRow label="프로모션" value={snapshot?.wallet.promoBalance ?? 0} />
        <WalletRow label="출금 대기" value={snapshot?.wallet.pendingWithdrawalBalance ?? 0} />
        <View style={styles.walletDivider} />
        <WalletRow label="출금 가능" value={snapshot?.wallet.withdrawableBalance ?? 0} strong />
      </View>
    </ScrollView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.actionIconWrap}>
        <MaterialIcons name={icon} size={22} color={Colors.primaryDark} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function ModeBadge({ label }: { label: string }) {
  return (
    <View style={styles.modeBadge}>
      <Text style={styles.modeBadgeText}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'request' | 'mission' }) {
  return (
    <View style={[styles.statusPill, tone === 'request' ? styles.requestPill : styles.missionPill]}>
      <Text
        style={[
          styles.statusPillText,
          tone === 'request' ? styles.requestPillText : styles.missionPillText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyCardTitle}>{title}</Text>
      <Text style={styles.emptyCardSubtitle}>{subtitle}</Text>
    </View>
  );
}

function WalletRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={styles.walletRow}>
      <Text style={[styles.walletLabel, strong && styles.walletLabelStrong]}>{label}</Text>
      <Text style={[styles.walletValue, strong && styles.walletValueStrong]}>{value.toLocaleString()}원</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    gap: Spacing.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing['5xl'],
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  hero: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  heroTop: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  heroCopy: {
    flex: 1,
  },
  heroKicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    color: Colors.gray700,
    fontSize: Typography.fontSize.base,
    lineHeight: 22,
    maxWidth: 280,
  },
  roleChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleChipText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    flex: 1,
    padding: Spacing.md,
  },
  metricLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginBottom: 6,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
  },
  strategyPanel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 6,
  },
  strategyKicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  strategyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    lineHeight: 24,
  },
  strategyBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  actionGrid: {
    gap: Spacing.md,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  actionIconWrap: {
    alignItems: 'center',
    backgroundColor: Colors.secondaryLight,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    marginBottom: Spacing.md,
    width: 42,
  },
  actionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  recommendationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  recommendationText: {
    color: Colors.gray700,
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  boardCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: 8,
    padding: Spacing.lg,
  },
  boardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  boardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardTitle: {
    color: Colors.textPrimary,
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  modeBadge: {
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeBadgeText: {
    color: Colors.infoDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
  },
  statusPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestPill: {
    backgroundColor: Colors.successLight,
  },
  missionPill: {
    backgroundColor: Colors.infoLight,
  },
  statusPillText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
  },
  requestPillText: {
    color: Colors.successDark,
  },
  missionPillText: {
    color: Colors.info,
  },
  boardBody: {
    color: Colors.gray700,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  boardMeta: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  rewardText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  strategyCard: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  strategyCardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  strategyCardBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: 6,
  },
  emptyCardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  emptyCardSubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  walletCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  walletLabelStrong: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  walletValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  walletValueStrong: {
    color: Colors.primary,
  },
  walletDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
});
