/**
 * Add Route Screen - 완전히 새로 작성
 * 동선 (출퇴근 경로) 등록 화면
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { getAllStations } from '../../services/config-service';
import { createRoute } from '../../services/route-service';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { Station } from '../../types/config';
import type { StationInfo } from '../../types/route';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

export default function AddRouteScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();

  // State
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form data
  const [startStationName, setStartStationName] = useState('');
  const [endStationName, setEndStationName] = useState('');
  const [departureTime, setDepartureTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // UI State
  const [showStartStationList, setShowStartStationList] = useState(false);
  const [showEndStationList, setShowEndStationList] = useState(false);

  // Load stations on mount
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

  const handleSave = async () => {
    // Validate
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

    // Find station objects
    const startStation = stations.find(s => s.stationName === startStationName);
    const endStation = stations.find(s => s.stationName === endStationName);

    if (!startStation || !endStation) {
      Alert.alert('오류', '선택한 역을 찾을 수 없습니다.');
      return;
    }

    // Convert to StationInfo
    const startStationInfo: StationInfo = {
      id: startStation.stationId,
      stationId: startStation.stationId,
      stationName: startStation.stationName,
      line: startStation.lines[0]?.lineId || '',
      lineCode: startStation.lines[0]?.lineCode || '',
      lat: startStation.location?.latitude || 0,
      lng: startStation.location?.longitude || 0,
    };

    const endStationInfo: StationInfo = {
      id: endStation.stationId,
      stationId: endStation.stationId,
      stationName: endStation.stationName,
      line: endStation.lines[0]?.lineId || '',
      lineCode: endStation.lines[0]?.lineCode || '',
      lat: endStation.location?.latitude || 0,
      lng: endStation.location?.longitude || 0,
    };

    // Save
    try {
      setSaving(true);
      const userId = await requireUserId();

      const result = await createRoute(
        userId,
        startStationInfo,
        endStationInfo,
        departureTime,
        selectedDays
      );

      Alert.alert(
        '성공',
        `동선이 등록되었습니다.\n${startStationName} → ${endStationName}`,
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('동선 저장 실패:', error);
      Alert.alert(
        '실패',
        error instanceof Error ? error.message : '동선 저장에 실패했습니다.'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const dayLabels = ['', '월', '화', '수', '목', '금', '토', '일'];

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

      <ScrollView style={styles.content}>
        {/* Start Station */}
        <View style={styles.field}>
          <Text style={styles.label}>출발역</Text>
          <Text
            style={styles.input}
            onPress={() => setShowStartStationList(true)}
          >
            {startStationName || '출발역 선택'}
          </Text>
        </View>

        {/* Start Station List */}
        {showStartStationList && (
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>출발역 선택</Text>
                <Text style={styles.modalClose} onPress={() => setShowStartStationList(false)}>
                  ✕
                </Text>
              </View>
              <ScrollView style={styles.stationList}>
                {stations.map((station) => (
                  <Text
                    key={station.stationId}
                    style={styles.stationItem}
                    onPress={() => {
                      setStartStationName(station.stationName);
                      setShowStartStationList(false);
                    }}
                  >
                    {station.stationName}
                  </Text>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* End Station */}
        <View style={styles.field}>
          <Text style={styles.label}>도착역</Text>
          <Text
            style={styles.input}
            onPress={() => setShowEndStationList(true)}
          >
            {endStationName || '도착역 선택'}
          </Text>
        </View>

        {/* End Station List */}
        {showEndStationList && (
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>도착역 선택</Text>
                <Text style={styles.modalClose} onPress={() => setShowEndStationList(false)}>
                  ✕
                </Text>
              </View>
              <ScrollView style={styles.stationList}>
                {stations.map((station) => (
                  <Text
                    key={station.stationId}
                    style={styles.stationItem}
                    onPress={() => {
                      setEndStationName(station.stationName);
                      setShowEndStationList(false);
                    }}
                  >
                    {station.stationName}
                  </Text>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Departure Time */}
        <View style={styles.field}>
          <Text style={styles.label}>출발 시간</Text>
          <TextInput
            style={styles.input}
            value={departureTime}
            onChangeText={setDepartureTime}
            placeholder="HH:MM (예: 08:00)"
          />
        </View>

        {/* Days Selector */}
        <View style={styles.field}>
          <Text style={styles.label}>운영 요일</Text>
          <View style={styles.daysContainer}>
            {dayLabels.slice(1).map((label, index) => {
              const day = index + 1;
              const isSelected = selectedDays.includes(day);
              return (
                <Text
                  key={day}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  {label}
                </Text>
              );
            })}
          </View>
        </View>

        {/* Save Button */}
        <View
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onStartShouldSetResponder={() => !saving && handleSave()}
        >
          <Text style={styles.saveButtonText}>
            {saving ? '저장 중...' : '동선 등록'}
          </Text>
        </View>
      </ScrollView>
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
    textAlign: 'center',
    lineHeight: 42,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  dayButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    color: Colors.white,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalClose: {
    fontSize: 24,
    color: Colors.gray600,
    padding: Spacing.sm,
  },
  stationList: {
    maxHeight: 400,
  },
  stationItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    fontSize: Typography.fontSize.base,
  },
});
