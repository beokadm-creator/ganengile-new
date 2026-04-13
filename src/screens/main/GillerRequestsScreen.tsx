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
import { useNavigation } from '@react-navigation/native';

import { MissionGroupCard } from '../../components/giller/MissionGroupCard';
import { MissionBoardHeader } from '../../components/giller/MissionBoardHeader';
import { MissionBoardSection } from '../../components/giller/MissionBoardSection';
import { MissionDetailSheet } from '../../components/giller/MissionDetailSheet';
import type { MissionCard, MissionGroup } from '../../components/giller/mission-board-types';
import {
  buildComparisonHint,
  buildFeaturedReason,
  buildOptionLabel,
  buildQuickFacts,
  getNextActionLabel,
  getPrimaryOption,
  groupMissionCards,
  isFullSpanOption,
  isImmediateMission,
  locationDistance,
} from '../../components/giller/mission-board-utils';
import * as Haptics from 'expo-haptics';
import { useUser } from '../../contexts/UserContext';
import { useGillerAccess } from '../../hooks/useGillerAccess';
import {
  acceptMissionBundleForGiller,
  getBeta1HomeSnapshot,
  releaseMissionBundleForGiller,
  type Beta1HomeSnapshot,
} from '../../services/beta1-orchestration-service';
import { locationService, type LocationData } from '../../services/location-service';
import {
  buildProfessionalMissionBridgeReason,
  resolveGillerMissionExecutionMode,
} from '../../services/giller-mission-execution-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';
import { GillerType } from '../../types/user';

export default function GillerRequestsScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const { user } = useUser();
  const { canAccessGiller } = useGillerAccess();
  const isPreviewMode = !canAccessGiller;
  const [snapshot, setSnapshot] = useState<Beta1HomeSnapshot | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingBundleId, setSubmittingBundleId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<MissionGroup | null>(null);

  const loadSnapshot = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
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
      } catch (error) {
        console.error('Failed to load giller snapshot', error);
        Alert.alert('요청을 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.uid]
  );

  useEffect(() => {
    void loadSnapshot('initial');
  }, [loadSnapshot]);

  useEffect(() => {
    if (isPreviewMode) {
      locationService.getCurrentLocation()
        .then((loc) => {
          if (loc) {
            setCurrentLocation(loc);
          }
        })
        .catch((error) => {
          console.error('Failed to get location for preview mode', error);
        });
    }
  }, [isPreviewMode]);

  const activeTerritory = useMemo(() => {
    const territories = user?.gillerProfile?.territories ?? [];
    const activeTerritoryId = user?.gillerProfile?.activeTerritoryId;
    if (!territories.length) {
      return null;
    }

    if (activeTerritoryId === '') {
      return null;
    }

    return (
      territories.find((territory) => territory.territoryId === activeTerritoryId) ??
      territories[0]
    );
  }, [user?.gillerProfile?.activeTerritoryId, user?.gillerProfile?.territories]);

  const filterByTerritory = useCallback(
    (groups: MissionGroup[]) => {
      let centerLat: number;
      let centerLng: number;
      let radiusMeters: number;

      if (activeTerritory) {
        centerLat = activeTerritory.latitude;
        centerLng = activeTerritory.longitude;
        radiusMeters = activeTerritory.radiusKm * 1000;
      } else if (isPreviewMode && currentLocation) {
        centerLat = currentLocation.latitude;
        centerLng = currentLocation.longitude;
        radiusMeters = 6000; // 미리보기 모드 시 내 주변 6km 기본 적용
      } else {
        return groups;
      }

      return groups.filter((group) => {
        const points = [group.originPoint, group.destinationPoint].filter(
          (point): point is NonNullable<MissionGroup['originPoint']> => point != null
        );

        if (!points.length) {
          return true;
        }

        return points.some((point) => {
          const distance = Math.min(
            locationDistance(centerLat, centerLng, point.latitude, point.longitude),
            Number.POSITIVE_INFINITY
          );
          return distance <= radiusMeters;
        });
      });
    },
    [activeTerritory, isPreviewMode, currentLocation]
  );

  const immediateMissionGroups = useMemo(
    () =>
      filterByTerritory(
        groupMissionCards(
        (snapshot?.missionCards ?? []).filter(
          (card) => card.selectionState === 'available' && isImmediateMission(card)
        )
        )
      ),
    [filterByTerritory, snapshot]
  );
  const ongoingMissionGroups = useMemo(
    () => filterByTerritory(groupMissionCards((snapshot?.missionCards ?? []).filter((card) => card.selectionState === 'accepted'))),
    [filterByTerritory, snapshot]
  );
  const suggestedMissionGroups = useMemo(
    () =>
      filterByTerritory(
        groupMissionCards(
        (snapshot?.missionCards ?? []).filter(
          (card) => card.selectionState !== 'accepted' && !isImmediateMission(card)
        )
        )
      ),
    [filterByTerritory, snapshot]
  );
  const featuredMissionGroup = immediateMissionGroups[0] ?? null;

  const handleAccept = useCallback(
    (card: MissionCard) => {
      if (isPreviewMode) {
        Alert.alert(
          '미리보기 모드', 
          '실제 배송을 수행하려면 길러 신청을 완료해주세요.',
          [
            { text: '닫기', style: 'cancel' },
            { text: '신청하기', onPress: () => navigation.navigate('Profile') }
          ]
        );
        return;
      }

      if (!user?.uid || !card.bundleId || card.selectionState === 'accepted') {
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      Alert.alert(
        '이 구간을 맡을까요?',
        `${buildOptionLabel(card)} · ${card.rewardLabel}\n${card.legSummary ?? card.strategyBody}\n\n선택하지 않은 나머지 구간은 다른 길러나 배송 파트너에게 이어질 수 있습니다.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '수행하기',
            onPress: () => {
              const bundleId = card.bundleId;
              if (!bundleId) {
                return;
              }

              void (async () => {
                try {
                  setSubmittingBundleId(bundleId);
                  await acceptMissionBundleForGiller(bundleId, user.uid);
                  await loadSnapshot('refresh');
                } catch (error) {
                  const message = error instanceof Error ? error.message : '구간 수락에 실패했습니다.';
                  Alert.alert('수락 실패', message);
                } finally {
                  setSubmittingBundleId(null);
                }
              })();
            },
          },
        ]
      );
    },
    [loadSnapshot, user?.uid, isPreviewMode, navigation]
  );

  const handleRelease = useCallback(
    (card: MissionCard) => {
      if (!user?.uid || !card.bundleId || card.selectionState !== 'accepted') {
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Alert.alert(
        '수락을 취소할까요?',
        '아직 진행 전이라면 다시 미션 보드로 돌릴 수 있습니다.',
        [
          { text: '닫기', style: 'cancel' },
          {
            text: '수락 취소',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  setSubmittingBundleId(card.bundleId ?? null);
                  await releaseMissionBundleForGiller(card.bundleId!, user.uid);
                  await loadSnapshot('refresh');
                } catch (error) {
                  const message = error instanceof Error ? error.message : '수락 취소에 실패했습니다.';
                  Alert.alert('수락 취소 실패', message);
                } finally {
                  setSubmittingBundleId(null);
                }
              })();
            },
          },
        ]
      );
    },
    [loadSnapshot, user?.uid]
  );

  const handleNextAction = useCallback(
    (group: MissionGroup) => {
      const primaryCard = getPrimaryOption(group);
      if (!primaryCard) {
        return;
      }

      const executionMode = resolveGillerMissionExecutionMode(user?.gillerProfile?.type, group);
      if (executionMode === 'external_bridge') {
        navigation.navigate('ProfessionalMissionBridge', {
          missionTitle: group.routeLabel,
          missionWindow: group.windowLabel,
          reason: buildProfessionalMissionBridgeReason(group),
          requestId: primaryCard.requestId,
          deliveryId: primaryCard.deliveryId,
        });
        return;
      }

      const requestId = primaryCard.requestId;
      const deliveryId = primaryCard.deliveryId;
      const status = group.status.toLowerCase();

      if ((status.includes('accepted') || status.includes('queued')) && requestId && deliveryId) {
        navigation.navigate('PickupVerification', { deliveryId, requestId });
        return;
      }

      if ((status.includes('arrival_pending') || status.includes('handover_pending') || status.includes('in_progress')) && deliveryId) {
        navigation.navigate('DeliveryCompletion', { deliveryId });
        return;
      }

      if (requestId) {
        navigation.navigate('DeliveryTracking', { requestId });
      }
    },
    [navigation, user?.gillerProfile?.type]
  );

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSnapshot('refresh')} />}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>GOING BOARD</Text>
        <Text style={styles.title}>미션 보드</Text>
        <Text style={styles.subtitle}>권역으로 보고, 동선이 맞는 미션을 먼저 잡는 화면입니다.</Text>
      </View>

      <MissionBoardHeader
        scopeTitle={
          activeTerritory 
            ? `${activeTerritory.label} 기준` 
            : isPreviewMode && currentLocation
              ? '내 주변 기준 (미리보기)'
              : '전체 권역 기준'
        }
        scopeSubtitle={
          user?.gillerProfile?.type === GillerType.PROFESSIONAL || user?.gillerProfile?.type === GillerType.MASTER
            ? '권역 노출 후 동선 우선권을 보고, 일부 미션은 외부 연동으로 이어집니다.'
            : isPreviewMode && currentLocation
              ? '내 주변 6km 이내의 미션을 미리 확인해보세요.'
              : '권역 노출 후 동선이 맞는 길러에게 먼저 기회가 갑니다.'
        }
        onPressScopeSettings={() => navigation.navigate('Tabs', { screen: 'RouteManagement' })}
        featuredMission={
          featuredMissionGroup && getPrimaryOption(featuredMissionGroup)
            ? {
                routeLabel: featuredMissionGroup.routeLabel,
                featuredReason: buildFeaturedReason(featuredMissionGroup),
                quickFacts: buildQuickFacts(featuredMissionGroup),
                rewardLabel: getPrimaryOption(featuredMissionGroup)?.rewardLabel,
                disabled: submittingBundleId === getPrimaryOption(featuredMissionGroup)?.bundleId,
                onPress: () => {
                  const primaryCard = getPrimaryOption(featuredMissionGroup);
                  if (primaryCard) {
                    handleAccept(primaryCard);
                  }
                },
              }
            : null
        }
      />

      <View style={styles.metricRow}>
        <MetricCard label="진행 중" value={ongoingMissionGroups.length} />
        <MetricCard label="즉시 선택" value={immediateMissionGroups.length} />
        <MetricCard label="추가 제안" value={suggestedMissionGroups.length} />
        <MetricCard label="예상 보상" value={`${(snapshot?.pendingRewardTotal ?? 0).toLocaleString()}원`} />
      </View>

      <MissionBoardSection
        title="내 진행 중"
        subtitle="이미 맡은 배송과 현재 수행 중인 구간입니다."
        items={ongoingMissionGroups}
        emptyTitle="현재 진행 중인 배송이 없습니다"
        emptySubtitle={activeTerritory ? '선택한 권역 안에서 수락한 배송이 가장 먼저 여기에서 보입니다.' : '수락한 구간과 연결된 배송은 가장 먼저 여기에서 보여드립니다.'}
        getKey={(group) => group.id}
        renderItem={(group) => (
          <MissionGroupCard
            group={group}
            submittingBundleId={submittingBundleId}
            isPreviewMode={isPreviewMode}
            onPress={handleAccept}
            onRelease={handleRelease}
            onNextAction={handleNextAction}
            onOpenDetails={setSelectedGroup}
            buildOptionLabel={buildOptionLabel}
            buildQuickFacts={buildQuickFacts}
            getNextActionLabel={getNextActionLabel}
            isFullSpanOption={isFullSpanOption}
            buildComparisonHint={buildComparisonHint}
          />
        )}
      />

      <MissionBoardSection
        title="지금 선택 가능"
        subtitle="지금 바로 맡을 수 있는 배송을 지도와 구간 옵션으로 확인하세요."
        items={immediateMissionGroups}
        emptyTitle="지금 바로 맡을 수 있는 배송이 없습니다"
        emptySubtitle={
          activeTerritory
            ? '선택한 권역에 들어오는 새 배송은 여기에서 전체 구간과 부분 구간으로 보입니다.'
            : isPreviewMode && currentLocation
              ? '현재 내 주변 6km 이내에 올라온 배송이 없습니다.'
              : '새 배송이 들어오면 여기에서 전체 구간과 부분 구간을 함께 보여드립니다.'
        }
        getKey={(group) => group.id}
        renderItem={(group) => (
          <MissionGroupCard
            group={group}
            submittingBundleId={submittingBundleId}
            isPreviewMode={isPreviewMode}
            onPress={handleAccept}
            onRelease={handleRelease}
            onNextAction={handleNextAction}
            onOpenDetails={setSelectedGroup}
            buildOptionLabel={buildOptionLabel}
            buildQuickFacts={buildQuickFacts}
            getNextActionLabel={getNextActionLabel}
            isFullSpanOption={isFullSpanOption}
            buildComparisonHint={buildComparisonHint}
          />
        )}
      />

      <MissionBoardSection
        title="검토해볼 제안"
        subtitle="시간 조율이나 fallback이 걸린 배송을 따로 모아 보여드립니다."
        items={suggestedMissionGroups}
        emptyTitle="검토할 제안이 없습니다"
        emptySubtitle="현재는 바로 수락 가능한 배송이 우선 열려 있습니다."
        getKey={(group) => group.id}
        renderItem={(group) => (
          <MissionGroupCard
            group={group}
            submittingBundleId={submittingBundleId}
            isPreviewMode={isPreviewMode}
            onPress={handleAccept}
            onRelease={handleRelease}
            onNextAction={handleNextAction}
            onOpenDetails={setSelectedGroup}
            buildOptionLabel={buildOptionLabel}
            buildQuickFacts={buildQuickFacts}
            getNextActionLabel={getNextActionLabel}
            isFullSpanOption={isFullSpanOption}
            buildComparisonHint={buildComparisonHint}
          />
        )}
      />

      <MissionDetailSheet
        group={selectedGroup}
        submittingBundleId={submittingBundleId}
        isPreviewMode={isPreviewMode}
        onClose={() => setSelectedGroup(null)}
        onAccept={handleAccept}
        onRelease={handleRelease}
        onNextAction={handleNextAction}
        buildOptionLabel={buildOptionLabel}
        getNextActionLabel={getNextActionLabel}
      />
    </ScrollView>
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
});
