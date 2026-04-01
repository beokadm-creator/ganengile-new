import React, { useEffect, useMemo, useState } from 'react';
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

import AppTopBar from '../../components/common/AppTopBar';
import Button from '../../components/common/Button';
import DaySelector, { DAY_LABELS } from '../../components/common/DaySelector';
import StationSelectModal from '../../components/common/StationSelectModal';
import TimePicker from '../../components/common/TimePicker';
import { getAllStations } from '../../services/config-service';
import { requireUserId } from '../../services/firebase';
import { createRoute } from '../../services/route-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { Station } from '../../types/config';
import type { MainStackWithTabNavigationProp } from '../../types/navigation';
import type { StationInfo } from '../../types/route';

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
    const loadStations = async () => {
      try {
        setLoading(true);
        const stationList = await getAllStations();
        setStations(stationList);
      } catch (error) {
        console.error('Failed to load stations', error);
        Alert.alert('역 정보를 불러오지 못했습니다', '잠시 후 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    };

    void loadStations();
  }, []);

  const routeSummary = useMemo(() => {
    if (!startStation || !endStation) {
      return '출발역과 도착역을 선택해주세요.';
    }

    return `${startStation.stationName} -> ${endStation.stationName}`;
  }, [endStation, startStation]);

  const handleSave = async () => {
    if (!startStation || !endStation) {
      Alert.alert('역을 선택해주세요', '출발역과 도착역을 먼저 선택해주세요.');
      return;
    }

    if (startStation.stationId === endStation.stationId) {
      Alert.alert('역을 다시 선택해주세요', '출발역과 도착역은 다르게 선택해야 합니다.');
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('요일을 선택해주세요', '운행 요일을 하나 이상 선택해주세요.');
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

      Alert.alert('경로를 등록했어요', `${routeSummary}\n${departureTime} 출발`, [
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
      Alert.alert(
        '경로 등록에 실패했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>경로 정보를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppTopBar title="경로 등록" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>이동 구간</Text>

          <TouchableOpacity
            style={styles.stationButton}
            onPress={() => setPickTarget('start')}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.stationLabel}>출발역</Text>
              <Text style={styles.stationValue}>
                {startStation?.stationName ?? '출발역 선택'}
              </Text>
            </View>
            <Text style={styles.stationAction}>선택</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stationButton}
            onPress={() => setPickTarget('end')}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.stationLabel}>도착역</Text>
              <Text style={styles.stationValue}>
                {endStation?.stationName ?? '도착역 선택'}
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
            placeholder="출발 시간을 선택해주세요."
            minuteInterval={10}
          />
          <DaySelector
            selectedDays={selectedDays}
            onChange={setSelectedDays}
            label="운행 요일"
            hint="반복되는 요일만 선택하세요."
          />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>등록 내용</Text>
          <Text style={styles.summaryRoute}>{routeSummary}</Text>
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
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  stationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    minHeight: 58,
  },
  stationLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  stationValue: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  stationAction: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
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
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  summaryRoute: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summaryMeta: {
    marginTop: Spacing.xs,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
});
