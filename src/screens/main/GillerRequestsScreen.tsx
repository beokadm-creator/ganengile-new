import React, { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useUser } from '../../contexts/UserContext';
import { getBeta1HomeSnapshot, type Beta1HomeSnapshot } from '../../services/beta1-orchestration-service';
import { BorderRadius, Shadows, Spacing, Typography } from '../../theme';

type MissionCard = Beta1HomeSnapshot['missionCards'][number];

export default function GillerRequestsScreen() {
  const { user } = useUser();
  const [missionCards, setMissionCards] = useState<MissionCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user?.uid) {
        return;
      }

      const snapshot = await getBeta1HomeSnapshot(user.uid, 'giller');
      if (mounted) {
        setMissionCards(snapshot.missionCards);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user]);

  const refresh = async () => {
    if (!user?.uid) {
      return;
    }

    setRefreshing(true);
    const snapshot = await getBeta1HomeSnapshot(user.uid, 'giller');
    setMissionCards(snapshot.missionCards);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>mission home</Text>
        <Text style={styles.title}>길러는 전체 배송이 아니라 지금 내가 잡아야 할 미션 전략부터 봅니다</Text>
        <Text style={styles.subtitle}>
          beta1은 현재 위치, 경로, 번들 가능성, actor 우선순위를 함께 보고 미션을 제안합니다. 즉시형은 빠른 수락과 이동 리듬을, 예약형은 시간 약속과 거점 안정성을 더 중요하게 봅니다.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>수락 전에 볼 기준</Text>
        <View style={styles.ruleCard}>
          <RuleRow text="즉시형은 빠르게 움직일 수 있는지, 지금 내 이동 리듬을 깨지 않는지가 먼저입니다." />
          <RuleRow text="예약형은 약속 시간을 지킬 수 있는지, 거점과 handover를 안정적으로 맞출 수 있는지가 먼저입니다." />
          <RuleRow text="연속 미션 번들은 총보상보다 다음 이동 효율과 실패 리스크를 같이 보고 판단해야 합니다." />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>지금 제안된 미션</Text>
        {missionCards.length ? (
          missionCards.map((mission) => (
            <TouchableOpacity key={mission.id} style={styles.missionCard} activeOpacity={0.92}>
              <View style={styles.headerRow}>
                <Text style={styles.missionTitle}>{mission.title}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{mission.status}</Text>
                </View>
              </View>

              <Text style={styles.metaText}>{mission.windowLabel}</Text>
              <Text style={styles.rewardText}>{mission.rewardLabel}</Text>

              <View style={styles.strategyCard}>
                <Text style={styles.strategyTitle}>{mission.strategyTitle}</Text>
                <Text style={styles.strategyBody}>{mission.strategyBody}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>아직 제안된 미션이 없습니다</Text>
            <Text style={styles.emptySubtitle}>
              길러 경로와 위치 신호가 들어오면 beta1이 가장 현실적인 구간부터 미션 카드로 다시 제안합니다.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>번들 판단 가이드</Text>
        <View style={styles.ruleCard}>
          <RuleRow text="사물함/거점이 들어간 미션은 대면 실패를 줄이는 대신 인계 시점을 더 정확히 맞춰야 합니다." />
          <RuleRow text="즉시형 미션이 밀리면 외부 파트너 fallback 가능성도 같이 커집니다." />
          <RuleRow text="예약형 미션은 단순 고가 보상보다 시간 약속을 지키는 안정성이 더 높은 평가로 이어집니다." />
        </View>
      </View>
    </ScrollView>
  );
}

function RuleRow({ text }: { text: string }) {
  return (
    <View style={styles.ruleRow}>
      <MaterialIcons name="check-circle" size={18} color="#0F766E" />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  content: {
    gap: Spacing.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  hero: {
    backgroundColor: '#E0F2FE',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
  },
  kicker: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#0F172A',
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    marginBottom: 8,
    lineHeight: 32,
  },
  subtitle: {
    color: '#475569',
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  missionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    gap: 8,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  missionTitle: {
    color: '#0F172A',
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  metaText: {
    color: '#64748B',
    fontSize: Typography.fontSize.sm,
  },
  rewardText: {
    color: '#0F766E',
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800',
  },
  strategyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  strategyTitle: {
    color: '#0F172A',
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  strategyBody: {
    color: '#475569',
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  ruleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    gap: 12,
    padding: Spacing.lg,
  },
  ruleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  ruleText: {
    color: '#475569',
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
});
