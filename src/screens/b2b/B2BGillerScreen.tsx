/**
 * B2B Giller Screen
 * B2B 길러 전용 대시보드
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface GillerDelivery {
  id: string;
  requestId: string;
  pickupStation: string;
  deliveryStation: string;
  status: 'pending' | 'matched' | 'in_progress' | 'completed';
  fee: number;
  createdAt: string;
}

interface MonthlyEarnings {
  totalDeliveries: number;
  totalEarnings: number;
  tierBonus: number;
  activityBonus: number;
  qualityBonus: number;
  netEarnings: number;
  currentTier: 'silver' | 'gold' | 'platinum';
  nextTier?: 'silver' | 'gold' | 'platinum';
  progressToNext?: number;
}

// TODO: Firebase 연동 후 실제 데이터 사용
const dummyDeliveries: GillerDelivery[] = [
  {
    id: '1',
    requestId: 'req-001',
    pickupStation: '서울역',
    deliveryStation: '강남역',
    status: 'in_progress',
    fee: 5000,
    createdAt: '2026-02-12 14:30',
  },
  {
    id: '2',
    requestId: 'req-002',
    pickupStation: '역삼역',
    deliveryStation: '선릉역',
    status: 'completed',
    fee: 4000,
    createdAt: '2026-02-12 10:15',
  },
  {
    id: '3',
    requestId: 'req-003',
    pickupStation: '삼성역',
    deliveryStation: '종로3가역',
    status: 'completed',
    fee: 6000,
    createdAt: '2026-02-11 16:45',
  },
];

const dummyEarnings: MonthlyEarnings = {
  totalDeliveries: 67,
  totalEarnings: 335000,
  tierBonus: 33500,
  activityBonus: 50000,
  qualityBonus: 30000,
  netEarnings: 415355,
  currentTier: 'gold',
  nextTier: 'platinum',
  progressToNext: 83,
};

export default function B2BGillerScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<GillerDelivery[]>(dummyDeliveries);
  const [earnings, setEarnings] = useState<MonthlyEarnings>(dummyEarnings);

  useEffect(() => {
    loadGillerData();
  }, []);

  const loadGillerData = async () => {
    try {
      // TODO: Firebase Firestore에서 데이터 가져오기
      // const deliveriesData = await getGillerDeliveries();
      // const earningsData = await getGillerEarnings();

      setLoading(false);
    } catch (error) {
      console.error('Error loading giller data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return Colors.text.tertiary;
      case 'matched':
        return Colors.info;
      case 'in_progress':
        return Colors.warning;
      case 'completed':
        return Colors.success;
      default:
        return Colors.text.tertiary;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending':
        return '대기중';
      case 'matched':
        return '매칭완료';
      case 'in_progress':
        return '배송중';
      case 'completed':
        return '완료';
      default:
        return status;
    }
  };

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'silver':
        return { name: 'Silver', color: '#C0C0C0', bonus: '5%', minDeliveries: 30 };
      case 'gold':
        return { name: 'Gold', color: '#FFD700', bonus: '10%', minDeliveries: 60 };
      case 'platinum':
        return { name: 'Platinum', color: '#E5E4E2', bonus: '15%', minDeliveries: 100 };
      default:
        return { name: 'Regular', color: '#999999', bonus: '0%', minDeliveries: 0 };
    }
  };

  const tierInfo = getTierInfo(earnings.currentTier);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>B2B 길러 대시보드</Text>
          <Text style={styles.subtitle}>
            배송 현황과 수익을 확인하세요.
          </Text>
        </View>

        {/* Tier Badge */}
        <View style={[styles.tierBadge, { backgroundColor: tierInfo.color }]}>
          <Text style={styles.tierName}>{tierInfo.name} 길러</Text>
          <Text style={styles.tierBonus}>보너스 {tierInfo.bonus}</Text>
        </View>

        {/* Monthly Earnings */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsTitle}>📊 2월 수익 현황</Text>

          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>총 배송 건수</Text>
            <Text style={styles.earningsValue}>{earnings.totalDeliveries}건</Text>
          </View>

          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>기본 수익</Text>
            <Text style={styles.earningsValue}>{formatCurrency(earnings.totalEarnings)}</Text>
          </View>

          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>등급 보너스</Text>
            <Text style={[styles.earningsValue, styles.bonusValue]}>
              +{formatCurrency(earnings.tierBonus)}
            </Text>
          </View>

          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>활동 보너스</Text>
            <Text style={[styles.earningsValue, styles.bonusValue]}>
              +{formatCurrency(earnings.activityBonus)}
            </Text>
          </View>

          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>품질 보너스</Text>
            <Text style={[styles.earningsValue, styles.bonusValue]}>
              +{formatCurrency(earnings.qualityBonus)}
            </Text>
          </View>

          <View style={[styles.earningsDivider]} />

          <View style={styles.earningsRow}>
            <Text style={[styles.earningsLabel, styles.earningsLabelTotal]}>실수익 (세후)</Text>
            <Text style={[styles.earningsValue, styles.earningsValueTotal]}>
              {formatCurrency(earnings.netEarnings)}
            </Text>
          </View>
        </View>

        {/* Tier Progress */}
        {earnings.nextTier && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>
              🎖️ {getTierInfo(earnings.nextTier).name} 승급까지
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${earnings.progressToNext}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {earnings.progressToNext}% 완료
            </Text>
          </View>
        )}

        {/* Deliveries List */}
        <View style={styles.deliveriesSection}>
          <Text style={styles.sectionTitle}>📦 내 배송</Text>

          {deliveries.map((delivery) => (
            <View key={delivery.id} style={styles.deliveryCard}>
              <View style={styles.deliveryHeader}>
                <Text style={styles.deliveryRoute}>
                  {delivery.pickupStation} → {delivery.deliveryStation}
                </Text>
                <Text style={[styles.deliveryStatus, { color: getStatusColor(delivery.status) }]}>
                  {getStatusText(delivery.status)}
                </Text>
              </View>
              <View style={styles.deliveryDetails}>
                <Text style={styles.deliveryFee}>{formatCurrency(delivery.fee)}</Text>
                <Text style={styles.deliveryDate}>{delivery.createdAt}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Tier Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>🏆 등급 혜택</Text>

          <View style={styles.benefitRow}>
            <View style={styles.benefitTierBadge} style={{ backgroundColor: '#C0C0C0' }}>
              <Text style={styles.benefitTierName}>Silver</Text>
            </View>
            <Text style={styles.benefitDesc}>30건 이상: 5% 보너스</Text>
          </View>

          <View style={styles.benefitRow}>
            <View style={styles.benefitTierBadge} style={{ backgroundColor: '#FFD700' }}>
              <Text style={styles.benefitTierName}>Gold</Text>
            </View>
            <Text style={styles.benefitDesc}>60건 이상: 10% 보너스</Text>
          </View>

          <View style={styles.benefitRow}>
            <View style={styles.benefitTierBadge} style={{ backgroundColor: '#E5E4E2' }}>
              <Text style={styles.benefitTierName}>Platinum</Text>
            </View>
            <Text style={styles.benefitDesc}>100건 이상: 15% 보너스</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  tierBadge: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  tierName: {
    ...Typography.h2,
    color: Colors.white,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  tierBonus: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
  earningsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  earningsTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  earningsLabel: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  earningsLabelTotal: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
  },
  earningsValue: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
  },
  earningsValueTotal: {
    ...Typography.h2,
    color: Colors.primary,
  },
  bonusValue: {
    color: Colors.success,
  },
  earningsDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  progressCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  progressTitle: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  deliveriesSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  deliveryCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  deliveryRoute: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
    flex: 1,
  },
  deliveryStatus: {
    ...Typography.caption,
    fontWeight: 'bold',
  },
  deliveryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryFee: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  deliveryDate: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  benefitsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  benefitsTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  benefitTierBadge: {
    width: 80,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  benefitTierName: {
    ...Typography.caption,
    fontWeight: 'bold',
    color: Colors.white,
  },
  benefitDesc: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
});
