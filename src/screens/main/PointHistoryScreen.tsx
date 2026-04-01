import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useUser } from '../../contexts/UserContext';
import { getBeta1HomeSnapshot } from '../../services/beta1-orchestration-service';
import { PointService } from '../../services/PointService';
import { BorderRadius, Shadows, Spacing, Typography } from '../../theme';
import { WithdrawalEligibilityStatus } from '../../types/beta1-wallet';
import type { MainStackNavigationProp } from '../../types/navigation';

type Props = {
  navigation: MainStackNavigationProp;
};

type WalletSnapshot = {
  chargeBalance: number;
  earnedBalance: number;
  promoBalance: number;
  pendingWithdrawalBalance: number;
  withdrawableBalance: number;
};

export default function PointHistoryScreen({ navigation }: Props) {
  const { user } = useUser();
  const [wallet, setWallet] = useState<WalletSnapshot>({
    chargeBalance: 0,
    earnedBalance: 0,
    promoBalance: 0,
    pendingWithdrawalBalance: 0,
    withdrawableBalance: 0,
  });
  const [eligibilityReasons, setEligibilityReasons] = useState<WithdrawalEligibilityStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!user?.uid) {
        return;
      }

      const [snapshot, summary] = await Promise.all([
        getBeta1HomeSnapshot(user.uid, 'requester'),
        PointService.getSummary(user.uid),
      ]);

      if (!active) {
        return;
      }

      setWallet(snapshot.wallet);
      setEligibilityReasons(summary.withdrawalEligibility?.reasons ?? []);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  async function refreshWallet() {
    if (!user?.uid) {
      setRefreshing(false);
      return;
    }

    const [snapshot, summary] = await Promise.all([
      getBeta1HomeSnapshot(user.uid, 'requester'),
      PointService.getSummary(user.uid),
    ]);

    setWallet(snapshot.wallet);
    setEligibilityReasons(summary.withdrawalEligibility?.reasons ?? []);
    setRefreshing(false);
  }

  const rows = [
    {
      label: '충전금',
      value: wallet.chargeBalance,
      hint: '결제와 보증금 결제에 먼저 사용되는 금액입니다.',
    },
    {
      label: '정산금',
      value: wallet.earnedBalance,
      hint: '길러 수익으로 적립된 금액입니다.',
    },
    {
      label: '프로모션',
      value: wallet.promoBalance,
      hint: '이벤트 또는 보상으로 적립된 금액입니다.',
    },
    {
      label: '출금 대기',
      value: wallet.pendingWithdrawalBalance,
      hint: '운영 검토 또는 실제 이체 처리 중인 금액입니다.',
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void refreshWallet();
          }}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>wallet ledger</Text>
        <Text style={styles.title}>지갑은 하나지만 성격은 나눠서 봅니다</Text>
        <Text style={styles.subtitle}>
          충전금, 정산금, 프로모션, 출금 대기를 분리해서 보고 출금 가능 조건도 바로 확인할 수 있습니다.
        </Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>출금 가능한 정산금</Text>
        <Text style={styles.totalValue}>{wallet.withdrawableBalance.toLocaleString()}원</Text>
        <View style={styles.totalActions}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('PointWithdraw')}>
            <Text style={styles.primaryButtonText}>출금 요청하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Earnings')}>
            <Text style={styles.secondaryButtonText}>정산 기준 보기</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.guardCard}>
        <Text style={styles.guardTitle}>출금 체크</Text>
        <GuardRow
          ok={!eligibilityReasons.includes(WithdrawalEligibilityStatus.IDENTITY_UNVERIFIED)}
          label="본인 확인 또는 테스트 우회 준비"
        />
        <GuardRow
          ok={!eligibilityReasons.includes(WithdrawalEligibilityStatus.PAYOUT_ACCOUNT_UNVERIFIED)}
          label="정산 계좌 인증 또는 운영 확인"
        />
        <GuardRow
          ok={!eligibilityReasons.includes(WithdrawalEligibilityStatus.DISPUTE_OPEN)}
          label="열려 있는 분쟁 없음"
        />
        <GuardRow
          ok={!eligibilityReasons.includes(WithdrawalEligibilityStatus.MANUAL_HOLD)}
          label="수동 보류 상태 없음"
        />
      </View>

      {rows.map((row) => (
        <View key={row.label} style={styles.rowCard}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value.toLocaleString()}원</Text>
          </View>
          <Text style={styles.rowHint}>{row.hint}</Text>
        </View>
      ))}
    </ScrollView>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  hero: {
    backgroundColor: '#EEF2FF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338CA',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: '#475569',
    lineHeight: 20,
  },
  totalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: 12,
  },
  totalLabel: {
    fontSize: Typography.fontSize.sm,
    color: '#64748B',
  },
  totalValue: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: '800',
    color: '#0F172A',
  },
  totalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0F766E',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF3',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#115E59',
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  guardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 10,
  },
  guardTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    color: '#111827',
  },
  guardRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  guardState: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    minWidth: 60,
  },
  guardStateOk: {
    color: '#047857',
  },
  guardStateBad: {
    color: '#B91C1C',
  },
  guardText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: '#475569',
    lineHeight: 20,
  },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: '#111827',
  },
  rowValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    color: '#0F172A',
  },
  rowHint: {
    fontSize: Typography.fontSize.sm,
    color: '#64748B',
    lineHeight: 20,
  },
});
