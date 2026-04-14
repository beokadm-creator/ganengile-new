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
import { BorderRadius, Colors, Shadows, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';
import type { MainStackNavigationProp } from '../../types/navigation';
import { GillerType } from '../../types/user';

const PREVIEW_SEARCH_RADIUS_METERS = 6000;

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
        radiusMeters = PREVIEW_SEARCH_RADIUS_METERS; // 미리보기 모드 시 내 주변 6km 기본 적용
      } else {
        return groups;
      }

      return groups.filter((group) => {
        const points = group.options
          .flatMap((option) => [option.originPoint, option.destinationPoint])
          .filter((point): point is NonNullable<MissionGroup['originPoint']> => point != null);

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

  const allGroups = useMemo(() => {
    return filterByTerritory(groupMissionCards(snapshot?.missionCards ?? []));
  }, [filterByTerritory, snapshot?.missionCards]);

  const ongoingMissionGroups = useMemo(() => {
    return allGroups.filter((group) => group.selectionState === 'accepted');
  }, [allGroups]);

  const immediateMissionGroups = useMemo(() => {
    return allGroups.filter(
      (group) => group.selectionState === 'available' && isImmediateMission(group.options[0] ?? ({} as any))
    );
  }, [allGroups]);

  const suggestedMissionGroups = useMemo(() => {
    return allGroups.filter(
      (group) => group.selectionState === 'available' && !isImmediateMission(group.options[0] ?? ({} as any))
    );
  }, [allGroups]);
  const featuredMissionGroup = immediateMissionGroups[0] ?? null;

  const handleAccept = useCallback(
    (card: MissionCard) => {
      if (isPreviewMode) {
        Alert.alert(
          '길러 전용', 
          '수락은 길러 신청 후 이용할 수 있습니다.',
          [
            { text: '닫기', style: 'cancel' },
            { text: '신청하기', onPress: () => navigation.navigate('Tabs', { screen: 'Profile' }) }
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
      if (isPreviewMode) {
        Alert.alert(
          '길러 전용', 
          '수락 취소는 길러 신청 후 이용할 수 있습니다.',
          [
            { text: '닫기', style: 'cancel' },
            { text: '신청하기', onPress: () => navigation.navigate('Tabs', { screen: 'Profile' }) }
          ]
        );
        return;
      }

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
    [loadSnapshot, user?.uid, isPreviewMode, navigation]
  );

  const handleNextAction = useCallback(
    (group: MissionGroup) => {
      if (isPreviewMode) {
        Alert.alert(
          '길러 전용', 
          '다음 작업은 길러 신청 후 진행할 수 있습니다.',
          [
            { text: '닫기', style: 'cancel' },
            { text: '신청하기', onPress: () => navigation.navigate('Tabs', { screen: 'Profile' }) }
          ]
        );
        return;
      }

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
    [navigation, user?.gillerProfile?.type, isPreviewMode]
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
        <Text style={styles.kicker}>미션 보드</Text>
        <View style={styles.headerStats}>
          <Text style={styles.headerStatItem}>
            <Text style={styles.headerStatValue}>{ongoingMissionGroups.length}</Text>
            <Text style={styles.headerStatLabel}> 진행 중</Text>
          </Text>
          <Text style={styles.headerStatDot}>·</Text>
          <Text style={styles.headerStatItem}>
            <Text style={styles.headerStatValue}>{immediateMissionGroups.length}</Text>
            <Text style={styles.headerStatLabel}> 선택 가능</Text>
          </Text>
          <Text style={styles.headerStatDot}>·</Text>
          <Text style={styles.headerStatItem}>
            <Text style={styles.headerStatValue}>{(snapshot?.pendingRewardTotal ?? 0).toLocaleString()}원</Text>
            <Text style={styles.headerStatLabel}> 예상 보상</Text>
          </Text>
        </View>
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
            ? '권역과 동선이 일치하는 미션을 먼저 제안합니다.'
            : isPreviewMode && currentLocation
              ? '내 주변 미션을 미리 확인해보세요.'
              : '동선이 맞는 길러에게 우선 배정됩니다.'
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

      <MissionBoardSection
        title="내 진행 중"
        subtitle="이미 맡은 배송과 현재 수행 중인 구간입니다."
        items={ongoingMissionGroups}
        emptyTitle="현재 진행 중인 배송이 없습니다"
        emptySubtitle={activeTerritory ? '선택한 권역의 배송이 표시됩니다.' : '수락한 배송이 표시됩니다.'}
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
        subtitle="바로 맡을 수 있는 배송입니다."
        items={immediateMissionGroups}
        emptyTitle="선택 가능한 배송이 없습니다"
        emptySubtitle={
          activeTerritory
            ? '권역 내 새 배송이 이곳에 표시됩니다.'
            : isPreviewMode && currentLocation
              ? '내 주변에 등록된 배송이 없습니다.'
              : '새 배송이 이곳에 표시됩니다.'
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
        subtitle="조율이 필요한 배송을 제안합니다."
        items={suggestedMissionGroups}
        emptyTitle="현재 제안된 배송이 없습니다"
        emptySubtitle="바로 수락 가능한 배송이 우선 노출됩니다."
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
    gap: Spacing.sm,
  },
  kicker: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.extrabold,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerStatItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  headerStatValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
  },
  headerStatValuePrimary: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
  },
  headerStatLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  headerStatDot: {
    color: Colors.border,
    fontSize: Typography.fontSize.sm,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
});
