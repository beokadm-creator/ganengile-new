/**
 * Giller Level Upgrade Screen
 * 길러 승급 신청 화면 (P1-1)
 *
 * 기능:
 * - 승급 기준 안내 (50건, 평점 4.5+, 30일 가입)
 * - 현재 달성 현황 표시
 * - 승급 신청 버튼
 * - 승급 심사 대기 알림
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { requireUserId } from '../../services/firebase';
import { ProfessionalGillerService } from '../../services/ProfessionalGillerService';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface GillerStats {
  completedDeliveries: number;
  rating: number;
  memberDays: number;
  recentPenalties: number;
  totalDeliveries: number;
  avgMonthlyDeliveries: number;
}

interface UpgradeCriteria {
  completedDeliveries: number;
  rating: number;
  memberDays: number;
  noRecentPenalties: boolean;
}

type GillerLevel = 'normal' | 'professional' | 'master';

export default function GillerLevelUpgradeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<GillerLevel>('normal');
  const [stats, setStats] = useState<GillerStats | null>(null);
  const [canUpgrade, setCanUpgrade] = useState(false);
  const [upgradeTo, setUpgradeTo] = useState<GillerLevel | null>(null);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);

  // 승급 기준
  const upgradeCriteria: Record<GillerLevel, UpgradeCriteria> = {
    professional: {
      completedDeliveries: 50,
      rating: 4.5,
      memberDays: 30,
      noRecentPenalties: true,
    },
    master: {
      completedDeliveries: 100,
      rating: 4.8,
      memberDays: 90,
      noRecentPenalties: true,
    },
  };

  // 등급별 혜택
  const levelBenefits: Record<GillerLevel, string[]> = {
    normal: ['동선 5개', '일일 10건', '요금 보너스 없음'],
    professional: ['동선 10개', '일일 20건', '요금 15% 보너스', '우선 매칭'],
    master: ['동선 15개', '일일 30건', '요금 25% 보너스', '최우선 매칭', '멘토 배지'],
  };

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      setLoading(true);

      const db = getFirestore();
      const userId = requireUserId();
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // 현재 등급
        setCurrentLevel(userData.gillerLevel || 'normal');

        // 통계
        const statsData: GillerStats = {
          completedDeliveries: userData.stats?.completedDeliveries || 0,
          rating: userData.stats?.rating || 0,
          memberDays: calculateMemberDays(userData.createdAt?.toDate()),
          recentPenalties: userData.stats?.recentPenalties || 0,
          totalDeliveries: userData.stats?.totalDeliveries || 0,
          avgMonthlyDeliveries: calculateAvgMonthlyDeliveries(
            userData.stats?.completedDeliveries || 0,
            calculateMemberDays(userData.createdAt?.toDate())
          ),
        };
        setStats(statsData);

        // 승급 가능 여부 확인
        checkUpgradeEligibility(userData);

        // 대기 중인 신청
        const pending = userData.pendingUpgrades || [];
        setPendingRequests(pending);
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
      Alert.alert('오류', '통계를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const calculateMemberDays = (createdAt?: Date): number => {
    if (!createdAt) return 0;
    const diff = Date.now() - createdAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const calculateAvgMonthlyDeliveries = (deliveries: number, days: number): number => {
    if (days === 0) return 0;
    return Math.round((deliveries / days) * 30);
  };

  const checkUpgradeEligibility = (userData: any) => {
    const currentLevel = userData.gillerLevel || 'normal';

    // 일반 → 전문가
    if (currentLevel === 'normal') {
      const criteria = upgradeCriteria.professional;
      const eligible =
        (userData.stats?.completedDeliveries || 0) >= criteria.completedDeliveries &&
        (userData.stats?.rating || 0) >= criteria.rating &&
        calculateMemberDays(userData.createdAt?.toDate()) >= criteria.memberDays &&
        (userData.stats?.recentPenalties || 0) === 0;

      if (eligible) {
        setCanUpgrade(true);
        setUpgradeTo('professional');
      }
    }
    // 전문가 → 마스터
    else if (currentLevel === 'professional') {
      const criteria = upgradeCriteria.master;
      const eligible =
        (userData.stats?.completedDeliveries || 0) >= criteria.completedDeliveries &&
        (userData.stats?.rating || 0) >= criteria.rating &&
        calculateMemberDays(userData.createdAt?.toDate()) >= criteria.memberDays &&
        (userData.stats?.recentPenalties || 0) === 0;

      if (eligible) {
        setCanUpgrade(true);
        setUpgradeTo('master');
      }
    }
  };

  const handleUpgradeRequest = async () => {
    if (!upgradeTo) return;

    Alert.alert(
      '승급 신청 확인',
      `${getLevelLabel(upgradeTo)}(으)로 승급을 신청하시겠습니까?\n\n심사는 1~3일 소요됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '신청',
          style: 'default',
          onPress: submitUpgradeRequest,
        },
      ]
    );
  };

  const submitUpgradeRequest = async () => {
    try {
      setSubmitting(true);

      const db = getFirestore();
      const userId = requireUserId();
      const userRef = doc(db, 'users', userId);

      // 승급 신청 추가
      await updateDoc(userRef, {
        pendingUpgrades: [...pendingRequests, upgradeTo],
        upgradeRequestedAt: new Date(),
      });

      Alert.alert(
        '신청 완료',
        '승급 신청이 완료되었습니다.\n심사 결과는 알림으로 전달해드립니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting upgrade request:', error);
      Alert.alert('오류', '승급 신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const getLevelLabel = (level: GillerLevel): string => {
    switch (level) {
      case 'normal':
        return '일반 길러';
      case 'professional':
        return '전문가 길러';
      case 'master':
        return '마스터 길러';
    }
  };

  const getLevelColor = (level: GillerLevel): string => {
    switch (level) {
      case 'normal':
        return '#9E9E9E'; // Gray
      case 'professional':
        return '#FFD700'; // Gold
      case 'master':
        return '#4CAF50'; // Green
    }
  };

  const renderCriteriaCard = (targetLevel: GillerLevel) => {
    const criteria = upgradeCriteria[targetLevel];
    const levelColor = getLevelColor(targetLevel);

    return (
      <View style={[styles.criteriaCard, { borderColor: levelColor }]}>
        <View style={styles.criteriaHeader}>
          <Text style={[styles.criteriaTitle, { color: levelColor }]}>
            {getLevelLabel(targetLevel)} 승급 기준
          </Text>
        </View>

        {/* 완료 건수 */}
        <View style={styles.criteriaItem}>
          <View style={styles.criteriaLabel}>
            <Text style={styles.criteriaIcon}>📦</Text>
            <Text style={styles.criteriaLabelText}>완료 건수</Text>
          </View>
          <View style={styles.criteriaValue}>
            <Text
              style={[
                styles.criteriaValueText,
                stats && stats.completedDeliveries >= criteria.completedDeliveries
                  ? styles.criteriaMet
                  : styles.criteriaNotMet,
              ]}
            >
              {stats?.completedDeliveries || 0} / {criteria.completedDeliveries}건
            </Text>
          </View>
        </View>

        {/* 평점 */}
        <View style={styles.criteriaItem}>
          <View style={styles.criteriaLabel}>
            <Text style={styles.criteriaIcon}>⭐</Text>
            <Text style={styles.criteriaLabelText}>평점</Text>
          </View>
          <View style={styles.criteriaValue}>
            <Text
              style={[
                styles.criteriaValueText,
                stats && stats.rating >= criteria.rating
                  ? styles.criteriaMet
                  : styles.criteriaNotMet,
              ]}
            >
              {stats?.rating.toFixed(1) || '0.0'} / {criteria.rating.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* 가입 기간 */}
        <View style={styles.criteriaItem}>
          <View style={styles.criteriaLabel}>
            <Text style={styles.criteriaIcon}>📅</Text>
            <Text style={styles.criteriaLabelText}>가입 기간</Text>
          </View>
          <View style={styles.criteriaValue}>
            <Text
              style={[
                styles.criteriaValueText,
                stats && stats.memberDays >= criteria.memberDays
                  ? styles.criteriaMet
                  : styles.criteriaNotMet,
              ]}
            >
              {stats?.memberDays || 0}일 / {criteria.memberDays}일
            </Text>
          </View>
        </View>

        {/* 최근 페널티 */}
        <View style={styles.criteriaItem}>
          <View style={styles.criteriaLabel}>
            <Text style={styles.criteriaIcon}>✅</Text>
            <Text style={styles.criteriaLabelText}>최근 페널티</Text>
          </View>
          <View style={styles.criteriaValue}>
            <Text
              style={[
                styles.criteriaValueText,
                stats && stats.recentPenalties === 0
                  ? styles.criteriaMet
                  : styles.criteriaNotMet,
              ]}
            >
              {stats?.recentPenalties || 0}회 / 0회
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderBenefitsCard = (level: GillerLevel) => {
    const benefits = levelBenefits[level];
    const levelColor = getLevelColor(level);

    return (
      <View style={[styles.benefitsCard, { backgroundColor: levelColor + '20' }]}>
        <Text style={[styles.benefitsTitle, { color: levelColor }]}>
          {getLevelLabel(level)} 혜택
        </Text>
        {benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>•</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>통계를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>길러 승급 신청</Text>
        <Text style={styles.headerSubtitle}>
          현재: {getLevelLabel(currentLevel)}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 대기 중인 신청 */}
        {pendingRequests.length > 0 && (
          <View style={styles.pendingSection}>
            <Text style={styles.pendingTitle}>심사 대기 중</Text>
            {pendingRequests.map((level, index) => (
              <View key={index} style={styles.pendingCard}>
                <Text style={styles.pendingText}>
                  {getLevelLabel(level as GillerLevel)} 승급 심사 중
                </Text>
                <Text style={styles.pendingSubtext}>심사는 1~3일 소요됩니다</Text>
              </View>
            ))}
          </View>
        )}

        {/* 현재 등급 혜택 */}
        {renderBenefitsCard(currentLevel)}

        {/* 승급 가능 여부 */}
        {upgradeTo && (
          <>
            {/* 승급 기준 */}
            {renderCriteriaCard(upgradeTo!)}

            {/* 승급 후 혜택 */}
            {renderBenefitsCard(upgradeTo!)}

            {/* 승급 신청 버튼 */}
            {canUpgrade ? (
              <TouchableOpacity
                style={[styles.upgradeButton, submitting && styles.upgradeButtonDisabled]}
                onPress={handleUpgradeRequest}
                disabled={submitting || pendingRequests.length > 0}
              >
                <Text style={styles.upgradeButtonText}>
                  {submitting ? '신청 중...' : `${getLevelLabel(upgradeTo!)}로 승급`}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.notEligibleContainer}>
                <Text style={styles.notEligibleIcon}>🔒</Text>
                <Text style={styles.notEligibleText}>
                  아직 승급 기준을 충족하지 못했습니다.
                </Text>
                <Text style={styles.notEligibleSubtext}>
                  계속 활동하시면 승급 기회가 올 것입니다!
                </Text>
              </View>
            )}
          </>
        )}

        {/* 이미 최고 등급 */}
        {currentLevel === 'master' && (
          <View style={styles.masterContainer}>
            <Text style={styles.masterIcon}>👑</Text>
            <Text style={styles.masterText}>최고 등급입니다!</Text>
            <Text style={styles.masterSubtext}>
              마스터 길러로서 모든 혜택을 누리고 계십니다.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  pendingSection: {
    backgroundColor: '#FFF3E0',
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  pendingTitle: {
    ...Typography.h3,
    color: '#F57C00',
    marginBottom: Spacing.sm,
  },
  pendingCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  pendingText: {
    ...Typography.body1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  pendingSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  criteriaCard: {
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  criteriaHeader: {
    marginBottom: Spacing.md,
  },
  criteriaTitle: {
    ...Typography.h3,
    fontWeight: '700',
  },
  criteriaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  criteriaLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  criteriaIcon: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  criteriaLabelText: {
    ...Typography.body1,
    color: Colors.text,
  },
  criteriaValue: {
    alignItems: 'flex-end',
  },
  criteriaValueText: {
    ...Typography.body1,
    fontWeight: '600',
  },
  criteriaMet: {
    color: '#4CAF50',
  },
  criteriaNotMet: {
    color: '#FF5252',
  },
  benefitsCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  benefitsTitle: {
    ...Typography.h3,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: Spacing.sm,
    color: Colors.textSecondary,
  },
  benefitText: {
    ...Typography.body1,
    color: Colors.text,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    margin: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  upgradeButtonDisabled: {
    backgroundColor: Colors.border,
  },
  upgradeButtonText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: '700',
  },
  notEligibleContainer: {
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  notEligibleIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  notEligibleText: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  notEligibleSubtext: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  masterContainer: {
    backgroundColor: '#FFF3E0',
    margin: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  masterIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  masterText: {
    ...Typography.h2,
    color: '#F57C00',
    marginBottom: Spacing.xs,
  },
  masterSubtext: {
    ...Typography.body1,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
