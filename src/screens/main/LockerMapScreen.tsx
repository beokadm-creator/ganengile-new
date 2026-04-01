import React, { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
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

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setLoading(true);
        const [nextLockers, nextStations, nextLocation] = await Promise.all([
          getAvailableLockers(),
          getAllStations(),
          locationService.getCurrentLocation(),
        ]);

        setLockers(nextLockers);
        setStations(nextStations);
        setCurrentLocation(nextLocation);
      } catch (error) {
        console.error('Failed to load locker map data:', error);
        Alert.alert('보관함 정보를 불러오지 못했어요', '잠시 후 다시 시도해 주세요.');
      } finally {
        setLoading(false);
      }
    };

    void load();
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
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>보관함 위치를 불러오고 있어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {mapItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>지금 선택 가능한 보관함이 없어요.</Text>
          <Text style={styles.emptyBody}>다른 시간대에 다시 확인하거나 일반 배송 흐름으로 진행해 주세요.</Text>
        </View>
      ) : (
        mapItems.map((item) => (
          <TouchableOpacity key={item.locker.lockerId} style={styles.card} onPress={() => handleSelect(item)}>
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
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    gap: 16,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  hero: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 8,
    padding: 20,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyBody: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 8,
    padding: 20,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  badge: {
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardBody: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 13,
  },
});
