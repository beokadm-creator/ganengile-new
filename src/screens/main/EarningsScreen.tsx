import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ParamListBase } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUser } from '../../contexts/UserContext';
import {
  getUserMonthlyEarnings,
  getUserPayments,
  Payment,
  PaymentStatus,
  PaymentType,
} from '../../services/payment-service';
import { SETTLEMENT_POLICY, SETTLEMENT_POLICY_LABELS } from '../../constants/settlementPolicy';

type NavigationProp = StackNavigationProp<ParamListBase>;

interface Props {
  navigation: NavigationProp;
}

const TAX_GUIDE = {
  platformFeeRateLabel: SETTLEMENT_POLICY_LABELS.platformFee,
  withholdingRateLabel: SETTLEMENT_POLICY_LABELS.combinedWithholding,
  annualFilingLabel: '종합소득세 신고 안내',
  annualFilingBody: `연간 지급 내역은 ${SETTLEMENT_POLICY.annualFilingWindowLabel} 종합소득세 신고 때 참고해야 합니다. 최종 신고 의무와 필요 서류는 개인 상황에 따라 달라질 수 있습니다.`,
  taxCaution: SETTLEMENT_POLICY.caution,
};

export default function EarningsScreen({ navigation }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
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
      const [allPayments, monthly] = await Promise.all([
        getUserPayments(user.uid, 30),
        getUserMonthlyEarnings(user.uid, now.getFullYear(), now.getMonth() + 1),
      ]);

      const earningPayments = allPayments.filter(
        (payment) =>
          payment.type === PaymentType.GILLER_EARNING &&
          payment.status === PaymentStatus.COMPLETED
      );

      setPayments(earningPayments);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>정산 데이터를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerKicker}>giller settlement</Text>
        <Text style={styles.headerTitle}>수익과 정산 기준</Text>
        <Text style={styles.headerSubtitle}>
          매출, 플랫폼 수수료, 원천징수 3.3%, 실수령액을 분리해서 보여줍니다.
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
            <SettlementRow label={TAX_GUIDE.platformFeeRateLabel} value={monthlySummary.platformFee} negative />
            <SettlementRow label={TAX_GUIDE.withholdingRateLabel} value={monthlySummary.taxWithheld} negative />
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

        <TouchableOpacity style={styles.withdrawButton} onPress={() => navigation.navigate('PointWithdraw')}>
          <Text style={styles.withdrawButtonText}>정산금 출금하기</Text>
          <Text style={styles.withdrawButtonSubtext}>
            출금 전에는 계좌 상태, 본인 확인, 운영 검토 여부를 먼저 확인합니다.
          </Text>
        </TouchableOpacity>

        <View style={styles.policyCard}>
          <Text style={styles.sectionTitle}>세금과 정산 안내</Text>
          <PolicyItem
            title={TAX_GUIDE.platformFeeRateLabel}
            body="배송 수익 정산 전 플랫폼 수수료가 먼저 반영됩니다."
          />
          <PolicyItem
            title={TAX_GUIDE.withholdingRateLabel}
            body="길러 지급액은 사업소득 원천징수 기준을 반영해 실수령액으로 표시됩니다."
          />
          <PolicyItem
            title={TAX_GUIDE.annualFilingLabel}
            body={TAX_GUIDE.annualFilingBody}
          />
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>안내</Text>
            <Text style={styles.noticeText}>{TAX_GUIDE.taxCaution}</Text>
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
  const color = strong ? '#0F766E' : negative ? '#DC2626' : '#0F172A';
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
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerKicker: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTitle: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 8,
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  heroCount: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    color: '#64748B',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  rowCompact: {
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  rowLabelStrong: {
    fontWeight: '700',
    color: '#0F172A',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowValueStrong: {
    fontSize: 18,
    fontWeight: '800',
  },
  withdrawButton: {
    backgroundColor: '#0F766E',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  withdrawButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  withdrawButtonSubtext: {
    marginTop: 4,
    color: '#CCFBF1',
    fontSize: 12,
    lineHeight: 18,
  },
  policyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  policyItem: {
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 14,
    marginBottom: 10,
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  policyBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },
  noticeBox: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    padding: 14,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  noticeText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
  },
  historySection: {
    marginBottom: 24,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
    textAlign: 'center',
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recordDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  recordDescription: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
  },
  statusBadge: {
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
});
