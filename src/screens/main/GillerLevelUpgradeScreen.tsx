import React, { useCallback, useEffect, useState } from 'react';
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
import { createGillerService } from '../../services/giller-service';
import { getUserVerification } from '../../services/verification-service';
import { getBankIntegrationConfig, getPaymentIntegrationConfig } from '../../services/integration-config-service';
import { useUser } from '../../contexts/UserContext';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { GillerProfile } from '../../types/giller';
import { BorderRadius, Shadows, Spacing, Typography, Colors } from '../../theme';

type PromotionEligibility = {
  isEligible: boolean;
  score: number;
};

export default function GillerLevelUpgradeScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, refreshUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<GillerProfile | null>(null);
  const [eligibility, setEligibility] = useState<PromotionEligibility | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [bankStatusMessage, setBankStatusMessage] = useState('확인 중');
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('확인 중');

  const loadUpgradeContext = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const gillerService = createGillerService();
      const [profileData, eligibilityData, verification, bankConfig, paymentConfig] = await Promise.all([
        gillerService.getGillerProfile(),
        gillerService.checkPromotionEligibility(),
        getUserVerification(user.uid),
        getBankIntegrationConfig(),
        getPaymentIntegrationConfig(),
      ]);

      setProfile(profileData);
      setEligibility(eligibilityData);
      setIdentityReady(verification?.status === 'approved');
      setBankStatusMessage(bankConfig.statusMessage);
      setPaymentStatusMessage(paymentConfig.statusMessage);
    } catch (error) {
      console.error('Failed to load giller upgrade context', error);
      Alert.alert('승급 정보를 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadUpgradeContext();
  }, [loadUpgradeContext]);

  async function handlePromote() {
    if (!eligibility?.isEligible) {
      Alert.alert('아직 승급 조건이 부족합니다', '필수 조건을 먼저 확인해 주세요.');
      return;
    }

    if (!identityReady) {
      Alert.alert('본인 확인이 먼저 필요합니다', '길러 승급 전에는 본인 확인을 완료해야 합니다.', [
        { text: '본인 확인하기', onPress: () => navigation.navigate('IdentityVerification') },
        { text: '닫기', style: 'cancel' },
      ]);
      return;
    }

    try {
      setSubmitting(true);
      const service = createGillerService();
      await service.promoteToProfessional();
      await refreshUser();
      await loadUpgradeContext();
      Alert.alert('승급 반영 완료', '길러 승급이 반영되었습니다.');
    } catch (error) {
      console.error('Failed to promote giller', error);
      Alert.alert('승급 처리 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.centerText}>승급 정보를 준비하는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadUpgradeContext()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>가는길에 길러</Text>
        <Text style={styles.title}>승급 준비 상태를 확인하세요.</Text>
        <Text style={styles.subtitle}>실적뿐 아니라 본인 확인, 계좌 준비, 보증금 결제 준비까지 함께 봅니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>현재 상태</Text>
        <MetricRow label="현재 등급" value={profile?.gillerType ?? 'regular'} helper="현재 길러 등급입니다." />
        <MetricRow label="승급 점수" value={`${Math.round(eligibility?.score ?? 0)}점`} helper="80점 이상이면 승급을 검토합니다." />
        <MetricRow label="본인 확인" value={identityReady ? '완료' : '필요'} helper={identityReady ? '본인 확인이 반영됐습니다.' : '승급 전에는 본인 확인이 필요합니다.'} />
        <MetricRow label="계좌 준비" value={bankStatusMessage} helper="정산 계좌 준비 상태입니다." />
        <MetricRow label="보증금 결제 준비" value={paymentStatusMessage} helper="PG 준비가 끝나면 같은 흐름에서 실결제로 이어집니다." />
      </View>

      <View style={styles.actionGroup}>
        <ActionButton label="본인 확인" onPress={() => navigation.navigate('IdentityVerification')} />
        <ActionButton label="지갑/출금 보기" onPress={() => navigation.navigate('PointWithdraw')} />
        <ActionButton label={submitting ? '승급 처리 중...' : '승급 요청 반영'} onPress={() => void handlePromote()} primary disabled={submitting} />
      </View>
    </ScrollView>
  );
}

function MetricRow({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricMain}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricHelper}>{helper}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.actionButton, primary && styles.primaryAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.actionText, primary && styles.primaryActionText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  centerText: { marginTop: Spacing.md, color: Colors.textSecondary, ...Typography.body },
  hero: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 6, ...Shadows.sm },
  kicker: { fontSize: 12, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { color: Colors.textSecondary, ...Typography.body },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md, ...Shadows.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  metricRow: { gap: 6, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  metricMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { color: Colors.textSecondary, ...Typography.bodySmall },
  metricValue: { color: Colors.textPrimary, ...Typography.bodyBold },
  metricHelper: { color: Colors.textTertiary, ...Typography.caption },
  actionGroup: { gap: Spacing.sm },
  actionButton: { minHeight: 52, borderRadius: BorderRadius.xl, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  primaryAction: { backgroundColor: Colors.primary },
  disabledAction: { opacity: 0.6 },
  actionText: { color: Colors.textPrimary, ...Typography.bodyBold },
  primaryActionText: { color: Colors.surface },
});
