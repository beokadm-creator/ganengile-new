import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { DepositService } from '../../services/DepositService';
import { PointService } from '../../services/PointService';
import { getPaymentIntegrationConfig } from '../../services/integration-config-service';
import { DEPOSIT_RATE, DepositPaymentMethod } from '../../types/point';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

type DepositPaymentRouteProp = RouteProp<MainStackParamList, 'DepositPayment'>;

export default function DepositPaymentScreen({ navigation, route }: { navigation: MainStackNavigationProp; route: DepositPaymentRouteProp }) {
  const [loading, setLoading] = useState(false);
  const [pointBalance, setPointBalance] = useState(0);
  const [modeTitle, setModeTitle] = useState('결제 준비 상태를 불러오는 중입니다.');
  const [modeBody, setModeBody] = useState('관리자 설정과 현재 결제 공급자 상태를 확인하고 있습니다.');

  const { gillerId, gllerId, requestId, itemValue } = route.params;
  const depositAmount = Math.round(itemValue * DEPOSIT_RATE);
  const pointCoverage = Math.min(pointBalance, depositAmount);
  const pgAmount = Math.max(0, depositAmount - pointCoverage);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [balance, paymentConfig] = await Promise.all([PointService.getBalance(gillerId), getPaymentIntegrationConfig()]);
        if (!mounted) return;
        setPointBalance(balance);
        if (paymentConfig.liveReady && !paymentConfig.testMode) {
          setModeTitle('실서비스 결제 준비 완료');
          setModeBody(`${paymentConfig.provider} 기준으로 보증금 결제 경로가 준비되어 있습니다. 이후 이체와 최종 정산은 운영 검토를 거칩니다.`);
        } else {
          setModeTitle('테스트 또는 운영 검토 모드');
          setModeBody(paymentConfig.statusMessage);
        }
      } catch (error) {
        console.error('Failed to load deposit payment screen', error);
        if (mounted) {
          setModeTitle('기본 결제 모드');
          setModeBody('결제 설정을 읽지 못해 기본 안내 문구를 보여주고 있습니다.');
        }
      }
    }
    void load();
    return () => { mounted = false; };
  }, [gillerId]);

  const summaryRows = useMemo(() => [
    { label: '물품 가치', value: `${itemValue.toLocaleString()}원` },
    { label: `보증금(${Math.round(DEPOSIT_RATE * 100)}%)`, value: `${depositAmount.toLocaleString()}원`, strong: true },
    { label: '포인트 우선 사용', value: `${pointCoverage.toLocaleString()}원` },
    { label: 'PG 또는 테스트 경로', value: `${pgAmount.toLocaleString()}원` },
  ], [depositAmount, itemValue, pgAmount, pointCoverage]);

  async function handlePayment() {
    try {
      setLoading(true);
      const result = await DepositService.payDeposit(gillerId, gllerId, requestId, itemValue);
      if (!result.success) {
        Alert.alert('결제 실패', result.error ?? '보증금 결제 중 문제가 발생했습니다.');
        return;
      }
      Alert.alert('보증금 결제 완료', result.deposit?.paymentMethod === DepositPaymentMethod.MIXED ? '포인트와 결제 경로를 함께 사용해 보증금 준비를 마쳤습니다. 이후 최종 이체와 차감 판단은 운영 검토를 거칩니다.' : '보증금 준비가 완료되었습니다. 이후 배송 결과와 운영 판단에 따라 이체 또는 차감으로 이어집니다.', [{ text: '정산 보기', onPress: () => navigation.navigate('Earnings') }, { text: '닫기', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '보증금 결제 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>가는길에 보증금</Text>
        <Text style={styles.title}>보증금 결제</Text>
        <Text style={styles.subtitle}>배송 시작 전에 필요한 보증금입니다. 결제 준비 상태와 이후 정산 연결을 한 번에 확인합니다.</Text>
      </View>
      <View style={styles.noticeCard}><Text style={styles.noticeTitle}>{modeTitle}</Text><Text style={styles.noticeBody}>{modeBody}</Text></View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>결제 요약</Text>
        {summaryRows.map((row) => <View key={row.label} style={styles.row}><Text style={styles.rowLabel}>{row.label}</Text><Text style={[styles.rowValue, row.strong && styles.rowValueStrong]}>{row.value}</Text></View>)}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>현재 포인트 잔액</Text>
        <Text style={styles.balanceValue}>{pointBalance.toLocaleString()}P</Text>
        <Text style={styles.balanceHint}>포인트가 있으면 먼저 사용하고, 부족한 금액만 결제 공급자 또는 테스트 경로로 이어집니다.</Text>
      </View>
      <View style={styles.policyBox}>
        <Text style={styles.policyTitle}>운영 가드레일</Text>
        <Text style={styles.policyText}>배송 완료 후 보증금 이체 여부는 배송 상태와 운영 검토를 함께 봅니다.</Text>
        <Text style={styles.policyText}>분실, 차감, 패널티, 최종 정산은 AI가 단독으로 확정하지 않습니다.</Text>
      </View>
      <TouchableOpacity style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={() => void handlePayment()} disabled={loading} activeOpacity={0.9}>{loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>{depositAmount.toLocaleString()}원 결제하기</Text>}</TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('PointHistory')} activeOpacity={0.9}><Text style={styles.secondaryButtonText}>지갑으로 돌아가기</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, paddingBottom: 32, gap: Spacing.md },
  hero: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm, ...Shadows.sm },
  kicker: { color: Colors.primary, fontSize: Typography.fontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  title: { color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'], fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, lineHeight: 21 },
  noticeCard: { backgroundColor: Colors.warningLight, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.warning, padding: Spacing.lg, gap: Spacing.sm },
  noticeTitle: { color: Colors.warningDark, fontSize: Typography.fontSize.sm, fontWeight: '800' },
  noticeBody: { color: Colors.warningDark, fontSize: Typography.fontSize.xs, lineHeight: 19 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md, ...Shadows.sm, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  rowLabel: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm },
  rowValue: { color: Colors.textPrimary, fontSize: Typography.fontSize.sm, fontWeight: '700' },
  rowValueStrong: { color: Colors.primary, fontSize: Typography.fontSize.lg, fontWeight: '800' },
  balanceValue: { color: Colors.primary, fontSize: Typography.fontSize['3xl'], fontWeight: '800', textAlign: 'center' },
  balanceHint: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, lineHeight: 20, textAlign: 'center' },
  policyBox: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  policyTitle: { color: Colors.textPrimary, fontWeight: '800' },
  policyText: { color: Colors.textSecondary, lineHeight: 20 },
  primaryButton: { minHeight: 54, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: Colors.white, fontWeight: '800', fontSize: Typography.fontSize.base },
  secondaryButton: { minHeight: 54, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.fontSize.sm },
});
