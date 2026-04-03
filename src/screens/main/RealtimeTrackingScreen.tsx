import React, { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { doc, onSnapshot } from 'firebase/firestore';

import AppTopBar from '../../components/common/AppTopBar';
import { NaverMapCard } from '../../components/maps/NaverMapCard';
import { updateGillerLocation } from '../../services/delivery-service';
import { db, requireUserId } from '../../services/firebase';
import { locationService } from '../../services/location-service';
import {
  formatRouteDistance,
  formatRouteDuration,
  getDrivingRoute,
  type RouteCoordinate,
} from '../../services/naver-route-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

type RealtimeTrackingRoute = RouteProp<MainStackParamList, 'RealtimeTracking'>;

type CourierPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
};

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

function hasUsableCoordinate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0;
}

function toRoutePoint(point: CourierPoint | { latitude: number; longitude: number }): RouteCoordinate {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

export default function RealtimeTrackingScreen(): JSX.Element {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<RealtimeTrackingRoute>();
  const { deliveryId, pickupStation, dropoffStation, gillerId } = route.params;

  const [courierPoint, setCourierPoint] = useState<CourierPoint | null>(null);
  const [routeData, setRouteData] = useState<Awaited<ReturnType<typeof getDrivingRoute>>>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const viewerId = (() => {
    try {
      return requireUserId();
    } catch {
      return '';
    }
  })();
  const isAssignedGiller = viewerId.length > 0 && viewerId === gillerId;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'deliveries', deliveryId),
      (snapshot) => {
        const data = snapshot.data() as
          | {
              tracking?: {
                courierLocation?: {
                  location?: { latitude?: number; longitude?: number };
                  accuracy?: number;
                  timestamp?: { toDate?: () => Date } | Date;
                };
              };
            }
          | undefined;

        const latitude = data?.tracking?.courierLocation?.location?.latitude;
        const longitude = data?.tracking?.courierLocation?.location?.longitude;

        if (!hasUsableCoordinate(latitude) || !hasUsableCoordinate(longitude)) {
          setCourierPoint(null);
          return;
        }

        const timestamp = data?.tracking?.courierLocation?.timestamp;
        setCourierPoint({
          latitude,
          longitude,
          accuracy: data?.tracking?.courierLocation?.accuracy,
          timestamp:
            timestamp instanceof Date ? timestamp : typeof timestamp?.toDate === 'function' ? timestamp.toDate() : undefined,
        });
      },
      (error) => {
        console.error('Failed to subscribe realtime tracking', error);
      }
    );

    return unsubscribe;
  }, [deliveryId]);

  useEffect(() => {
    if (!isAssignedGiller) {
      return;
    }

    let disposed = false;

    void locationService.startLocationTracking((location) => {
      if (disposed) return;

      setCourierPoint({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date(),
      });

      void updateGillerLocation(deliveryId, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
      });
    });

    return () => {
      disposed = true;
      locationService.stopLocationTracking();
    };
  }, [deliveryId, isAssignedGiller]);

  useEffect(() => {
    const start = courierPoint ? toRoutePoint(courierPoint) : toRoutePoint(pickupStation);
    const goal = toRoutePoint(dropoffStation);

    let cancelled = false;
    setRouteLoading(true);

    void getDrivingRoute({ start, goal })
      .then((result) => {
        if (!cancelled) {
          setRouteData(result);
        }
      })
      .catch((error) => {
        console.error('Failed to load realtime route', error);
        if (!cancelled) {
          setRouteData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRouteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courierPoint, dropoffStation, pickupStation]);

  const center = {
    latitude: courierPoint ? courierPoint.latitude : (pickupStation.latitude + dropoffStation.latitude) / 2,
    longitude: courierPoint ? courierPoint.longitude : (pickupStation.longitude + dropoffStation.longitude) / 2,
  };
  const markers = [
    { latitude: pickupStation.latitude, longitude: pickupStation.longitude, label: '출' },
    ...(courierPoint ? [{ latitude: courierPoint.latitude, longitude: courierPoint.longitude, label: '현' }] : []),
    { latitude: dropoffStation.latitude, longitude: dropoffStation.longitude, label: '도' },
  ];
  const routePath =
    routeData?.coordinates.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    })) ?? [];

  const etaSummary = useMemo(
    () => ({
      distanceLabel: routeLoading ? '불러오는 중' : formatRouteDistance(routeData?.summary.distanceMeters ?? 0),
      durationLabel: routeLoading ? '불러오는 중' : formatRouteDuration(routeData?.summary.durationMs ?? 0),
      currentLegLabel: courierPoint
        ? '길러 GPS를 기준으로 현재 위치에서 도착 지점까지 경로를 다시 계산합니다.'
        : '아직 길러 GPS가 없어 출발역을 기준으로 예상 경로를 표시합니다.',
    }),
    [courierPoint, routeData, routeLoading]
  );

  return (
    <View style={styles.container}>
      <AppTopBar title="실시간 진행 보기" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>실제 동선 추적</Text>
          <Text style={styles.heroTitle}>GPS와 경로 좌표 API를 함께 사용합니다.</Text>
          <Text style={styles.heroSubtitle}>
            길러가 위치 전송을 시작하면 현재 좌표를 저장하고, 경로 API로 도착지까지의 실제 동선을 다시 계산합니다.
          </Text>
        </View>

        <NaverMapCard
          center={center}
          markers={markers}
          path={routePath}
          title="실시간 배송 지도"
          subtitle="웹 지도에서는 현재 위치부터 도착지까지의 경로 좌표를 선으로 표시합니다."
        />

        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>{pickupStation.name}</Text>
            <MaterialIcons name="east" size={20} color={Colors.primary} />
            <Text style={styles.routeTitle}>{dropoffStation.name}</Text>
          </View>
          <View style={styles.metricRow}>
            <MetricPill label="예상 소요" value={etaSummary.durationLabel} />
            <MetricPill label="경로 길이" value={etaSummary.distanceLabel} />
            <MetricPill
              label="좌표 수"
              value={routeData?.coordinates?.length ? `${routeData.coordinates.length}개` : '-'}
            />
          </View>
          <Text style={styles.routeHint}>{etaSummary.currentLegLabel}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>현재 위치 정보</Text>
          <View style={styles.locationCard}>
            <LocationRow
              label="출발 좌표"
              value={`${formatCoordinate(pickupStation.latitude)}, ${formatCoordinate(pickupStation.longitude)}`}
            />
            <LocationRow
              label="도착 좌표"
              value={`${formatCoordinate(dropoffStation.latitude)}, ${formatCoordinate(dropoffStation.longitude)}`}
            />
            <LocationRow
              label="길러 GPS"
              value={
                courierPoint
                  ? `${formatCoordinate(courierPoint.latitude)}, ${formatCoordinate(courierPoint.longitude)}`
                  : '아직 위치 수신 전'
              }
            />
            <LocationRow
              label="업데이트 시각"
              value={courierPoint?.timestamp ? courierPoint.timestamp.toLocaleTimeString('ko-KR') : '-'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>운영 기준</Text>
          <View style={styles.timelineCard}>
            <TimelineRow
              title="GPS 저장"
              body="길러 기기에서 5초 간격 위치를 올리고 Firestore에 최근 위치와 이력을 저장합니다."
              tone="done"
            />
            <TimelineRow
              title="경로 좌표 계산"
              body="현재 GPS 또는 출발역을 시작점으로 사용해 도착지까지의 경로 좌표를 받아옵니다."
              tone="active"
            />
            <TimelineRow
              title="이용자 표시"
              body="배송 추적 화면에서는 단계, 현재 GPS, 경로 길이와 예상 소요를 함께 보여줍니다."
              tone="pending"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('DeliveryTracking', { requestId: deliveryId })}
        >
          <MaterialIcons name="local-shipping" size={18} color={Colors.primary} />
          <Text style={styles.linkButtonText}>배송 상세 보기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function TimelineRow({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: 'done' | 'active' | 'pending';
}) {
  const icon = tone === 'done' ? 'check-circle' : tone === 'active' ? 'radio-button-checked' : 'schedule';
  const color = tone === 'done' ? Colors.success : tone === 'active' ? Colors.primary : Colors.gray400;

  return (
    <View style={styles.timelineRow}>
      <MaterialIcons name={icon} size={18} color={color} />
      <View style={styles.timelineCopy}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineBody}>{body}</Text>
      </View>
    </View>
  );
}

function LocationRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.locationRow}>
      <Text style={styles.locationLabel}>{label}</Text>
      <Text style={styles.locationValue}>{value}</Text>
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
    padding: Spacing.lg,
    gap: 6,
    ...Shadows.sm,
  },
  heroKicker: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    ...Typography.body,
  },
  routeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  routeTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  metricPill: {
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  metricLabel: {
    color: Colors.gray500,
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  routeHint: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  timelineCopy: {
    flex: 1,
    gap: 4,
  },
  timelineTitle: {
    color: Colors.textPrimary,
    ...Typography.bodyBold,
  },
  timelineBody: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  locationCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  locationLabel: {
    color: Colors.gray500,
    ...Typography.bodySmall,
  },
  locationValue: {
    flex: 1,
    textAlign: 'right',
    color: Colors.textPrimary,
    ...Typography.bodySmall,
  },
  linkButton: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.sm,
  },
  linkButtonText: {
    color: Colors.primary,
    ...Typography.bodyBold,
  },
});
