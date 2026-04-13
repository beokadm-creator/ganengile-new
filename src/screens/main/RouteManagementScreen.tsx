import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { StackActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

import { useUser } from '../../contexts/UserContext';
import { useGillerAccess } from '../../hooks/useGillerAccess';
import { requireUserId } from '../../services/firebase';
import {
  saveCurrentLocationAsGillerTerritory,
  setActiveGillerTerritory,
} from '../../services/giller-territory-service';
import { deleteRoute, getUserRoutes } from '../../services/route-service';
import { DAY_LABELS } from '../../components/common/DaySelector';
import type { Route } from '../../types/route';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../theme';
import AppTopBar from '../../components/common/AppTopBar';

const MAX_ROUTES = 5;
const MAX_TERRITORIES = 2;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export default function RouteManagementScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const { user } = useUser();
  const { canAccessGiller } = useGillerAccess();
  const isPreviewMode = !canAccessGiller;
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [territoryLoading, setTerritoryLoading] = useState(false);
  const [localTerritories, setLocalTerritories] = useState(user?.gillerProfile?.territories ?? []);
  const [localActiveTerritoryId, setLocalActiveTerritoryId] = useState(
    user?.gillerProfile?.activeTerritoryId ?? ''
  );

  const lastFetchedRef = useRef<number>(0);

  const loadRoutes = useCallback(async (force: boolean = false) => {
    try {
      const now = Date.now();
      if (!force && now - lastFetchedRef.current < STALE_TIME) {
        return;
      }

      if (!lastFetchedRef.current || force) {
        setLoading(true);
      }
      
      const userId = requireUserId();
      const userRoutes = await getUserRoutes(userId);
      const activeRoutes = userRoutes
        .filter((item) => item.isActive)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setRoutes(activeRoutes);
      lastFetchedRef.current = Date.now();
    } catch (error) {
      console.error('Failed to load routes', error);
      Alert.alert('동선을 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  const territories = localTerritories;
  const activeTerritoryId = localActiveTerritoryId;

  const handleRegisterTerritory = () => {
    if (isPreviewMode) {
      Alert.alert(
        '미리보기 모드',
        '권역을 추가하려면 길러 신청을 완료해주세요.',
        [
          { text: '닫기', style: 'cancel' },
          { text: '신청하기', onPress: () => navigation.navigate('Profile') }
        ]
      );
      return;
    }

    if (!user?.uid) {
      return;
    }

    void (async () => {
      try {
        setTerritoryLoading(true);
        const nextTerritories = await saveCurrentLocationAsGillerTerritory(user.uid, user.gillerProfile);
        setLocalTerritories(nextTerritories);
        setLocalActiveTerritoryId(nextTerritories[0]?.territoryId ?? '');
      } catch (error) {
        console.error('Failed to register territory', error);
        Alert.alert('권역 등록 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
      } finally {
        setTerritoryLoading(false);
      }
    })();
  };

  const handleActivateTerritory = (territoryId: string) => {
    if (!user?.uid) {
      return;
    }

    void (async () => {
      try {
        setTerritoryLoading(true);
        await setActiveGillerTerritory(user.uid, territoryId, user.gillerProfile);
        setLocalActiveTerritoryId(territoryId);
      } catch (error) {
        console.error('Failed to activate territory', error);
        Alert.alert('권역 전환 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
      } finally {
        setTerritoryLoading(false);
      }
    })();
  };

  useFocusEffect(
    useCallback(() => {
      void loadRoutes();
      setLocalTerritories(user?.gillerProfile?.territories ?? []);
      setLocalActiveTerritoryId(user?.gillerProfile?.activeTerritoryId ?? '');
    }, [loadRoutes, user?.gillerProfile?.activeTerritoryId, user?.gillerProfile?.territories]),
  );

  const handleDelete = (routeId: string, routeName: string) => {
    const executeDelete = async () => {
      try {
        const userId = requireUserId();
        const deleted = await deleteRoute(routeId, userId);

        if (!deleted) {
          Alert.alert('동선을 삭제하지 못했습니다', '이미 삭제되었거나 권한이 없습니다.');
          return;
        }

        Alert.alert('동선을 삭제했습니다');
        await loadRoutes(true);
      } catch (error) {
        console.error('Failed to delete route', error);
        Alert.alert('동선 삭제 실패', '잠시 후 다시 시도해 주세요.');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`${routeName} 동선을 삭제할까요?`);
      if (confirmed) {
        void executeDelete();
      }
      return;
    }

    Alert.alert('동선 삭제', `${routeName} 동선을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void executeDelete() },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>등록한 동선을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppTopBar title="권역과 동선" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>가는길에</Text>
          <Text style={styles.heroTitle}>미션을 받는 기준</Text>
          <Text style={styles.heroSubtitle}>
            자주 가는 길을 등록하면 권역 안의 미션과 더 잘 이어집니다.
          </Text>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>등록 동선</Text>
            <Text style={styles.metricValue}>{routes.length}개</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>남은 자리</Text>
            <Text style={styles.metricValue}>{MAX_ROUTES - routes.length}개</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.boardShortcut}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
        >
          <View style={styles.boardShortcutCopy}>
            <Text style={styles.boardShortcutTitle}>미션 보드 보기</Text>
            <Text style={styles.boardShortcutBody}>지금 기준으로 어떤 미션이 보이는지 바로 확인합니다.</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={18} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionTitle}>권역</Text>
              <Text style={styles.sectionSubtitle}>현재 위치 인증으로만 추가되고 최대 2개까지 관리합니다.</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.inlinePrimaryButton, 
                (territoryLoading || isPreviewMode) && styles.inlineButtonDisabled,
                isPreviewMode && styles.previewButton
              ]}
              activeOpacity={0.9}
              disabled={territoryLoading || territories.length >= MAX_TERRITORIES}
              onPress={handleRegisterTerritory}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {isPreviewMode && <MaterialIcons name="lock" size={14} color={Colors.primary} />}
                <Text style={styles.inlinePrimaryButtonText}>
                  {territoryLoading ? '확인 중...' : '현재 위치로 추가'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.ruleList}>
            <RulePill icon="my-location" label="현재 위치 인증 기반" />
            <RulePill icon="train" label="역 중심 권역" />
            <RulePill icon="filter-2" label="최대 2개" />
          </View>

          {territories.length ? (
            <View style={styles.territoryList}>
              <TouchableOpacity
                style={[styles.territoryCard, activeTerritoryId === '' && styles.territoryCardActive]}
                activeOpacity={0.88}
                disabled={territoryLoading}
                onPress={() => handleActivateTerritory('')}
              >
                <View style={styles.territoryTop}>
                  <Text style={styles.territoryName}>전체 보기</Text>
                  {activeTerritoryId === '' ? <Text style={styles.territoryBadge}>활성</Text> : null}
                </View>
                <Text style={styles.territoryMeta}>권역 밖 미션까지 함께 봅니다.</Text>
              </TouchableOpacity>

              {territories.map((territory) => {
                const active = activeTerritoryId === territory.territoryId;
                return (
                  <TouchableOpacity
                    key={territory.territoryId}
                    style={[styles.territoryCard, active && styles.territoryCardActive]}
                    activeOpacity={0.88}
                    disabled={territoryLoading}
                    onPress={() => handleActivateTerritory(territory.territoryId)}
                  >
                    <View style={styles.territoryTop}>
                      <Text style={styles.territoryName}>{territory.label}</Text>
                      {active ? <Text style={styles.territoryBadge}>활성</Text> : null}
                    </View>
                    <Text style={styles.territoryMeta}>
                      {territory.stationName ?? '기준 역'} · 반경 {territory.radiusKm}km
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyInlineText}>먼저 현재 위치로 권역을 추가하면 미션 리스트가 더 정확해집니다.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionTitle}>동선</Text>
              <Text style={styles.sectionSubtitle}>등록한 길이 권역 안의 미션 추천과 우선 노출에 반영됩니다.</Text>
            </View>
          </View>

          {routes.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons name="alt-route" size={32} color={Colors.primary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>등록한 동선이 없습니다</Text>
              <Text style={styles.emptySubtitle}>
                자주 가는 길을 등록해 두면 맞는 미션이 더 빨리 올라옵니다.
              </Text>
              <TouchableOpacity
                style={[styles.addButton, isPreviewMode && styles.previewButtonAlt]}
                onPress={() => {
                  if (isPreviewMode) {
                    Alert.alert(
                      '미리보기 모드',
                      '동선을 추가하려면 길러 신청을 완료해주세요.',
                      [
                        { text: '닫기', style: 'cancel' },
                        { text: '신청하기', onPress: () => navigation.navigate('Profile') }
                      ]
                    );
                    return;
                  }
                  navigation.dispatch(StackActions.push('AddRoute'));
                }}
                activeOpacity={0.9}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {isPreviewMode && <MaterialIcons name="lock" size={18} color={Colors.white} />}
                  <Text style={styles.addButtonText}>첫 동선 추가</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {routes.map((item) => {
                const routeName = `${item.startStation.stationName} → ${item.endStation.stationName}`;
                return (
                  <View key={item.routeId} style={styles.routeCard}>
                    <View style={styles.routeHeader}>
                      <Text style={styles.routeName}>{routeName}</Text>
                      <Text style={styles.routeTime}>{item.departureTime} 출발</Text>
                    </View>

                    <Text style={styles.routeDays}>
                      {item.daysOfWeek.map((day) => DAY_LABELS[day]).join(', ')}
                    </Text>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.editActionButton]}
                        onPress={() =>
                          navigation.dispatch(StackActions.push('EditRoute', { routeId: item.routeId }))
                        }
                      >
                        <Text style={styles.editActionButtonText}>동선 수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteActionButton]}
                        onPress={() => handleDelete(item.routeId, routeName)}
                      >
                        <Text style={styles.deleteActionButtonText}>동선 삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {routes.length >= MAX_ROUTES ? (
                <View style={styles.limitBanner}>
                  <Text style={styles.limitText}>동선은 최대 5개까지 등록할 수 있습니다.</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      {routes.length < MAX_ROUTES && routes.length > 0 ? (
        <TouchableOpacity
          style={[styles.fab, isPreviewMode && styles.previewButtonAlt]}
          onPress={() => {
            if (isPreviewMode) {
              Alert.alert(
                '미리보기 모드',
                '동선을 추가하려면 길러 신청을 완료해주세요.',
                [
                  { text: '닫기', style: 'cancel' },
                  { text: '신청하기', onPress: () => navigation.navigate('Profile') }
                ]
              );
              return;
            }
            navigation.dispatch(StackActions.push('AddRoute'));
          }}
          activeOpacity={0.9}
        >
          {isPreviewMode ? (
            <MaterialIcons name="lock" size={24} color={Colors.white} />
          ) : (
            <Text style={styles.fabLabel}>+</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function RulePill({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.rulePill}>
      <MaterialIcons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.rulePillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  loadingText: { color: Colors.textSecondary, marginTop: Spacing.md, ...Typography.body },
  contentInner: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.md },
  heroCard: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
  },
  heroKicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 6,
  },
  heroSubtitle: { color: Colors.textSecondary, ...Typography.body },
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
    fontSize: Typography.fontSize.sm,
    marginBottom: 6,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  boardShortcut: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  boardShortcutCopy: {
    flex: 1,
    gap: 4,
  },
  boardShortcutTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  boardShortcutBody: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  sectionHeader: {
    gap: Spacing.sm,
  },
  sectionHeaderCopy: {
    gap: 4,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  inlinePrimaryButton: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryMint,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlinePrimaryButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  inlineButtonDisabled: {
    opacity: 0.6,
  },
  ruleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  rulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray50,
  },
  rulePillText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  territoryList: {
    gap: Spacing.sm,
  },
  territoryCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
  },
  territoryCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMint,
  },
  territoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  territoryName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    flex: 1,
  },
  territoryMeta: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  territoryBadge: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
  },
  emptyInlineText: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  emptyIcon: { marginBottom: Spacing.md },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: { color: Colors.textSecondary, ...Typography.body, textAlign: 'center' },
  addButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  addButtonText: { color: Colors.white, fontSize: Typography.fontSize.base, fontWeight: '800' },
  listContainer: { gap: Spacing.md },
  routeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    flex: 1,
  },
  routeTime: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  routeDays: { color: Colors.textSecondary, ...Typography.bodySmall },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  editActionButton: { backgroundColor: Colors.surface, borderColor: Colors.border },
  editActionButtonText: { color: Colors.textPrimary, fontWeight: '700' },
  deleteActionButton: { backgroundColor: Colors.surface, borderColor: Colors.error },
  deleteActionButtonText: { color: Colors.error, fontWeight: '700' },
  limitBanner: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  limitText: {
    color: Colors.warningDark,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: Typography.fontSize.sm,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  fabLabel: { color: Colors.white, fontSize: 32, fontWeight: '300', marginTop: -4 },
  previewButton: {
    backgroundColor: Colors.gray100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewButtonAlt: {
    backgroundColor: Colors.textTertiary,
  },
});
