import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NaverMapCard } from '../maps/NaverMapCard';
import { getAllStations } from '../../services/config-service';
import { locationService, type LocationData } from '../../services/location-service';
import {
  createLockerLocation,
  getAvailableLockers,
  getLockersByStation,
  getNonSubwayLockers,
} from '../../services/locker-service';
import type { Station } from '../../types/config';
import type { Locker, LockerSummary } from '../../types/locker';
import { LockerStatus } from '../../types/locker';
import { BorderRadius, Colors, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';

const FONT_XS = 12;
const FONT_SM = 14;
const FONT_MD = 16;
const FONT_LG = 18;
const FONT_XL = 22;

interface LockerLocatorProps {
  selectedStationId?: string;
  deliveryStationId?: string;
  onLockerSelect: (locker: LockerSummary) => void;
  onClose: () => void;
  mode?: 'grouped' | 'specific';
  initialTargetStationType?: 'pickup' | 'delivery';
}

type LockerMapRow = ReturnType<typeof createLockerLocation> & {
  distanceMeters: number | null;
  latitude?: number;
  longitude?: number;
  isAreaGroup?: boolean;
  availableCount?: number;
  basePrice?: number;
  stationId?: string;
};

function formatDistance(distanceMeters: number | null): string {
  if (distanceMeters == null) {
    return '거리 확인 중';
  }
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function buildRow(locker: Locker, station: Station | null, currentLocation: LocationData | null): LockerMapRow {
  const base = createLockerLocation(locker);
  const distanceMeters =
    station && currentLocation
      ? locationService.calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          station.location.latitude,
          station.location.longitude
        )
      : null;

  return {
    ...base,
    distanceMeters,
    latitude: station?.location.latitude,
    longitude: station?.location.longitude,
  };
}

export default function LockerLocator({ selectedStationId, deliveryStationId, onLockerSelect, onClose, mode = 'grouped', initialTargetStationType = 'pickup' }: LockerLocatorProps) {
  const [lockers, setLockers] = useState<LockerMapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [includeNonSubway, setIncludeNonSubway] = useState(false);
  const [targetStationType, setTargetStationType] = useState<'pickup' | 'delivery'>(initialTargetStationType);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);

  const loadLockers = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const [currentLocation, stations] = await Promise.all([
        locationService.getCurrentLocation(),
        getAllStations(),
      ]);
      setUserLocation(currentLocation);

      const activeStationId = targetStationType === 'pickup' ? selectedStationId : deliveryStationId;

      let lockerList: Locker[] = [];
      if (includeNonSubway) {
        lockerList = await getNonSubwayLockers();
      } else if (activeStationId) {
        lockerList = await getLockersByStation(activeStationId);
      } else {
        lockerList = await getAvailableLockers();
      }

      const stationMap = new Map(stations.map((station) => [station.stationId, station]));
      
      let rows: LockerMapRow[] = [];

      if (mode === 'grouped') {
        const areaGroups = new Map<string, LockerMapRow>();
        
        lockerList
          .filter((locker) => locker.status === LockerStatus.AVAILABLE && (locker.availability?.available ?? 1) > 0)
          .forEach((locker) => {
            const areaKey = `AREA::${locker.location.stationId}::${locker.location.section || 'default'}`;
            const station = stationMap.get(locker.location.stationId) ?? null;
            const row = buildRow(locker, station, currentLocation);
            
            if (!areaGroups.has(areaKey)) {
              areaGroups.set(areaKey, {
                ...row,
                lockerId: areaKey,
                isAreaGroup: true,
                availableCount: locker.availability?.available ?? 1,
                basePrice: locker.pricing.base,
                stationId: locker.location.stationId,
              });
            } else {
              const existing = areaGroups.get(areaKey)!;
              existing.availableCount = (existing.availableCount || 0) + (locker.availability?.available ?? 1);
              if (locker.pricing.base < (existing.basePrice || Infinity)) {
                existing.basePrice = locker.pricing.base;
              }
            }
          });

        rows = Array.from(areaGroups.values());
      } else {
        rows = lockerList
          .filter((locker) => locker.status === LockerStatus.AVAILABLE && (locker.availability?.available ?? 1) > 0)
          .map((locker) => buildRow(locker, stationMap.get(locker.location.stationId) ?? null, currentLocation));
      }

      rows.sort(
        (left, right) =>
          (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (right.distanceMeters ?? Number.MAX_SAFE_INTEGER)
      );

      setLockers(rows);
    } catch (error) {
      console.error('Error loading lockers:', error);
      Alert.alert('?ㅻ쪟', '?щЪ??紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??');
    } finally {
      setLoading(false);
    }
  }, [includeNonSubway, selectedStationId, deliveryStationId, targetStationType]);

  useFocusEffect(
    useCallback(() => {
      void loadLockers();
    }, [loadLockers])
  );

  const featuredMapRows = useMemo(
    () => lockers.slice(0, 4).filter((item) => item.latitude && item.longitude),
    [lockers]
  );

  const mapCenter = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        label: '현재 위치',
      };
    }
    return featuredMapRows[0]
      ? {
          latitude: featuredMapRows[0].latitude!,
          longitude: featuredMapRows[0].longitude!,
          label: featuredMapRows[0].stationName ?? featuredMapRows[0].name,
        }
      : {
          latitude: 37.5665,
          longitude: 126.978,
          label: 'Seoul',
        };
  }, [featuredMapRows, userLocation]);

  const mapMarkers = useMemo(() => {
    const markers = featuredMapRows.map((item, index) => ({
      latitude: item.latitude!,
      longitude: item.longitude!,
      label: String(index + 1),
    }));
    if (userLocation) {
      markers.push({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        label: '📍',
      });
    }
    return markers;
  }, [featuredMapRows, userLocation]);

  const handleLockerSelect = (locker: LockerMapRow): void => {
    const summary: LockerSummary = {
      lockerId: locker.lockerId,
      stationId: locker.stationId,
      stationName: locker.stationName ?? locker.name ?? '',
      size: 'medium' as never,
      status: locker.isAvailable ? LockerStatus.AVAILABLE : LockerStatus.OCCUPIED,
      available: locker.isAvailable ?? true,
      pricePerHour: locker.isAreaGroup ? locker.basePrice : locker.pricePer4Hours,
    };
    onLockerSelect(summary);
  };

  const renderLockerItem = ({ item }: { item: LockerMapRow }) => (
    <TouchableOpacity style={styles.lockerItem} onPress={() => handleLockerSelect(item)} activeOpacity={0.7}>
      <View style={styles.lockerIconContainer}>
        <Ionicons
          name={item.isAvailable ? 'cube' : 'cube-outline'}
          size={28}
          color={item.isAvailable ? Colors.primary : Colors.gray400}
        />
      </View>
      <View style={styles.lockerInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.lockerName}>
            {item.stationName || item.name} {item.isAreaGroup ? '보관함 구역' : ''}
          </Text>
          <Text style={styles.distanceBadge}>{formatDistance(item.distanceMeters)}</Text>
        </View>
        <Text style={styles.detailText}>
          {item.line ?? '노선 정보 없음'} · {item.floor ?? 1}층 · {item.section ?? item.name}
        </Text>
        <Text style={styles.detailText}>
          기본 {(item.isAreaGroup ? item.basePrice ?? 0 : item.pricePer4Hours ?? 0).toLocaleString()}원 / 4시간
        </Text>
        {item.isAreaGroup && (
          <Text style={[styles.detailText, { color: Colors.primary, fontWeight: 'bold' }]}>
            현재 {item.availableCount}개 이용 가능
          </Text>
        )}
        {!item.isAreaGroup && !!item.telNo && <Text style={styles.detailText}>문의: {item.telNo}</Text>}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>사물함을 찾는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, !includeNonSubway && styles.filterButtonActive]}
          onPress={() => setIncludeNonSubway(false)}
        >
          <Text style={[styles.filterText, !includeNonSubway && styles.filterTextActive]}>지하철 보관함</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, includeNonSubway && styles.filterButtonActive]}
          onPress={() => setIncludeNonSubway(true)}
        >
          <Text style={[styles.filterText, includeNonSubway && styles.filterTextActive]}>외부 거점</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>사물함 선택</Text>
          <View style={styles.closeButton} />
        </View>

        {deliveryStationId ? (
          <View style={[styles.filterRow, { marginBottom: 12 }]}>
            <TouchableOpacity
              style={[styles.filterButton, targetStationType === 'pickup' && styles.filterButtonActive]}
              onPress={() => setTargetStationType('pickup')}
            >
              <Text style={[styles.filterText, targetStationType === 'pickup' && styles.filterTextActive]}>출발역 주변</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, targetStationType === 'delivery' && styles.filterButtonActive]}
              onPress={() => setTargetStationType('delivery')}
            >
              <Text style={[styles.filterText, targetStationType === 'delivery' && styles.filterTextActive]}>도착역 주변</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={18} color={viewMode === 'list' ? Colors.white : Colors.gray600} />
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>목록</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map" size={18} color={viewMode === 'map' ? Colors.white : Colors.gray600} />
            <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>지도</Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'list' ? (
        <FlatList
          style={{ flex: 1 }}
          data={lockers}
          keyExtractor={(item) => item.lockerId}
          renderItem={renderLockerItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="cube-outline" size={64} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>선택 가능한 사물함이 없습니다.</Text>
              <Text style={styles.emptySubtitle}>다른 역이나 다른 시간대로 다시 확인해 주세요.</Text>
            </View>
          }
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mapContainer}>
          <NaverMapCard
            center={mapCenter}
            markers={mapMarkers}
            title="가까운 사물함 지도"
            subtitle="현재 위치가 있으면 가까운 순서로, 없으면 선택 역 기준으로 보여줍니다."
          />

          <View style={styles.mapListCard}>
            <Text style={styles.mapTitle}>빠른 선택</Text>
            <Text style={styles.mapSubtitle}>지도를 먼저 보고 아래 카드에서 바로 예약할 수 있습니다.</Text>
            {featuredMapRows.map((item, index) => (
              <TouchableOpacity key={item.lockerId} style={styles.mapRow} onPress={() => handleLockerSelect(item)}>
                <View style={styles.mapRowIndex}>
                  <Text style={styles.mapRowIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.mapRowBody}>
                  <Text style={styles.mapRowTitle}>{item.stationName}</Text>
                  <Text style={styles.mapRowMeta}>
                    {item.line ?? '노선 정보 없음'} · {formatDistance(item.distanceMeters)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centerContainer: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { marginTop: Spacing.md, fontSize: FONT_SM, color: Colors.gray600 },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  filterButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray200,
    paddingVertical: Spacing.sm,
  },
  filterButtonActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: FONT_SM, fontWeight: Typography.fontWeight.bold, color: Colors.gray700 },
  filterTextActive: { color: Colors.white },
  header: { gap: Spacing.md, padding: Spacing.lg },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray900,
  },
  title: { fontSize: FONT_XL, fontWeight: Typography.fontWeight.extrabold, color: Colors.gray900 },
  viewToggle: { flexDirection: 'row', gap: Spacing.sm },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray200,
  },
  toggleButtonActive: { backgroundColor: Colors.primary },
  toggleText: { fontSize: FONT_SM, fontWeight: Typography.fontWeight.bold, color: Colors.gray700 },
  toggleTextActive: { color: Colors.white },
  listContent: { paddingBottom: 48, paddingHorizontal: Spacing.lg },
  lockerItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    padding: Spacing.lg,
  },
  lockerIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray100,
  },
  lockerInfo: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  lockerName: { flex: 1, fontSize: FONT_MD, fontWeight: Typography.fontWeight.extrabold, color: Colors.gray900 },
  distanceBadge: { fontSize: FONT_XS, fontWeight: Typography.fontWeight.bold, color: Colors.primary },
  detailText: { fontSize: FONT_SM, color: Colors.gray600 },
  emptyTitle: { marginTop: Spacing.md, fontSize: FONT_LG, fontWeight: Typography.fontWeight.extrabold, color: Colors.gray900 },
  emptySubtitle: { marginTop: Spacing.xs, fontSize: FONT_SM, lineHeight: 20, textAlign: 'center', color: Colors.gray600 },
  mapContainer: { gap: Spacing.lg, padding: Spacing.lg },
  mapListCard: { borderRadius: BorderRadius.xl, backgroundColor: Colors.white, padding: Spacing.lg, gap: Spacing.sm },
  mapTitle: { fontSize: FONT_LG, fontWeight: Typography.fontWeight.extrabold, color: Colors.gray900 },
  mapSubtitle: { fontSize: FONT_SM, lineHeight: 20, color: Colors.gray600 },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.gray50, padding: Spacing.md },
  mapRowIndex: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  mapRowIndexText: { fontSize: FONT_XS, fontWeight: Typography.fontWeight.extrabold, color: Colors.white },
  mapRowBody: { flex: 1, gap: 2 },
  mapRowTitle: { fontSize: FONT_SM, fontWeight: Typography.fontWeight.bold, color: Colors.gray900 },
  mapRowMeta: { fontSize: FONT_XS, color: Colors.gray600 },
});


