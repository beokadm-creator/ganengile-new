/**
 * Edit Route Screen
 * 동선 (출퇴근 경로) 수정 화면
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
import { getRoute, updateRoute, validateRouteForUpdate } from '../../services/route-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { Station } from '../../types/config';
import type { StationInfo, Route } from '../../types/route';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import Button from '../../components/common/Button';
import TimePicker from '../../components/common/TimePicker';
import DaySelector, { DAY_LABELS } from '../../components/common/DaySelector';
import StationSelectModal from '../../components/common/StationSelectModal';

interface RouteParams {
  routeId: string;
}

export default function EditRouteScreen() {
  const route = useRoute();
  const navigation = useNavigation<MainStackNavigationProp>();

  const { routeId } = (route.params as RouteParams) || {};

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalRoute, setOriginalRoute] = useState<Route | null>(null);

  const [startStation, setStartStation] = useState<StationInfo | null>(null);
  const [endStation, setEndStation] = useState<StationInfo | null>(null);
  const [departureTime, setDepartureTime] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const [startStationModalVisible, setStartStationModalVisible] = useState(false);
  const [endStationModalVisible, setEndStationModalVisible] = useState(false);

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!routeId) {
      Alert.alert('오류', '경로 ID가 없습니다.');
      navigation.goBack();
      return;
    }

    loadRouteData();
    loadStations();
  }, [routeId]);

  // 변경사항 감지
  useEffect(() => {
    if (!originalRoute) return;

    const changed =
      startStation?.stationId !== originalRoute.startStation.stationId ||
      endStation?.stationId !== originalRoute.endStation.stationId ||
      departureTime !== originalRoute.departureTime ||
      JSON.stringify(selectedDays.sort()) !== JSON.stringify(originalRoute.daysOfWeek.sort());

    setHasChanges(changed);
  }, [startStation, endStation, departureTime, selectedDays, originalRoute]);

  const loadRouteData = async () => {
    try {
      setLoading(true);
      const userId = await requireUserId();
      const routeData = await getRoute(routeId, userId);

      if (!routeData) {
        Alert.alert('오류', '경로를 찾을 수 없습니다.');
        navigation.goBack();
        return;
      }

      setOriginalRoute(routeData);
      setStartStation(routeData.startStation);
      setEndStation(routeData.endStation);
      setDepartureTime(routeData.departureTime);
      setSelectedDays(routeData.daysOfWeek);
    } catch (error) {
      console.error('경로 로드 실패:', error);
      Alert.alert('오류', '경로 정보를 불러오는데 실패했습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadStations = async () => {
    try {
      const stationList = await getAllStations();
      setStations(stationList);
    } catch (error) {
      console.error('역 목록 로드 실패:', error);
      Alert.alert('오류', '역 목록을 불러오는데 실패했습니다.');
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

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        '수정 사항이 있습니다',
        '저장하지 않고 나가시겠습니까?',
        [
          { text: '계속 수정', style: 'cancel' },
          {
            text: '나가기',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
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

    // 비동기 유효성 검사
    try {
      const userId = await requireUserId();
      const validation = await validateRouteForUpdate(
        userId,
        routeId,
        startStation,
        endStation,
        departureTime,
        selectedDays
      );

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
    } catch (error) {
      console.error('Validation error:', error);
      Alert.alert(
        '오류',
        '유효성 검사 중 오류가 발생했습니다.',
        [{ text: '확인' }]
      );
    }
  };

  const saveRoute = async () => {
    if (!startStation || !endStation) return;

    try {
      setSaving(true);
      const userId = await requireUserId();

      await updateRoute(routeId, userId, {
        startStation,
        endStation,
        departureTime,
        daysOfWeek: selectedDays,
      });

      Alert.alert(
        '✅ 동선 수정 완료',
        `${startStation.stationName} → ${endStation.stationName}\n${departureTime} 출발\n${selectedDays.map(d => DAY_LABELS[d]).join(', ')}요일에 운영합니다.`,
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('동선 수정 실패:', error);
      Alert.alert(
        '저장 실패',
        '동선 수정에 실패했습니다. 다시 시도해주세요.',
        [{ text: '확인' }]
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!originalRoute) return;

    const routeName = `${originalRoute.startStation.stationName} → ${originalRoute.endStation.stationName}`;

    Alert.alert(
      '동선 삭제',
      `${routeName}\n\n이 동선을 삭제하시겠습니까?\n삭제된 동선은 복구할 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const userId = await requireUserId();
              const { deleteRoute } = await import('../../services/route-service');
              await deleteRoute(routeId, userId);
              Alert.alert(
                '삭제 완료',
                '동선이 삭제되었습니다.',
                [
                  {
                    text: '확인',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              console.error('동선 삭제 실패:', error);
              Alert.alert(
                '삭제 실패',
                '동선 삭제에 실패했습니다. 다시 시도해주세요.',
                [{ text: '확인' }]
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>동선 정보 로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>동선 수정</Text>
          <View style={styles.backButton} />
        </View>
        <Text style={styles.subtitle}>기존 동선 정보를 수정하세요</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* 선택 정보 요약 */}
        {startStation && endStation && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <Text style={styles.summaryTitle}>동선 요약</Text>
              {hasChanges && (
                <View style={styles.changedBadge}>
                  <Text style={styles.changedBadgeText}>수정됨</Text>
                </View>
              )}
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

        {/* 저장 버튼 */}
        <Button
          title="저장하기"
          onPress={handleSave}
          loading={saving}
          disabled={saving || !hasChanges}
          variant="primary"
          size="large"
          fullWidth
          style={{ marginBottom: Spacing.md }}
        />

        {/* 삭제 버튼 */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={saving}
        >
          <Ionicons name="trash-outline" size={20} color="#f44336" />
          <Text style={styles.deleteButtonText}>이 동선 삭제하기</Text>
        </TouchableOpacity>
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
    backgroundColor: Colors.primary,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  backButton: {
    width: 40,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize['2xl'],
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
    backgroundColor: Colors.primaryLight,
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  summaryTitle: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    flex: 1,
  },
  changedBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  changedBadgeText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
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
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  deleteButtonText: {
    color: '#f44336',
    fontSize: Typography.fontSize.base,
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
