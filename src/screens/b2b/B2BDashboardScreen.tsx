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
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface MonthlyStats {
  totalDeliveries: number;
  totalAmount: number;
  avgCostPerDelivery: number;
}

interface TaxInvoice {
  id: string;
  invoiceNumber: string;
  period: string;
  totalAmount: number;
  status: 'issued' | 'paid';
  issuedAt: string;
}

interface Settlement {
  id: string;
  period: string;
  totalAmount: number;
  status: 'pending' | 'completed';
  transferredAt?: string;
}

// TODO: Firebase 연동 후 실제 데이터 사용
const dummyStats: MonthlyStats = {
  totalDeliveries: 127,
  totalAmount: 635000,
  avgCostPerDelivery: 5000,
};

const dummyTaxInvoices: TaxInvoice[] = [
  {
    id: '1',
    invoiceNumber: 'TAX-202601-0001',
    period: '2026년 1월',
    totalAmount: 635000,
    status: 'issued',
    issuedAt: '2026-02-01',
  },
  {
    id: '2',
    invoiceNumber: 'TAX-202512-0001',
    period: '2025년 12월',
    totalAmount: 580000,
    status: 'paid',
    issuedAt: '2026-01-01',
  },
  {
    id: '3',
    invoiceNumber: 'TAX-202511-0001',
    period: '2025년 11월',
    totalAmount: 610000,
    status: 'paid',
    issuedAt: '2025-12-01',
  },
];

const dummySettlements: Settlement[] = [
  {
    id: '1',
    period: '2026년 1월',
    totalAmount: 635000,
    status: 'completed',
    transferredAt: '2026-02-05',
  },
  {
    id: '2',
    period: '2025년 12월',
    totalAmount: 580000,
    status: 'completed',
    transferredAt: '2026-01-05',
  },
];

export default function B2BDashboardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MonthlyStats>(dummyStats);
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>(dummyTaxInvoices);
  const [settlements, setSettlements] = useState<Settlement[]>(dummySettlements);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // TODO: Firebase Firestore에서 데이터 가져오기
      // const statsData = await getB2BStats();
      // const invoicesData = await getTaxInvoices();
      // const settlementsData = await getSettlements();

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
            <Text style={styles.statsPeriod}>2026년 2월</Text>
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
