import React, { useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { requireUserId } from '../../services/firebase';
import { EnterpriseLegacySettlementService } from '../../services/enterprise-legacy-settlement-service';
import type { EnterpriseLegacySettlement } from '../../types/enterprise-legacy-settlement';
import type { EnterpriseLegacyStackNavigationProp } from '../../types/navigation';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

interface SettlementSummary {
  totalSettlements: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function getStatusTone(status: EnterpriseLegacySettlement['status']): string {
  switch (status) {
    case 'paid':
      return Colors.success;
    case 'failed':
      return Colors.error;
    default:
      return Colors.warning;
  }
}

export default function MonthlySettlementScreen() {
  const navigation = useNavigation<EnterpriseLegacyStackNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settlements, setSettlements] = useState<EnterpriseLegacySettlement[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);

  useEffect(() => {
    void loadSettlementData();
  }, []);

  async function loadSettlementData(): Promise<void> {
    try {
      const userId = requireUserId();
      const data = await EnterpriseLegacySettlementService.getGillerSettlements(userId);
      const sorted = [...data].sort((a, b) => b.period.start.getTime() - a.period.start.getTime());
      const paidAmount = sorted
        .filter((settlement) => settlement.status === 'paid')
        .reduce((sum, settlement) => sum + settlement.totalSettlement, 0);
      const pendingAmount = sorted
        .filter((settlement) => settlement.status === 'pending_payment')
        .reduce((sum, settlement) => sum + settlement.totalSettlement, 0);

      setSettlements(sorted);
      setSummary({
        totalSettlements: sorted.length,
        totalAmount: paidAmount + pendingAmount,
        paidAmount,
        pendingAmount,
      });
    } catch (error) {
      console.error('Failed to load monthly settlements', error);
      Alert.alert('불러오기 실패', '정산 현황을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    await loadSettlementData();
    setRefreshing(false);
  }

  async function handleExport(settlementId: string): Promise<void> {
    try {
      const report = await EnterpriseLegacySettlementService.generateSettlementReport(settlementId);
      if (!report.success || !report.reportText) {
        Alert.alert('내보내기 실패', report.error ?? '정산 리포트를 만들지 못했습니다.');
        return;
      }

      const html = `
        <html>
          <head><meta charset="utf-8" /></head>
          <body style="font-family: Apple SD Gothic Neo, sans-serif; padding: 24px; white-space: pre-wrap;">${report.reportText}</body>
        </html>
      `;
      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: '정산 리포트 공유',
        });
      }
    } catch (error) {
      console.error('Failed to export settlement report', error);
      Alert.alert('내보내기 실패', '정산 리포트를 내보내지 못했습니다.');
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>월 정산</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        showsVerticalScrollIndicator={false}
      >
        {summary ? (
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>정산 요약</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>정산 건수</Text>
              <Text style={styles.summaryValue}>{summary.totalSettlements}건</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>총 정산액</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>지급 완료</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.paidAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>운영 검토 대기</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.pendingAmount)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>운영 검토 기준</Text>
          <Text style={styles.noticeText}>실지급 자동 이체 대신 운영 수동 검토 후 지급 상태가 갱신됩니다.</Text>
          <Text style={styles.noticeText}>계좌 인증, 세금 처리, 지급 사유 확인이 끝난 뒤 지급 완료로 전환됩니다.</Text>
        </View>

        {settlements.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>아직 생성된 정산이 없습니다.</Text>
            <Text style={styles.emptyText}>월 정산이 생성되면 이 화면에서 운영 검토 상태와 리포트를 확인할 수 있습니다.</Text>
          </View>
        ) : (
          settlements.map((settlement) => (
            <View key={settlement.id} style={styles.settlementCard}>
              <View style={styles.settlementHeader}>
                <View>
                  <Text style={styles.settlementPeriod}>
                    {settlement.period.start.toLocaleDateString('ko-KR')} ~ {settlement.period.end.toLocaleDateString('ko-KR')}
                  </Text>
                  <Text style={styles.settlementMeta}>배송 {settlement.b2bDeliveries}건 · 보너스 {formatCurrency(settlement.monthlyBonus)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusTone(settlement.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusTone(settlement.status) }]}>
                    {EnterpriseLegacySettlementService.getSettlementStatusLabel(settlement.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.settlementAmount}>{formatCurrency(settlement.totalSettlement)}</Text>
              <Text style={styles.reviewNote}>{settlement.reviewNote ?? '운영 검토 메모가 아직 없습니다.'}</Text>

              <View style={styles.settlementFooter}>
                <Text style={styles.transferHint}>
                  {settlement.transferInfo?.bank ? `${settlement.transferInfo.bank} / ${settlement.transferInfo.accountNumber}` : '계좌 정보 확인 필요'}
                </Text>
                <TouchableOpacity style={styles.exportButton} onPress={() => void handleExport(settlement.id)}>
                  <Ionicons name="download-outline" size={16} color={Colors.primary} />
                  <Text style={styles.exportText}>리포트</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  summaryCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  noticeCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  noticeTitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.warningDark,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  noticeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.warningDark,
    lineHeight: 20,
  },
  emptyCard: {
    marginHorizontal: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  settlementCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settlementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  settlementPeriod: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  settlementMeta: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  settlementAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.primary,
    marginTop: Spacing.md,
  },
  reviewNote: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  settlementFooter: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transferHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: Spacing.xl,
  },
});
