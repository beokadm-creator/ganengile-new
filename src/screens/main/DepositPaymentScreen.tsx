import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DepositService } from '../../services/DepositService';
import { PointService } from '../../services/PointService';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface RouteParams {
  gillerId: string;
  gllerId: string;
  requestId: string;
  itemValue: number;
}

export default function DepositPaymentScreen({ navigation }: { navigation: NavigationProp }) {
  const [loading, setLoading] = useState(false);
  const [pointBalance, setPointBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'auto' | 'tosspayments'>('auto');

  const route = navigation.getState().routes.find(
    route => route.name === 'DepositPayment'
  )?.params as RouteParams || {
    gillerId: '',
    gllerId: '',
    requestId: '',
    itemValue: 0,
  };

  const depositAmount = Math.round(route.itemValue * 0.8);

  const pointCoverage = Math.min(pointBalance, depositAmount);
  const tossAmount = depositAmount - pointCoverage;

  useEffect(() => {
    loadPointBalance();
  }, []);

  const loadPointBalance = async () => {
    try {
      const balance = await PointService.getBalance(route.gillerId);
      setPointBalance(balance);
    } catch (error) {
      console.error('Failed to load point balance:', error);
    }
  };

  const handlePayment = async () => {
    if (paymentMethod === 'auto') {
      setPaymentMethod('tosspayments');
      return;
    }

    try {
      setLoading(true);

      const result = await DepositService.payDeposit(
        route.gillerId,
        route.gllerId,
        route.requestId,
        route.itemValue
      );

      if (result.success) {
        Alert.alert(
          '보증금 결제 완료',
          `보증금 ${depositAmount.toLocaleString()}원이 정상적으로 결제되었습니다.\n\n배송을 시작합니다.`,
          [
            {
              text: '확인',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('결제 실패', result.error || '결제 처리 중 오류가 발생했습니다.');
      }
    } catch (error: any) {
      Alert.alert('오류', error.message || '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>보증금 결제</Text>
          <Text style={styles.headerSubtitle}>
            배송을 수락하기 위해 보증금을 납부해주세요
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>보증금 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>물건 가치</Text>
            <Text style={styles.infoValue}>
              {route.itemValue.toLocaleString()}원
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>보증금 (80%)</Text>
            <Text style={styles.depositAmount}>
              {depositAmount.toLocaleString()}원
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>현재 포인트</Text>
          <Text style={styles.pointBalance}>
            {pointBalance.toLocaleString()} P
          </Text>
        </View>

        <Text style={styles.sectionTitle}>결제 방식</Text>

        {pointBalance < depositAmount && pointBalance > 0 && (
          <View style={styles.paymentMethodCard}>
            <Text style={styles.paymentMethodTitle}>
              포인트 + 토스페이먼츠 혼합
            </Text>
            <View style={styles.paymentBreakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>포인트</Text>
                <Text style={styles.breakdownValue}>
                  -{pointCoverage.toLocaleString()}원
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>토스페이먼츠</Text>
                <Text style={styles.breakdownValue}>
                  -{tossAmount.toLocaleString()}원
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>총 결제</Text>
                <Text style={styles.breakdownValueTotal}>
                  {depositAmount.toLocaleString()}원
                </Text>
              </View>
            </View>
          </View>
        )}

        {pointBalance >= depositAmount && (
          <View style={styles.paymentMethodCard}>
            <Text style={styles.paymentMethodTitle}>
              포인트 결제
            </Text>
            <View style={styles.paymentBreakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>포인트</Text>
                <Text style={styles.breakdownValue}>
                  -{depositAmount.toLocaleString()}원
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>총 결제</Text>
                <Text style={styles.breakdownValueTotal}>
                  {depositAmount.toLocaleString()}원
                </Text>
              </View>
            </View>
          </View>
        )}

        {pointBalance === 0 && (
          <View style={styles.paymentMethodCard}>
            <Text style={styles.paymentMethodTitle}>
              토스페이먼츠 결제
            </Text>
            <View style={styles.paymentBreakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>토스페이먼츠</Text>
                <Text style={styles.breakdownValue}>
                  -{depositAmount.toLocaleString()}원
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>총 결제</Text>
                <Text style={styles.breakdownValueTotal}>
                  {depositAmount.toLocaleString()}원
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.policyBox}>
          <Text style={styles.policyTitle}>보증금 정책</Text>
          <Text style={styles.policyItem}>• 배송 완료 시 보증금 환급</Text>
          <Text style={styles.policyItem}>• 사고/분실 시 보증금 100% 차감</Text>
          <Text style={styles.policyItem}>
            • 추가 페널티: 평점 하락, 정지 등
          </Text>
        </View>

        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payButtonText}>
              {depositAmount.toLocaleString()}원 결제하기
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>취소</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  infoValue: {
    ...Typography.h4,
    fontWeight: '600',
    color: Colors.text,
  },
  depositAmount: {
    ...Typography.h2,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  pointBalance: {
    ...Typography.h1,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  paymentMethodCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  paymentMethodTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  paymentBreakdown: {
    marginTop: Spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  breakdownLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  breakdownValue: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  breakdownValueTotal: {
    ...Typography.h4,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  policyBox: {
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  policyTitle: {
    ...Typography.h4,
    color: Colors.accent,
    marginBottom: Spacing.sm,
  },
  policyItem: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  payButtonText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
});
