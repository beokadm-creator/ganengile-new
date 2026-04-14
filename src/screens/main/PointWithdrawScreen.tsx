import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useUser } from '../../contexts/UserContext';
import { PointService } from '../../services/PointService';
import { getBeta1HomeSnapshot } from '../../services/beta1-orchestration-service';
import { getBankIntegrationConfig } from '../../services/integration-config-service';
import { getWithdrawalEligibility } from '../../services/beta1-wallet-service';
import { WithdrawalEligibilityStatus } from '../../types/beta1-wallet';
import type { MainStackNavigationProp } from '../../types/navigation';
import { BorderRadius, Colors, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';
import { TaxInfoRegistrationModal } from '../../components/tax/TaxInfoRegistrationModal';

type Props = {
  navigation: MainStackNavigationProp;
};

export default function PointWithdrawScreen({ navigation }: Props) {
  const { user, refreshUser } = useUser();
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [withdrawable, setWithdrawable] = useState(0);
  const [bankStatusMessage, setBankStatusMessage] = useState('계좌 인증 상태를 확인하고 있습니다.');
  const [eligibilityReasons, setEligibilityReasons] = useState<WithdrawalEligibilityStatus[]>([]);
  const [showTaxModal, setShowTaxModal] = useState(false);

  const loadWithdrawContext = useCallback(async () => {
    if (!user?.uid) {
      setInitializing(false);
      return;
    }

    try {
      const [snapshot, bankConfig, eligibility] = await Promise.all([
        getBeta1HomeSnapshot(user.uid, 'requester'),
        getBankIntegrationConfig(),
        getWithdrawalEligibility(user.uid),
      ]);

      setWithdrawable(snapshot.wallet.withdrawableBalance);
      setAccountHolder(user.name ?? '');
      setBankStatusMessage(bankConfig.statusMessage);
      setEligibilityReasons(eligibility.reasons);
    } catch (error) {
      console.error('Failed to load withdrawal context', error);
      Alert.alert('출금 정보를 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setInitializing(false);
    }
  }, [user?.name, user?.uid]);

  useEffect(() => {
    void loadWithdrawContext();
  }, [loadWithdrawContext]);

  const submit = async () => {
    const numericAmount = Number(amount || 0);

    if (!user?.uid || !numericAmount || !bankName || !accountNumber || !accountHolder) {
      Alert.alert('입력 확인', '출금 금액과 계좌 정보를 다시 확인해 주세요.');
      return;
    }

    if (!user.taxInfo?.residentNumberEncrypted) {
      setShowTaxModal(true);
      return;
    }

    if (numericAmount > withdrawable) {
      Alert.alert('출금 금액 확인', '출금 가능한 정산금보다 큰 금액은 요청할 수 없습니다.');
      return;
    }

    setLoading(true);
    try {
      const eligibility = await getWithdrawalEligibility(user.uid, numericAmount);
      if (!eligibility.allowed) {
        Alert.alert('출금 조건 확인', getEligibilityMessage(eligibility.reasons));
        return;
      }

      await PointService.requestWithdrawal({
        userId: user.uid,
        amount: numericAmount,
        bankName,
        accountNumber,
        accountHolder,
      });

      Alert.alert(
        '출금 요청이 접수됐습니다',
        '운영 검토 후 실제 이체가 진행됩니다. 진행 상태는 지갑 내역과 관리자 처리 단계에 함께 반영됩니다.',
        [{ text: '확인', onPress: () => navigation.goBack() }]
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : '출금 요청 중 문제가 발생했습니다.';
      Alert.alert('출금 요청 실패', message);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>출금 가능 조건을 확인하는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>withdrawal guard</Text>
        <Text style={styles.title}>정산금은 조건을 확인한 뒤 출금됩니다</Text>
        <Text style={styles.subtitle}>
          본인 확인, 계좌 인증, 분쟁 여부, 운영 보류 상태를 먼저 보고 안전한 요청만 접수합니다.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>계좌 준비 상태</Text>
        <Text style={styles.noticeText}>{bankStatusMessage}</Text>
      </View>

      <View style={styles.guardCard}>
        <Text style={styles.guardTitle}>출금 체크리스트</Text>
        <GuardRow
          ok={!eligibilityReasons.includes(WithdrawalEligibilityStatus.IDENTITY_UNVERIFIED)}
          label="본인 확인 또는 테스트 우회 준비가 반영되어 있어야 합니다."
        />
        <GuardRow
          ok={!eligibilityReasons.includes(WithdrawalEligibilityStatus.DISPUTE_OPEN)}
          label="열려 있는 분쟁이 없어야 합니다."
        />
        <GuardRow
          ok={!eligibilityReasons.includes(WithdrawalEligibilityStatus.MANUAL_HOLD)}
          label="수동 보류 상태가 없어야 합니다."
        />
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>현재 출금 가능한 정산금</Text>
        <Text style={styles.balanceValue}>{withdrawable.toLocaleString()}원</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('PointHistory')}>
            <Text style={styles.secondaryButtonText}>지갑 내역 보기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Earnings')}>
            <Text style={styles.secondaryButtonText}>정산 기준 보기</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formCard}>
        <Field label="출금 금액" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
        <Field label="은행명" value={bankName} onChangeText={setBankName} />
        <Field label="계좌번호" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" />
        <Field label="예금주" value={accountHolder} onChangeText={setAccountHolder} />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={() => {
          void submit();
        }}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitButtonText}>출금 요청하기</Text>}
      </TouchableOpacity>

      <TaxInfoRegistrationModal
        visible={showTaxModal}
        onClose={() => setShowTaxModal(false)}
        onSuccess={async () => {
          setShowTaxModal(false);
          if (refreshUser) {
            await refreshUser();
          }
          Alert.alert('알림', '정보가 등록되었습니다. 다시 출금 요청을 눌러주세요.');
        }}
      />
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

function GuardRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.guardRow}>
      <Text style={[styles.guardState, ok ? styles.guardStateOk : styles.guardStateBad]}>
        {ok ? '확인됨' : '보완 필요'}
      </Text>
      <Text style={styles.guardText}>{label}</Text>
    </View>
  );
}

function getEligibilityMessage(reasons: WithdrawalEligibilityStatus[]) {
  const labels: Record<WithdrawalEligibilityStatus, string> = {
    [WithdrawalEligibilityStatus.ELIGIBLE]: '출금이 가능합니다.',
    [WithdrawalEligibilityStatus.INSUFFICIENT_BALANCE]: '출금 가능한 정산금이 부족합니다.',
    [WithdrawalEligibilityStatus.BELOW_MINIMUM]: '최소 출금 금액을 충족해야 합니다.',
    [WithdrawalEligibilityStatus.IDENTITY_UNVERIFIED]: '본인 확인 또는 테스트 우회 준비가 필요합니다.',
    [WithdrawalEligibilityStatus.PAYOUT_ACCOUNT_UNVERIFIED]: '계좌 인증 또는 운영 확인이 필요합니다.',
    [WithdrawalEligibilityStatus.ACCOUNT_OWNER_MISMATCH]: '예금주 일치 여부를 다시 확인해 주세요.',
    [WithdrawalEligibilityStatus.RISK_REVIEW_REQUIRED]: '운영 수동 검토가 필요합니다.',
    [WithdrawalEligibilityStatus.DISPUTE_OPEN]: '열려 있는 분쟁이 있어 출금이 보류됩니다.',
    [WithdrawalEligibilityStatus.MANUAL_HOLD]: '수동 보류 상태라 운영 확인이 필요합니다.',
  };

  return reasons.map((reason) => labels[reason]).join('\n');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  hero: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  kicker: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  noticeCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  noticeTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.warningDark,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.warningDark,
    lineHeight: 20,
  },
  guardCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 10,
  },
  guardTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  guardRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  guardState: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.extrabold,
    minWidth: 60,
  },
  guardStateOk: {
    color: Colors.success,
  },
  guardStateBad: {
    color: Colors.error,
  },
  guardText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  balanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: 12,
  },
  balanceLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  balanceValue: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryButton: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: Colors.success,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.extrabold,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.gray700,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
  },
});
