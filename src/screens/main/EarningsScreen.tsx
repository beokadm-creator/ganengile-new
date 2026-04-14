import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ParamListBase } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUser } from '../../contexts/UserContext';
import { useGillerAccess } from '../../hooks/useGillerAccess';
import {
  getUserMonthlyEarnings,
  getUserPayments,
  Payment,
  PaymentStatus,
  PaymentType,
} from '../../services/payment-service';
import {
  formatPercentLabel,
  getRuntimeSettlementPolicy,
  type RuntimeSettlementPolicy,
} from '../../services/settlement-policy-service';
import { BorderRadius, Colors, Shadows, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';

type NavigationProp = StackNavigationProp<ParamListBase>;

interface Props {
  navigation: NavigationProp;
}

export default function EarningsScreen({ navigation }: Props) {
  const { user } = useUser();
  const { canAccessGiller } = useGillerAccess();
  const isPreviewMode = !canAccessGiller;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settlementPolicy, setSettlementPolicy] = useState<RuntimeSettlementPolicy | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<{
    total: number;
    platformFee: number;
    taxWithheld: number;
    netIncome: number;
    count: number;
  } | null>(null);

  const loadEarnings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const now = new Date();
      const [allPayments, monthly, policy] = await Promise.all([
        getUserPayments(user.uid, 30),
        getUserMonthlyEarnings(user.uid, now.getFullYear(), now.getMonth() + 1),
        getRuntimeSettlementPolicy(),
      ]);

      const earningPayments = allPayments.filter(
        (payment) =>
          payment.type === PaymentType.GILLER_EARNING &&
          payment.status === PaymentStatus.COMPLETED
      );

      setPayments(earningPayments);
      setSettlementPolicy(policy);
      setMonthlySummary({
        total: monthly.total,
        platformFee: monthly.platformFee,
        taxWithheld: monthly.taxWithheld,
        netIncome: monthly.netIncome,
        count: monthly.count,
      });
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  const totals = useMemo(() => {
    return payments.reduce(
      (acc, payment) => {
        acc.totalGross += payment.amount ?? 0;
        acc.totalFees += payment.fee ?? 0;
        acc.totalTax += payment.tax ?? 0;
        acc.totalNet += payment.netAmount ?? 0;
        return acc;
      },
      {
        totalGross: 0,
        totalFees: 0,
        totalTax: 0,
        totalNet: 0,
      }
    );
  }, [payments]);

  const taxGuide = useMemo(() => {
    const policy = settlementPolicy;
    return {
      platformFeeRateLabel: `플랫폼 수수료 ${formatPercentLabel(policy?.platformFeeRate ?? 0.1)}`,
      withholdingRateLabel: `사업소득 원천징수 ${formatPercentLabel(policy?.combinedWithholdingRate ?? 0.033)}`,
      annualFilingLabel: '종합소득세 신고 안내',
      annualFilingBody: `연간 지급 내역은 ${policy?.annualFilingWindowLabel ?? '다음 해 5월 1일 ~ 5월 31일'} 종합소득세 신고 때 참고해야 합니다. 최종 신고 의무와 필요 서류는 개인 상황에 따라 달라질 수 있습니다.`,
      taxCaution: policy?.caution ?? '실제 세무 신고와 원천세 납부 의무는 운영 정책과 개별 상황을 함께 확인해야 합니다.',
    };
  }, [settlementPolicy]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>정산 데이터를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerKicker}>giller settlement</Text>
        <Text style={styles.headerTitle}>수익과 정산 기준</Text>
        <Text style={styles.heroSubtitle}>
            플랫폼 수수료와 원천징수를 제외한 실수령액입니다.
          </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadEarnings();
            }}
          />
        }
      >
        {monthlySummary ? (
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>이번 달 정산 요약</Text>
            <Text style={styles.heroCount}>완료 건수 {monthlySummary.count}건</Text>
            <SettlementRow label="세전 수익" value={monthlySummary.total} />
            <SettlementRow label={taxGuide.platformFeeRateLabel} value={monthlySummary.platformFee} negative />
            <SettlementRow label={taxGuide.withholdingRateLabel} value={monthlySummary.taxWithheld} negative />
            <SettlementRow label="실수령 예정액" value={monthlySummary.netIncome} strong />
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>누적 수익 요약</Text>
          <SettlementRow label="누적 세전 수익" value={totals.totalGross} />
          <SettlementRow label="누적 플랫폼 수수료" value={totals.totalFees} negative />
          <SettlementRow label="누적 원천징수" value={totals.totalTax} negative />
          <SettlementRow label="누적 실수령액" value={totals.totalNet} strong />
        </View>

        <TouchableOpacity 
          style={[styles.withdrawButton, isPreviewMode && styles.previewButtonAlt]} 
          onPress={() => {
            if (isPreviewMode) {
              Alert.alert(
                '길러 전용',
              '출금은 길러 신청 후 이용할 수 있습니다.',
                [
                  { text: '닫기', style: 'cancel' },
                  { text: '신청하기', onPress: () => navigation.navigate('Profile') }
                ]
              );
              return;
            }
            navigation.navigate('PointWithdraw');
          }}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isPreviewMode && <MaterialIcons name="lock" size={18} color={Colors.white} />}
            <Text style={styles.withdrawButtonText}>정산금 출금하기</Text>
          </View>
          <Text style={[styles.withdrawButtonSubtext, isPreviewMode && styles.previewButtonSubtextAlt]}>
            계좌 및 본인 확인 후 출금됩니다.
          </Text>
        </TouchableOpacity>

        <View style={styles.policyCard}>
          <Text style={styles.sectionTitle}>세금과 정산 안내</Text>
          <PolicyItem
            title={taxGuide.platformFeeRateLabel}
            body="배송 수익 정산 전 플랫폼 수수료가 먼저 반영됩니다."
          />
          <PolicyItem
            title={taxGuide.withholdingRateLabel}
            body="길러 지급액은 사업소득 원천징수 기준을 반영해 실수령액으로 표시됩니다."
          />
          <PolicyItem
            title={taxGuide.annualFilingLabel}
            body={taxGuide.annualFilingBody}
          />
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>안내</Text>
            <Text style={styles.noticeText}>{taxGuide.taxCaution}</Text>
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>최근 수익 내역</Text>
          {payments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>아직 수익 내역이 없습니다.</Text>
              <Text style={styles.emptySubtitle}>
                배송 완료 후 최종 정산 데이터가 정리되면 이곳에 반영됩니다.
              </Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View key={payment.paymentId} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <View>
                    <Text style={styles.recordDate}>
                      {payment.createdAt instanceof Date
                        ? payment.createdAt.toLocaleDateString('ko-KR')
                        : '날짜 정보 없음'}
                    </Text>
                    <Text style={styles.recordDescription}>
                      {payment.description || '정산 지급 완료'}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>지급 완료</Text>
                  </View>
                </View>
                <SettlementRow label="세전 수익" value={payment.amount ?? 0} compact />
                <SettlementRow label="플랫폼 수수료" value={payment.fee ?? 0} negative compact />
                <SettlementRow label="원천징수" value={payment.tax ?? 0} negative compact />
                <SettlementRow label="실수령액" value={payment.netAmount ?? 0} strong compact />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SettlementRow({
  label,
  value,
  negative,
  strong,
  compact,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
  compact?: boolean;
}) {
  const color = strong ? Colors.primary : negative ? Colors.error : Colors.textPrimary;
  const prefix = negative ? '-' : '';

  return (
    <View style={[styles.row, compact ? styles.rowCompact : undefined]}>
      <Text style={[styles.rowLabel, strong ? styles.rowLabelStrong : undefined]}>{label}</Text>
      <Text style={[styles.rowValue, { color }, strong ? styles.rowValueStrong : undefined]}>
        {prefix}
        {value.toLocaleString()}원
      </Text>
    </View>
  );
}

function PolicyItem({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.policyItem}>
      <Text style={styles.policyTitle}>{title}</Text>
      <Text style={styles.policyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primaryMint,
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing['2xl'],
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerKicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTitle: {
    marginTop: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
  },
  heroSubtitle: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.base,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  heroTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  heroCount: {
    marginTop: 4,
    marginBottom: Spacing.md,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowCompact: {
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: Typography.fontSize.base,
    color: Colors.textTertiary,
  },
  rowLabelStrong: {
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  rowValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  rowValueStrong: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  withdrawButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  withdrawButtonText: {
    color: Colors.textWhite,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  withdrawButtonSubtext: {
    marginTop: 4,
    color: Colors.primaryMint,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  policyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  policyItem: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  policyTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  policyBody: {
    marginTop: 6,
    fontSize: Typography.fontSize.sm,
    lineHeight: 19,
    color: Colors.textTertiary,
  },
  noticeBox: {
    marginTop: 6,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.warningLight,
    padding: Spacing.md,
  },
  noticeTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.warningDark,
  },
  noticeText: {
    marginTop: 6,
    fontSize: Typography.fontSize.sm,
    lineHeight: 19,
    color: Colors.warningDark,
  },
  historySection: {
    marginBottom: Spacing['2xl'],
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    lineHeight: 19,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
  recordCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  recordDate: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  recordDescription: {
    marginTop: 4,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  statusBadge: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.successDark,
  },
  previewButtonAlt: {
    backgroundColor: Colors.textTertiary,
  },
  previewButtonSubtextAlt: {
    color: Colors.gray200,
  },
});
