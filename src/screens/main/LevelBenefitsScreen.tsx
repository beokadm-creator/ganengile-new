import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../theme';


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
    levelColor: Colors.textSecondary,
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
    levelIcon: '🥇',
    levelColor: Colors.warning,
    benefits: {
      routeCount: 10,
      dailyDeliveries: 20,
      feeBonus: 15,
      priority: '우선',
      extraBenefits: ['전문가 배지 노출', '프로필 프레임', '우선 상담 큐'],
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
    levelColor: Colors.success,
    benefits: {
      routeCount: 15,
      dailyDeliveries: 30,
      feeBonus: 25,
      priority: '최우선',
      extraBenefits: ['마스터 배지 노출', '골드 프레임', '멘토링 권한', '이벤트 우선 초대'],
    },
    requirements: {
      completedDeliveries: 100,
      rating: 4.8,
      memberDays: 90,
    },
  },
];

export default function LevelBenefitsScreen() {
  const [selectedLevel, setSelectedLevel] = useState<GillerLevel | null>('professional');
  const [showComparison, setShowComparison] = useState(false);

  const formatPercentage = (value: number): string => {
    return value > 0 ? `+${value}%` : '없음';
  };

  const renderLevelCard = (benefit: LevelBenefit) => {
    const isSelected = selectedLevel === benefit.level;

    return (
      <TouchableOpacity
        key={benefit.level}
        style={[
          styles.levelCard,
          isSelected ? styles.levelCardSelected : undefined,
          { borderColor: benefit.levelColor },
        ]}
        onPress={() => setSelectedLevel(benefit.level)}
        activeOpacity={0.8}
      >
        <View style={[styles.levelHeader, { backgroundColor: `${benefit.levelColor}18` }]}>
          <View style={styles.levelHeaderLeft}>
            <Text style={styles.levelIcon}>{benefit.levelIcon}</Text>
            <View>
              <Text style={[styles.levelName, { color: benefit.levelColor }]}>{benefit.levelName}</Text>
              <Text style={styles.levelSubtitle}>
                {benefit.level === 'normal'
                  ? '입문 단계'
                  : benefit.level === 'professional'
                    ? '숙련된 길러'
                    : '최상위 전문 길러'}
              </Text>
            </View>
          </View>
          <View style={[styles.levelBadge, { backgroundColor: benefit.levelColor }]}>
            <Text style={styles.levelBadgeText}>{benefit.level.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.benefitsList}>
          <BenefitRow label="등록 가능한 동선" value={`${benefit.benefits.routeCount}개`} icon="🗺️" />
          <BenefitRow label="일일 배송 가능 수" value={`${benefit.benefits.dailyDeliveries}건`} icon="📦" />
          <BenefitRow
            label="요금 보너스"
            value={formatPercentage(benefit.benefits.feeBonus)}
            icon="💰"
            emphasis={benefit.benefits.feeBonus > 0}
          />
          <BenefitRow label="매칭 우선순위" value={benefit.benefits.priority} icon="🚦" />
        </View>

        {benefit.benefits.extraBenefits.length > 0 ? (
          <View style={styles.extraBenefits}>
            <Text style={styles.extraBenefitsTitle}>추가 혜택</Text>
            {benefit.benefits.extraBenefits.map((extra) => (
              <View key={extra} style={styles.extraBenefitItem}>
                <Text style={styles.extraBenefitIcon}>•</Text>
                <Text style={styles.extraBenefitText}>{extra}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {isSelected && benefit.level !== 'normal' ? (
          <View style={styles.requirements}>
            <Text style={styles.requirementsTitle}>승급 기준</Text>
            <Text style={styles.requirementText}>완료 배송 {benefit.requirements.completedDeliveries}건 이상</Text>
            <Text style={styles.requirementText}>평점 {benefit.requirements.rating.toFixed(1)} 이상</Text>
            <Text style={styles.requirementText}>가입 {benefit.requirements.memberDays}일 이상</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>레벨별 혜택</Text>
        <Text style={styles.headerSubtitle}>
          길러 활동 수준에 따라 동선 수, 배송 수, 보너스가 달라집니다.
        </Text>
      </View>

      <TouchableOpacity style={styles.compareButton} onPress={() => setShowComparison((prev) => !prev)}>
        <Text style={styles.compareButtonText}>
          {showComparison ? '비교표 접기' : '전체 비교표 보기'}
        </Text>
      </TouchableOpacity>

      {showComparison ? (
        <View style={styles.comparisonTable}>
          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonHeaderCell}>구분</Text>
            <Text style={styles.comparisonHeaderCell}>일반</Text>
            <Text style={styles.comparisonHeaderCell}>전문가</Text>
            <Text style={styles.comparisonHeaderCell}>마스터</Text>
          </View>
          <ComparisonRow label="동선" normal="5개" professional="10개" master="15개" />
          <ComparisonRow label="일일 배송" normal="10건" professional="20건" master="30건" />
          <ComparisonRow label="보너스" normal="0%" professional="15%" master="25%" />
          <ComparisonRow label="우선순위" normal="일반" professional="우선" master="최우선" />
        </View>
      ) : null}

      <ScrollView style={styles.levelList} showsVerticalScrollIndicator={false}>
        {LEVEL_BENEFITS.map(renderLevelCard)}
      </ScrollView>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeIcon}>💡</Text>
        <Text style={styles.noticeText}>
          기준을 충족하면 길러 전환 신청 화면에서 바로 다음 단계를 진행할 수 있어요.
        </Text>
      </View>
    </View>
  );
}

function BenefitRow({
  label,
  value,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  icon: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIconContainer}>
        <Text style={styles.benefitIcon}>{icon}</Text>
      </View>
      <View style={styles.benefitContent}>
        <Text style={styles.benefitLabel}>{label}</Text>
        <Text style={[styles.benefitValue, emphasis ? styles.bonusText : undefined]}>{value}</Text>
      </View>
    </View>
  );
}

function ComparisonRow({
  label,
  normal,
  professional,
  master,
}: {
  label: string;
  normal: string;
  professional: string;
  master: string;
}) {
  return (
    <View style={styles.comparisonRow}>
      <Text style={styles.comparisonLabelCell}>{label}</Text>
      <Text style={styles.comparisonDataCell}>{normal}</Text>
      <Text style={styles.comparisonDataCell}>{professional}</Text>
      <Text style={styles.comparisonDataCell}>{master}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 6 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary },
  compareButton: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  compareButtonText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  comparisonTable: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  comparisonHeader: { flexDirection: 'row', backgroundColor: Colors.primaryMint, paddingVertical: 10 },
  comparisonHeaderCell: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  comparisonRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  comparisonLabelCell: { flex: 1, fontSize: 13, color: Colors.textPrimary, textAlign: 'center' },
  comparisonDataCell: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  levelList: { flex: 1, paddingHorizontal: 20 },
  levelCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  levelCardSelected: { borderWidth: 3 },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  levelHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  levelIcon: { fontSize: 36, marginRight: 12 },
  levelName: { fontSize: 20, fontWeight: '800' },
  levelSubtitle: { fontSize: 13, color: Colors.textSecondary },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  levelBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.surface },
  benefitsList: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center' },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitIcon: { fontSize: 18 },
  benefitContent: { flex: 1 },
  benefitLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  benefitValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  bonusText: { color: Colors.success },
  extraBenefits: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  extraBenefitsTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  extraBenefitItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  extraBenefitIcon: { fontSize: 16, color: Colors.primary },
  extraBenefitText: { fontSize: 14, color: Colors.textPrimary },
  requirements: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  requirementsTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  requirementText: { fontSize: 14, color: Colors.textPrimary },
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.primaryMint,
    margin: 20,
    padding: 16,
    borderRadius: 18,
    alignItems: 'flex-start',
  },
  noticeIcon: { fontSize: 20 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.textPrimary },
});
