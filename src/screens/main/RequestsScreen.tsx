import React, { useEffect, useMemo, useState } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cancelDeliveryFlow } from '../../services/delivery-service';
import { requireUserId } from '../../services/firebase';
import { cancelRequest, getUserRequests, increaseRequestBid } from '../../services/request-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';
import { RequestStatus, type Request } from '../../types/request';

export default function RequestsScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);

  useEffect(() => {
    void loadRequests();
  }, []);

  const summary = useMemo(() => {
    const activeStatuses = [
      RequestStatus.PENDING,
      RequestStatus.MATCHED,
      RequestStatus.ACCEPTED,
      RequestStatus.IN_TRANSIT,
      RequestStatus.ARRIVED,
      RequestStatus.AT_LOCKER,
      RequestStatus.DELIVERED,
    ];

    return {
      total: requests.length,
      active: requests.filter((request) => activeStatuses.includes(request.status)).length,
      quoteReady: requests.filter((request) => Boolean(request.pricingQuoteId)).length,
      deliveryReady: requests.filter((request) => Boolean(request.primaryDeliveryId)).length,
    };
  }, [requests]);

  async function loadRequests() {
    try {
      const userId = requireUserId();
      const nextRequests = await getUserRequests(userId);
      setRequests(nextRequests);
    } catch (error) {
      console.error('Failed to load requests', error);
      Alert.alert('요청을 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadRequests();
  }

  function openDispute(request: Request) {
    navigation.navigate('DisputeReport', {
      deliveryId: request.primaryDeliveryId,
    });
  }

  function handleCancel(request: Request) {
    const canCancelDraft = [RequestStatus.PENDING, RequestStatus.MATCHED].includes(request.status);
    const canCancelAccepted = request.status === RequestStatus.ACCEPTED;

    if (!canCancelDraft && !canCancelAccepted) {
      Alert.alert('지금은 취소할 수 없습니다', '배송이 진행 중이면 채팅이나 분쟁 접수로 먼저 상황을 정리해 주세요.', [
        { text: '분쟁 접수', onPress: () => openDispute(request) },
        { text: '닫기', style: 'cancel' },
      ]);
      return;
    }

    const title = canCancelAccepted ? '수락된 배송을 취소할까요?' : '요청을 취소할까요?';
    const message = canCancelAccepted
      ? '픽업 전 취소라면 보증금 환불과 배송 취소를 함께 처리합니다.'
      : '지금 취소해도 요청 정보는 다음 요청에 참고할 수 있습니다.';

    Alert.alert(title, message, [
      { text: '계속 유지', style: 'cancel' },
      {
        text: '취소하기',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setWorkingRequestId(request.requestId);
              const userId = requireUserId();

              if (canCancelAccepted) {
                const result = await cancelDeliveryFlow({
                  requestId: request.requestId,
                  actorId: userId,
                  actorType: 'requester',
                  reason: 'requester_cancelled_before_pickup_from_request_board',
                });

                if (!result.success) {
                  Alert.alert('취소를 진행할 수 없습니다', result.message, [
                    { text: '분쟁 접수', onPress: () => openDispute(request) },
                    { text: '닫기', style: 'cancel' },
                  ]);
                  return;
                }

                const completionMessage =
                  result.depositStatus === 'refunded'
                    ? '배송 취소와 보증금 환불까지 처리했습니다.'
                    : result.depositStatus === 'failed'
                      ? '배송 취소는 처리했지만 보증금 환불은 운영 확인이 필요합니다.'
                      : result.message;

                Alert.alert('배송 취소 완료', completionMessage);
              } else {
                await cancelRequest(request.requestId, userId, 'requester cancelled from 가는길에');
                Alert.alert('요청 취소 완료', '요청을 취소했습니다.');
              }

              await loadRequests();
            } catch (error) {
              console.error('Failed to cancel request', error);
              Alert.alert('취소에 실패했습니다', '잠시 후 다시 시도해 주세요.');
            } finally {
              setWorkingRequestId(null);
            }
          })();
        },
      },
    ]);
  }

  async function handleIncreaseBid(request: Request, amount: number) {
    try {
      setWorkingRequestId(request.requestId);
      const result = await increaseRequestBid(request.requestId, requireUserId(), amount);

      if (!result.success) {
        Alert.alert('금액 조정 실패', result.message ?? '지금은 금액을 조정할 수 없습니다.');
        return;
      }

      Alert.alert('제안 금액을 올렸습니다', `현재 제안 금액은 ${(result.newFee ?? 0).toLocaleString()}원입니다.`);
      await loadRequests();
    } catch (error) {
      console.error('Failed to increase bid', error);
      Alert.alert('금액 조정 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorkingRequestId(null);
    }
  }

  function handleRematchAction(request: Request) {
    Alert.alert(
      '지금 바로 보내야 하나요?',
      '급하면 금액을 올려 더 빨리 다시 잡고, 급하지 않다면 예약으로 전환해 안정적으로 연결할 수 있습니다.',
      [
        {
          text: 'AI 추천 금액 올리기',
          onPress: () => {
            void handleIncreaseBid(request, 1000);
          },
        },
        {
          text: '예약으로 전환하기',
          onPress: () => {
            navigation.navigate('CreateRequest', {
              mode: 'reservation',
              sourceRequestId: request.requestId,
              prefill: {
                pickupStation: request.pickupStation,
                deliveryStation: request.deliveryStation,
                packageDescription: request.packageInfo.description,
                packageSize: request.packageInfo.size as 'small' | 'medium' | 'large' | 'xl',
                weightKg:
                  typeof request.packageInfo.weightKg === 'number'
                    ? request.packageInfo.weightKg
                    : typeof request.packageInfo.weight === 'number'
                      ? request.packageInfo.weight
                      : 1,
                itemValue: request.itemValue,
                urgency: 'normal',
                directParticipationMode: 'none',
                preferredPickupTime: request.preferredTime?.departureTime,
                preferredArrivalTime: request.preferredTime?.arrivalTime,
              },
            });
          },
        },
        { text: '그대로 기다리기', style: 'cancel' },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.centerStateText}>요청 보드를 준비하는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>가는길에</Text>
        <Text style={styles.heroTitle}>요청 상태를 한눈에 확인하세요.</Text>
        <Text style={styles.heroSubtitle}>
          초안, 견적, 배송 연결 상태만 간단하게 보여주고 필요한 행동만 바로 실행할 수 있게 정리했습니다.
        </Text>

        <View style={styles.summaryRow}>
          <SummaryCard label="전체 요청" value={summary.total} />
          <SummaryCard label="진행 중" value={summary.active} />
          <SummaryCard label="견적 준비" value={summary.quoteReady} />
          <SummaryCard label="배송 연결" value={summary.deliveryReady} />
        </View>
      </View>

      <TouchableOpacity style={styles.primaryAction} activeOpacity={0.9} onPress={() => navigation.navigate('CreateRequest')}>
        <MaterialIcons name="add-box" size={20} color={Colors.white} />
        <Text style={styles.primaryActionText}>새 요청 만들기</Text>
      </TouchableOpacity>

      {requests.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>아직 요청이 없습니다</Text>
          <Text style={styles.emptySubtitle}>지금 필요한 배송이 있다면 새 요청부터 시작해 보세요.</Text>
        </View>
      ) : (
        requests.map((request) => {
          const isWorking = workingRequestId === request.requestId;
          const amount = getRequestAmount(request);
          const canRematch = request.status === RequestStatus.PENDING || request.status === RequestStatus.MATCHED;
          const canCancel =
            request.status === RequestStatus.PENDING ||
            request.status === RequestStatus.MATCHED ||
            request.status === RequestStatus.ACCEPTED;
          const canDispute =
            request.status === RequestStatus.IN_TRANSIT ||
            request.status === RequestStatus.ARRIVED ||
            request.status === RequestStatus.AT_LOCKER ||
            request.status === RequestStatus.DELIVERED;

          return (
            <TouchableOpacity
              key={request.requestId}
              style={styles.requestCard}
              activeOpacity={0.95}
              onPress={() => navigation.navigate('RequestDetail', { requestId: request.requestId })}
            >
              <View style={styles.requestHeader}>
                <Text style={styles.phaseLabel}>{getStatusLabel(request.status)}</Text>
                <Text style={styles.requestTime}>{formatRelativeTime(request.createdAt)}</Text>
              </View>

              <Text style={styles.routeTitle}>
                {request.pickupStation.stationName} {'->'} {request.deliveryStation.stationName}
              </Text>
              <Text style={styles.routeSubtitle}>
                {request.packageInfo.description || '물품 설명 없음'} · {amount.toLocaleString()}원
              </Text>

              <View style={styles.stepRow}>
                <StepPill label="초안" active />
                <StepPill label="분석" active={Boolean(request.requestDraftId)} />
                <StepPill label="견적" active={Boolean(request.pricingQuoteId)} />
                <StepPill label="배송" active={Boolean(request.primaryDeliveryId)} />
              </View>

              <View style={styles.infoPanel}>
                <InfoRow label="현재 상태" value={getStatusDescription(request.status)} />
                <InfoRow label="희망 시간" value={formatPreferredTime(request)} />
                <InfoRow label="마감" value={formatDateTime(request.deadline)} />
              </View>

              <View style={styles.actionRow}>
                <MiniAction
                  icon="chat-bubble-outline"
                  label="채팅 보기"
                  onPress={() => navigation.navigate('ChatList')}
                  disabled={isWorking}
                />

                {canRematch ? (
                  <MiniAction icon="trending-up" label="다시 잡기" onPress={() => handleRematchAction(request)} disabled={isWorking} />
                ) : null}

                {canCancel ? (
                  <MiniAction
                    icon="close"
                    label={request.status === RequestStatus.ACCEPTED ? '배송 취소' : '요청 취소'}
                    onPress={() => handleCancel(request)}
                    disabled={isWorking}
                    warning
                  />
                ) : null}

                {canDispute ? (
                  <MiniAction icon="report-problem" label="분쟁 접수" onPress={() => openDispute(request)} disabled={isWorking} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StepPill({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.stepPill, active ? styles.stepPillActive : styles.stepPillIdle]}>
      <Text style={[styles.stepPillText, active ? styles.stepPillTextActive : styles.stepPillTextIdle]}>{label}</Text>
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

function MiniAction({
  icon,
  label,
  onPress,
  disabled,
  warning = false,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
  disabled: boolean;
  warning?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.secondaryAction, warning && styles.warningAction, disabled && styles.disabledAction]}
      onPress={onPress}
      disabled={disabled}
    >
      <MaterialIcons name={icon} size={18} color={warning ? Colors.error : Colors.primary} />
      <Text style={[styles.secondaryActionText, warning && styles.warningText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getRequestAmount(request: Request): number {
  return request.fee?.totalFee ?? request.feeBreakdown?.totalFee ?? request.initialNegotiationFee ?? 0;
}

function formatDateTime(value?: Timestamp | null): string {
  if (!value) return '-';
  const date = value instanceof Timestamp ? value.toDate() : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPreferredTime(request: Request): string {
  if (!request.preferredTime) return '미설정';
  return `${request.preferredTime.departureTime} 출발 · ${request.preferredTime.arrivalTime ?? '-'} 도착`;
}

function formatRelativeTime(value?: Timestamp | null): string {
  if (!value) return '-';
  const date = value instanceof Timestamp ? value.toDate() : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
}

function getStatusLabel(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.PENDING:
      return '매칭 대기';
    case RequestStatus.MATCHED:
      return '견적 도착';
    case RequestStatus.ACCEPTED:
      return '길러 수락';
    case RequestStatus.IN_TRANSIT:
      return '배송 중';
    case RequestStatus.ARRIVED:
      return '도착 확인';
    case RequestStatus.AT_LOCKER:
      return '사물함 보관';
    case RequestStatus.DELIVERED:
      return '수령 확인 대기';
    case RequestStatus.COMPLETED:
      return '완료';
    case RequestStatus.CANCELLED:
      return '취소';
    default:
      return status;
  }
}

function getStatusDescription(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.PENDING:
      return '길러와 파트너 연결을 기다리는 중입니다.';
    case RequestStatus.MATCHED:
      return '견적과 매칭 제안을 확인할 수 있습니다.';
    case RequestStatus.ACCEPTED:
      return '길러가 수락했습니다. 픽업 전까지 취소를 처리할 수 있습니다.';
    case RequestStatus.IN_TRANSIT:
      return '배송이 진행 중입니다.';
    case RequestStatus.ARRIVED:
      return '도착 확인 후 다음 인계나 수령을 기다립니다.';
    case RequestStatus.AT_LOCKER:
      return '사물함 보관 상태입니다.';
    case RequestStatus.DELIVERED:
      return '최종 수령 확인을 기다리고 있습니다.';
    case RequestStatus.COMPLETED:
      return '배송과 정산 흐름이 모두 마무리됐습니다.';
    case RequestStatus.CANCELLED:
      return '취소와 후속 정리가 완료된 상태입니다.';
    default:
      return status;
  }
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  centerStateText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    ...Typography.body,
  },
  hero: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  heroKicker: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  summaryCard: {
    flex: 1,
    minWidth: 72,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    gap: 4,
    ...Shadows.sm,
  },
  summaryValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summaryLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  primaryActionText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
  },
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
    gap: Spacing.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  requestTime: {
    color: Colors.gray400,
    ...Typography.caption,
  },
  routeTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  routeSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepPillActive: {
    backgroundColor: Colors.primaryMint,
  },
  stepPillIdle: {
    backgroundColor: Colors.gray200,
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepPillTextActive: {
    color: Colors.primary,
  },
  stepPillTextIdle: {
    color: Colors.gray500,
  },
  infoPanel: {
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  infoLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primaryMint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  warningAction: {
    backgroundColor: Colors.errorLight,
  },
  disabledAction: {
    opacity: 0.6,
  },
  secondaryActionText: {
    color: Colors.primary,
    ...Typography.bodyBold,
  },
  warningText: {
    color: Colors.error,
  },
});

