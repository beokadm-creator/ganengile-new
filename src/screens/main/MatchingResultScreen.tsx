import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NaverMapCard } from '../../components/maps/NaverMapCard';
import { CompoundPaymentPreview } from '../../components/payment/CompoundPaymentPreview';
import { BorderRadius, Colors, Spacing } from '../../theme';
import { fetchUserInfo } from '../../services/matching-service';
import { requireUserId } from '../../services/firebase';
import { getDrivingRoute, type RouteCoordinate } from '../../services/naver-route-service';
import {
  getRoutePriceInsight,
  increaseRequestBid,
  notifyGillers,
  subscribeToRequest,
  type RoutePriceInsight,
} from '../../services/request-service';
import { RequestStatus, type Request } from '../../types/request';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import type { SharedPackageSize } from '../../../shared/pricing-config';

type GillerSnapshot = Awaited<ReturnType<typeof fetchUserInfo>> & { id: string };

function readStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : undefined;
}

function readNumberField(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'number' ? field : undefined;
}

function isMatchedState(status: RequestStatus): boolean {
  return [
    RequestStatus.ACCEPTED,
    RequestStatus.IN_TRANSIT,
    RequestStatus.ARRIVED,
    RequestStatus.DELIVERED,
    RequestStatus.COMPLETED,
    RequestStatus.AT_LOCKER,
  ].includes(status);
}

function getRequestRouteLabel(request: Request | null, pickupStationName?: string, deliveryStationName?: string): string {
  const from = pickupStationName ?? request?.pickupStation.stationName ?? '출발역';
  const to = deliveryStationName ?? request?.deliveryStation.stationName ?? '도착역';
  return `${from} -> ${to}`;
}

function getProgressLabel(request: Request | null): string {
  const beta1Status = request?.beta1RequestStatus;
  if (beta1Status === 'match_pending') {
    return '매칭 준비 중';
  }
  if (beta1Status === 'accepted') {
    return '구간 확정';
  }
  return request?.status ?? 'pending';
}

export function MatchingResultScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<RouteProp<MainStackParamList, 'MatchingResult'>>();
  const { requestId, pickupStationName, deliveryStationName } = route.params;

  const [request, setRequest] = useState<Request | null>(null);
  const [giller, setGiller] = useState<GillerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [increasingBid, setIncreasingBid] = useState(false);
  const [priceInsight, setPriceInsight] = useState<RoutePriceInsight | null>(null);
  const [mapPath, setMapPath] = useState<RouteCoordinate[]>([]);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const searchMessageIndex = useRef(0);
  const [searchMessage, setSearchMessage] = useState('주변 길러와 전문 배송길러에게 요청을 보내고 있습니다.');

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    const messageRotation = [
      '주변 길러와 전문 배송길러에게 요청을 보내고 있습니다.',
      '응답 가능한 이동 경로를 계속 확인하고 있습니다.',
      '조건이 맞는 후보를 찾는 동안 요청은 유지됩니다.',
    ];
    const intervalId = setInterval(() => {
      searchMessageIndex.current = (searchMessageIndex.current + 1) % messageRotation.length;
      setSearchMessage(messageRotation[searchMessageIndex.current]);
    }, 2800);

    const unsubscribe = subscribeToRequest(requestId, (nextRequest) => {
      setRequest(nextRequest);
      setLoading(false);

      if (!nextRequest?.matchedGillerId) {
        setGiller(null);
        return;
      }

      const matchedGillerId = nextRequest.matchedGillerId;
      void fetchUserInfo(matchedGillerId)
        .then((snapshot) => setGiller({ id: matchedGillerId, ...snapshot }))
        .catch((error) => {
          console.error('Failed to load matched giller', error);
          setGiller(null);
        });
    });

    void (async () => {
      try {
        const result = await notifyGillers(requestId);
        const errorMessage = readStringField(result, 'error');
        const nextMessage = result.success
          ? '후보에게 알림을 보냈습니다.'
          : typeof errorMessage === 'string'
            ? errorMessage
            : null;
        setNotificationMessage(nextMessage);
      } catch (error) {
        console.error('Failed to notify gillers', error);
      }
    })();

    return () => {
      unsubscribe();
      clearInterval(intervalId);
      loop.stop();
    };
  }, [pulseAnim, requestId]);

  useEffect(() => {
    if (
      typeof request?.pickupStation.lat !== 'number' ||
      typeof request?.pickupStation.lng !== 'number' ||
      typeof request?.deliveryStation.lat !== 'number' ||
      typeof request?.deliveryStation.lng !== 'number'
    ) {
      setMapPath([]);
      return;
    }

    void getDrivingRoute({
      start: {
        latitude: request.pickupStation.lat,
        longitude: request.pickupStation.lng,
      },
      goal: {
        latitude: request.deliveryStation.lat,
        longitude: request.deliveryStation.lng,
      },
    })
      .then((routeResult: { coordinates: RouteCoordinate[] } | null) => {
        setMapPath(routeResult?.coordinates ?? []);
      })
      .catch(() => {
        setMapPath([]);
      });
  }, [request?.deliveryStation.lat, request?.deliveryStation.lng, request?.pickupStation.lat, request?.pickupStation.lng]);

  useEffect(() => {
    if (!request?.pickupStation.stationId || !request.deliveryStation.stationId) {
      return;
    }

    void getRoutePriceInsight({
      pickupStationId: request.pickupStation.stationId,
      deliveryStationId: request.deliveryStation.stationId,
      requestMode: request.requestMode,
      pricingContext: request.pricingContext,
    }).then((insight) => {
      setPriceInsight(insight);
    });
  }, [request?.deliveryStation.stationId, request?.pickupStation.stationId, request?.pricingContext, request?.requestMode]);

  const currentFee = request?.fee?.totalFee ?? request?.feeBreakdown?.totalFee ?? request?.initialNegotiationFee ?? 0;
  const routeLabel = getRequestRouteLabel(request, pickupStationName, deliveryStationName);
  const recommendedRaise =
    priceInsight && priceInsight.recommendedFee > currentFee
      ? Math.max(1000, Math.ceil((priceInsight.recommendedFee - currentFee) / 1000) * 1000)
      : 1000;

  async function handleIncreaseBid(amount: number = 1000) {
    if (!request) return;

    try {
      setIncreasingBid(true);
      const result = await increaseRequestBid(request.requestId, requireUserId(), amount);
      const errorMessage = readStringField(result, 'error');
      const newFee = readNumberField(result, 'newFee');
      if (!result.success) {
        Alert.alert('금액 조정 실패', errorMessage ?? '지금은 금액을 조정할 수 없습니다.');
        return;
      }

      Alert.alert('금액을 올렸습니다', `${(newFee ?? currentFee).toLocaleString()}원으로 다시 요청합니다.`);
    } catch (error) {
      console.error('Failed to increase bid', error);
      Alert.alert('금액 조정 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setIncreasingBid(false);
    }
  }

  if (loading) {
      return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.centerText}>상태를 불러오는 중입니다.</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>가는길에</Text>
          <Text style={styles.title}>요청을 다시 확인해 주세요.</Text>
          <Text style={styles.subtitle}>취소되었거나 아직 준비 중입니다.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>다음 단계</Text>
          <InfoRow label="1" value="요청 상세 보기" />
          <InfoRow label="2" value="새 요청 만들기" />
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('RequestDetail', { requestId })}>
            <Text style={styles.primaryButtonText}>요청 상세 보기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CreateRequest')}>
            <Text style={styles.secondaryButtonText}>새 요청 만들기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>가는길에</Text>
        <Text style={styles.title}>{isMatchedState(request.status) ? '연결 중입니다.' : '길러를 찾고 있습니다.'}</Text>
        <Text style={styles.subtitle}>{notificationMessage ?? '응답을 기다리는 중입니다.'}</Text>
        <View style={styles.searchPanel}>
          <View style={styles.radarWrap}>
            <Animated.View
              style={[
                styles.radarPulse,
                {
                  opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] }),
                  transform: [
                    {
                      scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }),
                    },
                  ],
                },
              ]}
            />
            <View style={styles.radarCore} />
          </View>
          <View style={styles.searchCopy}>
            <Text style={styles.searchTitle}>실시간으로 후보를 찾는 중</Text>
            <Text style={styles.searchBody}>{searchMessage}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>요청 경로</Text>
        <InfoRow label="구간" value={routeLabel} />
        <InfoRow label="현재 상태" value={getProgressLabel(request)} />
      </View>

      <View style={styles.card}>
        <CompoundPaymentPreview
          requestId={request.requestId}
          baseAmount={currentFee}
          initialSelectedCouponId={request.selectedCouponId}
        />
      </View>

      {typeof request.pickupStation.lat === 'number' &&
      typeof request.pickupStation.lng === 'number' &&
      typeof request.deliveryStation.lat === 'number' &&
      typeof request.deliveryStation.lng === 'number' ? (
        <NaverMapCard
          title="현재 찾고 있는 구간"
          subtitle="출발역과 도착역 기준으로 실제 지도 위에서 매칭 구간을 보여줍니다."
          center={{
            latitude: request.pickupStation.lat,
            longitude: request.pickupStation.lng,
            label: '출발',
          }}
          markers={[
            {
              latitude: request.pickupStation.lat,
              longitude: request.pickupStation.lng,
              label: '출발',
            },
            {
              latitude: request.deliveryStation.lat,
              longitude: request.deliveryStation.lng,
              label: '도착',
            },
          ]}
          path={mapPath}
          height={220}
        />
      ) : null}

      {priceInsight ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>요금 참고</Text>
          <Text style={styles.insightBody}>{priceInsight.contextSummary}</Text>
          <Text style={styles.insightBody}>
            평균 {priceInsight.averageFee.toLocaleString()}원
          </Text>
          <InfoRow label="최근 표본" value={`${priceInsight.sampleCount}건`} />
          <InfoRow label="주요 구간" value={`${priceInsight.minFee.toLocaleString()}원 - ${priceInsight.maxFee.toLocaleString()}원`} />
          {priceInsight.averageDynamicAdjustment !== 0 ? (
            <InfoRow
              label="환경 보정 평균"
              value={`${priceInsight.averageDynamicAdjustment > 0 ? '+' : ''}${priceInsight.averageDynamicAdjustment.toLocaleString()}원`}
            />
          ) : null}
          {priceInsight.recommendedFee > currentFee ? (
            <View style={styles.inlineHint}>
              <Text style={styles.inlineHintText}>
                현재 금액보다 {recommendedRaise.toLocaleString()}원 정도 올리면 응답 가능성이 더 좋아질 수 있어요.
              </Text>
              <Text style={styles.inlineHintSubtext}>{priceInsight.recommendationReason}</Text>
            </View>
          ) : (
            <View style={styles.inlineHint}>
              <Text style={styles.inlineHintText}>{priceInsight.recommendationReason}</Text>
            </View>
          )}
        </View>
      ) : null}

      {giller ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>현재 후보</Text>
          <InfoRow label="이름" value={giller.name ?? '길러'} />
          <InfoRow label="평점" value={typeof giller.rating === 'number' ? giller.rating.toFixed(1) : '-'} />
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => void handleIncreaseBid(recommendedRaise)}
          disabled={increasingBid}
        >
          <Text style={styles.primaryButtonText}>
            {increasingBid ? '조정 중...' : `금액 ${recommendedRaise.toLocaleString()}원 올리기`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate('CreateRequest', {
              mode: 'reservation',
              sourceRequestId: requestId,
              prefill: {
                pickupMode: request.pickupAddress ? 'address' : 'station',
                deliveryMode: request.deliveryAddress ? 'address' : 'station',
                pickupStation: request.pickupStation,
                deliveryStation: request.deliveryStation,
                pickupRoadAddress: request.pickupAddress?.roadAddress,
                pickupDetailAddress: request.pickupAddress?.detailAddress,
                deliveryRoadAddress: request.deliveryAddress?.roadAddress,
                deliveryDetailAddress: request.deliveryAddress?.detailAddress,
                packageDescription: request.packageInfo.description,
                packageSize: request.packageInfo.size as SharedPackageSize,
                weightKg:
                  typeof request.packageInfo.weightKg === 'number'
                    ? request.packageInfo.weightKg
                    : 1,
                itemValue: request.itemValue,
                photoRefs: request.selectedPhotoIds,
                recipientName: request.recipientName,
                recipientPhone: request.recipientPhone,
                pickupLocationDetail: request.pickupLocationDetail,
                storageLocation: request.storageLocation,
                specialInstructions: request.specialInstructions,
                urgency: 'normal',
                directParticipationMode: 'none',
                preferredPickupTime: request.preferredTime?.departureTime,
                preferredArrivalTime: request.preferredTime?.arrivalTime,
              },
            })
          }
        >
          <Text style={styles.secondaryButtonText}>예약 보내기로 바꾸기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={() => navigation.navigate('RequestDetail', { requestId })}>
          <Text style={styles.ghostButtonText}>요청 상세 보기</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  centerText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: 16 },
  hero: { backgroundColor: Colors.primaryMint, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm },
  kicker: { color: Colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', lineHeight: 32 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  searchPanel: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  radarWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
  },
  radarCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
  },
  searchCopy: { flex: 1, gap: 4 },
  searchTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  searchBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  insightBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  inlineHint: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
  },
  inlineHintText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  inlineHintSubtext: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  infoLabel: { color: Colors.textTertiary, fontSize: 14, fontWeight: '600' },
  infoValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  actionGroup: { gap: Spacing.sm, marginTop: Spacing.sm },
  primaryButton: { minHeight: 52, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 52, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  ghostButton: { minHeight: 52, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center' },
  ghostButtonText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },
});
