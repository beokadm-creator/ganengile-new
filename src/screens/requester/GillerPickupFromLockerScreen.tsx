import { Colors } from '../../theme';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { confirmDeliveryByRequester, getDeliveryByRequestId } from '../../services/delivery-service';
import { createLockerService, getLocker, openLocker, completeLockerReservation } from '../../services/locker-service';
import { requireUserId } from '../../services/firebase';
import type { Locker, LockerReservation } from '../../types/locker';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

type Props = {
  route: {
    params: MainStackParamList['GillerPickupFromLocker'];
  };
  navigation: MainStackNavigationProp;
};

type Step = 'reservation' | 'open' | 'confirm' | 'complete';

function getReservationTitle(reservation: LockerReservation | null): string {
  if (!reservation) {
    return '보관함 예약 정보를 찾는 중입니다.';
  }

  switch (reservation.status) {
    case 'pending':
      return '수령 대기';
    case 'active':
      return '보관함 열림';
    case 'in_use':
      return '수령 진행 중';
    case 'completed':
      return '수령 완료';
    case 'cancelled':
      return '예약 취소';
    default:
      return '예약 확인';
  }
}

function getStepNumber(step: Step): number {
  switch (step) {
    case 'reservation':
      return 1;
    case 'open':
      return 2;
    case 'confirm':
      return 3;
    case 'complete':
      return 4;
  }
}

export default function GillerPickupFromLockerScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('reservation');
  const [reservation, setReservation] = useState<LockerReservation | null>(null);
  const [locker, setLocker] = useState<Locker | null>(null);

  const loadLockerFlow = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const reservations = await createLockerService().getReservationByRequestId(requestId);
      const targetReservation =
        reservations.find((item) => item.type === 'requester_pickup') ?? reservations[0] ?? null;

      if (!targetReservation) {
        setReservation(null);
        setLocker(null);
        return;
      }

      const lockerData = await getLocker(targetReservation.lockerId);
      setReservation(targetReservation);
      setLocker(lockerData);

      if (targetReservation.status === 'completed') {
        setCurrentStep('complete');
      } else if (targetReservation.status === 'active' || targetReservation.status === 'in_use') {
        setCurrentStep('confirm');
      } else {
        setCurrentStep('open');
      }
    } catch (error) {
      console.error('Failed to load locker pickup flow:', error);
      Alert.alert('불러오기 실패', '보관함 수령 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadLockerFlow();
  }, [loadLockerFlow]);

  const handleOpenLocker = async (): Promise<void> => {
    if (!reservation || !locker) {
      Alert.alert('예약 확인 필요', '먼저 보관함 예약 정보를 확인해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const result = await openLocker(locker.lockerId, reservation.reservationId);

      if (!result.success) {
        Alert.alert('보관함 열기 실패', result.message ?? '보관함을 열지 못했습니다.');
        return;
      }

      Alert.alert('보관함 열림', '보관함이 열렸습니다. 물품을 확인한 뒤 수령 완료를 눌러주세요.');
      setCurrentStep('confirm');
      setReservation((current) => (current ? { ...current, status: 'active' } : current));
    } catch (error) {
      console.error('Failed to open locker:', error);
      Alert.alert('보관함 열기 실패', '보관함을 열지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPickup = async (): Promise<void> => {
    if (!reservation) {
      Alert.alert('예약 확인 필요', '보관함 예약 정보를 다시 확인해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const delivery = (await getDeliveryByRequestId(requestId)) as { deliveryId?: string } | null;
      if (!delivery?.deliveryId) {
        Alert.alert('배송 확인 실패', '연결된 배송 정보를 찾지 못했습니다.');
        return;
      }

      const requesterId = requireUserId();
      const result = await confirmDeliveryByRequester({
        deliveryId: delivery.deliveryId,
        requesterId,
        requestId,
      });

      if (!result.success) {
        Alert.alert('수령 확인 실패', result.message);
        return;
      }

      setCurrentStep('complete');
      setReservation((current) => (current ? { ...current, status: 'completed' } : current));
      Alert.alert('수령 완료', '보관함 수령이 확인되었습니다.');
    } catch (error) {
      console.error('Failed to confirm locker pickup:', error);
      Alert.alert('수령 확인 실패', '수령 완료를 처리하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!reservation || !locker) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={56} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>보관함 수령 정보가 없습니다</Text>
        <Text style={styles.emptyDescription}>
          요청에 연결된 보관함 예약을 찾지 못했습니다. 운영팀 또는 채팅에서 길러와 상태를 확인해주세요.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.stepPill}>STEP {getStepNumber(currentStep)}</Text>
        <Text style={styles.heroTitle}>사물함 수령 확인</Text>
        <Text style={styles.heroSubtitle}>
          {getReservationTitle(reservation)} · {locker.location.stationName} {locker.location.section}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryChip label="예약 확인" active />
          <SummaryChip label={currentStep === 'open' ? '열기 필요' : '열기 확인'} active={currentStep === 'open'} />
          <SummaryChip label={currentStep === 'confirm' ? '수령 확인 필요' : '수령 확인'} active={currentStep === 'confirm'} />
        </View>
        <Text style={styles.summaryText}>지금 필요한 단계만 진행하면 됩니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>보관함 정보</Text>
        <InfoRow label="역 이름" value={locker.location.stationName} />
        <InfoRow label="라인" value={locker.location.line} />
        <InfoRow label="위치" value={`${locker.location.floor}층 ${locker.location.section}`} />
        <InfoRow label="운영사" value={locker.operator} />
        <InfoRow label="예약 상태" value={reservation.status} />
        <InfoRow label="예약 코드" value={reservation.reservationId} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>수령 순서</Text>
        <TimelineRow active title="예약 확인" description="연결된 사물함과 상태를 확인합니다." />
        <TimelineRow
          active={currentStep === 'open' || currentStep === 'confirm' || currentStep === 'complete'}
          title="보관함 열기"
          description="문을 열고 물품을 꺼냅니다."
        />
        <TimelineRow
          active={currentStep === 'confirm' || currentStep === 'complete'}
          title="수령 완료"
          description="물품 확인 후 수령 완료를 누릅니다."
        />
      </View>

      {currentStep === 'open' && (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleOpenLocker()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>보관함 열기</Text>
          )}
        </TouchableOpacity>
      )}

      {currentStep === 'confirm' && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => void handleConfirmPickup()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>수령 완료 확인</Text>
          )}
        </TouchableOpacity>
      )}

      {currentStep === 'complete' && (
        <View style={styles.completeCard}>
          <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
          <Text style={styles.completeTitle}>수령이 완료되었습니다</Text>
          <Text style={styles.completeDescription}>
            요청 상세와 채팅에서 이후 정산 및 배송 완료 상태를 계속 확인할 수 있습니다.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('RequestDetail', { requestId })}>
            <Text style={styles.secondaryButtonText}>요청 상세로 이동</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function SummaryChip({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.summaryChip, active ? styles.summaryChipActive : undefined]}>
      <Text style={[styles.summaryChipText, active ? styles.summaryChipTextActive : undefined]}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function TimelineRow({
  active,
  title,
  description,
}: {
  active: boolean;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.timelineDot, active ? styles.timelineDotActive : undefined]} />
      <View style={styles.timelineText}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    shadowColor: Colors.textPrimary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  stepPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primaryMint,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  summaryChipActive: {
    backgroundColor: Colors.primaryMint,
  },
  summaryChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  summaryChipTextActive: {
    color: Colors.primary,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    shadowColor: Colors.textPrimary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginTop: 6,
    marginRight: 12,
  },
  timelineDotActive: {
    backgroundColor: Colors.primary,
  },
  timelineText: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  timelineDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.surface,
  },
  completeCard: {
    backgroundColor: Colors.primaryMint,
    borderRadius: 24,
    padding: 20,
    alignItems: 'flex-start',
  },
  completeTitle: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  completeDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.primary,
  },
  secondaryButton: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});
