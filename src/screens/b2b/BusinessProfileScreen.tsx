/**
 * Business Profile Screen
 * B2B 기업용 프로필 관리 화면
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { b2bFirestoreService } from '../../services/b2b-firestore-service';
import { businessContractService } from '../../services/business-contract-service';
import { requireUserId } from '../../services/firebase';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface BusinessProfile {
  businessId: string;
  companyName: string;
  businessNumber: string;
  ceoName: string;
  address: string;
  contact: string;
  email: string;
  businessType: string;
  subscriptionTier: string;
  subscriptionStatus: 'active' | 'suspended' | 'cancelled';
  monthlyLimit: number;
  usedDeliveries: number;
  createdAt: Date;
}

export default function BusinessProfileScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userId = await requireUserId();
      const businessData = await b2bFirestoreService.getBusinessInfo(userId);

      if (businessData) {
        setProfile(businessData);
        setCompanyName(businessData.companyName || '');
        setCeoName(businessData.ceoName || '');
        setAddress(businessData.address || '');
        setContact(businessData.contact || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('오류', '기업 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    // 원래 데이터로 복원
    if (profile) {
      setCompanyName(profile.companyName || '');
      setCeoName(profile.ceoName || '');
      setAddress(profile.address || '');
      setContact(profile.contact || '');
    }
  };

  const handleSave = async () => {
    // 필수 필드 검증
    if (!companyName || !ceoName || !address || !contact) {
      Alert.alert('입력 오류', '모든 필수 정보를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const userId = await requireUserId();
      await b2bFirestoreService.updateBusinessInfo(userId, {
        companyName,
        ceoName,
        address,
        contact,
      });

      Alert.alert('완료', '기업 정보가 업데이트되었습니다.');
      setEditing(false);
      loadProfile();
    } catch (error: any) {
      Alert.alert('실패', error.message || '기업 정보 업데이트에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleManageSubscription = () => {
    navigation.navigate('SubscriptionTierSelection' as never);
  };

  const handleChangePassword = () => {
    Alert.alert('알림', '비밀번호 변경은 웹에서 진행해주세요.');
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]
    );
  };

  const formatBusinessNumber = (number: string): string => {
    // XXX-XX-XXXX 형식으로 변환
    if (number.length === 10) {
      return `${number.slice(0, 3)}-${number.slice(3, 5)}-${number.slice(5)}`;
    }
    return number;
  };

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'premium':
        return Colors.premium;
      case 'standard':
        return Colors.primary;
      default:
        return Colors.text.secondary;
    }
  };

  const getTierName = (tier: string): string => {
    switch (tier) {
      case 'premium':
        return '프리미엄';
      case 'standard':
        return '스탠다드';
      default:
        return '베이직';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return Colors.success;
      case 'suspended':
        return Colors.warning;
      default:
        return Colors.error;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'active':
        return '활성';
      case 'suspended':
        return '일시정지';
      default:
        return '해지';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>기업 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const usagePercentage = profile.monthlyLimit > 0
    ? (profile.usedDeliveries / profile.monthlyLimit) * 100
    : 0;

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기업 프로필</Text>
        {!editing && (
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Ionicons name="create-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 기업 기본 정보 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileIcon}>
              <Ionicons name="business" size={48} color={Colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.companyName}>{profile.companyName}</Text>
              <Text style={styles.businessType}>{profile.businessType}</Text>
            </View>
          </View>

          {/* 사업자등록번호 */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>사업자등록번호</Text>
            <Text style={styles.infoValue}>
              {formatBusinessNumber(profile.businessNumber)}
            </Text>
          </View>

          {/* 대표자명 */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>대표자</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={ceoName}
                onChangeText={setCeoName}
                placeholder="대표자명"
              />
            ) : (
              <Text style={styles.infoValue}>{profile.ceoName}</Text>
            )}
          </View>

          {/* 주소 */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>주소</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={address}
                onChangeText={setAddress}
                placeholder="사업장 주소"
                multiline
              />
            ) : (
              <Text style={[styles.infoValue, styles.infoValueMultiline]}>
                {profile.address}
              </Text>
            )}
          </View>

          {/* 연락처 */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>연락처</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={contact}
                onChangeText={setContact}
                placeholder="담당자 연락처"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.infoValue}>{profile.contact}</Text>
            )}
          </View>

          {/* 이메일 */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>이메일</Text>
            <Text style={styles.infoValue}>{profile.email}</Text>
          </View>

          {/* 편집 모드 버튼 */}
          {editing && (
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButtonAction, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButtonAction, styles.saveButton]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>저장</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 구독 정보 카드 */}
        <View style={styles.subscriptionCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>구독 정보</Text>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={handleManageSubscription}
            >
              <Text style={styles.manageButtonText}>관리</Text>
            </TouchableOpacity>
          </View>

          {/* 티어 */}
          <View style={styles.tierRow}>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: getTierColor(profile.subscriptionTier) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.tierText,
                  { color: getTierColor(profile.subscriptionTier) },
                ]}
              >
                {getTierName(profile.subscriptionTier)}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(profile.subscriptionStatus) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(profile.subscriptionStatus) },
                ]}
              >
                {getStatusText(profile.subscriptionStatus)}
              </Text>
            </View>
          </View>

          {/* 월간 사용량 */}
          <View style={styles.usageContainer}>
            <View style={styles.usageHeader}>
              <Text style={styles.usageLabel}>월간 사용량</Text>
              <Text style={styles.usageValue}>
                {profile.usedDeliveries} / {profile.monthlyLimit}건
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(usagePercentage, 100)}%`,
                    backgroundColor:
                      usagePercentage > 90
                        ? Colors.error
                        : usagePercentage > 70
                        ? Colors.warning
                        : Colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.usageNote}>
              {usagePercentage > 90
                ? '한계 임박! 추가 결제가 필요합니다.'
                : usagePercentage > 70
                ? '사용량이 70%를 넘었습니다.'
                : '정상적인 사용량입니다.'}
            </Text>
          </View>
        </View>

        {/* 계정 관리 */}
        <View style={styles.accountCard}>
          <Text style={styles.cardTitle}>계정 관리</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
            <Ionicons name="lock-closed-outline" size={24} color={Colors.text.secondary} />
            <Text style={styles.menuText}>비밀번호 변경</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={Colors.error} />
            <Text style={[styles.menuText, { color: Colors.error }]}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* 버전 정보 */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>버전 1.0.0</Text>
          <Text style={styles.versionText}>© 2026 가는길에</Text>
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    ...Typography.body1,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#fff',
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  editButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  profileIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  companyName: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  businessType: {
    ...Typography.body2,
    color: Colors.text.secondary,
  },
  infoRow: {
    marginBottom: Spacing.md,
  },
  infoLabel: {
    ...Typography.body2,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  infoValue: {
    ...Typography.body1,
    color: Colors.text.primary,
  },
  infoValueMultiline: {
    lineHeight: 22,
  },
  input: {
    ...Typography.body1,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  editButtons: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  editButtonAction: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.background.secondary,
  },
  cancelButtonText: {
    ...Typography.body1,
    color: Colors.text.primary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    ...Typography.body1,
    color: '#fff',
    fontWeight: 'bold',
  },
  subscriptionCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  manageButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary + '10',
  },
  manageButtonText: {
    ...Typography.body2,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  tierRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tierBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  tierText: {
    ...Typography.body2,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.body2,
    fontWeight: 'bold',
  },
  usageContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  usageLabel: {
    ...Typography.body2,
    color: Colors.text.secondary,
  },
  usageValue: {
    ...Typography.body2,
    color: Colors.text.primary,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.background.secondary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  usageNote: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  accountCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuText: {
    ...Typography.body1,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
    flex: 1,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  versionText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
});
