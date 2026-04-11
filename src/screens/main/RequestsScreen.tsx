import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
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
  const [rematchTarget, setRematchTarget] = useState<Request | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Request | null>(null);

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

  function openRequestDetail(request: Request) {
    navigation.navigate('RequestDetail', { requestId: request.requestId });
  }

  async function executeCancel(request: Request) {
    const canCancelDraft = [RequestStatus.PENDING, RequestStatus.MATCHED].includes(request.status);
    const canCancelAccepted = request.status === RequestStatus.ACCEPTED;

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
      } else if (canCancelDraft) {
        const cancelled = await cancelRequest(
          request.requestId,
          userId,
          'requester cancelled from request board'
        );

        if (!cancelled) {
          Alert.alert('취소를 진행할 수 없습니다', '요청 소유자 정보가 맞는지 다시 확인해 주세요.');
          return;
        }

        Alert.alert('요청 취소 완료', '요청을 취소했습니다.');
      }

      await loadRequests();
    } catch (error) {
      console.error('Failed to cancel request', error);
      Alert.alert('취소에 실패했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorkingRequestId(null);
    }
  }

  function navigateToReservation(request: Request) {
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
        recipientName: request.recipientName,
        recipientPhone: request.recipientPhone,
        pickupMode: request.pickupAddress ? 'address' : 'station',
        deliveryMode: request.deliveryAddress ? 'address' : 'station',
        pickupRoadAddress: request.pickupAddress?.roadAddress,
        pickupDetailAddress: request.pickupAddress?.detailAddress,
        deliveryRoadAddress: request.deliveryAddress?.roadAddress,
        deliveryDetailAddress: request.deliveryAddress?.detailAddress,
        photoRefs: request.selectedPhotoIds,
        urgency: 'normal',
        directParticipationMode: 'none',
        preferredPickupTime: request.preferredTime?.departureTime,
        preferredArrivalTime: request.preferredTime?.arrivalTime,
      },
    });
  }

  function handleCancel(request: Request) {
    const canCancelDraft = [RequestStatus.PENDING, RequestStatus.MATCHED].includes(request.status);
    const canCancelAccepted = request.status === RequestStatus.ACCEPTED;

    if (!canCancelDraft && !canCancelAccepted) {
      Alert.alert(
        '지금은 취소할 수 없습니다',
        '배송이 진행 중이면 채팅이나 분쟁 접수로 먼저 상황을 정리해 주세요.',
        [
          { text: '분쟁 접수', onPress: () => openDispute(request) },
          { text: '닫기', style: 'cancel' },
        ]
      );
      return;
    }

    if (Platform.OS === 'web') {
      setCancelTarget(request);
      return;
    }

    if (canCancelAccepted) {
      Alert.alert('바로 취소보다 먼저 확인해 볼까요?', '상세 화면이나 분쟁 접수로 먼저 정리할 수 있습니다.', [
        { text: '상세 보기', onPress: () => openRequestDetail(request) },
        { text: '분쟁 접수', onPress: () => openDispute(request) },
        { text: '그래도 취소', style: 'destructive', onPress: () => void executeCancel(request) },
      ]);
      return;
    }

    Alert.alert('취소 전에 다른 방법도 있습니다', '금액을 올리거나 예약으로 바꾸면 연결 가능성을 더 볼 수 있습니다.', [
      { text: '1,000원 올리기', onPress: () => void handleIncreaseBid(request, 1000) },
      { text: '예약형으로 전환', onPress: () => navigateToReservation(request) },
      { text: '그래도 취소', style: 'destructive', onPress: () => void executeCancel(request) },
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
    if (Platform.OS === 'web') {
      setRematchTarget(request);
      return;
    }

    Alert.alert(
      '지금 바로 다시 보낼까요?',
      '급하면 금액을 조금 올려 빠르게 다시 찾고, 급하지 않으면 예약형으로 전환해 안정적으로 연결할 수 있습니다.',
      [
        {
          text: 'AI 추천 금액 올리기',
          onPress: () => {
            void handleIncreaseBid(request, 1000);
          },
        },
        {
          text: '예약형으로 전환',
          onPress: () => navigateToReservation(request),
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
        <Text style={styles.heroKicker}>가는길에 요청</Text>
        <Text style={styles.heroTitle}>요청 상태를 한눈에 확인하세요</Text>
        <Text style={styles.heroSubtitle}>
          초안, 견적, 배송 연결 상태를 바로 확인하고 필요한 동작을 이어갈 수 있습니다.
        </Text>

        <View style={styles.summaryRow}>
          <SummaryCard label="전체 요청" value={summary.total} />
          <SummaryCard label="진행 중" value={summary.active} />
          <SummaryCard label="견적 준비" value={summary.quoteReady} />
          <SummaryCard label="배송 연결" value={summary.deliveryReady} />
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryAction}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('CreateRequest')}
      >
        <MaterialIcons name="add-box" size={20} color={Colors.white} />
        <Text style={styles.primaryActionText}>새 요청 만들기</Text>
      </TouchableOpacity>

      {requests.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>아직 요청이 없습니다</Text>
          <Text style={styles.emptySubtitle}>필요한 배송이 있다면 새 요청부터 시작해 보세요.</Text>
        </View>
      ) : (
        requests.map((request) => {
          const isWorking = workingRequestId === request.requestId;
          const amount = getRequestAmount(request);
          const canRematch =
            request.status === RequestStatus.PENDING || request.status === RequestStatus.MATCHED;
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
            <View key={request.requestId} style={styles.requestCard}>
              <TouchableOpacity activeOpacity={0.95} onPress={() => openRequestDetail(request)}>
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
              </TouchableOpacity>

              <View style={styles.actionRow}>
                <MiniAction
                  icon="chat-bubble-outline"
                  label="상세/채팅"
                  onPress={() => openRequestDetail(request)}
                  disabled={isWorking}
                />

                {canRematch ? (
                  <MiniAction
                    icon="trending-up"
                    label="다시 찾기"
                    onPress={() => handleRematchAction(request)}
                    disabled={isWorking}
                  />
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
                  <MiniAction
                    icon="report-problem"
                    label="분쟁 접수"
                    onPress={() => openDispute(request)}
                    disabled={isWorking}
                  />
                ) : null}
              </View>
            </View>
          );
        })
      )}

      <ChoiceModal
        visible={Boolean(rematchTarget)}
        title="지금 바로 다시 보낼까요?"
        message="급하면 금액을 조금 올려 빠르게 다시 찾고, 급하지 않으면 예약으로 전환해 안정적으로 연결할 수 있습니다."
        onClose={() => setRematchTarget(null)}
        actions={[
          {
            label: 'AI 추천 금액 올리기',
            onPress: () => {
              const target = rematchTarget;
              setRematchTarget(null);
              if (target) {
                void handleIncreaseBid(target, 1000);
              }
            },
          },
          {
            label: '예약형으로 전환',
            onPress: () => {
              const target = rematchTarget;
              setRematchTarget(null);
              if (target) {
                navigateToReservation(target);
              }
            },
          },
        ]}
      />

      <ChoiceModal
        visible={Boolean(cancelTarget)}
        title={cancelTarget?.status === RequestStatus.ACCEPTED ? '배송을 바로 취소할까요?' : '요청을 바로 취소할까요?'}
        message={
          cancelTarget?.status === RequestStatus.ACCEPTED
            ? '상세 화면이나 분쟁 접수로 먼저 정리할 수도 있습니다.'
            : '금액을 올리거나 예약으로 바꾸면 연결 가능성을 더 볼 수 있습니다.'
        }
        onClose={() => setCancelTarget(null)}
        actions={
          cancelTarget?.status === RequestStatus.ACCEPTED
            ? [
                {
                  label: '상세 보기',
                  onPress: () => {
                    const target = cancelTarget;
                    setCancelTarget(null);
                    if (target) {
                      openRequestDetail(target);
                    }
                  },
                },
                {
                  label: '분쟁 접수',
                  onPress: () => {
                    const target = cancelTarget;
                    setCancelTarget(null);
                    if (target) {
                      openDispute(target);
                    }
                  },
                },
                {
                  label: '그래도 취소',
                  destructive: true,
                  onPress: () => {
                    const target = cancelTarget;
                    setCancelTarget(null);
                    if (target) {
                      void executeCancel(target);
                    }
                  },
                },
              ]
            : [
                {
                  label: '1,000원 올리기',
                  onPress: () => {
                    const target = cancelTarget;
                    setCancelTarget(null);
                    if (target) {
                      void handleIncreaseBid(target, 1000);
                    }
                  },
                },
                {
                  label: '예약형으로 전환',
                  onPress: () => {
                    const target = cancelTarget;
                    setCancelTarget(null);
                    if (target) {
                      navigateToReservation(target);
                    }
                  },
                },
                {
                  label: '그래도 취소',
                  destructive: true,
                  onPress: () => {
                    const target = cancelTarget;
                    setCancelTarget(null);
                    if (target) {
                      void executeCancel(target);
                    }
                  },
                },
              ]
        }
      />
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
      <Text
        style={[
          styles.stepPillText,
          active ? styles.stepPillTextActive : styles.stepPillTextIdle,
        ]}
      >
        {label}
      </Text>
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

function ChoiceModal({
  visible,
  title,
  message,
  onClose,
  actions,
}: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  actions: Array<{ label: string; onPress: () => void; destructive?: boolean }>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[
                  styles.modalActionButton,
                  action.destructive && styles.modalActionButtonDanger,
                ]}
                activeOpacity={0.85}
                onPress={action.onPress}
              >
                <Text
                  style={[
                    styles.modalActionText,
                    action.destructive && styles.modalActionTextDanger,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalActionButton, styles.modalSecondaryButton]}
              activeOpacity={0.85}
              onPress={onClose}
            >
              <Text style={styles.modalSecondaryText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getRequestAmount(request: Request): number {
  return (
    request.fee?.totalFee ?? request.feeBreakdown?.totalFee ?? request.initialNegotiationFee ?? 0
  );
}

function toDate(value?: Timestamp | { toDate?: () => Date } | null): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function formatDateTime(value?: Timestamp | null): string {
  const date = toDate(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPreferredTime(request: Request): string {
  if (!request.preferredTime) {
    return '미설정';
  }

  return `${request.preferredTime.departureTime} 출발 · ${request.preferredTime.arrivalTime ?? '-'} 도착`;
}

function formatRelativeTime(value?: Timestamp | null): string {
  const date = toDate(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '-';
  }

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
      return '견적 확인';
    case RequestStatus.ACCEPTED:
      return '길러 수락';
    case RequestStatus.IN_TRANSIT:
      return '배송 중';
    case RequestStatus.ARRIVED:
      return '도착 확인';
    case RequestStatus.AT_LOCKER:
      return '보관 완료';
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
      return '길러를 찾고 있습니다.';
    case RequestStatus.MATCHED:
      return '견적과 매칭 제안을 확인할 수 있습니다.';
    case RequestStatus.ACCEPTED:
      return '길러가 수락했습니다. 픽업 전까지 취소할 수 있습니다.';
    case RequestStatus.IN_TRANSIT:
      return '배송이 진행 중입니다.';
    case RequestStatus.ARRIVED:
      return '도착 확인 후 인계가 진행됩니다.';
    case RequestStatus.AT_LOCKER:
      return '사물함 보관 상태입니다.';
    case RequestStatus.DELIVERED:
      return '최종 수령 확인을 기다리고 있습니다.';
    case RequestStatus.COMPLETED:
      return '배송과 정산이 모두 완료되었습니다.';
    case RequestStatus.CANCELLED:
      return '취소 처리된 요청입니다.';
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
    paddingBottom: Spacing['4xl'],
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
  },
  summaryValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summaryLabel: {
    marginTop: 4,
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  primaryAction: {
    minHeight: 54,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    gap: 6,
    ...Shadows.sm,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.textTertiary,
    ...Typography.body,
  },
  requestCard: {
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseLabel: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: Typography.fontSize.sm,
  },
  requestTime: {
    color: Colors.textDisabled,
    fontSize: Typography.fontSize.xs,
  },
  routeTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  routeSubtitle: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
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
    backgroundColor: Colors.gray100,
  },
  stepPillText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  stepPillTextActive: {
    color: Colors.primary,
  },
  stepPillTextIdle: {
    color: Colors.textTertiary,
  },
  infoPanel: {
    gap: 8,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  infoLabel: {
    flex: 1,
    color: Colors.textTertiary,
    ...Typography.bodySmall,
  },
  infoValue: {
    flex: 1.4,
    textAlign: 'right',
    color: Colors.textPrimary,
    ...Typography.bodySmall,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryAction: {
    minHeight: 40,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryMint,
  },
  secondaryActionText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  warningAction: {
    backgroundColor: '#FEE2E2',
  },
  warningText: {
    color: Colors.error,
  },
  disabledAction: {
    opacity: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.46)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  modalMessage: {
    color: Colors.textSecondary,
    ...Typography.body,
  },
  modalActions: {
    gap: 10,
  },
  modalActionButton: {
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryMint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  modalActionButtonDanger: {
    backgroundColor: '#FEE2E2',
  },
  modalActionText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  modalActionTextDanger: {
    color: Colors.error,
  },
  modalSecondaryButton: {
    backgroundColor: Colors.gray100,
  },
  modalSecondaryText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
