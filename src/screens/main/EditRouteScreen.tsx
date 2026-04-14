import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { getAllStations } from '../../services/config-service';
import { getRoute, updateRoute, validateRouteForUpdate } from '../../services/route-service';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import type { Station } from '../../types/config';
import type { StationInfo, Route } from '../../types/route';
import { Colors, Spacing, BorderRadius } from '../../theme';
import { Typography } from '../../theme/typography';
import Button from '../../components/common/Button';
import TimePicker from '../../components/common/TimePicker';
import DaySelector, { DAY_LABELS } from '../../components/common/DaySelector';
import StationSelectModal from '../../components/common/StationSelectModal';
import AppTopBar from '../../components/common/AppTopBar';
import { Shadows } from '../../theme';

type EditRouteRouteProp = RouteProp<MainStackParamList, 'EditRoute'>;
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

function toStationCandidate(stationInfo: StationInfo): Station {
  return {
    stationId: stationInfo.stationId,
    stationName: stationInfo.stationName,
    stationNameEnglish: stationInfo.stationName,
    lines: [
      {
        lineId: stationInfo.line,
        lineCode: stationInfo.lineCode,
        lineName: stationInfo.lineCode || stationInfo.line,
        lineColor: Colors.textSecondary,
        lineType: 'general',
      },
    ],
    location: {
      latitude: stationInfo.lat,
      longitude: stationInfo.lng,
    },
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    facilities: {
      hasElevator: false,
      hasEscalator: false,
      wheelchairAccessible: false,
    },
    isActive: true,
    region: '서울',
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export default function EditRouteScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<EditRouteRouteProp>();
  const { routeId } = route.params;

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalRoute, setOriginalRoute] = useState<Route | null>(null);
  const [startStation, setStartStation] = useState<Station | null>(null);
  const [endStation, setEndStation] = useState<Station | null>(null);
  const [departureTime, setDepartureTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);

  const hasChanges = useMemo(() => {
    if (!originalRoute || !startStation || !endStation) {
      return false;
    }

    const originalDays = [...originalRoute.daysOfWeek].sort((a, b) => a - b).join(',');
    const currentDays = [...selectedDays].sort((a, b) => a - b).join(',');

    return (
      originalRoute.startStation.stationId !== startStation.stationId ||
      originalRoute.endStation.stationId !== endStation.stationId ||
      originalRoute.departureTime !== departureTime ||
      originalDays !== currentDays
    );
  }, [departureTime, endStation, originalRoute, selectedDays, startStation]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = requireUserId();
      const [routeData, stationList] = await Promise.all([getRoute(routeId, userId), getAllStations()]);

      if (!routeData) {
        Alert.alert('경로를 찾을 수 없어요', '이미 삭제되었거나 접근 권한이 없습니다.', [
          { text: '확인', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      setOriginalRoute(routeData);
      setStations(stationList);
      setStartStation(
        stationList.find((station) => station.stationId === routeData.startStation.stationId) ??
          toStationCandidate(routeData.startStation),
      );
      setEndStation(
        stationList.find((station) => station.stationId === routeData.endStation.stationId) ??
          toStationCandidate(routeData.endStation),
      );
      setDepartureTime(routeData.departureTime);
      setSelectedDays(routeData.daysOfWeek);
    } catch (error) {
      console.error('경로 정보를 불러오지 못했어요:', error);
      Alert.alert('경로 정보를 불러오지 못했어요', '잠시 후 다시 시도해 주세요.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [navigation, routeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBack = () => {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }

    Alert.alert('수정 내용을 저장하지 않았어요', '이 화면을 나가면 변경 사항이 사라집니다.', [
      { text: '계속 수정', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const persistRoute = async () => {
    if (!startStation || !endStation) {
      return;
    }

    setSaving(true);
    try {
      const userId = requireUserId();
      const updatedRoute = await updateRoute(routeId, userId, {
        startStation: toStationInfo(startStation),
        endStation: toStationInfo(endStation),
        departureTime,
        daysOfWeek: selectedDays,
      });

      if (!updatedRoute) {
        Alert.alert('경로를 수정할 수 없어요', '접근 권한을 다시 확인해 주세요.');
        return;
      }

      Alert.alert('경로를 수정했어요', '변경 내용이 저장되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(
        '경로 수정에 실패했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!startStation || !endStation) {
      Alert.alert('출발역과 도착역을 선택해 주세요');
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('운행 요일을 하나 이상 선택해 주세요');
      return;
    }

    try {
      const userId = requireUserId();
      const validation = await validateRouteForUpdate(
        userId,
        routeId,
        toStationInfo(startStation),
        toStationInfo(endStation),
        departureTime,
        selectedDays,
      );

      if (!validation.isValid) {
        Alert.alert('경로를 다시 확인해 주세요', validation.errors.join('\n\n'));
        return;
      }

      if (validation.warnings.length > 0) {
        Alert.alert('확인 후 저장해 주세요', validation.warnings.join('\n\n'), [
          { text: '취소', style: 'cancel' },
          { text: '계속 저장', onPress: () => void persistRoute() },
        ]);
        return;
      }

      await persistRoute();
    } catch (error) {
      console.error('경로 검증 실패:', error);
      Alert.alert('경로 검증에 실패했어요', '잠시 후 다시 시도해 주세요.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>등록된 경로 정보를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppTopBar title="경로 수정" onBack={handleBack} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>현재 요약</Text>
          <Text style={styles.summaryRoute}>
            {startStation?.stationName ?? '출발역'} → {endStation?.stationName ?? '도착역'}
          </Text>
          <Text style={styles.summaryMeta}>
            {departureTime} 출발 · {selectedDays.map((day) => DAY_LABELS[day]).join(', ')}
          </Text>
          {hasChanges ? <Text style={styles.changeBadge}>수정 사항이 있습니다.</Text> : null}
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.stationButton} onPress={() => setPickTarget('start')}>
            <View>
              <Text style={styles.stationLabel}>출발역</Text>
              <Text style={styles.stationValue}>{startStation?.stationName ?? '출발역 선택'}</Text>
            </View>
            <Text style={styles.stationAction}>변경</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.stationButton} onPress={() => setPickTarget('end')}>
            <View>
              <Text style={styles.stationLabel}>도착역</Text>
              <Text style={styles.stationValue}>{endStation?.stationName ?? '도착역 선택'}</Text>
            </View>
            <Text style={styles.stationAction}>변경</Text>
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

        <Button
          title={saving ? '저장 중...' : hasChanges ? '변경 내용 저장' : '변경 내용 없음'}
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={saving || !hasChanges}
          variant="primary"
          size="large"
          fullWidth
        />

        {Platform.OS === 'web' ? null : (
          <Text style={styles.footerHint}>저장하지 않은 상태로 나가면 변경 사항이 사라집니다.</Text>
        )}
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
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { alignItems: 'center', backgroundColor: Colors.background, flex: 1, justifyContent: 'center', padding: Spacing.xl },
  loadingText: { color: Colors.textSecondary, fontSize: Typography.fontSize.base, marginTop: Spacing.md, textAlign: 'center' },
  content: { flex: 1 },
  contentInner: { gap: Spacing.md, padding: Spacing.lg, paddingBottom: Spacing['5xl'] },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.sm },
  summaryTitle: { color: Colors.primary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.extrabold, marginBottom: Spacing.xs },
  summaryRoute: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.extrabold },
  summaryMeta: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, marginTop: Spacing.xs },
  changeBadge: { color: Colors.warningDark, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, marginTop: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, gap: Spacing.md, padding: Spacing.lg, ...Shadows.sm },
  stationButton: { alignItems: 'center', backgroundColor: Colors.surface, borderColor: Colors.border, borderRadius: BorderRadius.md, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md, minHeight: 58 },
  stationLabel: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, marginBottom: 4 },
  stationValue: { color: Colors.textPrimary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  stationAction: { color: Colors.primary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold },
  footerHint: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs, textAlign: 'center', marginTop: Spacing.md },
});
