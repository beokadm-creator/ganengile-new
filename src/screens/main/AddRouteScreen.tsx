import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { getAllStations } from '../../services/config-service';
import { createRoute } from '../../services/route-service';
import type { MainStackWithTabNavigationProp } from '../../types/navigation';
import type { Station } from '../../types/config';
import type { StationInfo } from '../../types/route';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import Button from '../../components/common/Button';
import TimePicker from '../../components/common/TimePicker';
import DaySelector, { DAY_LABELS } from '../../components/common/DaySelector';
import StationSelectModal from '../../components/common/StationSelectModal';

type PickTarget = 'start' | 'end' | null;

function toStationInfo(station: Station): StationInfo {
  return {
    id: station.stationId,
    stationId: station.stationId,
    stationName: station.stationName,
    line: station.lines[0]?.lineId ?? '',
    lineCode: station.lines[0]?.lineCode ?? '',
    lat: station.location?.latitude ?? 0,
    lng: station.location?.longitude ?? 0,
  };
}

export default function AddRouteScreen() {
  const navigation = useNavigation<MainStackWithTabNavigationProp>();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [startStation, setStartStation] = useState<Station | null>(null);
  const [endStation, setEndStation] = useState<Station | null>(null);
  const [departureTime, setDepartureTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    void loadStations();
  }, []);

  const routeSummary = useMemo(() => {
    if (!startStation || !endStation) {
      return null;
    }

    return `${startStation.stationName} → ${endStation.stationName}`;
  }, [startStation, endStation]);

  const loadStations = async () => {
    try {
      setLoading(true);
      const stationList = await getAllStations();
      setStations(stationList);
    } catch (error) {
      console.error('역 목록 로드 실패:', error);
      Alert.alert('역 정보를 불러오지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!startStation || !endStation) {
      Alert.alert('출발역과 도착역을 선택해 주세요');
      return;
    }

    if (startStation.stationId === endStation.stationId) {
      Alert.alert('같은 역으로는 경로를 만들 수 없어요', '서로 다른 역을 선택해 주세요.');
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('운행 요일을 하나 이상 선택해 주세요');
      return;
    }

    try {
      setSaving(true);
      const userId = requireUserId();
      const createdRoute = await createRoute(
        userId,
        toStationInfo(startStation),
        toStationInfo(endStation),
        departureTime,
        selectedDays,
      );

      Alert.alert(
        '경로를 등록했어요',
        `${startStation.stationName} → ${endStation.stationName}\n${departureTime} 출발 · ${selectedDays
          .map((day) => DAY_LABELS[day])
          .join(', ')}`,
        [
          {
            text: '확인',
            onPress: () =>
              navigation.navigate('Tabs', {
                screen: 'RouteManagement',
                params: { justAddedRouteId: createdRoute.routeId },
              }),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        '경로 등록에 실패했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>경로에 사용할 역을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>출퇴근 경로 등록</Text>
        <Text style={styles.headerSubtitle}>
          자주 이동하는 동선을 등록해 두면 매칭과 추천이 더 빨라집니다.
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>기본 경로</Text>
          <TouchableOpacity
            style={styles.stationButton}
            onPress={() => setPickTarget('start')}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.stationLabel}>출발역</Text>
              <Text style={styles.stationValue}>
                {startStation?.stationName ?? '출발역을 선택해 주세요'}
              </Text>
            </View>
            <Text style={styles.stationAction}>선택</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stationButton}
            onPress={() => setPickTarget('end')}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.stationLabel}>도착역</Text>
              <Text style={styles.stationValue}>
                {endStation?.stationName ?? '도착역을 선택해 주세요'}
              </Text>
            </View>
            <Text style={styles.stationAction}>선택</Text>
          </TouchableOpacity>
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
            hint="선택한 요일"
          />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>등록 예정 경로</Text>
          <Text style={styles.summaryRoute}>{routeSummary ?? '역을 먼저 선택해 주세요'}</Text>
          <Text style={styles.summaryMeta}>
            {departureTime} 출발 · {selectedDays.map((day) => DAY_LABELS[day]).join(', ')}
          </Text>
        </View>

        <Button
          title={saving ? '등록 중...' : '경로 등록'}
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
        searchPlaceholder="출발역 이름을 검색해 주세요"
      />

      <StationSelectModal
        visible={pickTarget === 'end'}
        onClose={() => setPickTarget(null)}
        onStationSelect={setEndStation}
        title="도착역 선택"
        stations={stations}
        searchPlaceholder="도착역 이름을 검색해 주세요"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    backgroundColor: Colors.secondary,
    padding: Spacing.lg,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  headerSubtitle: {
    marginTop: Spacing.xs,
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    opacity: 0.92,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  stationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: Colors.gray50,
  },
  stationLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  stationValue: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  stationAction: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  summaryCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  summaryTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  summaryRoute: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  summaryMeta: {
    marginTop: Spacing.xs,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
});
