import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppTopBar from '../../components/common/AppTopBar';
import Button from '../../components/common/Button';
import AddressSearchModal from '../../components/common/AddressSearchModal';
import NearbyStationRecommendationsModal, {
  type NearbyStationRecommendation,
} from '../../components/common/NearbyStationRecommendationsModal';
import DaySelector, { DAY_LABELS } from '../../components/common/DaySelector';
import StationSelectModal from '../../components/common/StationSelectModal';
import TimePicker from '../../components/common/TimePicker';
import { geocodeRoadAddress } from '../../services/address-geocode-service';
import { getAllStations } from '../../services/config-service';
import { requireUserId } from '../../services/firebase';
import { locationService } from '../../services/location-service';
import { createRoute } from '../../services/route-service';
import { BorderRadius, Colors, Shadows, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';
import type { Station } from '../../types/config';
import type { MainStackWithTabNavigationProp } from '../../types/navigation';
import type { DetailedAddress, StationInfo } from '../../types/route';

type PickTarget = 'start' | 'end' | null;
type AddressTarget = 'start' | 'end' | null;
type RouteEndpointMode = 'station' | 'address';
type RecommendationTarget = 'start' | 'end';

type StationCandidate = ReturnType<typeof buildStationLocation> & {
  station: Station;
};

type NearbyPickerState = {
  target: RecommendationTarget;
  title: string;
  description: string;
  recommendations: NearbyStationRecommendation[];
};

function toStationInfo(station: Station): StationInfo {
  return {
    id: station.stationId,
    stationId: station.stationId,
    stationName: station.stationName,
    line: station.lines[0]?.lineName ?? '',
    lineCode: station.lines[0]?.lineCode ?? '',
    lat: station.location?.latitude ?? 0,
    lng: station.location?.longitude ?? 0,
  };
}

function buildAddress(roadAddress: string, detailAddress: string): DetailedAddress | undefined {
  const road = roadAddress.trim();
  const detail = detailAddress.trim();

  if (!road) {
    return undefined;
  }

  return {
    roadAddress: road,
    detailAddress: detail,
    fullAddress: detail ? `${road} ${detail}` : road,
  };
}

function buildStationLocation(station: Station) {
  return {
    name: station.stationName,
    line: station.lines[0]?.lineName ?? '',
    latitude: station.location?.latitude ?? 0,
    longitude: station.location?.longitude ?? 0,
  };
}

function hasUsableCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.modeChip, active && styles.modeChipActive]} onPress={onPress}>
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AddRouteScreen() {
  const navigation = useNavigation<MainStackWithTabNavigationProp>();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [addressTarget, setAddressTarget] = useState<AddressTarget>(null);
  const [resolvingLocation, setResolvingLocation] = useState<PickTarget>(null);
  const [resolvingAddressStation, setResolvingAddressStation] = useState<PickTarget>(null);
  const [nearbyPicker, setNearbyPicker] = useState<NearbyPickerState | null>(null);

  const [startMode, setStartMode] = useState<RouteEndpointMode>('station');
  const [endMode, setEndMode] = useState<RouteEndpointMode>('station');
  const [startStation, setStartStation] = useState<Station | null>(null);
  const [endStation, setEndStation] = useState<Station | null>(null);
  const [startRoadAddress, setStartRoadAddress] = useState('');
  const [startDetailAddress, setStartDetailAddress] = useState('');
  const [endRoadAddress, setEndRoadAddress] = useState('');
  const [endDetailAddress, setEndDetailAddress] = useState('');
  const [departureTime, setDepartureTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    const loadStations = async () => {
      try {
        setLoading(true);
        const stationList = await getAllStations();
        setStations(stationList);
      } catch (error) {
        console.error('Failed to load stations', error);
        Alert.alert('역 정보를 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
      } finally {
        setLoading(false);
      }
    };

    void loadStations();
  }, []);

  const startAddress = useMemo(
    () => buildAddress(startRoadAddress, startDetailAddress),
    [startDetailAddress, startRoadAddress]
  );
  const endAddress = useMemo(
    () => buildAddress(endRoadAddress, endDetailAddress),
    [endDetailAddress, endRoadAddress]
  );

  const routeSummary = useMemo(() => {
    const startLabel =
      startMode === 'address'
        ? startAddress?.fullAddress ?? '출발지 주소를 입력해 주세요'
        : startStation?.stationName ?? '출발역을 선택해 주세요';
    const endLabel =
      endMode === 'address'
        ? endAddress?.fullAddress ?? '도착지 주소를 입력해 주세요'
        : endStation?.stationName ?? '도착역을 선택해 주세요';
    return `${startLabel} -> ${endLabel}`;
  }, [endAddress?.fullAddress, endMode, endStation?.stationName, startAddress?.fullAddress, startMode, startStation?.stationName]);

  function getStationCandidates(): StationCandidate[] {
    return stations
      .filter((station) => {
        const { latitude, longitude } = buildStationLocation(station);
        return hasUsableCoordinates(latitude, longitude);
      })
      .map((station) => ({
        station,
        ...buildStationLocation(station),
      }));
  }

  function buildNearbyRecommendations(latitude: number, longitude: number): NearbyStationRecommendation[] {
    return locationService
      .findNearestStations(
        {
          latitude,
          longitude,
          accuracy: 0,
          altitude: null,
          speed: null,
          heading: null,
        },
        getStationCandidates(),
        4
      )
      .map((item) => ({
        station: item.station.station,
        distanceMeters: item.distanceMeters,
      }));
  }

  async function handleUseCurrentLocation(target: PickTarget) {
    if (!target) {
      return;
    }

    try {
      setResolvingLocation(target);
      const currentLocation = await locationService.getCurrentLocation();
      if (!currentLocation) {
        Alert.alert('위치 권한이 필요합니다', '기기의 위치 권한을 허용한 뒤 다시 시도해 주세요.');
        return;
      }

      const recommendations = buildNearbyRecommendations(
        currentLocation.latitude,
        currentLocation.longitude
      );

      if (recommendations.length === 0) {
        Alert.alert('가까운 역을 찾지 못했습니다', '잠시 후 다시 시도해 주세요.');
        return;
      }

      setNearbyPicker({
        target,
        title: target === 'start' ? '출발역을 선택해 주세요' : '도착역을 선택해 주세요',
        description: '현재 위치 기준으로 가까운 역 4곳을 추천해 드립니다.',
        recommendations,
      });
    } catch (error) {
      console.error('Failed to resolve nearest station', error);
      Alert.alert('현재 위치를 확인하지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setResolvingLocation(null);
    }
  }

  function switchStartMode(mode: RouteEndpointMode) {
    setStartMode(mode);
    setPickTarget(null);
    setAddressTarget((current) => (current === 'start' ? null : current));
    setNearbyPicker((current) => (current?.target === 'start' ? null : current));
    if (mode === 'station') {
      setStartRoadAddress('');
      setStartDetailAddress('');
    } else {
      setStartStation(null);
    }
  }

  function switchEndMode(mode: RouteEndpointMode) {
    setEndMode(mode);
    setPickTarget(null);
    setAddressTarget((current) => (current === 'end' ? null : current));
    setNearbyPicker((current) => (current?.target === 'end' ? null : current));
    if (mode === 'station') {
      setEndRoadAddress('');
      setEndDetailAddress('');
    } else {
      setEndStation(null);
    }
  }

  async function handleRecommendStationFromAddress(target: RecommendationTarget, roadAddress: string) {
    const trimmedAddress = roadAddress.trim();
    if (!trimmedAddress) {
      return;
    }

    try {
      setResolvingAddressStation(target);
      const geocoded = await geocodeRoadAddress(trimmedAddress);
      if (!geocoded) {
        Alert.alert('주소 좌표를 찾지 못했습니다', '다른 주소로 다시 시도해 주세요.');
        return;
      }

      const recommendations = buildNearbyRecommendations(geocoded.latitude, geocoded.longitude);
      if (recommendations.length === 0) {
        Alert.alert('가까운 역을 찾지 못했습니다', '주소를 다시 확인해 주세요.');
        return;
      }

      setNearbyPicker({
        target,
        title: target === 'start' ? '출발역을 선택해 주세요' : '도착역을 선택해 주세요',
        description: '입력한 주소 기준으로 가까운 역 4곳을 추천해 드립니다.',
        recommendations,
      });
    } catch (error) {
      console.error('Failed to resolve nearest station from address', error);
      Alert.alert(
        '주소 기준 역 추천에 실패했습니다',
        error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setResolvingAddressStation(null);
    }
  }

  async function handleSave() {
    if (!startStation || !endStation) {
      Alert.alert('역 선택이 필요합니다', '출발역과 도착역을 먼저 선택해 주세요.');
      return;
    }

    if (startStation.stationId === endStation.stationId) {
      Alert.alert('같은 역은 사용할 수 없습니다', '출발역과 도착역을 다르게 선택해 주세요.');
      return;
    }

    if (startMode === 'address' && !startAddress) {
      Alert.alert('출발지 주소를 확인해 주세요', '도로명 주소를 검색하고 상세 주소를 입력해 주세요.');
      return;
    }

    if (endMode === 'address' && !endAddress) {
      Alert.alert('도착지 주소를 확인해 주세요', '도로명 주소를 검색하고 상세 주소를 입력해 주세요.');
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('요일 선택이 필요합니다', '최소 1개 이상의 요일을 선택해 주세요.');
      return;
    }

    try {
      setSaving(true);
      const userId = requireUserId();
      const createdRoute = await createRoute({
        userId,
        startStation: toStationInfo(startStation),
        endStation: toStationInfo(endStation),
        startAddress,
        endAddress,
        departureTime,
        daysOfWeek: selectedDays,
      });

      Alert.alert('동선이 등록되었습니다', `${routeSummary}\n${departureTime} 출발`, [
        {
          text: '확인',
          onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }

            navigation.navigate('Tabs', {
              screen: 'RouteManagement',
              params: { justAddedRouteId: createdRoute.routeId },
            });
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to create route', error);
      Alert.alert('동선 등록에 실패했습니다', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>동선 등록 화면을 준비하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppTopBar
        title="길러 동선 등록"
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          navigation.navigate('Tabs', { screen: 'RouteManagement' });
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>출발 정보</Text>
          <View style={styles.row}>
            <ModeChip label="역 기준" active={startMode === 'station'} onPress={() => switchStartMode('station')} />
            <ModeChip label="주소 기준" active={startMode === 'address'} onPress={() => switchStartMode('address')} />
          </View>

          {startMode === 'address' ? (
            <View style={styles.addressCard}>
              <TouchableOpacity style={styles.selector} onPress={() => setAddressTarget('start')}>
                <Text style={styles.selectorLabel}>도로명 주소</Text>
                <Text style={styles.selectorValue}>{startAddress?.roadAddress || '주소 검색으로 선택'}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={startDetailAddress}
                onChangeText={setStartDetailAddress}
                placeholder="상세 주소"
                placeholderTextColor={Colors.gray400}
              />
              <View style={styles.selector}>
                <Text style={styles.selectorLabel}>연결 출발역</Text>
                <Text style={styles.selectorValue}>{startStation?.stationName ?? '주소 기준으로 선택'}</Text>
              </View>
              <Button
                title={
                  resolvingAddressStation === 'start'
                    ? '주소 기준으로 가까운 역을 찾는 중...'
                    : '주소 기준 출발역 추천'
                }
                onPress={() => {
                  void handleRecommendStationFromAddress('start', startRoadAddress);
                }}
                variant="outline"
                fullWidth
                loading={resolvingAddressStation === 'start'}
              />
            </View>
          ) : null}

          {startMode === 'station' ? (
            <>
              <TouchableOpacity style={styles.selector} onPress={() => setPickTarget('start')}>
                <Text style={styles.selectorLabel}>출발역</Text>
                <Text style={styles.selectorValue}>{startStation?.stationName ?? '역 선택'}</Text>
              </TouchableOpacity>

              <Button
                title={resolvingLocation === 'start' ? '현재 위치 확인 중...' : '현재 위치로 가까운 출발역 추천'}
                onPress={() => {
                  void handleUseCurrentLocation('start');
                }}
                variant="outline"
                fullWidth
                loading={resolvingLocation === 'start'}
              />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>도착 정보</Text>
          <View style={styles.row}>
            <ModeChip label="역 기준" active={endMode === 'station'} onPress={() => switchEndMode('station')} />
            <ModeChip label="주소 기준" active={endMode === 'address'} onPress={() => switchEndMode('address')} />
          </View>

          {endMode === 'address' ? (
            <View style={styles.addressCard}>
              <TouchableOpacity style={styles.selector} onPress={() => setAddressTarget('end')}>
                <Text style={styles.selectorLabel}>도로명 주소</Text>
                <Text style={styles.selectorValue}>{endAddress?.roadAddress || '주소 검색으로 선택'}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={endDetailAddress}
                onChangeText={setEndDetailAddress}
                placeholder="상세 주소"
                placeholderTextColor={Colors.gray400}
              />
              <View style={styles.selector}>
                <Text style={styles.selectorLabel}>연결 도착역</Text>
                <Text style={styles.selectorValue}>{endStation?.stationName ?? '주소 기준으로 선택'}</Text>
              </View>
              <Button
                title={
                  resolvingAddressStation === 'end'
                    ? '주소 기준으로 가까운 역을 찾는 중...'
                    : '주소 기준 도착역 추천'
                }
                onPress={() => {
                  void handleRecommendStationFromAddress('end', endRoadAddress);
                }}
                variant="outline"
                fullWidth
                loading={resolvingAddressStation === 'end'}
              />
            </View>
          ) : null}

          {endMode === 'station' ? (
            <>
              <TouchableOpacity style={styles.selector} onPress={() => setPickTarget('end')}>
                <Text style={styles.selectorLabel}>도착역</Text>
                <Text style={styles.selectorValue}>{endStation?.stationName ?? '역 선택'}</Text>
              </TouchableOpacity>

              <Button
                title={resolvingLocation === 'end' ? '현재 위치 확인 중...' : '현재 위치로 가까운 도착역 추천'}
                onPress={() => {
                  void handleUseCurrentLocation('end');
                }}
                variant="outline"
                fullWidth
                loading={resolvingLocation === 'end'}
              />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <TimePicker
            label="출발 시간"
            value={departureTime}
            onChange={setDepartureTime}
            placeholder="출발 시간을 선택해 주세요"
            minuteInterval={10}
          />
          <DaySelector
            selectedDays={selectedDays}
            onChange={setSelectedDays}
            label="운행 요일"
            hint="선택한 운행 요일"
          />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>등록 예정 동선</Text>
          <Text style={styles.summaryRoute}>{routeSummary}</Text>
          <Text style={styles.summaryMeta}>
            {departureTime} 출발 · {selectedDays.map((day) => DAY_LABELS[day]).join(', ')}
          </Text>
        </View>

        <Button
          title={saving ? '동선을 등록하는 중...' : '동선 등록'}
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={saving}
          variant="primary"
          size="large"
          fullWidth
        />
      </ScrollView>

      <StationSelectModal
        visible={pickTarget === 'start'}
        onClose={() => setPickTarget(null)}
        onStationSelect={setStartStation}
        title="출발역 선택"
        stations={stations}
        searchPlaceholder="출발역 검색"
      />

      <StationSelectModal
        visible={pickTarget === 'end'}
        onClose={() => setPickTarget(null)}
        onStationSelect={setEndStation}
        title="도착역 선택"
        stations={stations}
        searchPlaceholder="도착역 검색"
      />

      <AddressSearchModal
        visible={addressTarget === 'start'}
        title="출발지 도로명 주소 검색"
        onClose={() => setAddressTarget(null)}
        onSelectAddress={(item) => {
          setStartRoadAddress(item.roadAddress);
          void handleRecommendStationFromAddress('start', item.roadAddress);
        }}
      />

      <AddressSearchModal
        visible={addressTarget === 'end'}
        title="도착지 도로명 주소 검색"
        onClose={() => setAddressTarget(null)}
        onSelectAddress={(item) => {
          setEndRoadAddress(item.roadAddress);
          void handleRecommendStationFromAddress('end', item.roadAddress);
        }}
      />

      <NearbyStationRecommendationsModal
        visible={nearbyPicker !== null}
        title={nearbyPicker?.title ?? ''}
        description={nearbyPicker?.description}
        recommendations={nearbyPicker?.recommendations ?? []}
        onClose={() => setNearbyPicker(null)}
        onSelectStation={(station) => {
          if (nearbyPicker?.target === 'start') {
            setStartStation(station);
          } else if (nearbyPicker?.target === 'end') {
            setEndStation(station);
          }
          setNearbyPicker(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  content: { flex: 1 },
  contentInner: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing['5xl'],
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  modeChip: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeChipText: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.bold,
  },
  modeChipTextActive: {
    color: Colors.white,
  },
  addressCard: {
    gap: Spacing.sm,
  },
  selector: {
    minHeight: 58,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    gap: 4,
  },
  selectorLabel: {
    color: Colors.textSecondary,
    ...Typography.caption,
  },
  selectorValue: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.bold,
  },
  input: {
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  summaryTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  summaryRoute: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  summaryMeta: {
    marginTop: Spacing.xs,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
});
