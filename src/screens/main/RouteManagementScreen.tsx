import React, { useCallback, useState } from 'react';
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

import { requireUserId } from '../../services/firebase';
import { deleteRoute, getUserRoutes } from '../../services/route-service';
import { DAY_LABELS } from '../../components/common/DaySelector';
import type { Route } from '../../types/route';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../theme';
import AppTopBar from '../../components/common/AppTopBar';

const MAX_ROUTES = 5;

export default function RouteManagementScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const userId = requireUserId();
      const userRoutes = await getUserRoutes(userId);
      const activeRoutes = userRoutes
        .filter((item) => item.isActive)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setRoutes(activeRoutes);
    } catch (error) {
      console.error('Failed to load routes', error);
      Alert.alert('동선을 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRoutes();
    }, [loadRoutes]),
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
        await loadRoutes();
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
      <AppTopBar title="길러 동선 관리" onBack={() => navigation.goBack()} />

      {routes.length === 0 ? (
        <View style={styles.contentInner}>
          <View style={styles.emptyCard}>
            <MaterialIcons name="alt-route" size={32} color={Colors.primary} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>등록한 동선이 없습니다</Text>
            <Text style={styles.emptySubtitle}>
              자주 이동하는 구간을 등록하면 미션 추천과 번들 제안이 더 빨라집니다.
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.dispatch(StackActions.push('AddRoute'))}
              activeOpacity={0.9}
            >
              <Text style={styles.addButtonText}>첫 동선 등록하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroKicker}>가는길에</Text>
            <Text style={styles.heroTitle}>자주 가는 동선</Text>
            <Text style={styles.heroSubtitle}>
              {routes.length} / {MAX_ROUTES}개의 동선을 사용 중입니다.
            </Text>
          </View>

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
                      <Text style={styles.editActionButtonText}>수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteActionButton]}
                      onPress={() => handleDelete(item.routeId, routeName)}
                    >
                      <Text style={styles.deleteActionButtonText}>삭제</Text>
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
        </ScrollView>
      )}

      {routes.length < MAX_ROUTES && routes.length > 0 ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.dispatch(StackActions.push('AddRoute'))}
          activeOpacity={0.9}
        >
          <Text style={styles.fabLabel}>+</Text>
        </TouchableOpacity>
      ) : null}
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
});
