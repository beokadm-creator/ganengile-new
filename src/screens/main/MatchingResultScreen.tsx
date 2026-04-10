import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { BorderRadius, Colors, Spacing } from '../../theme';
import { fetchUserInfo } from '../../services/matching-service';
import { requireUserId } from '../../services/firebase';
import { increaseRequestBid, notifyGillers, subscribeToRequest } from '../../services/request-service';
import { RequestStatus, type Request } from '../../types/request';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

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

  useEffect(() => {
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

    return unsubscribe;
  }, [requestId]);

  const currentFee = request?.fee?.totalFee ?? request?.feeBreakdown?.totalFee ?? request?.initialNegotiationFee ?? 0;
  const routeLabel = getRequestRouteLabel(request, pickupStationName, deliveryStationName);

  async function handleIncreaseBid() {
    if (!request) return;

    try {
      setIncreasingBid(true);
      const result = await increaseRequestBid(request.requestId, requireUserId(), 1000);
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
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>요청 경로</Text>
        <InfoRow label="구간" value={routeLabel} />
        <InfoRow label="현재 제안 금액" value={`${currentFee.toLocaleString()}원`} />
        <InfoRow label="현재 상태" value={getProgressLabel(request)} />
      </View>

      {giller ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>현재 후보</Text>
          <InfoRow label="이름" value={giller.name ?? '길러'} />
          <InfoRow label="평점" value={typeof giller.rating === 'number' ? giller.rating.toFixed(1) : '-'} />
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleIncreaseBid()} disabled={increasingBid}>
          <Text style={styles.primaryButtonText}>{increasingBid ? '조정 중...' : '금액 1,000원 올리기'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('CreateRequest', { mode: 'reservation', sourceRequestId: requestId })}
        >
          <Text style={styles.secondaryButtonText}>예약으로 바꾸기</Text>
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
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4 },
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
