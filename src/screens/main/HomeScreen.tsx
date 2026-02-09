/**
 * Home Screen - Role-Based Dashboard
 * 역할별 맞춤 대시보드 (이용자/길러/BOTH)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useUser } from '../../contexts/UserContext';
import { getUserStats } from '../../services/user-service';
import StationSelectModal from '../../components/StationSelectModal';
import { RoleSlider } from '../../components/common';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { User } from '../../types/user';
import type { Station } from '../../types/config';
import { UserRole } from '../../types/user';

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

  React.useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshUser();
    loadStats();
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
            <Text style={styles.title}>
              안녕하세요, {user.name.split(' ')[0]}님! 👋
            </Text>
            <Text style={styles.subtitle}>
              {currentRole === UserRole.GLER ? '오늘도 편리한 배송을' : '오늘도 좋은 수익을'}
            </Text>

            {/* Role Slider for BOTH users */}
            {user.role === UserRole.BOTH && (
              <RoleSlider
                currentRole={currentRole === UserRole.GLER ? 'gller' : 'giller'}
                onRoleChange={(newRole) => switchRole(newRole === 'gller' ? UserRole.GLER : UserRole.GILLER)}
              />
            )}
          </View>

          {/* Role-specific content */}
          {currentRole === 'gller' ? (
            <GllerDashboard
              user={user}
              stats={stats}
              navigation={navigation}
              openStationModal={openStationModal}
            />
          ) : (
            <GillerDashboard user={user} stats={stats} navigation={navigation} />
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
          onPress={() => navigation.navigate('Tabs', { screen: 'Requests' })}
        >
          <Text style={styles.statNumber}>{stats?.totalRequests || 0}</Text>
          <Text style={styles.statLabel}>총 요청</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'Requests' })}
        >
          <Text style={styles.statNumber}>{stats?.completionRate.toFixed(0) || 0}%</Text>
          <Text style={styles.statLabel}>완료율</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 시작</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('CreateRequest')}
        >
          <View style={styles.actionIcon}>📦</View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>배송 요청하기</Text>
            <Text style={styles.actionSubtitle}>
              출퇴근길에 짐을 보내보세요
            </Text>
          </View>
        </TouchableOpacity>

        {/* 빠른 동선 추가 - 역 선택 Modal */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={openStationModal}
        >
          <View style={styles.actionIcon}>🚇</View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>빠른 동선 추가</Text>
            <Text style={styles.actionSubtitle}>
              역을 선택하여 동선을 등록하세요
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AddRoute', {})}
        >
          <View style={styles.actionIcon}>📍</View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>동선 등록</Text>
            <Text style={styles.actionSubtitle}>
              자주 타는 경로를 등록하세요
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* My Routes Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 동선</Text>
        <TouchableOpacity
          style={styles.infoCard}
          onPress={() => navigation.navigate('AddRoute', {})}
        >
          <Text style={styles.infoTitle}>등록된 동선 관리</Text>
          <Text style={styles.infoSubtitle}>
            동선 관리에서 등록된 경로를 확인하세요
          </Text>
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
}: {
  user: User;
  stats: Stats | null;
  navigation: MainStackNavigationProp;
}) {
  return (
    <View style={styles.dashboardContainer}>
      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
        >
          <Text style={styles.statNumber}>{stats?.totalDeliveries || 0}</Text>
          <Text style={styles.statLabel}>완료 배송</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard}>
          <Text style={styles.statNumber}>
            {(stats?.totalEarnings || 0).toLocaleString()}원
          </Text>
          <Text style={styles.statLabel}>총 수익</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard}>
          <Text style={styles.statNumber}>{stats?.averageRating || 0}</Text>
          <Text style={styles.statLabel}>평점 ⭐</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>배송 매칭</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
        >
          <View style={styles.actionIcon}>🚴</View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>가능한 배송</Text>
            <Text style={styles.actionSubtitle}>
              내 동선과 매칭된 요청을 확인하세요
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('DeliveryTracking', {})}
        >
          <View style={styles.actionIcon}>📍</View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>배송 추적</Text>
            <Text style={styles.actionSubtitle}>
              진행 중인 배송을 확인하세요
            </Text>
          </View>
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
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>평균 평점</Text>
            <Text style={styles.performanceValue}>
              {stats?.averageRating || 0} / 5.0
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  actionContent: {
    flex: 1,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionSubtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  actionTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  dashboardContainer: {
    padding: 16,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#4CAF50',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
    paddingTop: 60,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  infoSubtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  infoTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  performanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  performanceLabel: {
    color: '#666',
    fontSize: 14,
  },
  performanceRow: {
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  performanceValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
  },
  roleToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    marginTop: 16,
    padding: 12,
  },
  roleToggleSub: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  roleToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  statNumber: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
    opacity: 0.9,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});
