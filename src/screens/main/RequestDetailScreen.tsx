import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import AppTopBar from '../../components/common/AppTopBar';
import { ensureChatRoomForRequest, getChatRoomByRequestId } from '../../services/chat-service';
import {
  cancelDeliveryFlow,
  confirmDeliveryByRequester,
  getDeliveryByRequestId,
} from '../../services/delivery-service';
import { requireUserId } from '../../services/firebase';
import {
  cancelRequest,
  getRequestById,
  increaseRequestBid,
  subscribeToRequest,
} from '../../services/request-service';
import { BorderRadius, Colors, Shadows, Spacing } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { RequestStatus, type Request } from '../../types/request';

type RequestDetailRoute = RouteProp<MainStackParamList, 'RequestDetail'>;

type WorkingState = 'cancel' | 'rematch' | 'confirm' | null;

function toDate(value?: Timestamp | Date | null): Date | null {
  if (!value) return null;
  return value instanceof Timestamp ? value.toDate() : value;
}

function formatDateTime(value?: Timestamp | Date | null): string {
  const resolved = toDate(value);
  if (!resolved || Number.isNaN(resolved.getTime())) return '-';
  return resolved.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRequestAmount(request: Request): number {
  const candidates = [
    request.fee?.totalFee,
    request.feeBreakdown?.totalFee,
    request.initialNegotiationFee,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function getStatusLabel(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.PENDING:
      return '매칭 대기';
    case RequestStatus.MATCHED:
      return '길러 매칭 완료';
    case RequestStatus.ACCEPTED:
      return '배송 수락 완료';
    case RequestStatus.IN_TRANSIT:
      return '배송 이동 중';
    case RequestStatus.ARRIVED:
      return '도착 확인';
    case RequestStatus.AT_LOCKER:
      return '사물함 보관';
    case RequestStatus.DELIVERED:
      return '수령 확인 대기';
    case RequestStatus.COMPLETED:
      return '배송 완료';
    case RequestStatus.CANCELLED:
      return '요청 취소';
    default:
      return '상태 확인 필요';
  }
}

function getRequestProgressDescription(request: Request): string {
  if (request.beta1RequestStatus === 'match_pending' && request.status === RequestStatus.PENDING) {
    return '후보를 찾는 중입니다.';
  }

  if (request.beta1RequestStatus === 'accepted') {
    return '배송이 시작됐습니다.';
  }

  return '현재 상태입니다.';
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
  label,
  icon,
  primary,
  destructive,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  primary?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        destructive && styles.actionButtonDanger,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <MaterialIcons
        name={icon}
        size={18}
        color={primary ? Colors.white : destructive ? Colors.error : Colors.primary}
      />
      <Text
        style={[
          styles.actionButtonText,
          primary && styles.actionButtonTextPrimary,
          destructive && styles.actionButtonTextDanger,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function RequestDetailScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<RequestDetailRoute>();
  const { requestId } = route.params;

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<WorkingState>(null);

  const loadRequest = useCallback(async () => {
    try {
      const nextRequest = await getRequestById(requestId);
      setRequest(nextRequest);
    } catch (error) {
      console.error('Failed to load request detail', error);
      Alert.alert('요청 정보를 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    const unsubscribe = subscribeToRequest(requestId, (nextRequest) => {
      setRequest(nextRequest);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [requestId]);

  async function onRefresh() {
    setRefreshing(true);
    await loadRequest();
  }

  async function openChat() {
    if (!request) return;

    try {
      let room = await getChatRoomByRequestId(request.requestId);

      if (!room && request.requesterId && request.matchedGillerId) {
        room = await ensureChatRoomForRequest({
          requestId: request.requestId,
          requesterId: request.requesterId,
          gillerId: request.matchedGillerId,
          requestInfo: {
            from: request.pickupStation.stationName,
            to: request.deliveryStation.stationName,
            urgency: request.urgency ?? 'normal',
          },
        });
      }

      if (!room) {
        Alert.alert('채팅방을 열 수 없습니다', '매칭 후 다시 시도해 주세요.');
        return;
      }

      const me = requireUserId();
      const other =
        room.participants.user1.userId === me ? room.participants.user2 : room.participants.user1;

      navigation.navigate('Chat', {
        chatRoomId: room.chatRoomId,
        otherUserId: other.userId,
        otherUserName: other.name,
      });
    } catch (error) {
      console.error('Failed to open chat', error);
      Alert.alert('채팅방 오류', '잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleIncreaseBid(amount: number) {
    if (!request) return;

    try {
      setWorking('rematch');
      const result = await increaseRequestBid(request.requestId, requireUserId(), amount);

      if (!result.success) {
        Alert.alert('금액 조정 실패', result.message ?? '지금은 조정할 수 없습니다.');
        return;
      }

      Alert.alert('금액을 올렸습니다', `${(result.newFee ?? 0).toLocaleString()}원으로 다시 요청합니다.`);
      await loadRequest();
    } catch (error) {
      console.error('Failed to increase bid', error);
      Alert.alert('재매칭 금액 조정 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(null);
    }
  }

  function handleRematchAction() {
    if (!request) return;

    Alert.alert('다시 시도할까요?', '금액을 올리거나 예약으로 바꿀 수 있습니다.', [
      {
        text: '금액 1,000원 올리기',
        onPress: () => void handleIncreaseBid(1000),
      },
      {
        text: '예약으로 바꾸기',
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
              recipientName: undefined,
              recipientPhone: undefined,
              urgency: 'normal',
              directParticipationMode: 'none',
              preferredPickupTime: request.preferredTime?.departureTime,
              preferredArrivalTime: request.preferredTime?.arrivalTime,
            },
          }),
      },
      { text: '닫기', style: 'cancel' },
    ]);
  }

  function openDispute() {
    navigation.navigate('DisputeReport', { deliveryId: request?.primaryDeliveryId });
  }

  function handleDepositPayment() {
    if (!request?.matchedGillerId) {
      Alert.alert('보증금 결제를 진행할 수 없습니다', '길러가 매칭된 뒤 다시 시도해 주세요.');
      return;
    }

    navigation.navigate('DepositPayment', {
      gillerId: request.matchedGillerId,
      requesterId: request.requesterId,
      gllerId: request.requesterId,
      requestId: request.requestId,
      itemValue: Number(request.itemValue ?? 0),
    });
  }

  function handleCancel() {
    if (!request) return;

    const isAccepted =
      request.status === RequestStatus.ACCEPTED ||
      request.status === RequestStatus.IN_TRANSIT ||
      request.status === RequestStatus.ARRIVED ||
      request.status === RequestStatus.AT_LOCKER ||
      request.status === RequestStatus.DELIVERED;

    Alert.alert(
      isAccepted ? '배송을 취소하시겠어요?' : '요청을 취소하시겠어요?',
      isAccepted
        ? '수락된 배송은 진행 상태에 따라 바로 취소되지 않을 수 있습니다.'
        : '취소하면 현재 요청은 더 이상 매칭되지 않습니다.',
      [
        { text: '돌아가기', style: 'cancel' },
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
                    reason: 'requester_cancelled_from_request_detail',
                  });

                  if (!result.success) {
                    Alert.alert('취소를 진행할 수 없습니다', result.message, [
                      { text: '분쟁 접수', onPress: openDispute },
                      { text: '닫기', style: 'cancel' },
                    ]);
                    return;
                  }

                  Alert.alert('배송 취소 완료', result.message);
                } else {
                  const cancelled = await cancelRequest(
                    request.requestId,
                    userId,
                    'requester cancelled from request detail'
                  );

                  if (!cancelled) {
                    Alert.alert('요청 취소 실패', '요청 정보를 다시 확인한 뒤 시도해 주세요.');
                    return;
                  }

                  Alert.alert('요청 취소 완료', '요청을 취소했습니다.');
                }

                await loadRequest();
              } catch (error) {
                console.error('Failed to cancel request', error);
                Alert.alert('취소 처리 실패', '잠시 후 다시 시도해 주세요.');
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
      const delivery = (await getDeliveryByRequestId(request.requestId)) as
        | { deliveryId?: string }
        | null;

      if (!delivery?.deliveryId) {
        Alert.alert('배송 정보를 찾지 못했습니다', '배송 생성 상태를 다시 확인해 주세요.');
        return;
      }

      const result = await confirmDeliveryByRequester({
        deliveryId: delivery.deliveryId,
        requesterId: requireUserId(),
      });

      if (!result.success) {
        Alert.alert('수령 확인 실패', result.message);
        return;
      }

      Alert.alert('수령 확인 완료', '배송을 완료 처리했습니다.');
      await loadRequest();
    } catch (error) {
      console.error('Failed to confirm delivery', error);
      Alert.alert('수령 확인 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setWorking(null);
    }
  }

  const amount = useMemo(() => (request ? getRequestAmount(request) : 0), [request]);

  if (loading) {
    return (
      <View style={styles.container}>
        <AppTopBar title="요청 상세" onBack={() => navigation.goBack()} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerText}>요청을 불러오는 중입니다.</Text>
        </View>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.container}>
        <AppTopBar title="요청 상세" onBack={() => navigation.goBack()} />
        <View style={styles.centerState}>
          <Text style={styles.errorText}>요청을 찾을 수 없습니다.</Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
          >
            <Text style={styles.emptyStateButtonText}>홈으로 이동</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const canRematch = request.status === RequestStatus.PENDING || request.status === RequestStatus.MATCHED;
  const canCancel =
    request.status !== RequestStatus.CANCELLED && request.status !== RequestStatus.COMPLETED;
  const canDispute =
    request.status === RequestStatus.IN_TRANSIT ||
    request.status === RequestStatus.ARRIVED ||
    request.status === RequestStatus.AT_LOCKER ||
    request.status === RequestStatus.DELIVERED;
  const canConfirm =
    request.status === RequestStatus.DELIVERED || request.status === RequestStatus.AT_LOCKER;
  const routeLabel = `${request.pickupStation.stationName} -> ${request.deliveryStation.stationName}`;
  const preferredTimeLabel = request.preferredTime
    ? `${request.preferredTime.departureTime ?? '-'}${
        request.preferredTime.arrivalTime ? ` / ${request.preferredTime.arrivalTime}` : ''
      }`
    : '-';

  return (
    <View style={styles.container}>
      <AppTopBar title="요청 상세" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>가방까지 배송</Text>
          <Text style={styles.title}>{routeLabel}</Text>
          <Text style={styles.subtitle}>{request.packageInfo.description || '물품 설명 없음'}</Text>
        </View>

        <Panel title="현재 상태">
          <InfoRow label="상태" value={getStatusLabel(request.status)} />
          <InfoRow label="진행 설명" value={getRequestProgressDescription(request)} />
          <InfoRow label="요청 방식" value={request.requestMode === 'reservation' ? '예약' : '즉시'} />
          <InfoRow label="예상 금액" value={`${amount.toLocaleString()}원`} />
          <InfoRow label="마감 시간" value={formatDateTime(request.deadline)} />
        </Panel>

        <Panel title="배송 정보">
          <InfoRow label="출발역" value={`${request.pickupStation.stationName} / ${request.pickupStation.line}`} />
          <InfoRow label="도착역" value={`${request.deliveryStation.stationName} / ${request.deliveryStation.line}`} />
          <InfoRow label="희망 시간" value={preferredTimeLabel} />
          <InfoRow
            label="물품 가치"
            value={typeof request.itemValue === 'number' ? `${request.itemValue.toLocaleString()}원` : '-'}
          />
        </Panel>

        <View style={styles.actionSection}>
          <ActionButton primary icon="chat-bubble-outline" label="채팅 열기" onPress={() => void openChat()} />

          {Boolean(request.matchedGillerId) && (request.itemValue ?? 0) > 0 ? (
            <ActionButton icon="lock" label="보증금 결제" onPress={handleDepositPayment} />
          ) : null}

          {canRematch ? (
            <ActionButton
              icon="trending-up"
              label={working === 'rematch' ? '조정 중...' : '다시 매칭하기'}
              onPress={handleRematchAction}
              disabled={working !== null}
            />
          ) : null}

          {canCancel ? (
            <ActionButton
              icon="cancel"
              label={working === 'cancel' ? '처리 중...' : '배송 취소'}
              onPress={handleCancel}
              disabled={working !== null}
              destructive
            />
          ) : null}

          {canDispute ? (
            <ActionButton icon="report-problem" label="분쟁 접수" onPress={openDispute} />
          ) : null}

          {canConfirm ? (
            <ActionButton
              icon="check-circle-outline"
              label={working === 'confirm' ? '확인 중...' : '수령 확인'}
              onPress={() => void handleConfirmDelivery()}
              disabled={working !== null}
            />
          ) : null}

          <ActionButton
            icon="map"
            label="배송 추적으로 이동"
            onPress={() => navigation.navigate('DeliveryTracking', { requestId: request.requestId })}
          />
        </View>
      </ScrollView>
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
  },
  centerText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStateButton: {
    marginTop: Spacing.md,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  hero: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  kicker: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  panelTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  actionSection: {
    gap: 10,
    paddingBottom: Spacing.xl,
  },
  actionButton: {
    minHeight: 54,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionButtonDanger: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  actionButtonTextPrimary: {
    color: Colors.white,
  },
  actionButtonTextDanger: {
    color: Colors.error,
  },
});
