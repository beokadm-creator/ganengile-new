import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

export default function RequestConfirmationScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<RouteProp<MainStackParamList, 'RequestConfirmation'>>();
  const { requestId, pickupStationName, deliveryStationName, deliveryFee } = route.params;

  const routeLabel =
    pickupStationName && deliveryStationName
      ? `${pickupStationName} -> ${deliveryStationName}`
      : '출발역과 도착역은 다음 화면에서 다시 확인할 수 있습니다.';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="check-circle" size={56} color=Colors.success />
          </View>
          <Text style={styles.heroTitle}>요청이 접수됐습니다.</Text>
          <Text style={styles.heroBody}>매칭을 시작합니다.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>진행 순서</Text>
          <View style={styles.stepList}>
            <StepRow label="1. 분석" body="요청 확인" />
            <StepRow label="2. 가격" body="제안 확인" />
            <StepRow label="3. 매칭" body="응답 대기" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>요청 요약</Text>
          <InfoRow label="경로" value={routeLabel} />
          <InfoRow label="요청 ID" value={requestId} mono />
          {deliveryFee ? (
            <>
              <InfoRow label="제안 금액" value={`${deliveryFee.totalFee.toLocaleString()}원`} />
              <InfoRow label="예상 시간" value={`${deliveryFee.estimatedTime}분`} />
            </>
          ) : null}
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() =>
              navigation.navigate('MatchingResult', {
                requestId,
                pickupStationName,
                deliveryStationName,
              })
            }
          >
            <Text style={styles.primaryButtonText}>매칭 진행 보기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => navigation.navigate('RequestDetail', { requestId })}
          >
            <Text style={styles.secondaryButtonText}>요청 상세 보기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.ghostButton]}
            onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
          >
            <Text style={styles.ghostButtonText}>홈으로 이동</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function StepRow({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <Text style={styles.stepBody}>{body}</Text>
    </View>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroBody: {
    color: Colors.textSecondary,
    textAlign: 'center',
    ...Typography.body,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  stepList: {
    gap: Spacing.md,
  },
  stepRow: {
    gap: 4,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  stepBody: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  infoLabel: {
    color: Colors.gray500,
    ...Typography.bodySmall,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: Colors.textPrimary,
    ...Typography.bodySmall,
  },
  mono: {
    fontFamily: 'monospace',
  },
  noticeCard: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  noticeBody: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  buttonGroup: {
    gap: Spacing.sm,
  },
  button: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButtonSubtext: {
    marginTop: 4,
    color: Colors.primaryMint,
    fontSize: 12,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    ...Typography.bodyBold,
  },
  ghostButtonText: {
    color: Colors.textSecondary,
    ...Typography.bodyBold,
  },
});
