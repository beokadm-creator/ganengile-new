/**
 * B2B Dashboard Screen
 * B2B 기업 전용 대시보드
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
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { b2bFirestoreService, MonthlyStats, TaxInvoice, Settlement } from '../../services/b2b-firestore-service';
import { auth } from '../../services/firebase';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

export default function B2BDashboardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MonthlyStats>({
    totalDeliveries: 0,
    totalAmount: 0,
    avgCostPerDelivery: 0,
  });
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 현재 사용자 확인
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('No authenticated user');
        setLoading(false);
        return;
      }

      const businessId = currentUser.uid;
      const { year, month } = b2bFirestoreService.getCurrentYearMonth();

      // 현재 기간 설정
      setCurrentPeriod(b2bFirestoreService.getPeriodText(year, month));

      // 병렬로 데이터 가져오기
      const [statsData, invoicesData, settlementsData] = await Promise.all([
        b2bFirestoreService.getMonthlyStats(businessId, year, month),
        b2bFirestoreService.getTaxInvoices(businessId, 10),
        b2bFirestoreService.getSettlements(businessId, 10),
      ]);

      // 데이터 업데이트
      if (statsData) {
        setStats(statsData);
      }

      if (invoicesData.length > 0) {
        setTaxInvoices(invoicesData);
      }

      if (settlementsData.length > 0) {
        setSettlements(settlementsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'issued':
      case 'pending':
        return Colors.warning;
      case 'paid':
      case 'completed':
        return Colors.success;
      default:
        return Colors.text.tertiary;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'issued':
        return '발행완료';
      case 'paid':
        return '지급완료';
      case 'pending':
        return '대기중';
      case 'completed':
        return '정산완료';
      default:
        return status;
    }
  };

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
          <Text style={styles.title}>B2B 대시보드</Text>
          <Text style={styles.subtitle}>기업 배송 현황을 한눈에 확인하세요.</Text>
        </View>

        {/* Monthly Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>📊 월간 현황</Text>
            <Text style={styles.statsPeriod}>{currentPeriod || '로딩 중...'}</Text>
          </View>

          <View style={styles.statsCards}>
            <View style={styles.statsCard}>
              <Text style={styles.statsCardLabel}>총 배송 건수</Text>
              <Text style={styles.statsCardValue}>{stats.totalDeliveries}건</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsCardLabel}>총 배송 금액</Text>
              <Text style={styles.statsCardValue}>{formatCurrency(stats.totalAmount)}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsCardLabel}>건당 평균 비용</Text>
              <Text style={styles.statsCardValue}>{formatCurrency(stats.avgCostPerDelivery)}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('B2BRequest')}
          >
            <Text style={styles.actionButtonIcon}>📦</Text>
            <Text style={styles.actionButtonText}>배송 요청</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('B2BGiller')}
          >
            <Text style={styles.actionButtonIcon}>👥</Text>
            <Text style={styles.actionButtonText}>길러 관리</Text>
          </TouchableOpacity>
        </View>

        {/* Tax Invoices */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🧾 세금계산서</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>전체보기</Text>
            </TouchableOpacity>
          </View>

          {taxInvoices.map((invoice) => (
            <View key={invoice.id} style={styles.invoiceCard}>
              <View style={styles.invoiceHeader}>
                <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                <Text style={[styles.invoiceStatus, { color: getStatusColor(invoice.status) }]}>
                  {getStatusText(invoice.status)}
                </Text>
              </View>
              <Text style={styles.invoicePeriod}>{invoice.period}</Text>
              <Text style={styles.invoiceAmount}>{formatCurrency(invoice.totalAmount)}</Text>
            </View>
          ))}
        </View>

        {/* Settlements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💰 정산 내역</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>전체보기</Text>
            </TouchableOpacity>
          </View>

          {settlements.map((settlement) => (
            <View key={settlement.id} style={styles.settlementCard}>
              <View style={styles.settlementHeader}>
                <Text style={styles.settlementPeriod}>{settlement.period}</Text>
                <Text style={[styles.settlementStatus, { color: getStatusColor(settlement.status) }]}>
                  {getStatusText(settlement.status)}
                </Text>
              </View>
              <View style={styles.settlementDetails}>
                <Text style={styles.settlementAmount}>{formatCurrency(settlement.totalAmount)}</Text>
                {settlement.transferredAt && (
                  <Text style={styles.settlementDate}>
                    이체: {settlement.transferredAt}
                  </Text>
                )}
              </View>
            </View>
          ))}
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
  statsContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statsTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  statsPeriod: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  statsCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsCard: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
  },
  statsCardLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  statsCardValue: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xs,
    alignItems: 'center',
    ...Shadows.sm,
  },
  actionButtonIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  actionButtonText: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  viewAll: {
    ...Typography.body,
    color: Colors.primary,
  },
  invoiceCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  invoiceNumber: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
  },
  invoiceStatus: {
    ...Typography.caption,
    fontWeight: 'bold',
  },
  invoicePeriod: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  invoiceAmount: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  settlementCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  settlementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  settlementPeriod: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
  },
  settlementStatus: {
    ...Typography.caption,
    fontWeight: 'bold',
  },
  settlementDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settlementAmount: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  settlementDate: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
});
