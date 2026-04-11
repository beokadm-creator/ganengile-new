import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { deliveryPartnerService } from '../../services/delivery-partner-service';
import { getRequestById, subscribeToRequest } from '../../services/request-service';
import { getRequesterStatusBody, getRequesterStatusLabel } from '../../services/request-status-presentation-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { RequestStatus, type Request } from '../../types/request';

function formatStageTime(value?: Request['acceptedAt'] | Request['pickedUpAt'] | Request['arrivedAt'] | Request['deliveredAt']) {
  if (!value) {
    return null;
  }

  const maybeTimestamp = value as unknown as { toDate?: () => Date };
  const resolved = typeof maybeTimestamp.toDate === 'function' ? maybeTimestamp.toDate() : new Date(value as unknown as Date);

  if (!(resolved instanceof Date) || Number.isNaN(resolved.getTime())) {
    return null;
  }

  return resolved.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RequestConfirmationScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<RouteProp<MainStackParamList, 'RequestConfirmation'>>();
  const { requestId, pickupStationName, deliveryStationName, deliveryFee } = route.params;
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [partnerDispatches, setPartnerDispatches] = useState<
    Array<{
      dispatchId: string;
      partnerName: string;
      status: string;
      dispatchMethod: string;
      updatedAt: Date;
    }>
  >([]);

  const routeLabel =
    pickupStationName && deliveryStationName
      ? `${pickupStationName} -> ${deliveryStationName}`
      : '경로는 다음 화면에서 확인할 수 있습니다.';
  const currentStatus = request?.status;
  const statusLabel = getRequesterStatusLabel(request?.status);
  const statusBody = getRequesterStatusBody(request);
  const canTrack =
    Boolean(request?.primaryDeliveryId) &&
    Boolean(currentStatus) &&
    [
      RequestStatus.ACCEPTED,
      RequestStatus.IN_TRANSIT,
      RequestStatus.ARRIVED,
      RequestStatus.AT_LOCKER,
      RequestStatus.DELIVERED,
      RequestStatus.COMPLETED,
    ].includes(currentStatus as RequestStatus);

  useEffect(() => {
    void (async () => {
      const current = await getRequestById(requestId).catch(() => null);
      setRequest(current);
      const dispatchSummary = await deliveryPartnerService.getDispatchSummary({
        requestId,
        ...(current?.primaryDeliveryId ? { deliveryId: current.primaryDeliveryId } : {}),
      }).catch(() => []);
      setPartnerDispatches(dispatchSummary);
      setLoading(false);
    })();

    const unsubscribe = subscribeToRequest(requestId, (nextRequest) => {
      setRequest(nextRequest);
      void deliveryPartnerService
        .getDispatchSummary({
          requestId,
          ...(nextRequest?.primaryDeliveryId ? { deliveryId: nextRequest.primaryDeliveryId } : {}),
        })
        .then(setPartnerDispatches)
        .catch(() => setPartnerDispatches([]));
      setLoading(false);
    });

    return unsubscribe;
  }, [requestId]);

  const stepState = useMemo(
    () => ({
      draft: true,
      quote: Boolean(request?.pricingQuoteId ?? deliveryFee),
      delivery: Boolean(request?.primaryDeliveryId),
      moving:
        request?.status === RequestStatus.IN_TRANSIT ||
        request?.status === RequestStatus.ARRIVED ||
        request?.status === RequestStatus.AT_LOCKER ||
        request?.status === RequestStatus.DELIVERED ||
        request?.status === RequestStatus.COMPLETED,
    }),
    [deliveryFee, request]
  );
  const missionProgressLabel = request?.missionProgress
    ? `${request.missionProgress.acceptedMissionCount}/${request.missionProgress.totalMissionCount} 구간 연결`
    : null;
  const acceptedAtLabel = formatStageTime(request?.acceptedAt);
  const pickedUpAtLabel = formatStageTime(request?.pickedUpAt);
  const arrivedAtLabel = formatStageTime(request?.arrivedAt);
  const deliveredAtLabel = formatStageTime(request?.deliveredAt);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="check-circle" size={56} color={Colors.success} />
          </View>
          <Text style={styles.heroTitle}>요청이 접수됐습니다.</Text>
          <Text style={styles.heroBody}>{statusBody}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>현재 상태</Text>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>최신 상태를 확인하는 중입니다.</Text>
            </View>
          ) : (
            <View style={styles.stepList}>
              <StepRow label="상태" body={statusLabel} />
              <StepRow label="요청" body={stepState.draft ? '등록 완료' : '확인 중'} />
              <StepRow label="견적" body={stepState.quote ? '확정됨' : '준비 중'} />
              <StepRow label="배송" body={stepState.delivery ? (stepState.moving ? '진행 중' : '연결됨') : '연결 대기'} />
              {missionProgressLabel ? <StepRow label="구간" body={missionProgressLabel} /> : null}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>진행</Text>
          <View style={styles.progressPills}>
            <ProgressPill label="요청" active />
            <ProgressPill label="견적" active={stepState.quote} />
            <ProgressPill label="배송 연결" active={stepState.delivery} />
            <ProgressPill label="이동" active={stepState.moving} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>요청 요약</Text>
          <InfoRow label="경로" value={routeLabel} />
          <InfoRow label="요청 ID" value={requestId} mono />
          {request?.recipientName ? <InfoRow label="수령인" value={request.recipientName} /> : null}
          {missionProgressLabel ? <InfoRow label="구간 진행" value={missionProgressLabel} /> : null}
          {acceptedAtLabel ? <InfoRow label="수락" value={acceptedAtLabel} /> : null}
          {pickedUpAtLabel ? <InfoRow label="인수" value={pickedUpAtLabel} /> : null}
          {arrivedAtLabel ? <InfoRow label="도착" value={arrivedAtLabel} /> : null}
          {deliveredAtLabel ? <InfoRow label="전달" value={deliveredAtLabel} /> : null}
          {deliveryFee ? (
            <>
              <InfoRow label="제안 금액" value={`${deliveryFee.totalFee.toLocaleString()}원`} />
              <InfoRow label="예상 시간" value={`${deliveryFee.estimatedTime}분`} />
            </>
          ) : null}
        </View>

        {partnerDispatches.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>업체 위임 상태</Text>
            {partnerDispatches.slice(0, 2).map((item) => (
              <InfoRow
                key={item.dispatchId}
                label={item.partnerName}
                value={`${item.status} · ${item.dispatchMethod}`}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>참고</Text>
          <Text style={styles.noticeBody}>요청 상세에서 상태를 바로 확인할 수 있습니다.</Text>
        </View>

        <View style={styles.buttonGroup}>
          {canTrack ? (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => navigation.navigate('DeliveryTracking', { requestId })}
            >
              <Text style={styles.primaryButtonText}>배송 추적 보기</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.button, canTrack ? styles.secondaryButton : styles.primaryButton]}
            onPress={() =>
              navigation.navigate('MatchingResult', {
                requestId,
                pickupStationName,
                deliveryStationName,
              })
            }
          >
            <Text style={canTrack ? styles.secondaryButtonText : styles.primaryButtonText}>매칭 보기</Text>
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

function ProgressPill({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.progressPill, active ? styles.progressPillActive : styles.progressPillIdle]}>
      <Text style={[styles.progressPillText, active ? styles.progressPillTextActive : styles.progressPillTextIdle]}>
        {label}
      </Text>
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
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
  progressPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  progressPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressPillActive: {
    backgroundColor: Colors.primaryMint,
  },
  progressPillIdle: {
    backgroundColor: Colors.gray100,
  },
  progressPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressPillTextActive: {
    color: Colors.primary,
  },
  progressPillTextIdle: {
    color: Colors.textSecondary,
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
