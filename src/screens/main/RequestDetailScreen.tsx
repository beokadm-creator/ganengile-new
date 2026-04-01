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
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Timestamp } from 'firebase/firestore';
import { getChatRoomByRequestId } from '../../services/chat-service';
import { cancelDeliveryFlow, confirmDeliveryByRequester, getDeliveryByRequestId } from '../../services/delivery-service';
import { requireUserId } from '../../services/firebase';
import { cancelRequest, getRequestById, increaseRequestBid } from '../../services/request-service';
import { BorderRadius, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { RequestStatus, type Request } from '../../types/request';

type RequestDetailRoute = RouteProp<MainStackParamList, 'RequestDetail'>;

export default function RequestDetailScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<RequestDetailRoute>();
  const { requestId } = route.params;

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<'cancel' | 'rematch' | 'confirm' | null>(null);

  const loadRequest = useCallback(async () => {
    try {
      const nextRequest = await getRequestById(requestId);
      setRequest(nextRequest);
    } catch (error) {
      console.error('Failed to load request detail', error);
      Alert.alert('요청을 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  async function onRefresh() {
    setRefreshing(true);
    await loadRequest();
  }

  async function openChat() {
    try {
      const room = await getChatRoomByRequestId(requestId);
      if (!room) {
        Alert.alert('아직 채팅이 열리지 않았습니다', '매칭이나 미션 확정 뒤에 채팅이 열립니다.');
        return;
      }

      const me = requireUserId();
      const otherParticipant = room.participants.user1.userId === me ? room.participants.user2 : room.participants.user1;
      navigation.navigate('Chat', {
        chatRoomId: room.chatRoomId,
        otherUserId: otherParticipant.userId,
        otherUserName: otherParticipant.name,
      });
    } catch (error) {
      console.error('Failed to open chat', error);
      Alert.alert('채팅 연결에 실패했습니다', '잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleIncreaseBid(amount: number) {
    if (!request) return;

    setWorking('rematch');
    try {
      const result = await increaseRequestBid(request.requestId, requireUserId(), amount);
      if (!result.success) {
        Alert.alert('금액 조정 실패', result.message ?? '지금은 금액을 조정할 수 없습니다.');
        return;
      }

      Alert.alert('제안 금액을 올렸습니다', `현재 제안 금액은 ${(result.newFee ?? 0).toLocaleString()}원입니다.`);
      await loadRequest();
    } catch (error) {
      console.error('Failed to increase bid', error);
      Alert.alert('금액 조정 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(null);
    }
  }

  function handleRematchAction() {
    if (!request) return;

    Alert.alert(
      '다시 연결할까요?',
      '급하면 금액을 올려 더 빨리 연결하고, 급하지 않다면 예약 요청으로 전환할 수 있습니다.',
      [
        { text: 'AI 추천 금액 올리기', onPress: () => void handleIncreaseBid(1000) },
        {
          text: '예약으로 전환하기',
          onPress: () =>
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
            }),
        },
        { text: '그대로 둘게요', style: 'cancel' },
      ]
    );
  }

  function openDispute() {
    navigation.navigate('DisputeReport', { deliveryId: request?.primaryDeliveryId });
  }

  function handleCancel() {
    if (!request) return;

    const isAccepted = request.status === RequestStatus.ACCEPTED;
    Alert.alert(
      isAccepted ? '수락된 배송을 취소할까요?' : '요청을 취소할까요?',
      isAccepted
        ? '픽업 전 취소라면 보증금 환불과 배송 취소를 함께 처리합니다. 진행 중이면 분쟁 접수로 이어집니다.'
        : '지금 취소해도 기본 정보는 다음 요청에 참고할 수 있습니다.',
      [
        { text: '유지하기', style: 'cancel' },
        {
          text: '취소하기',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setWorking('cancel');
                const userId = requireUserId();

                if (isAccepted) {
                  const result = await cancelDeliveryFlow({
                    requestId: request.requestId,
                    actorId: userId,
                    actorType: 'requester',
                    reason: 'requester_cancelled_before_pickup_from_request_detail',
                  });

                  if (!result.success) {
                    Alert.alert('취소를 진행할 수 없습니다', result.message, [
                      { text: '분쟁 접수', onPress: openDispute },
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

                await loadRequest();
              } catch (error) {
                console.error('Failed to cancel request', error);
                Alert.alert('취소에 실패했습니다', '잠시 후 다시 시도해 주세요.');
              } finally {
                setWorking(null);
              }
            })();
          },
        },
      ]
    );
  }

  async function handleConfirmDelivery() {
    if (!request) return;

    try {
      setWorking('confirm');
      const delivery = (await getDeliveryByRequestId(request.requestId)) as { deliveryId?: string; gillerId?: string | null } | null;
      const deliveryId = typeof delivery?.deliveryId === 'string' ? delivery.deliveryId : null;
      const deliveryGillerId = typeof delivery?.gillerId === 'string' ? delivery.gillerId : '';

      if (!deliveryId) {
        Alert.alert('배송 정보를 찾지 못했습니다', '배송 생성 뒤 다시 시도해 주세요.');
        return;
      }

      const result = await confirmDeliveryByRequester({
        deliveryId,
        requesterId: requireUserId(),
      });

      if (!result.success) {
        Alert.alert('수령 확인 실패', result.message);
        return;
      }

      Alert.alert('수령 확인 완료', '배송을 완료 처리했습니다. 평가와 최종 정산으로 이어집니다.', [
        {
          text: '평가 남기기',
          onPress: () =>
            navigation.navigate('Rating', {
              deliveryId,
              gillerId: deliveryGillerId,
              gllerId: deliveryGillerId,
            }),
        },
        { text: '닫기', style: 'cancel' },
      ]);
      await loadRequest();
    } catch (error) {
      console.error('Failed to confirm delivery', error);
      Alert.alert('수령 확인 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(null);
    }
  }

  function handleDepositPayment() {
    if (!request?.matchedGillerId || !request.itemValue || request.itemValue <= 0) {
      Alert.alert('보증금 준비 중', '길러 매칭과 물품 가치를 확인하면 보증금 결제로 이어집니다.');
      return;
    }

    navigation.navigate('DepositPayment', {
      gillerId: request.matchedGillerId,
      gllerId: request.requesterId,
      requestId: request.requestId,
      itemValue: request.itemValue,
    });
  }

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.centerText}>요청 상세를 불러오는 중입니다.</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.errorText}>요청 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const amount = getRequestAmount(request);
  const canRematch = request.status === RequestStatus.PENDING || request.status === RequestStatus.MATCHED;
  const canCancel = canRematch || request.status === RequestStatus.ACCEPTED;
  const canDispute =
    request.status === RequestStatus.IN_TRANSIT ||
    request.status === RequestStatus.ARRIVED ||
    request.status === RequestStatus.AT_LOCKER ||
    request.status === RequestStatus.DELIVERED;
  const canConfirm = request.status === RequestStatus.DELIVERED || request.status === RequestStatus.AT_LOCKER;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>가는길에</Text>
        <Text style={styles.title}>
          {request.pickupStation.stationName} {'->'} {request.deliveryStation.stationName}
        </Text>
        <Text style={styles.subtitle}>{request.packageInfo.description || '물품 설명 없음'}</Text>
      </View>

      <Panel title="현재 상태">
        <InfoRow label="상태" value={getStatusLabel(request.status)} />
        <InfoRow label="요청 방식" value={request.requestMode === 'reservation' ? '예약' : '즉시'} />
        <InfoRow label="제안 금액" value={`${amount.toLocaleString()}원`} />
        <InfoRow label="마감" value={formatDateTime(request.deadline)} />
      </Panel>

      <Panel title="배송 정보">
        <InfoRow label="출발" value={`${request.pickupStation.stationName} · ${request.pickupStation.line}`} />
        <InfoRow label="도착" value={`${request.deliveryStation.stationName} · ${request.deliveryStation.line}`} />
        <InfoRow
          label="희망 시간"
          value={request.preferredTime ? `${request.preferredTime.departureTime} 출발 · ${request.preferredTime.arrivalTime ?? '-'} 도착` : '미설정'}
        />
        <InfoRow label="물품 가치" value={typeof request.itemValue === 'number' ? `${request.itemValue.toLocaleString()}원` : '미입력'} />
      </Panel>

      <View style={styles.actionSection}>
        <ActionButton primary icon="chat-bubble-outline" label="채팅 열기" onPress={() => void openChat()} />

        {Boolean(request.matchedGillerId) && (request.itemValue ?? 0) > 0 ? (
          <ActionButton icon="lock" label="보증금 결제" onPress={handleDepositPayment} />
        ) : null}

        {canRematch ? (
          <ActionButton
            icon="trending-up"
            label={working === 'rematch' ? '조정 중...' : '다시 잡기'}
            onPress={handleRematchAction}
            disabled={working !== null}
          />
        ) : null}

        {canCancel ? (
          <ActionButton
            icon="close"
            label={working === 'cancel' ? '취소 중...' : request.status === RequestStatus.ACCEPTED ? '배송 취소' : '요청 취소'}
            onPress={handleCancel}
            disabled={working !== null}
            warning
          />
        ) : null}

        {canDispute ? <ActionButton icon="report-problem" label="분쟁 접수" onPress={openDispute} /> : null}

        {canConfirm ? (
          <ActionButton
            icon="verified"
            label={working === 'confirm' ? '확인 중...' : '수령 확인'}
            onPress={() => void handleConfirmDelivery()}
            disabled={working !== null}
          />
        ) : null}

        <ActionButton icon="local-shipping" label="배송 추적" onPress={() => navigation.navigate('DeliveryTracking', { requestId })} />
      </View>
    </ScrollView>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
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

function ActionButton({
  icon,
  label,
  onPress,
  primary = false,
  warning = false,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
  primary?: boolean;
  warning?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        primary && styles.primaryAction,
        warning && styles.warningAction,
        disabled && styles.disabledAction,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <MaterialIcons name={icon} size={18} color={primary ? '#FFFFFF' : warning ? '#B42318' : '#115E59'} />
      <Text style={[styles.actionText, primary && styles.primaryActionText, warning && styles.warningText]}>{label}</Text>
    </TouchableOpacity>
  );
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

function getRequestAmount(request: Request): number {
  return request.fee?.totalFee ?? request.feeBreakdown?.totalFee ?? request.initialNegotiationFee ?? 0;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#F8FAFC',
  },
  centerText: {
    marginTop: Spacing.md,
    color: '#475569',
    ...Typography.body,
  },
  errorText: {
    color: '#B42318',
    ...Typography.body,
  },
  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    color: '#475569',
    ...Typography.body,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
    gap: Spacing.sm,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  infoLabel: {
    color: '#64748B',
    ...Typography.bodySmall,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: '#0F172A',
    ...Typography.bodySmall,
  },
  actionSection: {
    gap: Spacing.sm,
  },
  actionButton: {
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  primaryAction: {
    backgroundColor: '#115E59',
  },
  warningAction: {
    backgroundColor: '#FFF5F5',
  },
  disabledAction: {
    opacity: 0.6,
  },
  actionText: {
    color: '#115E59',
    ...Typography.bodyBold,
  },
  primaryActionText: {
    color: '#FFFFFF',
  },
  warningText: {
    color: '#B42318',
  },
});

