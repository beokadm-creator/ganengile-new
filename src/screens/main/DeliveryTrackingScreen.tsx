import React, { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import AppTopBar from '../../components/common/AppTopBar';
import { NaverMapCard } from '../../components/maps/NaverMapCard';
import { getChatRoomByRequestId } from '../../services/chat-service';
import {
  confirmDeliveryByRequester,
  getDeliveryByRequestId,
  subscribeToDeliveryByRequestId,
} from '../../services/delivery-service';
import { requireUserId } from '../../services/firebase';
import { getRequestById, subscribeToRequest } from '../../services/request-service';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { formatWeightDisplay } from '../../utils/package-weight';
import { toTrackingModel, type TrackingEvent, type TrackingModel } from '../../utils/request-adapters';

type DeliveryLookup = { deliveryId: string; gillerId?: string };
type DeliveryTrackingRoute = RouteProp<MainStackParamList, 'DeliveryTracking'>;
type StepState = 'completed' | 'current' | 'upcoming';
type TrackingStep = {
  key: string;
  label: string;
  description: string;
  state: StepState;
  timestamp?: Date;
};

const STEP_ORDER = ['created', 'matched', 'picked_up', 'in_transit', 'arrived', 'completed'] as const;

function formatDateLabel(value: Date | string | undefined): string {
  if (!value) return '-';
  const resolved = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(resolved.getTime())) return '-';
  return resolved.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hasValidCoordinate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0;
}

function hasValidStationCoords(station: TrackingModel['pickupStation']): boolean {
  return hasValidCoordinate(station.lat) && hasValidCoordinate(station.lng);
}

function getCurrentStepKey(status: string): (typeof STEP_ORDER)[number] {
  switch (status) {
    case 'matched':
    case 'accepted':
      return 'matched';
    case 'in_transit':
      return 'in_transit';
    case 'arrived':
    case 'at_locker':
      return 'arrived';
    case 'delivered':
    case 'completed':
      return 'completed';
    default:
      return 'created';
  }
}

function getStepLabel(key: (typeof STEP_ORDER)[number], status: string): string {
  if (key === 'arrived' && status === 'at_locker') {
    return '사물함 보관';
  }

  switch (key) {
    case 'created':
      return '요청 접수';
    case 'matched':
      return '매칭 완료';
    case 'picked_up':
      return '픽업 완료';
    case 'in_transit':
      return '이동 중';
    case 'arrived':
      return '도착 확인';
    case 'completed':
      return '배송 완료';
    default:
      return '진행 상태';
  }
}

function getStepDescription(key: (typeof STEP_ORDER)[number], status: string): string {
  if (key === 'arrived' && status === 'at_locker') {
    return '물품이 사물함에 안전하게 보관되었습니다.';
  }

  switch (key) {
    case 'created':
      return '배송 요청이 등록되었습니다.';
    case 'matched':
      return '길러 배정과 연결이 끝났습니다.';
    case 'picked_up':
      return '출발지에서 물품 인계를 마쳤습니다.';
    case 'in_transit':
      return '목적지로 이동하고 있습니다.';
    case 'arrived':
      return '도착 후 전달 준비 단계입니다.';
    case 'completed':
      return '수령 확인과 완료 처리가 끝났습니다.';
    default:
      return '';
  }
}

function buildTrackingSteps(model: TrackingModel): TrackingStep[] {
  const currentStepKey = getCurrentStepKey(model.status);
  const currentIndex = STEP_ORDER.indexOf(currentStepKey);
  const eventMap = new Map<string, TrackingEvent>();

  for (const event of model.trackingEvents ?? []) {
    if (!eventMap.has(event.type)) {
      eventMap.set(event.type, event);
    }
  }

  if (model.status === 'cancelled') {
    return [
      {
        key: 'cancelled',
        label: '배송 취소',
        description: '진행이 중단되어 배송이 취소되었습니다.',
        state: 'current',
        timestamp: model.updatedAt,
      },
    ];
  }

  return STEP_ORDER.map((key, index) => {
    const matchedEvent = eventMap.get(key);
    const state: StepState =
      index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming';

    return {
      key,
      label: getStepLabel(key, model.status),
      description: matchedEvent?.description ?? getStepDescription(key, model.status),
      state,
      timestamp: matchedEvent?.timestamp ?? (state !== 'upcoming' ? model.updatedAt ?? model.createdAt : undefined),
    };
  });
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'matched':
    case 'accepted':
      return '길러가 연결되었습니다.';
    case 'in_transit':
      return '배송이 이동 중입니다.';
    case 'arrived':
      return '도착 후 전달을 준비하고 있습니다.';
    case 'at_locker':
      return '사물함 인계가 진행 중입니다.';
    case 'delivered':
      return '수령 확인을 기다리고 있습니다.';
    case 'completed':
      return '배송이 완료되었습니다.';
    case 'cancelled':
      return '배송이 취소되었습니다.';
    default:
      return '배송 준비 중입니다.';
  }
}

function calculateProgress(status: string): number {
  switch (status) {
    case 'matched':
    case 'accepted':
      return 25;
    case 'in_transit':
      return 60;
    case 'arrived':
      return 80;
    case 'at_locker':
      return 85;
    case 'delivered':
      return 92;
    case 'completed':
      return 100;
    case 'cancelled':
      return 0;
    default:
      return 12;
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StepRow({ step }: { step: TrackingStep }) {
  return (
    <View style={styles.stepRow}>
      <View
        style={[
          styles.stepDot,
          step.state === 'completed' && styles.stepDotCompleted,
          step.state === 'current' && styles.stepDotCurrent,
        ]}
      />
      <View style={styles.stepCopy}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepLabel}>{step.label}</Text>
          <Text style={styles.stepState}>
            {step.state === 'completed' ? '완료' : step.state === 'current' ? '진행 중' : '대기'}
          </Text>
        </View>
        <Text style={styles.stepDescription}>{step.description}</Text>
        {step.timestamp ? <Text style={styles.stepTimestamp}>{formatDateLabel(step.timestamp)}</Text> : null}
      </View>
    </View>
  );
}

function TimelineRow({ event }: { event: TrackingEvent }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineDot} />
      <View style={styles.timelineCopy}>
        <Text style={styles.timelineTitle}>{event.title}</Text>
        <Text style={styles.timelineDescription}>{event.description}</Text>
        <Text style={styles.timelineMeta}>{formatDateLabel(event.timestamp)}</Text>
      </View>
    </View>
  );
}

export default function DeliveryTrackingScreen(): JSX.Element {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<DeliveryTrackingRoute>();
  const requestId = route.params.requestId ?? route.params.matchId ?? '';
  const [trackingData, setTrackingData] = useState<TrackingModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let fallbackUnsubscribe: (() => void) | null = null;
    const unsubscribeDelivery = subscribeToDeliveryByRequestId(requestId, (delivery) => {
      if (delivery) {
        setTrackingData(toTrackingModel(delivery));
        setLoading(false);
        return;
      }

      fallbackUnsubscribe?.();
      fallbackUnsubscribe = subscribeToRequest(requestId, (request) => {
        if (request) {
          setTrackingData(toTrackingModel(request));
        }
        setLoading(false);
      });
    });

    return () => {
      unsubscribeDelivery();
      fallbackUnsubscribe?.();
    };
  }, [requestId]);

  async function loadTracking() {
    try {
      const delivery = (await getDeliveryByRequestId(requestId)) as
        | DeliveryLookup
        | Record<string, unknown>
        | null;

      if (delivery) {
        setTrackingData(toTrackingModel(delivery));
        return;
      }

      const request = await getRequestById(requestId);
      if (request) {
        setTrackingData(toTrackingModel(request));
      }
    } catch (error) {
      console.error('Failed to load tracking', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openChat() {
    try {
      const room = await getChatRoomByRequestId(requestId);
      if (!room) return;

      const viewerId = requireUserId();
      const other =
        room.participants.user1.userId === viewerId
          ? room.participants.user2
          : room.participants.user1;

      navigation.navigate('Chat', {
        chatRoomId: room.chatRoomId,
        otherUserId: other.userId,
        otherUserName: other.name,
      });
    } catch (error) {
      console.error('Failed to open chat', error);
    }
  }

  async function handleConfirmDelivery() {
    try {
      setConfirming(true);
      const delivery = (await getDeliveryByRequestId(requestId)) as DeliveryLookup | null;
      if (!delivery?.deliveryId) return;

      const result = await confirmDeliveryByRequester({
        deliveryId: delivery.deliveryId,
        requesterId: requireUserId(),
      });

      if (result.success) {
        await loadTracking();
      }
    } catch (error) {
      console.error('Failed to confirm delivery', error);
    } finally {
      setConfirming(false);
    }
  }

  const progress = useMemo(
    () => calculateProgress(trackingData?.status ?? 'pending'),
    [trackingData?.status],
  );
  const steps = useMemo(
    () => (trackingData ? buildTrackingSteps(trackingData) : []),
    [trackingData],
  );
  const hasMapCoordinates = Boolean(
    trackingData &&
      hasValidStationCoords(trackingData.pickupStation) &&
      hasValidStationCoords(trackingData.deliveryStation),
  );

  const pickupLatitude = trackingData?.pickupStation.lat ?? 0;
  const pickupLongitude = trackingData?.pickupStation.lng ?? 0;
  const deliveryLatitude = trackingData?.deliveryStation.lat ?? 0;
  const deliveryLongitude = trackingData?.deliveryStation.lng ?? 0;
  const mapCenter = {
    latitude: (pickupLatitude + deliveryLatitude) / 2,
    longitude: (pickupLongitude + deliveryLongitude) / 2,
  };

  if (loading || !trackingData) {
    return (
      <View style={styles.container}>
        <AppTopBar title="배송 추적" onBack={() => navigation.goBack()} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerText}>배송 추적 정보를 불러오는 중입니다.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppTopBar title="배송 추적" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadTracking()} />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>실시간 배송 상태</Text>
          <Text style={styles.heroTitle}>{getStatusLabel(trackingData.status)}</Text>
          <View style={styles.progressRail}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}% 진행</Text>
        </View>

        {hasMapCoordinates ? (
          <NaverMapCard
            center={mapCenter}
            markers={[
              { latitude: pickupLatitude, longitude: pickupLongitude, label: '출발' },
              { latitude: deliveryLatitude, longitude: deliveryLongitude, label: '도착' },
            ]}
            title="배송 구간 지도"
            subtitle="실제 역 좌표를 기준으로 현재 배송 구간을 보여드립니다."
          />
        ) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>배송 구간 지도</Text>
            <Text style={styles.panelBody}>
              역 좌표가 아직 준비되지 않아 지도 미리보기를 표시하지 않습니다.
            </Text>
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>진행 단계</Text>
          {steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>경로 요약</Text>
          <InfoRow
            label="출발"
            value={`${trackingData.pickupStation.stationName} / ${trackingData.pickupStation.line}`}
          />
          <InfoRow
            label="도착"
            value={`${trackingData.deliveryStation.stationName} / ${trackingData.deliveryStation.line}`}
          />
          <InfoRow
            label="예상 시간"
            value={
              trackingData.estimatedMinutes
                ? `약 ${trackingData.estimatedMinutes}분`
                : '조정 중'
            }
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>물품 정보</Text>
          <InfoRow label="물품" value={trackingData.packageInfo.description ?? '설명 없음'} />
          <InfoRow
            label="무게"
            value={formatWeightDisplay(
              trackingData.packageInfo.weight,
              trackingData.packageInfo.weightKg,
            )}
          />
          <InfoRow label="수령인" value={trackingData.recipientName ?? '수령 단계에서 확인'} />
        </View>

        {(trackingData.trackingEvents ?? []).length ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>세부 이력</Text>
            {(trackingData.trackingEvents ?? []).map((event) => (
              <TimelineRow key={`${event.type}-${event.title}`} event={event} />
            ))}
          </View>
        ) : null}

        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => void openChat()}>
            <MaterialIcons name="chat-bubble-outline" size={18} color={Colors.white} />
            <Text style={styles.primaryActionText}>채팅 열기</Text>
          </TouchableOpacity>

          {(trackingData.status === 'in_transit' || trackingData.status === 'arrived') &&
          hasMapCoordinates ? (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() =>
                navigation.navigate('RealtimeTracking', {
                  deliveryId: trackingData.deliveryId ?? '',
                  requesterId: '',
                  gillerId: trackingData.gillerId ?? '',
                  pickupStation: {
                    name: trackingData.pickupStation.stationName,
                    latitude: pickupLatitude,
                    longitude: pickupLongitude,
                  },
                  dropoffStation: {
                    name: trackingData.deliveryStation.stationName,
                    latitude: deliveryLatitude,
                    longitude: deliveryLongitude,
                  },
                })
              }
            >
              <MaterialIcons name="map" size={18} color={Colors.primary} />
              <Text style={styles.secondaryActionText}>실시간 위치 보기</Text>
            </TouchableOpacity>
          ) : null}

          {(trackingData.status === 'delivered' || trackingData.status === 'at_locker') ? (
            <TouchableOpacity
              style={[styles.secondaryAction, confirming && styles.disabledAction]}
              onPress={() => void handleConfirmDelivery()}
              disabled={confirming}
            >
              <MaterialIcons name="check-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.secondaryActionText}>
                {confirming ? '확인 중...' : '수령 확인'}
              </Text>
            </TouchableOpacity>
          ) : null}
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
  },
  centerText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: 16,
  },
  hero: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  progressRail: {
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray200,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressText: {
    color: Colors.primary,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'right',
    fontSize: 12,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  panelBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
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
    fontSize: 16,
    fontWeight: '700',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepDot: {
    width: 12,
    height: 12,
    marginTop: 5,
    borderRadius: 6,
    backgroundColor: Colors.gray300,
  },
  stepDotCompleted: {
    backgroundColor: Colors.primary,
  },
  stepDotCurrent: {
    backgroundColor: Colors.primaryDark,
  },
  stepCopy: {
    flex: 1,
    gap: 4,
    paddingBottom: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
  stepState: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
  },
  stepDescription: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  stepTimestamp: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginTop: 5,
  },
  timelineCopy: {
    flex: 1,
    gap: 2,
  },
  timelineTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  timelineDescription: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  timelineMeta: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  actionSection: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryAction: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryActionText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  disabledAction: {
    opacity: 0.6,
  },
});
