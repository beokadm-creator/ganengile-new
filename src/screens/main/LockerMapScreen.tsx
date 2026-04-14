import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NaverMapCard } from '../../components/maps/NaverMapCard';
import { getAllStations } from '../../services/config-service';
import { locationService, type LocationData } from '../../services/location-service';
import { getAvailableLockers } from '../../services/locker-service';
import type { Station } from '../../types/config';
import type { Locker } from '../../types/locker';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Spacing, BorderRadius } from '../../theme';
import { Typography } from '../../theme/typography';

type LockerMapItem = {
  locker: Locker;
  station: Station | null;
  distanceMeters: number | null;
};

function getLockerDistance(locker: Locker, station: Station | null, currentLocation: LocationData | null): number | null {
  if (!station || !currentLocation) {
    return null;
  }

  return locationService.calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    station.location.latitude,
    station.location.longitude
  );
}

function formatDistance(distanceMeters: number | null): string {
  if (distanceMeters == null) {
    return '거리 확인 중';
  }
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

export default function LockerMapScreen(): JSX.Element {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const load = async (): Promise<void> => {
      try {
        setLoading(true);
        const [nextLockers, nextStations, nextLocation] = await Promise.all([
          getAvailableLockers(),
          getAllStations(),
          locationService.getCurrentLocation(),
        ]);

        if (!isMounted.current) return;
        setLockers(nextLockers);
        setStations(nextStations);
        setCurrentLocation(nextLocation);
      } catch (error) {
        if (!isMounted.current) return;
        console.error('Failed to load locker map data:', error);
        Alert.alert('보관함 정보를 불러오지 못했어요', '잠시 후 다시 시도해 주세요.');
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    void load();
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  const mapItems = useMemo<LockerMapItem[]>(() => {
    const stationMap = new Map(stations.map((station) => [station.stationId, station]));

    return lockers
      .map((locker) => {
        const station = stationMap.get(locker.location.stationId) ?? null;
        return {
          locker,
          station,
          distanceMeters: getLockerDistance(locker, station, currentLocation),
        };
      })
      .sort(
        (left, right) =>
          (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (right.distanceMeters ?? Number.MAX_SAFE_INTEGER)
      )
      .slice(0, 12);
  }, [currentLocation, lockers, stations]);

  const featured = mapItems.slice(0, 4).filter((item) => item.station);
  const mapCenter =
    featured[0]?.station?.location ??
    currentLocation ?? {
      latitude: 37.5665,
      longitude: 126.978,
    };

  const handleSelect = (item: LockerMapItem): void => {
    navigation.navigate('LockerSelection', {
      stationId: item.locker.location.stationId,
      stationName: item.locker.location.stationName,
      lockerId: item.locker.lockerId,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>보관함 위치를 불러오고 있어요.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={mapItems}
      keyExtractor={(item) => item.locker.lockerId}
      ListHeaderComponent={
        <>
          <View style={styles.hero}>
            <Text style={styles.title}>보관함 지도</Text>
            <Text style={styles.subtitle}>
              가까운 보관함 위치를 먼저 지도 기준으로 보여주고, 바로 예약 화면으로 이어집니다.
            </Text>
          </View>

          <NaverMapCard
            center={mapCenter}
            markers={featured.map((item, index) => ({
              latitude: item.station!.location.latitude,
              longitude: item.station!.location.longitude,
              label: String(index + 1),
            }))}
            title="가까운 보관함 지도"
            subtitle={currentLocation ? '현재 위치를 기준으로 가까운 순서를 반영합니다.' : '위치 권한이 없으면 역 기준 목록으로 정렬합니다.'}
          />
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>지금 선택 가능한 보관함이 없어요.</Text>
          <Text style={styles.emptyBody}>다른 시간대에 다시 확인하거나 일반 배송 흐름으로 진행해 주세요.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.locker.location.stationName}</Text>
            <Text style={styles.badge}>{formatDistance(item.distanceMeters)}</Text>
          </View>
          <Text style={styles.cardBody}>
            {item.locker.location.line ?? '노선 정보 없음'} · {item.locker.location.floor}층 · {item.locker.location.section}
          </Text>
          <Text style={styles.cardMeta}>
            기본 {item.locker.pricing.base.toLocaleString()}원 / {item.locker.pricing.baseDuration}분
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },
  hero: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  emptyBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  badge: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryMint,
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    overflow: 'hidden',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  cardBody: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
  },
  cardMeta: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
});
