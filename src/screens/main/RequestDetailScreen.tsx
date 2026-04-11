import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Timestamp } from 'firebase/firestore';

import AppTopBar from '../../components/common/AppTopBar';
import { ensureChatRoomForRequest, getChatRoomByRequestId } from '../../services/chat-service';
import { deliveryPartnerService } from '../../services/delivery-partner-service';
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
import {
  getRequesterProgressDescription,
  getRequesterStatusLabel,
} from '../../services/request-status-presentation-service';
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
  const [partnerDispatches, setPartnerDispatches] = useState<
    Array<{
      dispatchId: string;
      partnerName: string;
      status: string;
      dispatchMethod: string;
      updatedAt: Date;
      opsMemo?: string;
    }>
  >([]);
  const [showRematchOptions, setShowRematchOptions] = useState(false);
  const [showCancelOptions, setShowCancelOptions] = useState(false);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Tabs', { screen: 'Requests' });
  }, [navigation]);

  const loadRequest = useCallback(async () => {
    try {
      const nextRequest = await getRequestById(requestId);
      setRequest(nextRequest);
      const dispatchSummary = await deliveryPartnerService.getDispatchSummary({
        requestId,
        ...(nextRequest?.primaryDeliveryId ? { deliveryId: nextRequest.primaryDeliveryId } : {}),
      }).catch(() => []);
      setPartnerDispatches(dispatchSummary);
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
      void deliveryPartnerService
        .getDispatchSummary({
          requestId,
          ...(nextRequest?.primaryDeliveryId ? { deliveryId: nextRequest.primaryDeliveryId } : {}),
        })
        .then(setPartnerDispatches)
        .catch(() => setPartnerDispatches([]));
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

  function navigateToReservation() {
    if (!request) return;

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
        pickupLocationDetail: request.pickupLocationDetail,
        storageLocation: request.storageLocation,
        specialInstructions: request.specialInstructions,
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

  function handleRematchAction() {
    if (!request) return;

    if (Platform.OS === 'web') {
      setShowRematchOptions(true);
      return;
    }

    Alert.alert('다시 시도할까요?', '금액을 올리거나 예약으로 바꿀 수 있습니다.', [
      {
        text: '금액 1,000원 올리기',
        onPress: () => void handleIncreaseBid(1000),
      },
      {
        text: '예약으로 바꾸기',
        onPress: navigateToReservation,
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

    if (Platform.OS === 'web') {
      setShowCancelOptions(true);
      return;
    }

    if (isAccepted) {
      Alert.alert('바로 취소보다 먼저 확인해 볼까요?', '채팅이나 분쟁 접수로 먼저 정리할 수 있습니다.', [
        { text: '채팅 열기', onPress: () => void openChat() },
        { text: '분쟁 접수', onPress: openDispute },
        { text: '그래도 취소', style: 'destructive', onPress: () => void executeCancel() },
      ]);
      return;
    }

    Alert.alert('취소 전에 다른 방법도 있습니다', '매칭을 조금 더 붙이거나 예약으로 바꿔볼 수 있습니다.', [
      { text: '1,000원 올리기', onPress: () => void handleIncreaseBid(1000) },
      { text: '예약으로 바꾸기', onPress: navigateToReservation },
      { text: '그래도 취소', style: 'destructive', onPress: () => void executeCancel() },
    ]);
  }

  async function executeCancel() {
    if (!request) return;

    const isAccepted =
      request.status === RequestStatus.ACCEPTED ||
      request.status === RequestStatus.IN_TRANSIT ||
      request.status === RequestStatus.ARRIVED ||
      request.status === RequestStatus.AT_LOCKER ||
      request.status === RequestStatus.DELIVERED;

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
        <AppTopBar title="요청 상세" onBack={handleBack} />
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
        <AppTopBar title="요청 상세" onBack={handleBack} />
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
  const canOpenChat = Boolean(request.matchedGillerId) && request.status !== RequestStatus.PENDING;
  const canDispute =
    request.status === RequestStatus.IN_TRANSIT ||
    request.status === RequestStatus.ARRIVED ||
    request.status === RequestStatus.AT_LOCKER ||
    request.status === RequestStatus.DELIVERED ||
    request.status === RequestStatus.COMPLETED;
  const canConfirm =
    request.status === RequestStatus.DELIVERED || request.status === RequestStatus.AT_LOCKER;
  const canTrackDelivery =
    Boolean(request.primaryDeliveryId) &&
    [
      RequestStatus.ACCEPTED,
      RequestStatus.IN_TRANSIT,
      RequestStatus.ARRIVED,
      RequestStatus.AT_LOCKER,
      RequestStatus.DELIVERED,
      RequestStatus.COMPLETED,
    ].includes(request.status);
  const routeLabel = `${request.pickupStation.stationName} -> ${request.deliveryStation.stationName}`;
  const preferredTimeLabel = request.preferredTime
    ? `${request.preferredTime.departureTime ?? '-'}${
        request.preferredTime.arrivalTime ? ` / ${request.preferredTime.arrivalTime}` : ''
      }`
    : '-';

  return (
    <View style={styles.container}>
      <AppTopBar
        title="요청 상세"
        onBack={handleBack}
        rightSlot={
          <TouchableOpacity style={styles.topShortcut} activeOpacity={0.85} onPress={handleBack}>
            <Text style={styles.topShortcutText}>목록</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>{request.requestMode === 'reservation' ? '예약 배송 요청' : '배송 요청 상세'}</Text>
          <Text style={styles.title}>{routeLabel}</Text>
          <Text style={styles.subtitle}>{request.packageInfo.description || '물품 설명 없음'}</Text>
        </View>

        <Panel title="현재 상태">
          <InfoRow label="상태" value={getRequesterStatusLabel(request.status)} />
          <InfoRow label="진행 설명" value={getRequesterProgressDescription(request)} />
          {request.missionProgress ? (
            <InfoRow
              label="구간 연결"
              value={`${request.missionProgress.acceptedMissionCount}/${request.missionProgress.totalMissionCount} 구간`}
            />
          ) : null}
          <InfoRow label="요청 방식" value={request.requestMode === 'reservation' ? '예약' : '즉시'} />
          <InfoRow label="예상 금액" value={`${amount.toLocaleString()}원`} />
          <InfoRow label="마감 시간" value={formatDateTime(request.deadline)} />
        </Panel>

        <Panel title="배송 정보">
          <InfoRow label="출발역" value={`${request.pickupStation.stationName} / ${request.pickupStation.line}`} />
          <InfoRow label="도착역" value={`${request.deliveryStation.stationName} / ${request.deliveryStation.line}`} />
          {request.pickupAddress ? (
            <InfoRow label="출발지 주소" value={request.pickupAddress.fullAddress} />
          ) : null}
          {request.deliveryAddress ? (
            <InfoRow label="도착지 주소" value={request.deliveryAddress.fullAddress} />
          ) : null}
          <InfoRow label="희망 시간" value={preferredTimeLabel} />
          <InfoRow
            label="물품 가치"
            value={typeof request.itemValue === 'number' ? `${request.itemValue.toLocaleString()}원` : '-'}
          />
          <InfoRow label="수령인" value={request.recipientName ?? '-'} />
          <InfoRow label="수령 연락처" value={request.recipientPhone ?? '-'} />
          {request.pickupLocationDetail ? <InfoRow label="픽업 안내" value={request.pickupLocationDetail} /> : null}
          {request.storageLocation ? <InfoRow label="사물함 안내" value={request.storageLocation} /> : null}
          {request.specialInstructions ? <InfoRow label="추가 요청" value={request.specialInstructions} /> : null}
          <InfoRow
            label="사진"
            value={
              request.selectedPhotoIds && request.selectedPhotoIds.length > 0
                ? `${request.selectedPhotoIds.length}장 등록`
                : '없음'
            }
          />
        </Panel>

        {partnerDispatches.length > 0 ? (
          <Panel title="업체 위임 상태">
            {partnerDispatches.slice(0, 3).map((item) => (
              <React.Fragment key={item.dispatchId}>
                <InfoRow label={item.partnerName} value={`${item.status} / ${item.dispatchMethod}`} />
                {item.opsMemo ? <InfoRow label="운영 메모" value={item.opsMemo} /> : null}
              </React.Fragment>
            ))}
          </Panel>
        ) : null}

        {request.packageInfo.imageUrl ? (
          <Panel title="물건 사진">
            <Image source={{ uri: request.packageInfo.imageUrl }} style={styles.photoPreview} />
          </Panel>
        ) : null}

        <View style={styles.actionSection}>
          {canOpenChat ? (
            <ActionButton primary icon="chat-bubble-outline" label="채팅 열기" onPress={() => void openChat()} />
          ) : null}

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
              label={
                working === 'cancel'
                  ? '처리 중...'
                  : request.status === RequestStatus.PENDING || request.status === RequestStatus.MATCHED
                    ? '요청 취소'
                    : '배송 취소'
              }
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

          {canTrackDelivery ? (
            <ActionButton
              icon="map"
              label={request.status === RequestStatus.COMPLETED ? '완료된 배송 보기' : '배송 추적으로 이동'}
              onPress={() => navigation.navigate('DeliveryTracking', { requestId: request.requestId })}
            />
          ) : null}
        </View>
      </ScrollView>

      <ChoiceModal
        visible={showRematchOptions}
        title="다시 시도할까요?"
        message="금액을 올리거나 예약으로 바꿀 수 있습니다."
        onClose={() => setShowRematchOptions(false)}
        actions={[
          {
            label: '금액 1,000원 올리기',
            onPress: () => {
              setShowRematchOptions(false);
              void handleIncreaseBid(1000);
            },
          },
          {
            label: '예약으로 바꾸기',
            onPress: () => {
              setShowRematchOptions(false);
              navigateToReservation();
            },
          },
        ]}
      />

      <ChoiceModal
        visible={showCancelOptions}
        title={
          request.status === RequestStatus.ACCEPTED ||
          request.status === RequestStatus.IN_TRANSIT ||
          request.status === RequestStatus.ARRIVED ||
          request.status === RequestStatus.AT_LOCKER ||
          request.status === RequestStatus.DELIVERED
            ? '배송을 취소하시겠어요?'
            : '요청을 취소하시겠어요?'
        }
        message={
          request.status === RequestStatus.ACCEPTED ||
          request.status === RequestStatus.IN_TRANSIT ||
          request.status === RequestStatus.ARRIVED ||
          request.status === RequestStatus.AT_LOCKER ||
          request.status === RequestStatus.DELIVERED
            ? '진행 상태에 따라 바로 취소되지 않을 수 있습니다.'
            : '취소 전에 매칭을 조금 더 붙이거나 예약으로 바꿔볼 수 있습니다.'
        }
        onClose={() => setShowCancelOptions(false)}
        actions={
          request.status === RequestStatus.ACCEPTED ||
          request.status === RequestStatus.IN_TRANSIT ||
          request.status === RequestStatus.ARRIVED ||
          request.status === RequestStatus.AT_LOCKER ||
          request.status === RequestStatus.DELIVERED
            ? [
                {
                  label: '채팅 열기',
                  onPress: () => {
                    setShowCancelOptions(false);
                    void openChat();
                  },
                },
                {
                  label: '분쟁 접수',
                  onPress: () => {
                    setShowCancelOptions(false);
                    openDispute();
                  },
                },
                {
                  label: '그래도 취소',
                  destructive: true,
                  onPress: () => {
                    setShowCancelOptions(false);
                    void executeCancel();
                  },
                },
              ]
            : [
                {
                  label: '1,000원 올리기',
                  onPress: () => {
                    setShowCancelOptions(false);
                    void handleIncreaseBid(1000);
                  },
                },
                {
                  label: '예약으로 바꾸기',
                  onPress: () => {
                    setShowCancelOptions(false);
                    navigateToReservation();
                  },
                },
                {
                  label: '그래도 취소',
                  destructive: true,
                  onPress: () => {
                    setShowCancelOptions(false);
                    void executeCancel();
                  },
                },
              ]
        }
      />
    </View>
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
  photoPreview: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray100,
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
  topShortcut: {
    minHeight: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryMint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  topShortcutText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
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
    fontSize: 18,
    fontWeight: '800',
  },
  modalMessage: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
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
    backgroundColor: Colors.errorLight,
  },
  modalActionText: {
    color: Colors.primary,
    fontSize: 15,
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
    fontSize: 15,
    fontWeight: '700',
  },
});
