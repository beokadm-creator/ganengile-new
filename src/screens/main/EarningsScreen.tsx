/**
 * Earnings Screen
 * 수익 관리 화면 (길러 전용)
 * 총 수익, 정산 내역, 세금, 출금 기능
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
import { getUserStats } from '../../services/user-service';
import { useUser } from '../../contexts/UserContext';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface EarningRecord {
  id: string;
  date: string;
  amount: number;
  fee: number;
  tax: number;
  net: number;
  status: 'completed' | 'pending';
}

// 더미데이터
const dummyEarnings: EarningRecord[] = [
  {
    id: '1',
    date: '2026-02-10',
    amount: 5000,
    fee: 500,
    tax: 149,
    net: 4351,
    status: 'completed',
  },
  {
    id: '2',
    date: '2026-02-09',
    amount: 5000,
    fee: 500,
    tax: 149,
    net: 4351,
    status: 'completed',
  },
  {
    id: '3',
    date: '2026-02-08',
    amount: 9000,
    fee: 900,
    tax: 267,
    net: 7833,
    status: 'completed',
  },
  {
    id: '4',
    date: '2026-02-07',
    amount: 5000,
    fee: 500,
    tax: 149,
    net: 4351,
    status: 'pending',
  },
];

export default function EarningsScreen({ navigation }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [earnings, setEarnings] = useState<EarningRecord[]>(dummyEarnings);

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    if (!user) return;

    try {
      const userStats = await getUserStats(user.uid);
      setStats(userStats);
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFC107" />
        <Text style={styles.loadingText}>수익 정보를 불러오는 중...</Text>
      </View>
    );
  }

  // 계산
  const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalFees = earnings.reduce((sum, e) => sum + e.fee, 0);
  const totalTax = earnings.reduce((sum, e) => sum + e.tax, 0);
  const totalNet = earnings.reduce((sum, e) => sum + e.net, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>수익 관리</Text>
        <Text style={styles.headerSubtitle}>총 수익과 정산 내역</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>총 수익 (세전)</Text>
            <Text style={styles.summaryValue}>₩{totalEarnings.toLocaleString()}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>플랫폼 수수료</Text>
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

          {earnings.map((earning) => (
            <View key={earning.id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <Text style={styles.recordDate}>{earning.date}</Text>
                <View style={[
                  styles.statusBadge,
                  earning.status === 'completed' ? styles.statusCompleted : styles.statusPending
                ]}>
                  <Text style={styles.statusText}>
                    {earning.status === 'completed' ? '지급 완료' : '지급 대기'}
                  </Text>
                </View>
              </View>

              <View style={styles.recordDetails}>
                <View style={styles.recordRow}>
                  <Text style={styles.recordLabel}>기본 요금</Text>
                  <Text style={styles.recordValue}>₩{earning.amount.toLocaleString()}</Text>
                </View>

                <View style={styles.recordRow}>
                  <Text style={styles.recordLabel}>수수료 (10%)</Text>
                  <Text style={[styles.recordValue, { color: '#f44336' }]}>
                    -₩{earning.fee.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.recordRow}>
                  <Text style={styles.recordLabel}>세금 (3.3%)</Text>
                  <Text style={[styles.recordValue, { color: '#f44336' }]}>
                    -₩{earning.tax.toLocaleString()}
                  </Text>
                </View>

                <View style={[styles.recordRow, styles.recordRowTotal]}>
                  <Text style={styles.recordLabelTotal}>실수익</Text>
                  <Text style={styles.recordValueTotal}>₩{earning.net.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          ))}
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
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
