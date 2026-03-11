/**
 * Home Screen
 * Main dashboard showing user's routes and status
 * Refactored with Design System components
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HomeScreenProps } from '../../src/types/navigation';
import { db, auth } from '../../src/services/firebase';
import {
  Card,
  Button,
  Chip,
} from '../../src/components';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/theme';

interface Route {
  id: string;
  startStation: { name: string };
  endStation: { name: string };
  departureTime: string;
  daysOfWeek: number[];
  isActive: boolean;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const daysMap: { [key: number]: string } = {
    1: '월',
    2: '화',
    3: '수',
    4: '목',
    5: '금',
    6: '토',
    7: '일',
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'routes'),
      where('userId', '==', user.uid),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const routesData: Route[] = [];
        snapshot.forEach((doc) => {
          routesData.push({
            id: doc.id,
            ...doc.data(),
          } as Route);
        });
        setRoutes(routesData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching routes:', error);
        Alert.alert('오류', '동선 목록을 불러오는데 실패했습니다.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleDeleteRoute = (routeId: string) => {
    Alert.alert(
      '동선 삭제',
      '정말 이 동선을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'routes', routeId));
              Alert.alert('성공', '동선이 삭제되었습니다.');
            } catch (error) {
              console.error('Error deleting route:', error);
              Alert.alert('오류', '동선 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const formatDays = (days: number[]): string => {
    if (days.length === 7) return '매일';
    if (days.length === 5 && !days.includes(6) && !days.includes(7)) {
      return '주중 (월~금)';
    }
    if (days.length === 2 && days.includes(6) && days.includes(7)) {
      return '주말 (토~일)';
    }
    return days.map((d) => daysMap[d]).join(', ');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>동선 목록을 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.secondary]}
          />
          }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Text style={styles.title}>가는길에</Text>
          <Text style={styles.subtitle}>출퇴근길에 배송하며 수익 창출</Text>
        </View>

        {/* My Routes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>내 동선</Text>
            <Chip
              label={`${routes.length}개`}
              variant="filled"
              size="small"
            />
          </View>

          {routes.length === 0 ? (
            <Card variant="elevated">
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📍</Text>
                <Text style={styles.emptyTitle}>등록된 동선이 없습니다</Text>
                <Button
                  title="첫 동선 등록하기"
                  variant="secondary"
                  onPress={() => {
                    console.log('첫 동선 등록하기 버튼 클릭됨');
                    console.log('네비게이션 시도:', navigation);
                    navigation.navigate('AddRoute' as never);
                  }}
                  fullWidth
                />
              </View>
            </Card>
          ) : (
            routes.map((route) => (
              <Card key={route.id} variant="elevated" style={styles.routeCard}>
                <View style={styles.routeHeader}>
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeText}>
                      {route.startStation.name} → {route.endStation.name}
                    </Text>
                    <Text style={styles.routeTime}>{route.departureTime} 출발</Text>
                  </View>
                  <View style={styles.routeActions}>
                    <Button
                      title="수정"
                      variant="outline"
                      size="small"
                      onPress={() => {
                        console.log('수정 버튼 클릭:', route.id);
                        navigation.navigate('AddRoute' as never, {
                          route: route,
                        });
                      }}
                      style={styles.editButton}
                    />
                    <Button
                      title="삭제"
                      variant="outline"
                      size="small"
                      onPress={() => handleDeleteRoute(route.id)}
                      style={styles.deleteButton}
                    />
                  </View>
                </View>
                <View style={styles.routeFooter}>
                  <Text style={styles.routeDays}>{formatDays(route.daysOfWeek)}</Text>
                  <Chip
                    label="활성"
                    variant="filled"
                    size="small"
                  />
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Today's Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오늘의 활동</Text>
          <View style={styles.statRow}>
            <Card variant="default" style={styles.statCard}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>진행 중인 배송</Text>
            </Card>
            <Card variant="default" style={styles.statCard}>
              <Text style={styles.statValue}>{routes.length}</Text>
              <Text style={styles.statLabel}>등록된 동선</Text>
            </Card>
          </View>
        </View>

        {/* Quick Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>빠른 메뉴</Text>
          <Card
            variant="outlined"
            onPress={() => {
              console.log('새 동선 등록 버튼 클릭됨');
              console.log('네비게이션 시도:', navigation);
              navigation.navigate('AddRoute' as never);
            }}
            style={styles.quickButton}
          >
            <Text style={styles.quickButtonIcon}>📍</Text>
            <Text style={styles.quickButtonText}>새 동선 등록</Text>
            <Text style={styles.quickButtonArrow}>›</Text>
          </Card>
          <Card
            variant="outlined"
            onPress={() => navigation.navigate('Tabs', { screen: 'Requests' })}
            style={styles.quickButton}
          >
            <Text style={styles.quickButtonIcon}>📦</Text>
            <Text style={styles.quickButtonText}>배송 요청 목록</Text>
            <Text style={styles.quickButtonArrow}>›</Text>
          </Card>
        </View>

        <View style={{ height: 100 + insets.bottom }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  header: {
    backgroundColor: Colors.secondary,
    padding: Spacing.xl,
    paddingTop: 60,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold as any,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    opacity: 0.9,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold as any,
  },
  routeCard: {
    marginBottom: Spacing.md,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  routeInfo: {
    flex: 1,
  },
  routeText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
    marginBottom: Spacing.xs,
  },
  routeTime: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeDays: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },
  editButton: {
    marginRight: Spacing.xs,
  },
  deleteButton: {
    marginLeft: Spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  statValue: {
    color: Colors.secondary,
    fontSize: Typography.fontSize["4xl"],
    fontWeight: Typography.fontWeight.bold as any,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickButtonIcon: {
    fontSize: Typography.fontSize.xl,
    marginRight: Spacing.md,
  },
  quickButtonText: {
    color: Colors.textPrimary,
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium as any,
  },
  quickButtonArrow: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize["2xl"],
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.md,
  },
});
