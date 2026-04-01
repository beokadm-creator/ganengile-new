import React, { useMemo } from 'react';
import type { JSX } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import AppTopBar from '../../components/common/AppTopBar';
import { NaverMapCard } from '../../components/maps/NaverMapCard';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

type RealtimeTrackingRoute = RouteProp<MainStackParamList, 'RealtimeTracking'>;

function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

export default function RealtimeTrackingScreen(): JSX.Element {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<RealtimeTrackingRoute>();
  const { deliveryId, pickupStation, dropoffStation } = route.params;

  const etaSummary = useMemo(() => {
    const latGap = Math.abs(pickupStation.latitude - dropoffStation.latitude);
    const lngGap = Math.abs(pickupStation.longitude - dropoffStation.longitude);
    const syntheticDistance = Math.max(1, Math.round((latGap + lngGap) * 450));
    const etaMinutes = Math.max(18, Math.min(95, syntheticDistance * 3));

    return {
      syntheticDistance,
      etaMinutes,
      currentLegLabel: '현재 이동 구간과 다음 인계 지점을 중심으로 ETA를 보여줍니다.',
    };
  }, [dropoffStation.latitude, dropoffStation.longitude, pickupStation.latitude, pickupStation.longitude]);

  const center = {
    latitude: (pickupStation.latitude + dropoffStation.latitude) / 2,
    longitude: (pickupStation.longitude + dropoffStation.longitude) / 2,
  };

  return (
    <View style={styles.container}>
      <AppTopBar title="실시간 진행 보기" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>가는길에 추적</Text>
          <Text style={styles.heroTitle}>현재 구간과 ETA를 빠르게 확인하세요.</Text>
          <Text style={styles.heroSubtitle}>
            큰 지도보다 지금 필요한 구간, 다음 인계 지점, 예상 시간을 먼저 보여줍니다.
          </Text>
        </View>

        <NaverMapCard
          center={center}
          markers={[
            { latitude: pickupStation.latitude, longitude: pickupStation.longitude, label: '출발' },
            { latitude: dropoffStation.latitude, longitude: dropoffStation.longitude, label: '도착' },
          ]}
          title="배송 구간 지도"
          subtitle="출발역과 도착역 기준으로 현재 배송 구간을 보여줍니다."
        />

        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>{pickupStation.name}</Text>
            <MaterialIcons name="east" size={20} color={Colors.primary} />
            <Text style={styles.routeTitle}>{dropoffStation.name}</Text>
          </View>
          <View style={styles.metricRow}>
            <MetricPill label="예상 ETA" value={`${etaSummary.etaMinutes}분`} />
            <MetricPill label="추정 이동" value={`${etaSummary.syntheticDistance}km`} />
            <MetricPill label="delivery" value={deliveryId.slice(0, 8)} />
          </View>
          <Text style={styles.routeHint}>{etaSummary.currentLegLabel}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>현재 흐름</Text>
          <View style={styles.timelineCard}>
            <TimelineRow title="출발 지점 확인" body={`${pickupStation.name}에서 출발 준비를 마쳤습니다.`} tone="done" />
            <TimelineRow title="현재 이동 구간" body="지금 이동 중인 구간과 ETA를 계속 업데이트합니다." tone="active" />
            <TimelineRow title="최종 인계" body={`${dropoffStation.name}에서 수령 또는 다음 인계가 진행됩니다.`} tone="pending" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>위치 정보</Text>
          <View style={styles.locationCard}>
            <LocationRow label="출발 좌표" value={`${formatCoordinate(pickupStation.latitude)}, ${formatCoordinate(pickupStation.longitude)}`} />
            <LocationRow label="도착 좌표" value={`${formatCoordinate(dropoffStation.latitude)}, ${formatCoordinate(dropoffStation.longitude)}`} />
            <LocationRow label="확장 방향" value="사용자 화면은 간단한 지도, 운영 화면은 관제형 지도로 확장합니다." />
          </View>
        </View>

        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('DeliveryTracking', { requestId: deliveryId })}>
          <MaterialIcons name="local-shipping" size={18} color=Colors.primary />
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
