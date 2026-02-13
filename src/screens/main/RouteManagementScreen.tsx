/**
 * Route Management Screen (동선 관리)
 * 등록된 동선을 관리하는 화면
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { getUserRoutes, deleteRoute } from '../../services/route-service';
import { DAY_LABELS } from '../../components/common/DaySelector';
import type { Route } from '../../types/route';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';

const MAX_ROUTES = 5;

export default function RouteManagementScreen() {
  const navigation = useNavigation();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRoutes = async () => {
    try {
      const userId = await requireUserId();
      const userRoutes = await getUserRoutes(userId);
      
      // 활성화된 동선만 표시, 최신순 정렬
      const activeRoutes = userRoutes
        .filter((route) => route.isActive)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setRoutes(activeRoutes);
    } catch (error: any) {
      console.error('Error loading routes:', error);
      Alert.alert('오류', '동선 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRoutes();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadRoutes();
  };

  const handleDelete = async (routeId: string, routeName: string) => {
    Alert.alert(
      '동선 삭제',
      `${routeName} 동선을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const userId = await requireUserId();
              await deleteRoute(userId, routeId);
              await loadRoutes();
            } catch (error: any) {
              console.error('Error deleting route:', error);
              Alert.alert('오류', '동선 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (route: Route) => {
    (navigation as any).navigate('EditRoute', { routeId: route.routeId });
  };

  const renderRightActions = (route: Route) => {
    return (
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeButton, styles.editButton]}
          onPress={() => handleEdit(route)}
        >
          <Ionicons name="create-outline" size={24} color="#fff" />
          <Text style={styles.swipeButtonText}>편집</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeButton, styles.deleteButton]}
          onPress={() => handleDelete(route.routeId, `${route.startStation.stationName} → ${route.endStation.stationName}`)}
        >
          <Ionicons name="trash-outline" size={24} color="#fff" />
          <Text style={styles.swipeButtonText}>삭제</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRouteCard = (route: Route) => {
    const daysText = route.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ');
    const routeName = `${route.startStation.stationName} → ${route.endStation.stationName}`;

    return (
      <Swipeable
        key={route.routeId}
        renderRightActions={() => renderRightActions(route)}
        friction={2}
        rightThreshold={40}
      >
        <View style={styles.routeCard}>
          {/* 경로 이름 */}
          <View style={styles.routeHeader}>
            <View style={styles.routeIconContainer}>
              <Ionicons name="train-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeName}>{routeName}</Text>
              <View style={styles.routeMeta}>
                <View style={styles.timeTag}>
                  <Ionicons name="time-outline" size={14} color={Colors.gray600} />
                  <Text style={styles.timeText}>{route.departureTime}</Text>
                </View>
                <View style={styles.daysBadge}>
                  <Text style={styles.daysText}>{daysText}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 역 정보 */}
          <View style={styles.stationsContainer}>
            <View style={styles.stationInfo}>
              <View style={styles.stationDot} />
              <Text style={styles.stationName}>{route.startStation.stationName}</Text>
            </View>
            
            <View style={styles.connector}>
              <View style={styles.connectorLine} />
              <Ionicons name="arrow-down" size={16} color={Colors.gray400} />
            </View>
            
            <View style={styles.stationInfo}>
              <View style={[styles.stationDot, { backgroundColor: Colors.secondary }]} />
              <Text style={styles.stationName}>{route.endStation.stationName}</Text>
            </View>
          </View>
        </View>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>동선 목록 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>동선 관리</Text>
        <Text style={styles.subtitle}>
          {routes.length} / {MAX_ROUTES}개 등록됨
        </Text>
      </View>

      {/* 동선 목록 */}
      {routes.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="train-outline" size={64} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>등록된 동선이 없습니다</Text>
          <Text style={styles.emptySubtitle}>
            출퇴근 경로를 등록하고 매칭받으세요
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddRoute' as never)}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addButtonText}>동선 등록하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {routes.map((route) => renderRouteCard(route))}
          
          {/* 최대 5개 안내 */}
          {routes.length >= MAX_ROUTES && (
            <View style={styles.limitBanner}>
              <Ionicons name="information-circle" size={20} color={Colors.accent} />
              <Text style={styles.limitText}>
                최대 {MAX_ROUTES}개의 동선만 등록할 수 있습니다
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 동선 추가 버튼 (FAB) */}
      {routes.length < MAX_ROUTES && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddRoute' as never)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  container: {
    backgroundColor: Colors.gray50,
    flex: 1,
  },
  connector: {
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  connectorLine: {
    backgroundColor: Colors.gray300,
    height: 20,
    width: 2,
  },
  daysBadge: {
    backgroundColor: Colors.secondaryLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  daysText: {
    color: Colors.secondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold as any,
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  editButton: {
    backgroundColor: Colors.primary,
  },
  emptySubtitle: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  emptyTitle: {
    color: Colors.gray700,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold as any,
    marginBottom: Spacing.xs,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 28,
    bottom: 24,
    elevation: 8,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    width: 56,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold as any,
  },
  header: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
  },
  limitBanner: {
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
  },
  limitText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },
  listContainer: {
    padding: Spacing.md,
  },
  loadingText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.md,
  },
  routeCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    elevation: 2,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  routeHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  routeIconContainer: {
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  routeInfo: {
    flex: 1,
  },
  routeMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  routeName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold as any,
  },
  stationDot: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  stationInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  stationName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
  },
  stationsContainer: {
    paddingLeft: 52,
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
    opacity: 0.9,
  },
  swipeActions: {
    flexDirection: 'row',
    width: 160,
  },
  swipeButton: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  swipeButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold as any,
    marginTop: 4,
  },
  text: {
    color: Colors.white,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold as any,
  },
  timeTag: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  timeText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.xs,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold as any,
  },
});
