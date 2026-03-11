/**
 * Home Screen - Role-Based Dashboard
 * 역할별 맞춤 대시보드 (이용자/길러/BOTH)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../theme';
import { useUser } from '../../contexts/UserContext';
import { getUserStats, getRequestsByRequester } from '../../services/user-service';
import StationSelectModal from '../../components/StationSelectModal';
import { RoleSlider } from '../../components/common';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { User } from '../../types/user';
import type { Station } from '../../types/config';
import { UserRole } from '../../types/user';
import type { Request } from '../../types/request';

// 웹에서는 아이콘 대신 텍스트 라벨 사용
const IconLabel = ({ name, label }: { name: string; label: string }) => {
  if (Platform.OS === 'web') {
    return <Text style={styles.iconLabel}>{label}</Text>;
  }
  let iconName = name;
  if (name === 'list') iconName = 'view-list';
  if (name === 'route') iconName = 'alt-route';
  return <MaterialIcons name={iconName as any} size={24} color="currentColor" />;
};

interface Stats {
  totalRequests: number;
  totalDeliveries: number;
  totalEarnings: number;
  averageRating: number;
  completionRate: number;
}

export default function HomeScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, currentRole, switchRole, refreshUser } = useUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stationModalVisible, setStationModalVisible] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!user) return;

    try {
      const userStats = await getUserStats(user.uid);
      setStats(userStats);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Load pending requests
  const loadPendingRequests = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingRequests(true);
      const requests = await getRequestsByRequester(user.uid);
      // Filter for active requests (pending, matched, in_progress)
      const activeRequests = requests.filter(
        req => req.status === 'pending' || req.status === 'matched' || req.status === 'in_progress'
      );
      setPendingRequests(activeRequests);
    } catch (error: any) {
      console.error('Error loading pending requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  }, [user]);

  React.useEffect(() => {
    loadStats();
    loadPendingRequests();
  }, [loadStats, loadPendingRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshUser();
    loadStats();
    loadPendingRequests();
  };

  // Toggle role for BOTH users
  const toggleRole = () => {
    if (user?.role === UserRole.BOTH && currentRole) {
      const newRole = currentRole === UserRole.GLER ? UserRole.GILLER : UserRole.GLER;
      switchRole(newRole);
    }
  };

  // Handle station selection
  const handleSelectStation = (station: any) => {
    setSelectedStation(station);
    // Navigate to AddRoute with selected station
    navigation.navigate('AddRoute', {
      selectedStation: station,
    });
  };

  const openStationModal = () => {
    setStationModalVisible(true);
  };

  const closeStationModal = () => {
    setStationModalVisible(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      scrollEnabled={true}
      bounces={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {!user ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>사용자 정보를 찾을 수 없습니다.</Text>
        </View>
      ) : (
        <>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerGreeting}>
              <Text style={styles.title}>
                안녕하세요,{`\n`}{user.name.split(' ')[0]}님!
              </Text>
              {Platform.OS === 'web' ? (
                <Text style={styles.waveText}>👋</Text>
              ) : (
                <MaterialIcons name="waving-hand" size={28} color="#FFD54F" style={styles.waveIcon} />
              )}
            </View>

            {/* Role Slider for BOTH users */}
            {user.role === UserRole.BOTH && (
              <RoleSlider
                currentRole={currentRole === UserRole.GLER ? 'gller' : 'giller'}
                onRoleChange={(newRole) => switchRole(newRole === 'gller' ? UserRole.GLER : UserRole.GILLER)}
              />
            )}
          </View>

          {/* Role-specific content */}
          {!currentRole || currentRole === UserRole.GLER ? (
            <GllerDashboard
              user={user}
              stats={stats}
              navigation={navigation}
              openStationModal={openStationModal}
              pendingRequests={pendingRequests}
              loadingRequests={loadingRequests}
            />
          ) : (
            <GillerDashboard
              user={user}
              stats={stats}
              navigation={navigation}
              openStationModal={openStationModal}
            />
          )}

          {/* Station Select Modal */}
          <StationSelectModal
            visible={stationModalVisible}
            onClose={closeStationModal}
            onSelectStation={handleSelectStation}
            title="출발역 선택"
            mode="start"
          />
        </>
      )}
    </ScrollView>
  );
}

/**
 * Gller Dashboard (이용자)
 */
function GllerDashboard({
  user,
  stats,
  navigation,
  openStationModal,
  pendingRequests,
  loadingRequests,
}: {
  user: User;
  stats: Stats | null;
  navigation: MainStackNavigationProp;
  openStationModal: () => void;
  pendingRequests: Request[];
  loadingRequests: boolean;
}) {
  return (
    <View style={styles.dashboardContainer}>
      {/* 진행 중인 요청 섹션 */}
      {loadingRequests ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>진행 중인 배송</Text>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        </View>
      ) : pendingRequests.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>진행 중인 배송</Text>
            <Text style={styles.sectionSubtitle}>{pendingRequests.length}건</Text>
          </View>

          {pendingRequests.map((request) => (
            <TouchableOpacity
              key={request.requestId}
              style={styles.requestCard}
              onPress={() => navigation.navigate('RequestDetail', { requestId: request.requestId })}
              activeOpacity={0.7}
            >
              <View style={styles.requestHeader}>
                <View style={styles.requestRoute}>
                  <Text style={styles.stationName}>{request.pickupStation.stationName}</Text>
                  <Text style={styles.arrow}>→</Text>
                  <Text style={styles.stationName}>{request.deliveryStation.stationName}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  request.status === 'pending' && styles.statusPending,
                  request.status === 'matched' && styles.statusMatched,
                  request.status === 'in_progress' && styles.statusInProgress
                ]}>
                  <Text style={styles.statusText}>
                    {request.status === 'pending' ? '매칭 중' :
                     request.status === 'matched' ? '매칭 완료' :
                     request.status === 'in_progress' ? '배송 중' : request.status}
                  </Text>
                </View>
              </View>

              <View style={styles.requestDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>📦 크기</Text>
                  <Text style={styles.detailValue}>
                    {request.packageInfo.size === 'small' ? '소형' :
                     request.packageInfo.size === 'medium' ? '중형' :
                     request.packageInfo.size === 'large' ? '대형' : '특대'}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>💰 배송비</Text>
                  <Text style={styles.detailValue}>
                    {request.initialNegotiationFee.toLocaleString()}원
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'Requests' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{stats?.totalRequests || 0}</Text>
          <Text style={styles.statLabel}>총 요청</Text>
          <View style={styles.statIconContainer}>
            <IconLabel name="inventory" label="📦" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'Requests' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{stats?.completionRate.toFixed(0) || 0}%</Text>
          <Text style={styles.statLabel}>완료율</Text>
          <View style={[styles.statIconContainer, { backgroundColor: Colors.secondaryLight }]}>
            <IconLabel name="check-circle" label="✅" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={{ height: 0 }} />

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('CreateRequest')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, styles.actionIconGreen]}>
            <IconLabel name="inventory-2" label="📦" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>배송 요청하기</Text>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.actionArrow}>▶</Text>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'Requests' })}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, styles.actionIconBlue]}>
            <IconLabel name="list" label="📋" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>요청 내역</Text>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.actionArrow}>▶</Text>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Giller Dashboard (길러)
 */
function GillerDashboard({
  user,
  stats,
  navigation,
  openStationModal,
}: {
  user: User;
  stats: Stats | null;
  navigation: MainStackNavigationProp;
  openStationModal: () => void;
}) {
  return (
    <View style={styles.dashboardContainer}>
      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{stats?.totalDeliveries || 0}</Text>
          <Text style={styles.statLabel}>완료 배송</Text>
          <View style={[styles.statIconContainer, { backgroundColor: Colors.secondaryLight }]}>
            <IconLabel name="local-shipping" label="🚚" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber} adjustsFontSizeToFit numberOfLines={1}>
            {((stats?.totalEarnings || 0) / 10000).toFixed(1)}만
          </Text>
          <Text style={styles.statLabel}>총 수익</Text>
          <View style={[styles.statIconContainer, { backgroundColor: Colors.accentLight }]}>
            <IconLabel name="payments" label="💰" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{stats?.averageRating || 0}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.statLabel}>평점</Text>
            <IconLabel name="star" label="⭐" />
          </View>
          <View style={[styles.statIconContainer, { backgroundColor: '#FFF9C4' }]}>
            <IconLabel name="star-rate" label="⭐" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={{ height: 0 }} />

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, styles.actionIconGreen]}>
            <IconLabel name="pedal-bike" label="🚲" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>가능한 배송</Text>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.actionArrow}>▶</Text>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={openStationModal}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, styles.actionIconOrange]}>
            <IconLabel name="subway" label="🚇" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>빠른 동선 추가</Text>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.actionArrow}>▶</Text>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AddRoute', {})}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, styles.actionIconBlue]}>
            <IconLabel name="route" label="🛤️" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>동선 관리</Text>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.actionArrow}>▶</Text>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('DeliveryTracking', {})}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, styles.actionIconPurple]}>
            <IconLabel name="location-on" label="📍" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>배송 추적</Text>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.actionArrow}>▶</Text>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
          )}
        </TouchableOpacity>
      </View>

      {/* Performance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 성과</Text>
        <View style={styles.performanceCard}>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>완료율</Text>
            <Text style={styles.performanceValue}>
              {stats?.completionRate.toFixed(0) || 0}%
            </Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>총 배송</Text>
            <Text style={styles.performanceValue}>
              {stats?.totalDeliveries || 0}건
            </Text>
          </View>
          <View style={[styles.performanceRow, styles.performanceRowLast]}>
            <Text style={styles.performanceLabel}>평균 평점</Text>
            <View style={styles.ratingContainer}>
              <Text style={styles.performanceValue}>
                {stats?.averageRating || 0}
              </Text>
              <IconLabel name="star" label="⭐" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    padding: Spacing.xxl,
    paddingTop: 65,
    paddingBottom: Spacing['3xl'],
    ...Shadows.lg,
  },
  headerGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -0.5,
  },
  waveIcon: {
    marginLeft: Spacing.sm,
  },
  waveText: {
    fontSize: 24,
    marginLeft: Spacing.sm,
  },
  iconLabel: {
    fontSize: 16,
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    marginTop: Spacing.xs,
    opacity: 0.95,
    fontWeight: Typography.fontWeight.medium,
  },
  dashboardContainer: {
    padding: Spacing.lg,
    marginTop: -Spacing['2xl'],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    flex: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  statNumber: {
    color: Colors.primary,
    fontSize: 28,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -1,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.lg,
    letterSpacing: -0.3,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  actionIconGreen: {
    backgroundColor: Colors.secondaryLight,
  },
  actionIconBlue: {
    backgroundColor: Colors.primaryLight,
  },
  actionIconOrange: {
    backgroundColor: Colors.accentLight,
  },
  actionIconPurple: {
    backgroundColor: '#E1BEE7',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  actionArrow: {
    marginLeft: Spacing.sm,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  infoTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  infoSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  performanceCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  performanceRowLast: {
    borderBottomWidth: 0,
  },
  performanceLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  performanceValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    marginLeft: Spacing.xs,
  },
  container: {
    backgroundColor: Colors.gray50,
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing['3xl'],
  },
  // 진행 중인 요청 관련 스타일
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  requestCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  requestRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stationName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
  arrow: {
    marginHorizontal: Spacing.xs,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusPending: {
    backgroundColor: Colors.warningLight,
  },
  statusMatched: {
    backgroundColor: Colors.primaryLight,
  },
  statusInProgress: {
    backgroundColor: Colors.secondaryLight,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  requestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  detailValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semiBold,
  },
});
