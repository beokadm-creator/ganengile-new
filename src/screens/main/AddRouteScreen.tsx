/**
 * Add Route Screen
 * 동선 (출퇴근 경로) 등록 화면
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { getAllStations } from '../../services/config-service';
import { createRoute } from '../../services/route-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { Station } from '../../types/config';
import type { StationInfo } from '../../types/route';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

type PickTarget = 'start' | 'end' | null;

export default function AddRouteScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [startStationName, setStartStationName] = useState('');
  const [endStationName, setEndStationName] = useState('');
  const [departureTime, setDepartureTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // 역 선택 모달
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [stationQuery, setStationQuery] = useState('');

  const filteredStations = useMemo(() => {
    if (!stationQuery.trim()) return stations;
    return stations.filter((s) =>
      s.stationName.includes(stationQuery.trim())
    );
  }, [stations, stationQuery]);

  useEffect(() => {
    loadStations();
  }, []);

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

  const openPicker = (target: PickTarget) => {
    setStationQuery('');
    setPickTarget(target);
  };

  const selectStation = (stationName: string) => {
    if (pickTarget === 'start') setStartStationName(stationName);
    else if (pickTarget === 'end') setEndStationName(stationName);
    setPickTarget(null);
  };

  const handleSave = async () => {
    if (!startStationName || !endStationName) {
      Alert.alert('필수 입력', '출발역과 도착역을 모두 선택해주세요.');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('필수 입력', '운영 요일을 최소 1개 이상 선택해주세요.');
      return;
    }
    if (startStationName === endStationName) {
      Alert.alert('입력 오류', '출발역과 도착역이 같습니다.');
      return;
    }

    const startStation = stations.find((s) => s.stationName === startStationName);
    const endStation = stations.find((s) => s.stationName === endStationName);

    if (!startStation || !endStation) {
      Alert.alert('오류', '선택한 역을 찾을 수 없습니다.');
      return;
    }

    const toStationInfo = (s: Station): StationInfo => ({
      id: s.stationId,
      stationId: s.stationId,
      stationName: s.stationName,
      line: s.lines[0]?.lineId || '',
      lineCode: s.lines[0]?.lineCode || '',
      lat: s.location?.latitude || 0,
      lng: s.location?.longitude || 0,
    });

    try {
      setSaving(true);
      const userId = await requireUserId();
      const createdRoute = await createRoute(
        userId,
        toStationInfo(startStation),
        toStationInfo(endStation),
        departureTime,
        selectedDays
      );
      Alert.alert(
        '✅ 동선 등록 완료',
        `${startStationName} → ${endStationName}\n출발: ${departureTime}\n요일: ${selectedDays.map((d) => DAY_LABELS[d - 1]).join(', ')}`,
        [{
          text: '확인',
          onPress: () => navigation.navigate('Tabs', {
            screen: 'RouteManagement',
            params: { justAddedRouteId: createdRoute.routeId },
          } as any),
        }]
      );
    } catch (error) {
      Alert.alert('실패', error instanceof Error ? error.message : '동선 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>동선 등록</Text>
        <Text style={styles.headerSubtitle}>출퇴근 경로를 등록하세요</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* 출발역 */}
        <View style={styles.field}>
          <Text style={styles.label}>출발역</Text>
          <TouchableOpacity
            style={[styles.stationButton, startStationName ? styles.stationButtonFilled : null]}
            onPress={() => openPicker('start')}
            activeOpacity={0.7}
          >
            <Text style={[styles.stationButtonText, !startStationName && styles.placeholder]}>
              {startStationName || '출발역 선택'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 도착역 */}
        <View style={styles.field}>
          <Text style={styles.label}>도착역</Text>
          <TouchableOpacity
            style={[styles.stationButton, endStationName ? styles.stationButtonFilled : null]}
            onPress={() => openPicker('end')}
            activeOpacity={0.7}
          >
            <Text style={[styles.stationButtonText, !endStationName && styles.placeholder]}>
              {endStationName || '도착역 선택'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 출발 시간 */}
        <View style={styles.field}>
          <Text style={styles.label}>출발 시간</Text>
          <TextInput
            style={styles.input}
            value={departureTime}
            onChangeText={setDepartureTime}
            placeholder="HH:MM (예: 08:00)"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* 운영 요일 */}
        <View style={styles.field}>
          <Text style={styles.label}>운영 요일</Text>
          <View style={styles.daysContainer}>
            {DAY_LABELS.map((label, index) => {
              const day = index + 1;
              const isSelected = selectedDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                  onPress={() => toggleDay(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 저장 버튼 */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {saving ? '저장 중...' : '동선 등록'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 역 선택 Modal — 앱 루트 레벨에서 렌더링됨 */}
      <Modal
        visible={pickTarget !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPickTarget(null)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* 모달 헤더 */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickTarget === 'start' ? '출발역 선택' : '도착역 선택'}
              </Text>
              <TouchableOpacity
                onPress={() => setPickTarget(null)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 검색 입력 */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="역 이름 검색..."
                value={stationQuery}
                onChangeText={setStationQuery}
                autoFocus={Platform.OS !== 'web'}
                clearButtonMode="while-editing"
              />
            </View>

            {/* 역 목록 */}
            <FlatList
              data={filteredStations}
              keyExtractor={(item) => item.stationId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.stationItem}
                  onPress={() => selectStation(item.stationName)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.stationItemText}>{item.stationName}</Text>
                  {item.lines?.length > 0 && (
                    <Text style={styles.stationLineText}>
                      {item.lines.map((l: any) => l.lineName || l.lineId).join(' · ')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                </View>
              }
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </SafeAreaView>
      </Modal>
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
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
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
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    opacity: 0.9,
    marginTop: Spacing.xs,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  stationButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationButtonFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  stationButtonText: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    flex: 1,
  },
  placeholder: {
    color: Colors.gray400,
  },
  chevron: {
    fontSize: 22,
    color: Colors.gray400,
    marginLeft: Spacing.sm,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  dayLabelSelected: {
    color: Colors.white,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalCloseText: {
    fontSize: 20,
    color: Colors.gray600,
  },
  searchContainer: {
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  searchInput: {
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.xs,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  stationItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  stationItemText: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  stationLineText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginHorizontal: Spacing.lg,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
});
