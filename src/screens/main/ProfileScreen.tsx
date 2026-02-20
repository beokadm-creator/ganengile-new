/**
 * Profile Screen (Enhanced)
 * 프로필 관리 화면 - 사진 업로드, 정보 수정, 계좌 입력, 길러 등급 표시
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StackNavigationProp } from '@react-navigation/stack';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { getUserStats } from '../../services/user-service';
import { getUserRating } from '../../services/rating-service';
import { useUser } from '../../contexts/UserContext';
import type { User } from '../../types/user';
import { UserRole } from '../../types/user';
import {
  getUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
} from '../../services/profile-service';
import {
  getUserVerification,
  getVerificationStatusDisplay,
} from '../../services/verification-service';
import {
  calculateGrade,
  getGradeInfo,
  getDeliveriesUntilNextGrade,
  getGradeProgress,
} from '../../services/grade-service';
import { BadgeService } from '../../services/BadgeService';
import Modal from '../../components/common/Modal';
import TextInputModal from '../../components/common/TextInputModal';

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

type EditModalType = 'name' | 'phone' | 'bankName' | 'accountNumber' | 'accountHolder' | null;

export default function ProfileScreen({ navigation: _navigation }: Props) {
  const { user, currentRole, switchRole, loading, refreshUser } = useUser();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [rating, setRating] = useState<{
    averageRating: number;
    totalRatings: number;
  } | null>(null);
  const [profile, setProfile] = useState<{
    name: string;
    phoneNumber: string;
    profilePhotoUrl?: string;
    bankAccount?: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    };
  } | null>(null);

  const [verification, setVerification] = useState<any>(null);
  const [badgeTier, setBadgeTier] = useState<{
    frame: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
    tier: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
    total: number;
  } | null>(null);
  const [editModal, setEditModal] = useState<{
    type: EditModalType;
    visible: boolean;
    value: string;
    title: string;
    placeholder?: string;
  }>({
    type: null,
    visible: false,
    value: '',
    title: '',
  });

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoadingProfile(true);

      const [userStats, userRating, userProfile, userVerification] =
        await Promise.all([
          getUserStats(user.uid),
          getUserRating(user.uid),
          getUserProfile(user.uid),
          getUserVerification(user.uid),
        ]);

      setStats(userStats);
      setRating({
        averageRating: userRating.averageRating,
        totalRatings: userRating.totalRatings,
      });

      if (userProfile) {
        setProfile({
          name: userProfile.name,
          phoneNumber: userProfile.phoneNumber || '',
          profilePhotoUrl: userProfile.profilePhotoUrl,
          bankAccount: userProfile.bankAccount,
        });
      }

      if (userVerification) {
        setVerification(userVerification);
      }

      // 배지 티어 계산
      const tierInfo = BadgeService.calculateBadgeTier(user.badges);
      setBadgeTier(tierInfo);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '확인',
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('오류', '로그아웃에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const toggleRole = () => {
    if (user?.role === UserRole.BOTH && currentRole) {
      const newRole = currentRole === UserRole.GLER ? UserRole.GILLER : UserRole.GLER;
      switchRole(newRole);
      Alert.alert('역할 전환', `${newRole === UserRole.GLER ? '이용자' : '길러'} 모드로 전환했습니다.`, [
        { text: '확인', onPress: () => refreshUser() },
      ]);
    }
  };

  const openEditModal = useCallback(
    (type: EditModalType, title: string, currentValue: string, placeholder?: string) => {
      setEditModal({
        type,
        visible: true,
        value: currentValue,
        title,
        placeholder,
      });
    },
    []
  );

  const closeEditModal = useCallback(() => {
    setEditModal((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleSaveEdit = async () => {
    if (!user || !editModal.type || !profile) return;

    try {
      setSaving(true);

      const updateData = {
        name: profile.name,
        phoneNumber: profile.phoneNumber,
        bankAccount: profile.bankAccount,
      };

      switch (editModal.type) {
        case 'name':
          updateData.name = editModal.value;
          break;
        case 'phone':
          updateData.phoneNumber = editModal.value;
          break;
        case 'bankName': {
          const existing = profile.bankAccount || { bankName: '', accountNumber: '', accountHolder: '' };
          updateData.bankAccount = {
            ...existing,
            bankName: editModal.value,
          };
          break;
        }
        case 'accountNumber': {
          const existing = profile.bankAccount || { bankName: '', accountNumber: '', accountHolder: '' };
          updateData.bankAccount = {
            ...existing,
            accountNumber: editModal.value,
          };
          break;
        }
        case 'accountHolder': {
          const existing = profile.bankAccount || { bankName: '', accountNumber: '', accountHolder: '' };
          updateData.bankAccount = {
            ...existing,
            accountHolder: editModal.value,
          };
          break;
        }
      }

      await updateUserProfile(user.uid, updateData);

      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...updateData,
        };
      });

      closeEditModal();
      Alert.alert('성공', '프로필이 업데이트되었습니다.');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('오류', '프로필 업데이트에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async () => {
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const photoUrl = await uploadProfilePhoto(user.uid, result.assets[0].uri);
      await updateUserProfile(user.uid, { profilePhotoUrl: photoUrl });

      setProfile((prev) => ({
        ...(prev || { name: '', phoneNumber: '' }),
        profilePhotoUrl: photoUrl,
      }));

      Alert.alert('성공', '프로필 사진이 업데이트되었습니다.');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('오류', '사진 업로드에 실패했습니다.');
    }
  };

  const getGillerGradeInfo = () => {
    if (!stats) return null;

    const grade = calculateGrade(stats.totalDeliveries);
    return getGradeInfo(grade);
  };

  const gradeInfo = getGillerGradeInfo();
  const verificationDisplay = getVerificationStatusDisplay(verification);

  if (loading || loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (!user || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>사용자 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const isGiller = currentRole === UserRole.GILLER || user.role === UserRole.GILLER;

  const commonItems: MenuItem[] = [
    {
      icon: '🔔',
      title: '알림 설정',
      subtitle: '푸시 알림, 이메일',
      onPress: () => (_navigation as any).navigate('NotificationSettings'),
      color: '#9C27B0',
    },
    {
      icon: '❓',
      title: '고객센터',
      subtitle: '도움말, 문의하기',
      onPress: () => (_navigation as any).navigate('CustomerService'),
      color: '#607D8B',
    },
    {
      icon: '📜',
      title: '약관 및 정책',
      subtitle: '이용약관, 개인정보처리방침',
      onPress: () => (_navigation as any).navigate('Terms'),
      color: '#9E9E9E',
    },
  ];

  const getMenuItems = (): MenuItem[] => {
    const gllerItems: MenuItem[] = [
      {
        icon: '📦',
        title: '요청 내역',
        subtitle: '모든 배송 요청 기록',
        onPress: () => (_navigation as any).navigate('Tabs', { screen: 'Requests' }),
        color: '#FF9800',
      },
      {
        icon: '🚇',
        title: '동선 관리',
        subtitle: '등록된 동선 관리',
        onPress: () => (_navigation as any).navigate('Tabs', { screen: 'RouteManagement' }),
        color: '#00BCD4',
      },
      ...commonItems,
    ];

    const gillerItems: MenuItem[] = [
      {
        icon: '🚴',
        title: '배송 내역',
        subtitle: '완료한 배송 기록',
        onPress: () => (_navigation as any).navigate('Tabs', { screen: 'GillerRequests' }),
        color: '#4CAF50',
      },
      {
        icon: '💰',
        title: '수익 관리',
        subtitle: '총 수익과 정산 내역',
        onPress: () => (_navigation as any).navigate('Earnings'),
        color: '#FFC107',
      },
      {
        icon: '⭐',
        title: '내 평가',
        subtitle: `평균 ${rating?.averageRating.toFixed(1) || 0}점 (${rating?.totalRatings || 0}개)`,
        onPress: () => (_navigation as any).navigate('MyRating'),
        color: '#FFA726',
      },
      {
        icon: '🎖️',
        title: '내 배지',
        subtitle: '획득한 배지 보기',
        onPress: () => (_navigation as any).navigate('BadgeCollection'),
        color: '#9C27B0',
      },
      {
        icon: '🚀',
        title: '길러 승급',
        subtitle: '전문 길러로 승급 신청',
        onPress: () => (_navigation as any).navigate('GillerLevelUpgrade'),
        color: '#FF5722',
      },
      ...commonItems,
    ];

    if (currentRole === UserRole.GLER) return gllerItems;
    if (currentRole === UserRole.GILLER) return gillerItems;
    return commonItems;
  };

  const menuItems = getMenuItems();

  // 배지 프레임 스타일 계산
  const getBadgeFrameStyle = () => {
    if (!badgeTier || badgeTier.frame === 'none') return null;

    const frameColors = {
      bronze: {
        borderColor: '#CD7F32',
        shadowColor: 'rgba(205, 127, 50, 0.6)',
      },
      silver: {
        borderColor: '#C0C0C0',
        shadowColor: 'rgba(192, 192, 192, 0.6)',
      },
      gold: {
        borderColor: '#FFD700',
        shadowColor: 'rgba(255, 215, 0, 0.6)',
      },
      platinum: {
        borderColor: '#E5E4E2',
        shadowColor: 'rgba(229, 228, 226, 0.8)',
      },
    };

    return frameColors[badgeTier.frame];
  };

  const getBadgeFrameIcon = () => {
    if (!badgeTier || badgeTier.total < 10) return null;

    if (badgeTier.total >= 13) return '👑'; // Platinum
    if (badgeTier.total >= 9) return '⭐'; // Gold
    if (badgeTier.total >= 5) return '💎'; // Silver
    return '🎖️'; // Bronze
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePhotoUpload}>
            {/* 배지 프레임 */}
            {badgeTier && badgeTier.frame !== 'none' && (
              <View style={[
                styles.badgeFrame,
                getBadgeFrameStyle(),
              ]}>
                {badgeTier.total >= 10 && (
                  <View style={styles.badgeFrameIcon}>
                    <Text style={styles.badgeFrameIconText}>{getBadgeFrameIcon()}</Text>
                  </View>
                )}
              </View>
            )}
            {profile.profilePhotoUrl ? (
              <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <TouchableOpacity onPress={() => openEditModal('name', '이름', profile.name)}>
              <View style={styles.nameRow}>
                <Text style={styles.userName}>{profile.name}</Text>
                <Text style={styles.editIcon}>✏️</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openEditModal('phone', '연락처', profile.phoneNumber, '010-0000-0000')}>
              <View style={styles.nameRow}>
                <Text style={styles.userEmail}>
                  {profile.phoneNumber || '연락처를 추가해주세요'}
                </Text>
                <Text style={styles.editIcon}>✏️</Text>
              </View>
            </TouchableOpacity>

            {/* Verification Badge */}
            {verificationDisplay.status === 'approved' && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIcon}>✅</Text>
                <Text style={styles.verifiedText}>인증완료</Text>
              </View>
            )}

            {/* Giller Grade */}
            {isGiller && gradeInfo && (
              <View style={[styles.gradeBadge, { backgroundColor: gradeInfo.color }]}>
                <Text style={styles.gradeIcon}>{gradeInfo.icon}</Text>
                <Text style={styles.gradeText}>{gradeInfo.nameKo} 길러</Text>
              </View>
            )}

            {/* Badge Count */}
            {badgeTier && badgeTier.total > 0 && (
              <View style={styles.badgeCountBadge}>
                <Text style={styles.badgeCountIcon}>🏆</Text>
                <Text style={styles.badgeCountText}>배지 {badgeTier.total}개</Text>
              </View>
            )}
          </View>
        </View>

        {/* Role Toggle for BOTH users */}
        {user.role === 'both' && (
          <TouchableOpacity style={styles.roleSwitchCard} onPress={toggleRole}>
            <View style={styles.roleSwitchContent}>
              <Text style={styles.roleSwitchIcon}>{currentRole === 'gller' ? '📦' : '🚴'}</Text>
              <View style={styles.roleSwitchInfo}>
                <Text style={styles.roleSwitchTitle}>
                  역할 전환: {currentRole === 'gller' ? '이용자' : '길러'} 모드
                </Text>
                <Text style={styles.roleSwitchSubtitle}>
                  {currentRole === 'gller'
                    ? '배송을 수행하려면 길러 모드로 전환하세요'
                    : '배송을 요청하려면 이용자 모드로 전환하세요'}
                </Text>
              </View>
            </View>
            <Text style={styles.roleSwitchArrow}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Bank Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계좌 정보</Text>
          <TouchableOpacity
            style={styles.bankAccountCard}
            onPress={() =>
              openEditModal(
                'bankName',
                '은행명',
                profile.bankAccount?.bankName || '',
                '은행을 선택해주세요'
              )
            }
          >
            <Text style={styles.bankLabel}>은행</Text>
            <Text style={styles.bankValue}>
              {profile.bankAccount?.bankName || '선택안함'}
            </Text>
            <Text style={styles.bankArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bankAccountCard}
            onPress={() =>
              openEditModal(
                'accountNumber',
                '계좌번호',
                profile.bankAccount?.accountNumber || '',
                '계좌번호를 입력해주세요'
              )
            }
          >
            <Text style={styles.bankLabel}>계좌번호</Text>
            <Text style={styles.bankValue}>
              {profile.bankAccount?.accountNumber
                ? maskAccountNumber(profile.bankAccount.accountNumber)
                : '입력안함'}
            </Text>
            <Text style={styles.bankArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bankAccountCard}
            onPress={() =>
              openEditModal(
                'accountHolder',
                '예금주',
                profile.bankAccount?.accountHolder || '',
                '예금주 성명을 입력해주세요'
              )
            }
          >
            <Text style={styles.bankLabel}>예금주</Text>
            <Text style={styles.bankValue}>
              {profile.bankAccount?.accountHolder || '입력안함'}
            </Text>
            <Text style={styles.bankArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Grade Progress (Giller only) */}
        {isGiller && gradeInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>길러 등급</Text>
            <View style={styles.gradeProgressCard}>
              <View style={[styles.gradeHeader, { backgroundColor: gradeInfo.color }]}>
                <Text style={styles.gradeHeaderIcon}>{gradeInfo.icon}</Text>
                <View>
                  <Text style={styles.gradeHeaderText}>{gradeInfo.nameKo} 길러</Text>
                  <Text style={styles.gradeHeaderSub}>
                    {stats?.totalDeliveries || 0}회 배송
                  </Text>
                </View>
              </View>
              <Text style={styles.gradeHeaderArrow}>›</Text>
            </View>
            <View style={styles.gradeDetails}>
              <Text style={styles.gradeDescription}>{gradeInfo.description}</Text>
              <View style={styles.benefitsList}>
                {gradeInfo.benefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <Text style={styles.benefitBullet}>•</Text>
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
              {(() => {
                const remaining = getDeliveriesUntilNextGrade(stats?.totalDeliveries || 0);
                return remaining !== null ? (
                  <View style={styles.nextGradeContainer}>
                    <Text style={styles.nextGradeText}>
                      다음 등급까지 {remaining}회 남음
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBarBackground}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${getGradeProgress(stats?.totalDeliveries || 0) * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.maxGradeText}>최고 등급 달성!</Text>
                );
              })()}
            </View>
          </View>
        )}

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
                {item.subtitle && <Text style={styles.menuSubtitle}>{item.subtitle}</Text>}
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

      {/* Edit Modal */}
      <TextInputModal
        visible={editModal.visible}
        title={editModal.title}
        value={editModal.value}
        placeholder={editModal.placeholder}
        loading={saving}
        confirmText="저장"
        cancelText="취소"
        onChangeText={(text) => setEditModal((prev) => ({ ...prev, value: text }))}
        onConfirm={handleSaveEdit}
        onCancel={closeEditModal}
      />
    </View>
  );
}

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  const visible = accountNumber.slice(-4);
  return '*'.repeat(accountNumber.length - 4) + visible;
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 35,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  avatarContainer: {
    height: 70,
    marginRight: 16,
    position: 'relative',
    width: 70,
  },
  avatarImage: {
    borderRadius: 35,
    height: 70,
    width: 70,
  },
  avatarText: {
    fontSize: 32,
  },
  badgeFrame: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 4,
    backgroundColor: 'transparent',
    zIndex: -1,
    elevation: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  badgeFrameIcon: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  badgeFrameIconText: {
    fontSize: 16,
  },
  badgeCountBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 16,
    flexDirection: 'row',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  badgeCountIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  badgeCountText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bankAccountCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bankArrow: {
    color: '#999',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bankLabel: {
    color: '#666',
    fontSize: 14,
  },
  bankValue: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  benefitBullet: {
    color: '#4CAF50',
    fontSize: 18,
    marginRight: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  benefitText: {
    color: '#333',
    fontSize: 14,
    flex: 1,
  },
  benefitsList: {
    marginTop: 12,
  },
  cameraIcon: {
    fontSize: 18,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#9C27B0',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  editIcon: {
    fontSize: 14,
    marginLeft: 8,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
  },
  gradeBadge: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  gradeDescription: {
    color: '#666',
    fontSize: 14,
    marginBottom: 12,
  },
  gradeDetails: {
    padding: 12,
  },
  gradeHeader: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 12,
    marginBottom: 12,
  },
  gradeHeaderIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  gradeHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gradeHeaderSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  gradeHeaderArrow: {
    color: '#fff',
    fontSize: 20,
  },
  gradeIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  gradeProgressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  gradeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
  maxGradeText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextGradeContainer: {
    marginTop: 12,
  },
  nextGradeText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBarBackground: {
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarFill: {
    backgroundColor: '#2196F3',
    height: '100%',
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
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
  verifiedBadge: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    flexDirection: 'row',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  verifiedIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  versionText: {
    color: '#999',
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
});
