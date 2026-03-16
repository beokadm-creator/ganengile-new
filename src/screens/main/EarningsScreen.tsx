/**
 * Earnings Screen
 * 수익 관리 화면 (길러 전용)
 * 총 수익, 정산 내역, 세금, 출금 기능 + 계좌 정보
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUser } from '../../contexts/UserContext';
import {
  getUserPayments,
  getUserMonthlyEarnings,
  Payment,
  PaymentType,
  PaymentStatus,
} from '../../services/payment-service';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

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
    if (!user) return;

    try {
      const now = new Date();
      const [allPayments, monthly] = await Promise.all([
        getUserPayments(user.uid, 30),
        getUserMonthlyEarnings(user.uid, now.getFullYear(), now.getMonth() + 1),
      ]);

      // 길러 수익만 필터
      const earningPayments = allPayments.filter(
        (p) => p.type === PaymentType.GILLER_EARNING && p.status === PaymentStatus.COMPLETED
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
    loadEarnings();
  }, [loadEarnings]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEarnings();
  };

  // 전체 합계 계산
  const totalGross = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalFees = payments.reduce((sum, p) => sum + (p.fee || 0), 0);
  const totalTax = payments.reduce((sum, p) => sum + (p.tax || 0), 0);
  const totalNet = payments.reduce((sum, p) => sum + (p.netAmount || 0), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFC107" />
        <Text style={styles.loadingText}>수익 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>수익 관리</Text>
        <Text style={styles.headerSubtitle}>총 수익과 정산 내역</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 이번 달 요약 */}
        {monthlySummary && (
          <View style={styles.monthlyCard}>
            <Text style={styles.monthlyTitle}>이번 달 수익</Text>
            <Text style={styles.monthlyCount}>{monthlySummary.count}건 완료</Text>
            <View style={styles.monthlyRow}>
              <Text style={styles.monthlyLabel}>총 수익 (세전)</Text>
              <Text style={styles.monthlyValue}>₩{monthlySummary.total.toLocaleString()}</Text>
            </View>
            <View style={styles.monthlyRow}>
              <Text style={styles.monthlyLabel}>플랫폼 수수료 (10%)</Text>
              <Text style={[styles.monthlyValue, { color: '#f44336' }]}>
                -₩{monthlySummary.platformFee.toLocaleString()}
              </Text>
            </View>
            <View style={styles.monthlyRow}>
              <Text style={styles.monthlyLabel}>원천징수세 (3.3%)</Text>
              <Text style={[styles.monthlyValue, { color: '#f44336' }]}>
                -₩{monthlySummary.taxWithheld.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.monthlyRow, styles.monthlyTotalRow]}>
              <Text style={styles.monthlyTotalLabel}>실수익</Text>
              <Text style={styles.monthlyTotalValue}>₩{monthlySummary.netIncome.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Summary Cards (전체) */}
        <View style={styles.summaryContainer}>
          <Text style={styles.sectionTitle}>전체 수익 요약</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>총 수익 (세전)</Text>
            <Text style={styles.summaryValue}>₩{totalGross.toLocaleString()}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>플랫폼 수수료 (10%)</Text>
            <Text style={[styles.summaryValue, { color: '#f44336' }]}>
              -₩{totalFees.toLocaleString()}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>원천징수세 (3.3%)</Text>
            <Text style={[styles.summaryValue, { color: '#f44336' }]}>
              -₩{totalTax.toLocaleString()}
            </Text>
          </View>

          <View style={[styles.summaryCard, styles.summaryCardHighlight]}>
            <Text style={styles.summaryLabel}>총 수익 (세후)</Text>
            <Text style={[styles.summaryValue, styles.summaryValueHighlight]}>
              ₩{totalNet.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Withdraw Button */}
        <TouchableOpacity style={styles.withdrawButton}>
          <Text style={styles.withdrawButtonText}>출금하기</Text>
          <Text style={styles.withdrawButtonSubtext}>최소 ₩10,000부터 출금 가능</Text>
        </TouchableOpacity>

        {/* Earnings History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>수익 내역</Text>

          {payments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>아직 수익 내역이 없습니다.</Text>
              <Text style={styles.emptySubtext}>배송을 완료하면 수익이 쌓입니다.</Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View key={payment.paymentId} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordDate}>
                    {payment.createdAt instanceof Date
                      ? payment.createdAt.toLocaleDateString('ko-KR')
                      : '날짜 없음'}
                  </Text>
                  <View style={[styles.statusBadge, styles.statusCompleted]}>
                    <Text style={styles.statusText}>지급 완료</Text>
                  </View>
                </View>

                <View style={styles.recordDetails}>
                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>기본 요금</Text>
                    <Text style={styles.recordValue}>₩{(payment.amount || 0).toLocaleString()}</Text>
                  </View>

                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>수수료 (10%)</Text>
                    <Text style={[styles.recordValue, { color: '#f44336' }]}>
                      -₩{(payment.fee || 0).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>세금 (3.3%)</Text>
                    <Text style={[styles.recordValue, { color: '#f44336' }]}>
                      -₩{(payment.tax || 0).toLocaleString()}
                    </Text>
                  </View>

                  <View style={[styles.recordRow, styles.recordRowTotal]}>
                    <Text style={styles.recordLabelTotal}>실수익</Text>
                    <Text style={styles.recordValueTotal}>
                      ₩{(payment.netAmount || 0).toLocaleString()}
                    </Text>
                  </View>

                  {payment.description && (
                    <Text style={styles.recordDescription}>{payment.description}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Tax Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeIcon}>ℹ️</Text>
          <Text style={styles.noticeText}>
            연간 수익 300만 원 초과 시 종합소득세 신고가 필요합니다.
            원천징수세는 매월 다음달 10일에 납부됩니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FFC107',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  monthlyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  monthlyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  monthlyCount: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  monthlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  monthlyLabel: {
    fontSize: 13,
    color: '#666',
  },
  monthlyValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  monthlyTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
    paddingTop: 8,
  },
  monthlyTotalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  monthlyTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
  },
  summaryCardHighlight: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValueHighlight: {
    color: '#FFC107',
    fontSize: 22,
  },
  withdrawButton: {
    backgroundColor: '#FFC107',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  withdrawButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#E8F5E9',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  recordDetails: {
    borderTopColor: '#f0f0f0',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  recordRowTotal: {
    borderTopColor: '#f0f0f0',
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  recordLabel: {
    fontSize: 14,
    color: '#666',
  },
  recordLabelTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  recordValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  recordValueTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  recordDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  noticeBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  noticeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 20,
  },
});
