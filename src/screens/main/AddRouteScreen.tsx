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
import Button from '../../components/common/Button';
import AddressSearchModal from '../../components/common/AddressSearchModal';
import DaySelector, { DAY_LABELS } from '../../components/common/DaySelector';
import StationSelectModal from '../../components/common/StationSelectModal';
import TimePicker from '../../components/common/TimePicker';
import { getAllStations } from '../../services/config-service';
import { requireUserId } from '../../services/firebase';
import { locationService } from '../../services/location-service';
import { createRoute } from '../../services/route-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { Station } from '../../types/config';
import type { MainStackWithTabNavigationProp } from '../../types/navigation';
import type { DetailedAddress, StationInfo } from '../../types/route';

type PickTarget = 'start' | 'end' | null;
type AddressTarget = 'start' | 'end' | null;
type RouteEndpointMode = 'station' | 'address';

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
      startMode === 'address' ? startAddress?.fullAddress ?? '출발 주소를 입력해 주세요.' : startStation?.stationName ?? '출발역을 선택해 주세요.';
    const endLabel =
      endMode === 'address' ? endAddress?.fullAddress ?? '도착 주소를 입력해 주세요.' : endStation?.stationName ?? '도착역을 선택해 주세요.';
    return `${startLabel} → ${endLabel}`;
  }, [endAddress?.fullAddress, endMode, endStation?.stationName, startAddress?.fullAddress, startMode, startStation?.stationName]);

  async function handleUseCurrentLocation(target: PickTarget) {
    if (!target) {
      return;
    }

    try {
      setResolvingLocation(target);
      const currentLocation = await locationService.getCurrentLocation();
      if (!currentLocation) {
        Alert.alert('위치 권한이 필요합니다', '기기 위치 권한을 허용한 뒤 다시 시도해 주세요.');
        return;
      }

      const stationCandidates = stations
        .filter((station) => station.location?.latitude != null && station.location?.longitude != null)
        .map((station) => ({
          station,
          ...buildStationLocation(station),
        }));

      const nearest = locationService.findNearestStations(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
          altitude: currentLocation.altitude,
          speed: currentLocation.speed,
          heading: currentLocation.heading,
        },
        stationCandidates,
        1
      )[0];

      if (!nearest) {
        Alert.alert('가까운 역을 찾지 못했습니다', '잠시 후 다시 시도해 주세요.');
        return;
      }

      if (target === 'start') {
        setStartStation(nearest.station.station);
      } else {
        setEndStation(nearest.station.station);
      }

      Alert.alert(
        '가까운 역을 추천했어요',
        `${nearest.station.station.stationName} (${Math.round(nearest.distanceMeters)}m)`
      );
    } catch (error) {
      console.error('Failed to resolve nearest station', error);
      Alert.alert('위치 확인에 실패했습니다', '현재 위치를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setResolvingLocation(null);
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
      Alert.alert('출발 주소를 확인해 주세요', '도로명 주소를 검색하고 상세주소를 입력해 주세요.');
      return;
    }

    if (endMode === 'address' && !endAddress) {
      Alert.alert('도착 주소를 확인해 주세요', '도로명 주소를 검색하고 상세주소를 입력해 주세요.');
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('요일 선택이 필요합니다', '최소 한 개 이상의 요일을 선택해 주세요.');
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
          onPress: () =>
            navigation.navigate('Tabs', {
              screen: 'RouteManagement',
              params: { justAddedRouteId: createdRoute.routeId },
            }),
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
        <Text style={styles.loadingText}>동선 화면을 준비하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>출발 정보</Text>
          <View style={styles.row}>
            <ModeChip label="역 기준" active={startMode === 'station'} onPress={() => setStartMode('station')} />
            <ModeChip label="주소 기준" active={startMode === 'address'} onPress={() => setStartMode('address')} />
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
                placeholder="상세주소"
                placeholderTextColor={Colors.gray400}
              />
            </View>
          ) : null}

          <TouchableOpacity style={styles.selector} onPress={() => setPickTarget('start')}>
            <Text style={styles.selectorLabel}>{startMode === 'address' ? '가까운 출발역' : '출발역'}</Text>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>도착 정보</Text>
          <View style={styles.row}>
            <ModeChip label="역 기준" active={endMode === 'station'} onPress={() => setEndMode('station')} />
            <ModeChip label="주소 기준" active={endMode === 'address'} onPress={() => setEndMode('address')} />
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
                placeholder="상세주소"
                placeholderTextColor={Colors.gray400}
              />
            </View>
          ) : null}

          <TouchableOpacity style={styles.selector} onPress={() => setPickTarget('end')}>
            <Text style={styles.selectorLabel}>{endMode === 'address' ? '가까운 도착역' : '도착역'}</Text>
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
        </View>

        <View style={styles.card}>
          <TimePicker
            label="출발 시간"
            value={departureTime}
            onChange={setDepartureTime}
            placeholder="출발 시간을 선택해 주세요."
            minuteInterval={10}
          />
          <DaySelector
            selectedDays={selectedDays}
            onChange={setSelectedDays}
            label="운행 요일"
            hint="반복되는 요일만 선택해 주세요."
          />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>등록 요약</Text>
          <Text style={styles.summaryRoute}>{routeSummary}</Text>
          <Text style={styles.summaryMeta}>
            {departureTime} 출발 · {selectedDays.map((day) => DAY_LABELS[day]).join(', ')}
          </Text>
        </View>

        <Button
          title={saving ? '동선 등록 중...' : '동선 등록'}
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
        title="출발 도로명 주소 검색"
        onClose={() => setAddressTarget(null)}
        onSelectAddress={(item) => {
          setStartRoadAddress(item.roadAddress);
        }}
      />

      <AddressSearchModal
        visible={addressTarget === 'end'}
        title="도착 도로명 주소 검색"
        onClose={() => setAddressTarget(null)}
        onSelectAddress={(item) => {
          setEndRoadAddress(item.roadAddress);
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
