/**
 * Add Route Screen
 * 동선 (출퇴근 경로) 등록 화면
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { getAllStations } from '../../services/config-service';
import { createRoute, validateRoute } from '../../services/route-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { Station } from '../../types/config';
import type { StationInfo } from '../../types/route';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import Button from '../../components/common/Button';
import TimePicker from '../../components/common/TimePicker';
import DaySelector, { DAY_LABELS } from '../../components/common/DaySelector';
import StationSelectModal from '../../components/common/StationSelectModal';

export default function AddRouteScreen() {
  const route = useRoute();
  const navigation = useNavigation<MainStackNavigationProp>();

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [startStation, setStartStation] = useState<StationInfo | null>(null);
  const [endStation, setEndStation] = useState<StationInfo | null>(null);
  const [departureTime, setDepartureTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [startStationModalVisible, setStartStationModalVisible] = useState(false);
  const [endStationModalVisible, setEndStationModalVisible] = useState(false);

  useEffect(() => {
    const params = route.params as { selectedStation?: Station } | undefined;
    if (params?.selectedStation) {
      const station = params.selectedStation;
      const stationInfo: StationInfo = {
        id: station.stationId,
        stationId: station.stationId,
        stationName: station.stationName,
        line: station.lines[0]?.lineId || '',
        lineCode: station.lines[0]?.lineCode || '',
        lat: station.location?.latitude || 0,
        lng: station.location?.longitude || 0,
      };
      setStartStation(stationInfo);
    }
    loadStations();
  }, [route.params]);

  const loadStations = async () => {
    try {
      setLoading(true);
      const stationList = await getAllStations();
      setStations(stationList);
    } catch (error) {
      console.error('역 목록 로드 실패:', error);
      Alert.alert('오류', '역 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStartStation = (station: Station) => {
    const stationInfo: StationInfo = {
      id: station.stationId,
      stationId: station.stationId,
      stationName: station.stationName,
      line: station.lines[0]?.lineId || '',
      lineCode: station.lines[0]?.lineCode || '',
      lat: station.location?.latitude || 0,
      lng: station.location?.longitude || 0,
    };
    setStartStation(stationInfo);
  };

  const handleSelectEndStation = (station: Station) => {
    const stationInfo: StationInfo = {
      id: station.stationId,
      stationId: station.stationId,
      stationName: station.stationName,
      line: station.lines[0]?.lineId || '',
      lineCode: station.lines[0]?.lineCode || '',
      lat: station.location?.latitude || 0,
      lng: station.location?.longitude || 0,
    };
    setEndStation(stationInfo);
  };

  const handleSave = () => {
    if (!startStation || !endStation) {
      Alert.alert(
        '역을 선택해주세요',
        '출발역과 도착역을 모두 선택해야 합니다.',
        [{ text: '확인' }]
      );
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert(
        '요일을 선택해주세요',
        '최소 하나 이상의 요일을 선택해야 합니다.',
        [{ text: '확인' }]
      );
      return;
    }

    const validation = validateRoute(startStation, endStation, departureTime, selectedDays);
    if (!validation.isValid) {
      Alert.alert(
        '유효성 오류',
        validation.errors.join('\n\n'),
        [{ text: '확인' }]
      );
      return;
    }

    if (validation.warnings.length > 0) {
      Alert.alert(
        '⚠️ 확인해주세요',
        validation.warnings.join('\n\n'),
        [
          { text: '취소', style: 'cancel' },
          { text: '계속 진행', onPress: saveRoute },
        ]
      );
    } else {
      saveRoute();
    }
  };

  const saveRoute = async () => {
    if (!startStation || !endStation) return;

    try {
      setSaving(true);

      const userId = requireUserId();
      await createRoute(userId, startStation, endStation, departureTime, selectedDays);

      Alert.alert(
        '✅ 동선 등록 완료',
        `${startStation.stationName} → ${endStation.stationName}\n${departureTime} 출발\n${selectedDays.map(d => DAY_LABELS[d]).join(', ')}요일에 운영합니다.`,
        [
          {
            text: '확인',
            onPress: () => {
              setStartStation(null);
              setEndStation(null);
              setDepartureTime('08:00');
              setSelectedDays([1, 2, 3, 4, 5]);
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('동선 저장 실패:', error);
      Alert.alert(
        '저장 실패',
        '동선 저장에 실패했습니다. 다시 시도해주세요.',
        [{ text: '확인' }]
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>역 목록 로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>동선 등록</Text>
        <Text style={styles.subtitle}>출퇴근 경로를 등록하세요</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* 선택 정보 요약 */}
        {startStation && endStation && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <Text style={styles.summaryTitle}>동선 요약</Text>
            </View>
            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>경로</Text>
                <Text style={styles.summaryValue}>
                  {startStation.stationName} → {endStation.stationName}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>출발 시간</Text>
                <Text style={styles.summaryValue}>{departureTime}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>운영 요일</Text>
                <Text style={styles.summaryValue}>
                  {selectedDays.map(d => DAY_LABELS[d]).join(', ')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 출발역 */}
        <View style={styles.section}>
          <Text style={styles.label}>출발역</Text>
          <TouchableOpacity
            style={styles.stationButton}
            onPress={() => setStartStationModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.stationButtonText}>
              {startStation ? startStation.stationName : '출발역 선택'}
            </Text>
            <Text style={styles.stationButtonArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 도착역 */}
        <View style={styles.section}>
          <Text style={styles.label}>도착역</Text>
          <TouchableOpacity
            style={styles.stationButton}
            onPress={() => setEndStationModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.stationButtonText}>
              {endStation ? endStation.stationName : '도착역 선택'}
            </Text>
            <Text style={styles.stationButtonArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 출발 시간 */}
        <View style={styles.section}>
          <TimePicker
            label="출발 시간"
            value={departureTime}
            onChange={setDepartureTime}
            placeholder="시간을 선택해주세요"
            minuteInterval={10}
          />
        </View>

        {/* 운영 요일 */}
        <View style={styles.section}>
          <DaySelector
            selectedDays={selectedDays}
            onChange={setSelectedDays}
            label="운영 요일"
            hint="선택된 요일"
          />
        </View>

        {/* 등록 버튼 */}
        <Button
          title="동선 등록"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          variant="primary"
          size="large"
          fullWidth
        />
      </ScrollView>

      {/* 역 선택 모달들 */}
      <StationSelectModal
        visible={startStationModalVisible}
        onClose={() => setStartStationModalVisible(false)}
        onStationSelect={handleSelectStartStation}
        title="출발역 선택"
        stations={stations}
        searchPlaceholder="역 이름 검색..."
      />

      <StationSelectModal
        visible={endStationModalVisible}
        onClose={() => setEndStationModalVisible(false)}
        onStationSelect={handleSelectEndStation}
        title="도착역 선택"
        stations={stations}
        searchPlaceholder="역 이름 검색..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    backgroundColor: Colors.secondary,
    padding: Spacing.lg,
    paddingTop: 60,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.xs,
    opacity: 0.9,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  stationButton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  stationButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
  },
  stationButtonArrow: {
    color: Colors.gray400,
    fontSize: 24,
    fontWeight: '300',
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  summaryHeader: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  summaryTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  summaryContent: {
    padding: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  summaryValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.md,
  },
});
