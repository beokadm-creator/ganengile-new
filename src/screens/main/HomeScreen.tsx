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
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../theme';
import { useUser } from '../../contexts/UserContext';
import { getUserStats, getRequestsByRequester } from '../../services/user-service';
import { getGillerDeliveries } from '../../services/delivery-service';
import StationSelectModal from '../../components/StationSelectModal';
import { RoleSlider } from '../../components/common';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { User } from '../../types/user';
import type { Station } from '../../types/config';
import { UserRole } from '../../types/user';
import { PASS_TEST_MODE } from '../../config/feature-flags';

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
  activeRequestsCount: number;
}

export default function HomeScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, currentRole, switchRole, refreshUser } = useUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stationModalVisible, setStationModalVisible] = useState(false);
  const [_selectedStation, _setSelectedStation] = useState<Station | null>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!user) return;

    try {
      const userStats = await getUserStats(user.uid);
      setStats(userStats);

      // Get active requests count
      const requests = await getRequestsByRequester(user.uid);
      const activeStatuses = ['pending', 'matched', 'accepted', 'in_transit', 'arrived', 'at_locker', 'delivered'];
      const activeRequests = requests.filter(req => activeStatuses.includes(req.status as any));
      const activeCount = activeRequests.length;
      setStats(prev => prev ? { ...prev, activeRequestsCount: activeCount } : null);
      setActiveRequest(activeRequests[0] || null);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  React.useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), loadStats()]);
  };

  // Toggle role for BOTH users
  const _toggleRole = () => {
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

  const canAccessGiller =
    PASS_TEST_MODE ||
    user?.role === UserRole.BOTH ||
    user?.role === UserRole.GILLER ||
    (user as any)?.isGiller === true ||
    (user?.gillerApplicationStatus === 'approved' && user?.isVerified);

  const handleRoleChange = (newRole: 'gller' | 'giller') => {
    if (newRole === 'giller' && !canAccessGiller) {
      Alert.alert(
        '길러 모드 이용 안내',
        user?.gillerApplicationStatus === 'pending'
          ? '길러 신청이 심사 중입니다. 승인 후 길러 모드를 이용할 수 있습니다.'
          : '길러 모드를 이용하려면 승인 절차가 필요합니다. 지금 신청하시겠어요?',
        [
          { text: '취소', style: 'cancel' },
          user?.gillerApplicationStatus !== 'pending'
            ? {
                text: '신청하기',
                onPress: () => navigation.navigate('GillerApply' as any),
              }
            : { text: '확인' },
        ]
      );
      return;
    }
    switchRole(newRole === 'gller' ? UserRole.GLER : UserRole.GILLER);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      scrollEnabled
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
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
          {/* 길러 신청 심사 중 배너 */}
          {user.gillerApplicationStatus === 'pending' && (
            <View style={styles.applicationBanner}>
              <Text style={styles.applicationBannerText}>
                🔍 길러 신청이 심사 중입니다. 승인 후 길러 기능이 활성화됩니다.
              </Text>
            </View>
          )}
          {user.gillerApplicationStatus === 'rejected' && (
            <View style={[styles.applicationBanner, styles.applicationBannerRejected]}>
              <Text style={[styles.applicationBannerText, styles.applicationBannerTextRejected]}>
                ❌ 길러 신청이 반려되었습니다. 고객센터에 문의해주세요.
              </Text>
            </View>
          )}

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
            <Text style={styles.subtitle}>
              {currentRole === UserRole.GLER ? '오늘도 편리한 배송을' : '오늘도 좋은 수익을'}
            </Text>

            {/* Role Slider for BOTH users */}
            {user.role === UserRole.BOTH && (
              <RoleSlider
                currentRole={currentRole === UserRole.GLER ? 'gller' : 'giller'}
                onRoleChange={handleRoleChange}
              />
            )}
          </View>

          {/* Role-specific content */}
          {!currentRole || currentRole === UserRole.GLER || (!canAccessGiller && currentRole === UserRole.GILLER) ? (
            <GllerDashboard
              user={user}
              stats={stats}
              activeRequest={activeRequest}
              navigation={navigation}
              openStationModal={openStationModal}
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
  activeRequest,
  navigation,
  openStationModal,
}: {
  user: User;
  stats: Stats | null;
  activeRequest: any;
  navigation: MainStackNavigationProp;
  openStationModal: () => void;
}) {
  const requesterStatusLabel: Record<string, string> = {
    pending: '매칭 대기',
    matched: '길러 매칭됨',
    accepted: '길러 수락',
    in_transit: '배송 중',
    arrived: '도착 완료',
    at_locker: '사물함 보관',
    delivered: '수령 확인 대기',
  };
  const needsGillerEntry = user.gillerApplicationStatus !== 'approved' || !user.isVerified;

  return (
    <View style={styles.dashboardContainer}>
      {activeRequest && (
        <TouchableOpacity
          style={styles.activeDeliveryCard}
          onPress={() => navigation.navigate('RequestDetail', { requestId: activeRequest.requestId })}
          activeOpacity={0.8}
        >
          <View style={styles.activeDeliveryHeader}>
            <Text style={styles.activeDeliveryBadge}>진행 중</Text>
            <Text style={styles.activeDeliveryStatus}>
              {requesterStatusLabel[activeRequest.status] || activeRequest.status}
            </Text>
          </View>
          <View style={styles.activeDeliveryRoute}>
            <Text style={styles.activeDeliveryStation}>
              {activeRequest.pickupStation?.stationName || '픽업 역'}
            </Text>
            <Text style={styles.activeDeliveryArrow}> → </Text>
            <Text style={styles.activeDeliveryStation}>
              {activeRequest.deliveryStation?.stationName || '배송 역'}
            </Text>
          </View>
          <Text style={styles.activeDeliveryAction}>👆 탭하여 진행 상황 확인</Text>
        </TouchableOpacity>
      )}

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        {/* 진행 중인 배송 */}
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'Requests' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{stats?.activeRequestsCount || 0}</Text>
          <Text style={styles.statLabel}>진행 중</Text>
          <View style={[styles.statIconContainer, { backgroundColor: Colors.accentLight }]}>
            <IconLabel name="local-shipping" label="🚚" />
          </View>
        </TouchableOpacity>

        {/* 총 배송 */}
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'Requests' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{stats?.totalRequests || 0}</Text>
          <Text style={styles.statLabel}>총 배송</Text>
          <View style={styles.statIconContainer}>
            <IconLabel name="inventory" label="📦" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 시작</Text>

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
            <Text style={styles.actionSubtitle}>
              출퇴근길에 짐을 보내보세요
            </Text>
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
            <Text style={styles.actionSubtitle}>
              배송 요청 내역을 확인하세요
            </Text>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.actionArrow}>▶</Text>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
          )}
        </TouchableOpacity>
      </View>

      {needsGillerEntry && (
        <TouchableOpacity
          style={styles.gillerPromoBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('IdentityVerification')}
        >
          <Text style={styles.gillerPromoTitle}>🚴 길러를 신청하고 배송해보세요</Text>
          <Text style={styles.gillerPromoDesc}>
            신원 인증을 완료하면 길러 신청과 심사 절차를 진행할 수 있어요.
          </Text>
          <Text style={styles.gillerPromoAction}>신원 인증 시작하기 →</Text>
        </TouchableOpacity>
      )}
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
  const [activeDelivery, setActiveDelivery] = useState<any>(null);

  useEffect(() => {
    const loadActiveDelivery = async () => {
      try {
        const accepted = await getGillerDeliveries(user.uid, 'accepted' as any);
        if (accepted.length > 0) {
          setActiveDelivery(accepted[0]);
          return;
        }
        const inTransit = await getGillerDeliveries(user.uid, 'in_transit' as any);
        if (inTransit.length > 0) {
          setActiveDelivery(inTransit[0]);
        }
      } catch (e) {
        // 조용히 실패
      }
    };
    loadActiveDelivery();
  }, [user.uid]);

  const statusLabel: Record<string, string> = {
    accepted: '수락됨 - 픽업 대기',
    in_transit: '배송 중',
    arrived: '목적지 도착',
  };

  return (
    <View style={styles.dashboardContainer}>
      {/* 진행 중인 배송 카드 */}
      {activeDelivery && (
        <TouchableOpacity
          style={styles.activeDeliveryCard}
          onPress={() => navigation.navigate('DeliveryTracking', { requestId: activeDelivery.requestId })}
          activeOpacity={0.8}
        >
          <View style={styles.activeDeliveryHeader}>
            <Text style={styles.activeDeliveryBadge}>진행 중</Text>
            <Text style={styles.activeDeliveryStatus}>
              {statusLabel[activeDelivery.status] || activeDelivery.status}
            </Text>
          </View>
          <View style={styles.activeDeliveryRoute}>
            <Text style={styles.activeDeliveryStation}>
              {activeDelivery.pickupStation?.stationName || '픽업 역'}
            </Text>
            <Text style={styles.activeDeliveryArrow}> → </Text>
            <Text style={styles.activeDeliveryStation}>
              {activeDelivery.deliveryStation?.stationName || '배송 역'}
            </Text>
          </View>
          <Text style={styles.activeDeliveryAction}>
            {activeDelivery.status === 'accepted' ? '👆 탭하여 픽업 인증 시작' : '👆 탭하여 배송 완료 처리'}
          </Text>
        </TouchableOpacity>
      )}

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
        <Text style={styles.sectionTitle}>배송 매칭</Text>

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
            <Text style={styles.actionSubtitle}>
              내 동선과 매칭된 요청을 확인하세요
            </Text>
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
            <Text style={styles.actionSubtitle}>
              역을 선택하여 동선을 빠르게 등록하세요
            </Text>
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
            <Text style={styles.actionSubtitle}>
              루틴/단일 동선을 등록하고 관리하세요
            </Text>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.actionArrow}>▶</Text>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
          )}
        </TouchableOpacity>

        {activeDelivery && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('DeliveryTracking', { requestId: activeDelivery.requestId })}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, styles.actionIconPurple]}>
              <IconLabel name="location-on" label="📍" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>배송 진행하기</Text>
              <Text style={styles.actionSubtitle}>
                {statusLabel[activeDelivery.status] || '진행 중인 배송이 있습니다'}
              </Text>
            </View>
            {Platform.OS === 'web' ? (
              <Text style={styles.actionArrow}>▶</Text>
            ) : (
              <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} style={styles.actionArrow} />
            )}
          </TouchableOpacity>
        )}
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
  applicationBanner: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  applicationBannerRejected: {
    backgroundColor: '#FFEBEE',
    borderLeftColor: '#F44336',
  },
  applicationBannerText: {
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  applicationBannerTextRejected: {
    color: '#B71C1C',
  },
  header: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    padding: Spacing.xxl,
    paddingTop: 65,
    paddingBottom: Spacing['4xl'],
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
  activeDeliveryCard: {
    backgroundColor: '#0B7B73',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#57D7C8',
    shadowColor: '#0B7B73',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 8,
  },
  activeDeliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  activeDeliveryBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    color: Colors.white,
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeDeliveryStatus: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  activeDeliveryRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeDeliveryStation: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeDeliveryArrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
  activeDeliveryAction: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
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
    marginTop: -Spacing.lg,
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
  gillerPromoBanner: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  gillerPromoTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: '#2E7D32',
    marginBottom: Spacing.xs,
  },
  gillerPromoDesc: {
    fontSize: Typography.fontSize.sm,
    color: '#33691E',
    lineHeight: 20,
  },
  gillerPromoAction: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: '#1B5E20',
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
    paddingBottom: Spacing['5xl'],
  },
});
