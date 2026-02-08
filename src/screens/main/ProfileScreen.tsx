/**
 * Profile Screen
 * 사용자 프로필 및 설정 화면
 * 역할 스위치 기능 추가
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { getUserStats } from '../../services/user-service';
import { getUserRating } from '../../services/rating-service';
import { useUser } from '../../contexts/UserContext';
import type { User } from '../../types/user';
import { UserRole } from '../../types/user';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface UserStats {
  totalRequests: number;
  totalDeliveries: number;
  totalEarnings: number;
  averageRating: number;
  completionRate: number;
}

interface MenuItem {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  color?: string;
}

export default function ProfileScreen({ navigation: _navigation }: Props) {
  const { user, currentRole, switchRole, loading, refreshUser } = useUser();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [rating, setRating] = useState<{ averageRating: number; totalRatings: number } | null>(null);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Get user stats
      const userStats = await getUserStats(user.uid);
      setStats(userStats);

      // Get user rating
      const userRating = await getUserRating(user.uid);
      setRating({
        averageRating: userRating.averageRating,
        totalRatings: userRating.totalRatings,
      });
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            try {
              await signOut(auth);
              // Navigation will handle auth state change
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('오류', '로그아웃에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const toggleRole = () => {
    if (user?.role === UserRole.BOTH && currentRole) {
      const newRole = currentRole === UserRole.GLER ? UserRole.GILLER : UserRole.GLER;
      switchRole(newRole);
      Alert.alert(
        '역할 전환',
        `${newRole === UserRole.GLER ? '이용자' : '길러'} 모드로 전환했습니다.`,
        [{ text: '확인', onPress: () => refreshUser() }]
      );
    }
  };

  const menuItems: MenuItem[] = [
    {
      icon: '📦',
      title: '배송 내역',
      subtitle: '모든 배송 요청 기록',
      onPress: () => {},
      color: '#FF9800',
    },
    {
      icon: '⭐',
      title: '내 평가',
      subtitle: `평균 ${rating?.averageRating.toFixed(1) || 0}점 (${rating?.totalRatings || 0}개)`,
      onPress: () => {},
      color: '#FFA726',
    },
    {
      icon: '🔔',
      title: '알림 설정',
      subtitle: '푸시 알림, 이메일',
      onPress: () => {},
      color: '#9C27B0',
    },
    {
      icon: '❓',
      title: '고객센터',
      subtitle: '도움말, 문의하기',
      onPress: () => {},
      color: '#607D8B',
    },
    {
      icon: '📜',
      title: '약관 및 정책',
      subtitle: '이용약관, 개인정보처리방침',
      onPress: () => {},
      color: '#9E9E9E',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>사용자 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user.name || '사용자'}</Text>
            <Text style={styles.userEmail}>{user.email || ''}</Text>
            <View style={styles.userRole}>
              <Text style={styles.userRoleText}>
                {currentRole === 'gller' ? '이용자 (Gller)' : '길러 (Giller)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Role Toggle for BOTH users */}
        {user.role === 'both' && (
          <TouchableOpacity style={styles.roleSwitchCard} onPress={toggleRole}>
            <View style={styles.roleSwitchContent}>
              <Text style={styles.roleSwitchIcon}>
                {currentRole === 'gller' ? '📦' : '🚴'}
              </Text>
              <View style={styles.roleSwitchInfo}>
                <Text style={styles.roleSwitchTitle}>
                  역할 전환: {currentRole === 'gller' ? '이용자' : '길러'} 모드
                </Text>
                <Text style={styles.roleSwitchSubtitle}>
                  {currentRole === 'gller'
                    ? '배송을 요청하려면 길러 모드로 전환하세요'
                    : '배송을 하려면 이용자 모드로 전환하세요'}
                </Text>
              </View>
            </View>
            <Text style={styles.roleSwitchArrow}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📦</Text>
            <Text style={styles.statValue}>{stats?.totalRequests || 0}</Text>
            <Text style={styles.statLabel}>요청</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🚴</Text>
            <Text style={styles.statValue}>{stats?.totalDeliveries || 0}</Text>
            <Text style={styles.statLabel}>배송</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statValue}>{rating?.averageRating.toFixed(1) || '0.0'}</Text>
            <Text style={styles.statLabel}>평점</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statValue}>{stats?.completionRate.toFixed(0) || '0'}%</Text>
            <Text style={styles.statLabel}>완료율</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { borderLeftColor: item.color }]}
              onPress={item.onPress}
            >
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                {item.subtitle && (
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                )}
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <Text style={styles.versionText}>가는길에 v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 35,
    height: 70,
    justifyContent: 'center',
    marginRight: 16,
    width: 70,
  },
  avatarText: {
    fontSize: 32,
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#9C27B0',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    marginBottom: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  logoutButtonText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuArrow: {
    color: '#999',
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuContent: {
    flex: 1,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuIconContainer: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40,
  },
  menuItem: {
    alignItems: 'center',
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderLeftWidth: 4,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuSubtitle: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  menuTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  profileInfo: {
    flex: 1,
  },
  roleSwitchArrow: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  roleSwitchCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 12,
  },
  roleSwitchContent: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  roleSwitchIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  roleSwitchInfo: {
    flex: 1,
  },
  roleSwitchSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  roleSwitchTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    width: '48%',
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  statValue: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  userEmail: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userRole: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  userRoleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  versionText: {
    color: '#999',
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
});
