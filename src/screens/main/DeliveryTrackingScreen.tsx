import React, { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NaverMapCard } from '../../components/maps/NaverMapCard';
import { getChatRoomByRequestId } from '../../services/chat-service';
import { confirmDeliveryByRequester, getDeliveryByRequestId, subscribeToDeliveryByRequestId } from '../../services/delivery-service';
import { requireUserId } from '../../services/firebase';
import { getRequestById, subscribeToRequest } from '../../services/request-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { formatWeightDisplay } from '../../utils/package-weight';
import { toTrackingModel, type TrackingEvent, type TrackingModel } from '../../utils/request-adapters';

type DeliveryLookup = { deliveryId: string; gillerId?: string };
type DeliveryTrackingRoute = RouteProp<MainStackParamList, 'DeliveryTracking'>;

function formatDateLabel(value: Date | string | undefined): string {
  if (!value) return '-';
  const resolved = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(resolved.getTime())) return '-';
  return resolved.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
        if (request) setTrackingData(toTrackingModel(request));
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
      const delivery = (await getDeliveryByRequestId(requestId)) as DeliveryLookup | Record<string, unknown> | null;
      if (delivery) {
        setTrackingData(toTrackingModel(delivery));
        return;
      }
      const request = await getRequestById(requestId);
      if (request) setTrackingData(toTrackingModel(request));
    } catch (error) {
      console.error('Failed to load tracking', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const progress = useMemo(() => calculateProgress(trackingData?.status ?? 'pending'), [trackingData?.status]);
  const pickupLatitude = trackingData?.pickupStation.lat ?? 37.5665;
  const pickupLongitude = trackingData?.pickupStation.lng ?? 126.978;
  const deliveryLatitude = trackingData?.deliveryStation.lat ?? 37.57;
  const deliveryLongitude = trackingData?.deliveryStation.lng ?? 126.99;
  const mapCenter = { latitude: (pickupLatitude + deliveryLatitude) / 2, longitude: (pickupLongitude + deliveryLongitude) / 2 };

  async function openChat() {
    try {
      const room = await getChatRoomByRequestId(requestId);
      if (!room) return;
      const viewerId = requireUserId();
      const other = room.participants.user1.userId === viewerId ? room.participants.user2 : room.participants.user1;
      navigation.navigate('Chat', { chatRoomId: room.chatRoomId, otherUserId: other.userId, otherUserName: other.name });
    } catch (error) {
      console.error('Failed to open chat', error);
    }
  }

  async function handleConfirmDelivery() {
    try {
      setConfirming(true);
      const delivery = (await getDeliveryByRequestId(requestId)) as DeliveryLookup | null;
      if (!delivery?.deliveryId) return;
      const result = await confirmDeliveryByRequester({ deliveryId: delivery.deliveryId, requesterId: requireUserId() });
      if (result.success) await loadTracking();
    } catch (error) {
      console.error('Failed to confirm delivery', error);
    } finally {
      setConfirming(false);
    }
  }

  if (loading || !trackingData) {
    return <View style={styles.centerState}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.centerText}>배송 추적 정보를 불러오는 중입니다.</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadTracking()} />}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>가는길에 배송 추적</Text>
        <Text style={styles.heroTitle}>{getStatusLabel(trackingData.status)}</Text>
        <Text style={styles.heroSubtitle}>현재 leg 기준 진행률과 다음 액션을 함께 보여줍니다.</Text>
        <View style={styles.progressRail}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.progressText}>{progress}% 진행</Text>
      </View>

      <NaverMapCard center={mapCenter} markers={[{ latitude: pickupLatitude, longitude: pickupLongitude, label: '출발' }, { latitude: deliveryLatitude, longitude: deliveryLongitude, label: '도착' }]} title="배송 구간 지도" subtitle="출발역과 도착역 기준으로 현재 배송 구간을 보여줍니다." />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>경로 요약</Text>
        <InfoRow label="출발" value={`${trackingData.pickupStation.stationName} / ${trackingData.pickupStation.line}`} />
        <InfoRow label="도착" value={`${trackingData.deliveryStation.stationName} / ${trackingData.deliveryStation.line}`} />
        <InfoRow label="예상 ETA" value={trackingData.estimatedMinutes ? `약 ${trackingData.estimatedMinutes}분` : '조정 중'} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>물품과 인계</Text>
        <InfoRow label="물품" value={trackingData.packageInfo.description ?? '설명 없음'} />
        <InfoRow label="무게" value={formatWeightDisplay(trackingData.packageInfo.weight, trackingData.packageInfo.weightKg)} />
        <InfoRow label="수령인" value={trackingData.recipientName ?? '미션 단계에 따라 제한 공개'} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>진행 타임라인</Text>
        {(trackingData.trackingEvents ?? []).map((event) => <TimelineRow key={`${event.type}-${event.title}`} event={event} />)}
      </View>

      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.primaryAction} onPress={() => void openChat()}><MaterialIcons name="chat-bubble-outline" size={18} color={Colors.white} /><Text style={styles.primaryActionText}>채팅 열기</Text></TouchableOpacity>
        {(trackingData.status === 'in_transit' || trackingData.status === 'arrived') && <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('RealtimeTracking', { deliveryId: trackingData.deliveryId ?? '', requesterId: '', gillerId: trackingData.gillerId ?? '', pickupStation: { name: trackingData.pickupStation.stationName, latitude: pickupLatitude, longitude: pickupLongitude }, dropoffStation: { name: trackingData.deliveryStation.stationName, latitude: deliveryLatitude, longitude: deliveryLongitude } })}><MaterialIcons name="map" size={18} color={Colors.primary} /><Text style={styles.secondaryActionText}>실시간 위치 보기</Text></TouchableOpacity>}
        {(trackingData.status === 'delivered' || trackingData.status === 'at_locker') && <TouchableOpacity style={[styles.secondaryAction, confirming && styles.disabledAction]} onPress={() => void handleConfirmDelivery()} disabled={confirming}><MaterialIcons name="check-circle-outline" size={18} color={Colors.primary} /><Text style={styles.secondaryActionText}>{confirming ? '확인 중...' : '수령 확인'}</Text></TouchableOpacity>}
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function TimelineRow({ event }: { event: TrackingEvent }) {
  return <View style={styles.timelineRow}><View style={styles.timelineDot} /><View style={styles.timelineCopy}><Text style={styles.timelineTitle}>{event.title}</Text><Text style={styles.timelineMeta}>{formatDateLabel(event.timestamp)}</Text></View></View>;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'accepted': return '길러가 연결되었습니다.';
    case 'in_transit': return '배송이 이동 중입니다.';
    case 'arrived': return '도착 직전입니다.';
    case 'delivered': return '인계가 완료되었습니다.';
    case 'completed': return '배송이 완료되었습니다.';
    case 'at_locker': return '사물함 보관 중입니다.';
    default: return '배송 준비 중입니다.';
  }
}

function calculateProgress(status: string): number {
  switch (status) {
    case 'accepted': return 25;
    case 'in_transit': return 55;
    case 'arrived': return 75;
    case 'delivered': return 90;
    case 'completed': return 100;
    case 'at_locker': return 85;
    default: return 10;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  centerText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: 16 },
  hero: { backgroundColor: Colors.primaryMint, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm },
  heroKicker: { fontSize: 12, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, lineHeight: 32 },
  heroSubtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  progressRail: { height: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.gray200, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  progressText: { color: Colors.primary, fontWeight: '800', marginTop: 4, textAlign: 'right', fontSize: 12 },
  panel: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 12, borderWidth: 1, borderColor: Colors.border },
  panelTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoLabel: { color: Colors.textTertiary, fontSize: 14, fontWeight: '600' },
  infoValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 4 },
  timelineCopy: { flex: 1, gap: 2 },
  timelineTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  timelineMeta: { color: Colors.textTertiary, fontSize: 12 },
  actionSection: { gap: Spacing.sm, marginTop: Spacing.sm },
  primaryAction: { minHeight: 52, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryActionText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  secondaryAction: { minHeight: 52, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: Colors.border },
  secondaryActionText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  disabledAction: { opacity: 0.6 },
});
