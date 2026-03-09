/**
 * Level Benefits Screen
 * 등급별 혜택 안내 화면 (P1-2)
 *
 * 기능:
 * - 일반/전문가/마스터 등급별 혜택 비교
 * - 요금 보너스 (0%, 15%, 25%)
 * - 동선 개수 (5, 10, 15개)
 * - 일일 배송 가능 수 (10, 20, 30건)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

type GillerLevel = 'normal' | 'professional' | 'master';

interface LevelBenefit {
  level: GillerLevel;
  levelName: string;
  levelIcon: string;
  levelColor: string;
  benefits: {
    routeCount: number;
    dailyDeliveries: number;
    feeBonus: number;
    priority: string;
    extraBenefits: string[];
  };
  requirements: {
    completedDeliveries: number;
    rating: number;
    memberDays: number;
  };
}

const LEVEL_BENEFITS: LevelBenefit[] = [
  {
    level: 'normal',
    levelName: '일반 길러',
    levelIcon: '🚶',
    levelColor: '#9E9E9E',
    benefits: {
      routeCount: 5,
      dailyDeliveries: 10,
      feeBonus: 0,
      priority: '일반',
      extraBenefits: [],
    },
    requirements: {
      completedDeliveries: 0,
      rating: 0,
      memberDays: 0,
    },
  },
  {
    level: 'professional',
    levelName: '전문가 길러',
    levelIcon: '⭐',
    levelColor: '#FFD700',
    benefits: {
      routeCount: 10,
      dailyDeliveries: 20,
      feeBonus: 15,
      priority: '우선',
      extraBenefits: ['전문가 배지 획득 가능', '프로필 프레임'],
    },
    requirements: {
      completedDeliveries: 50,
      rating: 4.5,
      memberDays: 30,
    },
  },
  {
    level: 'master',
    levelName: '마스터 길러',
    levelIcon: '👑',
    levelColor: '#4CAF50',
    benefits: {
      routeCount: 15,
      dailyDeliveries: 30,
      feeBonus: 25,
      priority: '최우선',
      extraBenefits: [
        '마스터 배지 획득 가능',
        '골드 프레임',
        '멘토링 권한',
        '이벤트 우선 초대',
      ],
    },
    requirements: {
      completedDeliveries: 100,
      rating: 4.8,
      memberDays: 90,
    },
  },
];

export default function LevelBenefitsScreen({ navigation: _navigation }: Props) {
  const [selectedLevel, setSelectedLevel] = useState<GillerLevel | null>(null);
  const [showRequirements, setShowRequirements] = useState(false);

  const formatPercentage = (value: number): string => {
    return value > 0 ? `+${value}%` : '없음';
  };

  const renderLevelCard = (benefit: LevelBenefit, index: number) => {
    const isSelected = selectedLevel === benefit.level;

    return (
      <TouchableOpacity
        key={benefit.level}
        style={[
          styles.levelCard,
          isSelected && styles.levelCardSelected,
          { borderColor: benefit.levelColor },
        ]}
        onPress={() => setSelectedLevel(benefit.level)}
        activeOpacity={0.7}
      >
        {/* 등급 헤더 */}
        <View style={[styles.levelHeader, { backgroundColor: benefit.levelColor + '20' }]}>
          <View style={styles.levelHeaderLeft}>
            <Text style={styles.levelIcon}>{benefit.levelIcon}</Text>
            <View>
              <Text style={[styles.levelName, { color: benefit.levelColor }]}>
                {benefit.levelName}
              </Text>
              <Text style={styles.levelSubtitle}>
                {benefit.level === 'normal'
                  ? '입문 단계'
                  : benefit.level === 'professional'
                  ? '숙련된 길러'
                  : '최고 전문가'}
              </Text>
            </View>
          </View>
          <View style={styles.levelHeaderRight}>
            <Text style={[styles.levelBadge, { backgroundColor: benefit.levelColor }]}>
              {benefit.level.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* 혜택 목록 */}
        <View style={styles.benefitsList}>
          {/* 동선 개수 */}
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconContainer}>
              <Text style={styles.benefitIcon}>🗺️</Text>
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitLabel}>등록 가능 동선</Text>
              <Text style={styles.benefitValue}>{benefit.benefits.routeCount}개</Text>
            </View>
          </View>

          {/* 일일 배송 가능 수 */}
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconContainer}>
              <Text style={styles.benefitIcon}>📦</Text>
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitLabel}>일일 배송 가능</Text>
              <Text style={styles.benefitValue}>{benefit.benefits.dailyDeliveries}건</Text>
            </View>
          </View>

          {/* 요금 보너스 */}
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconContainer}>
              <Text style={styles.benefitIcon}>💰</Text>
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitLabel}>요금 보너스</Text>
              <Text
                style={[
                  styles.benefitValue,
                  { color: benefit.benefits.feeBonus > 0 ? '#4CAF50' : Colors.textSecondary },
                ]}
              >
                {formatPercentage(benefit.benefits.feeBonus)}
              </Text>
            </View>
          </View>

          {/* 매칭 우선순위 */}
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconContainer}>
              <Text style={styles.benefitIcon}>🎯</Text>
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitLabel}>매칭 우선순위</Text>
              <Text style={styles.benefitValue}>{benefit.benefits.priority}</Text>
            </View>
          </View>
        </View>

        {/* 추가 혜택 */}
        {benefit.benefits.extraBenefits.length > 0 && (
          <View style={styles.extraBenefits}>
            <Text style={styles.extraBenefitsTitle}>특별 혜택</Text>
            {benefit.benefits.extraBenefits.map((extra, idx) => (
              <View key={idx} style={styles.extraBenefitItem}>
                <Text style={styles.extraBenefitIcon}>✨</Text>
                <Text style={styles.extraBenefitText}>{extra}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 확장 버튼 */}
        {isSelected && (
          <>
            <View style={styles.divider} />

            {/* 승급 기준 */}
            {benefit.level !== 'normal' && (
              <View style={styles.requirements}>
                <Text style={styles.requirementsTitle}>승급 기준</Text>
                <View style={styles.requirementItem}>
                  <Text style={styles.requirementIcon}>📦</Text>
                  <Text style={styles.requirementText}>
                    완료 건수 {benefit.requirements.completedDeliveries}건 이상
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={styles.requirementIcon}>⭐</Text>
                  <Text style={styles.requirementText}>
                    평점 {benefit.requirements.rating.toFixed(1)} 이상
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text style={styles.requirementIcon}>📅</Text>
                  <Text style={styles.requirementText}>
                    가입 {benefit.requirements.memberDays}일 이상
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>등급별 혜택</Text>
        <Text style={styles.headerSubtitle}>
          활동에 따라 혜택이 달라집니다
        </Text>
      </View>

      {/* 비교 테이블 버튼 */}
      <TouchableOpacity
        style={styles.compareButton}
        onPress={() => setShowRequirements(!showRequirements)}
      >
        <Text style={styles.compareButtonText}>
          {showRequirements ? '숨기기' : '전체 비교표 보기'}
        </Text>
      </TouchableOpacity>

      {/* 전체 비교표 */}
      {showRequirements && (
        <View style={styles.comparisonTable}>
          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonHeaderCell}>혜택</Text>
            <Text style={styles.comparisonHeaderCell}>일반</Text>
            <Text style={styles.comparisonHeaderCell}>전문가</Text>
            <Text style={styles.comparisonHeaderCell}>마스터</Text>
          </View>

          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabelCell}>동선</Text>
            <Text style={styles.comparisonDataCell}>5개</Text>
            <Text style={styles.comparisonDataCell}>10개</Text>
            <Text style={styles.comparisonDataCell}>15개</Text>
          </View>

          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabelCell}>일일</Text>
            <Text style={styles.comparisonDataCell}>10건</Text>
            <Text style={styles.comparisonDataCell}>20건</Text>
            <Text style={styles.comparisonDataCell}>30건</Text>
          </View>

          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabelCell}>보너스</Text>
            <Text style={styles.comparisonDataCell}>0%</Text>
            <Text style={styles.comparisonDataCell}>15%</Text>
            <Text style={styles.comparisonDataCell}>25%</Text>
          </View>

          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabelCell}>우선순위</Text>
            <Text style={styles.comparisonDataCell}>일반</Text>
            <Text style={styles.comparisonDataCell}>우선</Text>
            <Text style={styles.comparisonDataCell}>최우선</Text>
          </View>
        </View>
      )}

      {/* 등급 카드 목록 */}
      <ScrollView
        style={styles.levelList}
        showsVerticalScrollIndicator={false}
      >
        {LEVEL_BENEFITS.map((benefit, index) => renderLevelCard(benefit, index))}
      </ScrollView>

      {/* 승급 안내 */}
      <View style={styles.upgradeNotice}>
        <Text style={styles.upgradeNoticeIcon}>💡</Text>
        <Text style={styles.upgradeNoticeText}>
          승급 기준을 충족하면 자동으로 승급 신청이 가능합니다.
          {'\n'}
          길러 승급 신청 화면에서 확인해보세요!
        </Text>
      </View>
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
  compareButton: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  compareButtonText: {
    ...Typography.body1,
    color: Colors.primary,
    fontWeight: '600',
  },
  comparisonTable: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '20',
    paddingVertical: Spacing.sm,
  },
  comparisonHeaderCell: {
    flex: 1,
    ...Typography.body2,
    color: Colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  comparisonLabelCell: {
    flex: 1,
    ...Typography.body2,
    color: Colors.text,
    textAlign: 'center',
  },
  comparisonDataCell: {
    flex: 1,
    ...Typography.body2,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  levelList: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  levelCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    overflow: 'hidden',
  },
  levelCardSelected: {
    borderWidth: 3,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  levelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  levelIcon: {
    fontSize: 36,
    marginRight: Spacing.md,
  },
  levelName: {
    ...Typography.h3,
    fontWeight: '700',
  },
  levelSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  levelHeaderRight: {},
  levelBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  benefitsList: {
    padding: Spacing.lg,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  benefitIcon: {
    fontSize: 20,
  },
  benefitContent: {
    flex: 1,
  },
  benefitLabel: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  benefitValue: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
  },
  extraBenefits: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  extraBenefitsTitle: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  extraBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  extraBenefitIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  extraBenefitText: {
    ...Typography.body2,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  requirements: {
    padding: Spacing.lg,
  },
  requirementsTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  requirementIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  requirementText: {
    ...Typography.body1,
    color: Colors.text,
  },
  upgradeNotice: {
    backgroundColor: Colors.primary + '10',
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  upgradeNoticeIcon: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  upgradeNoticeText: {
    ...Typography.body2,
    color: Colors.text,
    flex: 1,
  },
});
