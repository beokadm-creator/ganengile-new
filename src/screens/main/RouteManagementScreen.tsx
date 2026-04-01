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
import { requireUserId } from '../../services/firebase';
import { deleteRoute, getUserRoutes } from '../../services/route-service';
import { DAY_LABELS } from '../../components/common/DaySelector';
import type { Route } from '../../types/route';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

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
      console.error('경로 목록 조회 실패:', error);
      Alert.alert('경로 목록을 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
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
          Alert.alert('경로를 삭제할 수 없습니다', '이미 삭제되었거나 권한이 없습니다.');
          return;
        }

        Alert.alert('경로를 삭제했습니다');
        await loadRoutes();
      } catch (error) {
        console.error('경로 삭제 실패:', error);
        Alert.alert('경로 삭제에 실패했습니다', '잠시 후 다시 시도해 주세요.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${routeName} 경로를 삭제할까요?`);
      if (confirmed) {
        void executeDelete();
      }
      return;
    }

    Alert.alert('경로 삭제', `${routeName} 경로를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void executeDelete() },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>등록한 경로를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>경로 관리</Text>
        <Text style={styles.subtitle}>
          {routes.length} / {MAX_ROUTES}개의 경로를 사용 중입니다.
        </Text>
      </View>

      {routes.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>경로 없음</Text>
          <Text style={styles.emptyTitle}>등록된 경로가 아직 없습니다</Text>
          <Text style={styles.emptySubtitle}>
            자주 이동하는 출퇴근 동선을 등록하면 미션 추천과 배정 판단이 더 빨라집니다.
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.dispatch(StackActions.push('AddRoute'))}>
            <Text style={styles.addButtonText}>寃쎈줈 ?깅줉?섍린</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {routes.map((item) => {
            const routeName = `${item.startStation.stationName} ??${item.endStation.stationName}`;
            return (
              <View key={item.routeId} style={styles.routeCard}>
                <View style={styles.routeHeader}>
                  <Text style={styles.routeName}>{routeName}</Text>
                  <Text style={styles.routeTime}>{item.departureTime} 異쒕컻</Text>
                </View>

                <Text style={styles.routeDays}>{item.daysOfWeek.map((day) => DAY_LABELS[day]).join(', ')}</Text>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editActionButton]}
                    onPress={() => navigation.dispatch(StackActions.push('EditRoute', { routeId: item.routeId }))}
                  >
                    <Text style={styles.editActionButtonText}>?섏젙</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteActionButton]}
                    onPress={() => handleDelete(item.routeId, routeName)}
                  >
                    <Text style={styles.deleteActionButtonText}>??젣</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {routes.length >= MAX_ROUTES ? (
            <View style={styles.limitBanner}>
              <Text style={styles.limitText}>理쒕? 5媛쒖쓽 寃쎈줈源뚯? ?깅줉?????덉뒿?덈떎.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {routes.length < MAX_ROUTES ? (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.dispatch(StackActions.push('AddRoute'))}>
          <Text style={styles.fabLabel}>+</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray50,
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  header: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
    opacity: 0.9,
  },
  loadingText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.md,
  },
  emptyIcon: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    color: Colors.gray700,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  listContainer: {
    padding: Spacing.md,
  },
  routeCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  routeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  routeName: {
    color: Colors.textPrimary,
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  routeTime: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  routeDays: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  actionButtons: {
    borderTopColor: Colors.gray200,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  editActionButton: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  editActionButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  deleteActionButton: {
    backgroundColor: Colors.error + '1A',
    borderColor: Colors.error,
    borderWidth: 1,
  },
  deleteActionButtonText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  limitBanner: {
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    padding: Spacing.md,
  },
  limitText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 28,
    bottom: 24,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    width: 56,
  },
  fabLabel: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: '300',
  },
});


