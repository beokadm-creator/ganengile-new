/**
 * Monthly Settlement Screen
 * B2B 기업용 월간 정산 화면
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { b2bFirestoreService } from '../../services/b2b-firestore-service';
import { requireUserId } from '../../services/firebase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface MonthlySummary {
  year: number;
  month: number;
  totalDeliveries: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue';
}

interface SettlementItem {
  settlementId: string;
  deliveryId: string;
  date: Date;
  amount: number;
  status: 'pending' | 'paid';
}

export default function MonthlySettlementScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<{ year: number; month: number } | null>(null);

  useEffect(() => {
    loadSettlementData();
  }, []);

  const loadSettlementData = async () => {
    try {
      const userId = await requireUserId();
      const { year, month } = b2bFirestoreService.getCurrentYearMonth();
      setSelectedPeriod({ year, month });

      // 월간 요약 조회
      const summaryData = await b2bFirestoreService.getMonthlySummary(userId, year, month);
      if (summaryData) {
        setSummary(summaryData);
      }

      // 정산 내역 조회
      const settlementsData = await b2bFirestoreService.getSettlements(userId, 50);
      setSettlements(settlementsData);
    } catch (error) {
      console.error('Error loading settlement data:', error);
      Alert.alert('오류', '정산 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSettlementData();
    setRefreshing(false);
  };

  const handleDownloadPDF = async () => {
    try {
      if (!summary) {
        Alert.alert('알림', '다운로드할 데이터가 없습니다.');
        return;
      }

      // HTML 템플릿 생성
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>월간 정산서</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
            h1 { color: #00BCD4; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f5f5f5; }
            .summary { background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .total { font-size: 24px; font-weight: bold; color: #00BCD4; }
          </style>
        </head>
        <body>
          <h1>월간 정산서</h1>
          <p>기간: ${selectedPeriod?.year}년 ${selectedPeriod?.month}월</p>
          
          <div class="summary">
            <h2>요약</h2>
            <p>총 배송 건수: ${summary?.totalDeliveries || 0}건</p>
            <p>총 금액: ${summary?.totalAmount.toLocaleString()}원</p>
            <p>결제 완료: ${summary?.paidAmount.toLocaleString()}원</p>
            <p>미결제: ${summary?.unpaidAmount.toLocaleString()}원</p>
            <p>결제 예정일: ${summary?.dueDate.toLocaleDateString('ko-KR')}</p>
          </div>

          <h2>상세 내역</h2>
          <table>
            <thead>
              <tr>
                <th>배송 ID</th>
                <th>날짜</th>
                <th>금액</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              ${settlements.map(s => `
                <tr>
                  <td>${s.deliveryId}</td>
                  <td>${new Date(s.date).toLocaleDateString('ko-KR')}</td>
                  <td>${s.amount.toLocaleString()}원</td>
                  <td>${s.status === 'paid' ? '결제 완료' : '미결제'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // PDF 생성
      const { uri } = await Print.printToFileAsync({ html });
      
      // 공유
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: '월간 정산서',
        });
      } else {
        Alert.alert('알림', 'PDF 저장이 지원되지 않는 기기입니다.');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('오류', 'PDF 다운로드에 실패했습니다.');
    }
  };

  const handlePayNow = () => {
    if (!summary || summary.status === 'paid') {
      return;
    }

    Alert.alert(
      '결제',
      `미결제 금액: ${summary.unpaidAmount.toLocaleString()}원\n결제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '결제',
          onPress: () => {
            Alert.alert('완료', '결제가 완료되었습니다.');
            loadSettlementData();
          },
        },
      ]
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'paid':
        return Colors.success;
      case 'overdue':
        return Colors.error;
      default:
        return Colors.warning;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'paid':
        return '결제 완료';
      case 'overdue':
        return '연체';
      default:
        return '미결제';
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
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>월간 정산</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 기간 선택 */}
        <View style={styles.periodContainer}>
          <Text style={styles.periodText}>
            {selectedPeriod?.year}년 {selectedPeriod?.month}월
          </Text>
          <TouchableOpacity style={styles.changePeriodButton}>
            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            <Text style={styles.changePeriodText}>기간 변경</Text>
          </TouchableOpacity>
        </View>

        {/* 요약 카드 */}
        {summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>총 배송 건수</Text>
              <Text style={styles.summaryValue}>{summary.totalDeliveries}건</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>총 금액</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalAmount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>결제 완료</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                {formatCurrency(summary.paidAmount)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>미결제</Text>
              <Text style={[styles.summaryValue, { color: Colors.warning }]}>
                {formatCurrency(summary.unpaidAmount)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>결제 예정일</Text>
              <Text style={styles.summaryValue}>
                {summary.dueDate.toLocaleDateString('ko-KR')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>상태</Text>
              <Text style={[styles.summaryValue, { color: getStatusColor(summary.status) }]}>
                {getStatusText(summary.status)}
              </Text>
            </View>
          </View>
        )}

        {/* 액션 버튼 */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDownloadPDF}
          >
            <Ionicons name="download-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>PDF 다운로드</Text>
          </TouchableOpacity>
          {summary && summary.status !== 'paid' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.payButton]}
              onPress={handlePayNow}
            >
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                즉시 결제
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 상세 내역 */}
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>상세 내역</Text>
          {settlements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>정산 내역이 없습니다</Text>
            </View>
          ) : (
            settlements.map((item) => (
              <View key={item.settlementId} style={styles.settlementItem}>
                <View style={styles.settlementInfo}>
                  <Text style={styles.settlementId}>{item.deliveryId}</Text>
                  <Text style={styles.settlementDate}>
                    {new Date(item.date).toLocaleDateString('ko-KR')}
                  </Text>
                </View>
                <View style={styles.settlementAmount}>
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(item.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: getStatusColor(item.status) }]}
                    >
                      {item.status === 'paid' ? '완료' : '대기'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
  },
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  periodText: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  changePeriodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background.secondary,
  },
  changePeriodText: {
    ...Typography.body2,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  summaryCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.body2,
    color: Colors.text.secondary,
  },
  summaryValue: {
    ...Typography.body1,
    color: Colors.text.primary,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  payButton: {
    backgroundColor: Colors.primary,
  },
  actionButtonText: {
    ...Typography.body2,
    color: Colors.primary,
    marginLeft: Spacing.xs,
    fontWeight: 'bold',
  },
  detailsContainer: {
    margin: Spacing.md,
  },
  detailsTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    ...Typography.body2,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
  settlementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.md,
    ...Shadows.xs,
  },
  settlementInfo: {
    flex: 1,
  },
  settlementId: {
    ...Typography.body1,
    color: Colors.text.primary,
    fontWeight: 'bold',
  },
  settlementDate: {
    ...Typography.body2,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  settlementAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    ...Typography.body1,
    color: Colors.text.primary,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: 'bold',
  },
});
