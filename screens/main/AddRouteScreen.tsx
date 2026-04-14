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
import { requireUserId } from '../src/services/firebase';
import { getAllStations } from '../src/services/config-service';
import { createRoute, updateRoute, validateRouteForUpdate } from '../src/services/route-service';
import type { Station } from '../src/types/config';
import type { StationInfo } from '../src/types/route';
import { Colors, Spacing, BorderRadius } from '../src/theme';
import { Typography } from '../src/theme/typography';
import { useRoute } from '@react-navigation/native';

export default function AddRouteScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Check if editing mode
  const editingRoute = route.params as { route: any } | undefined;
  const isEditing = !!editingRoute?.route;

  // Initialize form data if editing
  useEffect(() => {
    if (isEditing && editingRoute?.route) {
      const route = editingRoute.route;
      setStartStationName(route.startStation.stationName);
      setEndStationName(route.endStation.stationName);
      setDepartureTime(route.departureTime);
      setSelectedDays(route.daysOfWeek);
    }
  }, [isEditing, editingRoute]);

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
  const [startSearchQuery, setStartSearchQuery] = useState('');
  const [endSearchQuery, setEndSearchQuery] = useState('');

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
    console.log('[AddRoute] 저장 버튼 클릭됨');
    console.log('[AddRoute] startStationName:', startStationName);
    console.log('[AddRoute] endStationName:', endStationName);
    console.log('[AddRoute] isEditing:', isEditing);

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

    console.log('[AddRoute] startStation found:', startStation);
    console.log('[AddRoute] endStation found:', endStation);

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

    console.log('[AddRoute] Saving route...');

    // Save or Update
    try {
      setSaving(true);
      const userId = await requireUserId();
      console.log('[AddRoute] userId:', userId);

      if (isEditing && editingRoute?.route?.id) {
        // Update existing route
        console.log('[AddRoute] Updating existing route:', editingRoute.route.id);

        // Validate for update
        const validation = await validateRouteForUpdate(
          userId,
          editingRoute.route.id,
          startStationInfo,
          endStationInfo,
          departureTime,
          selectedDays
        );

        if (!validation.isValid) {
          Alert.alert('유효성 검사 실패', validation.errors.join('\n'));
          return;
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
          const shouldContinue = await new Promise<boolean>((resolve) => {
            Alert.alert(
              '경고',
              validation.warnings.join('\n\n'),
              [
                { text: '취소', onPress: () => resolve(false), style: 'cancel' },
                { text: '계속 진행', onPress: () => resolve(true) },
              ]
            );
          });

          if (!shouldContinue) {
            setSaving(false);
            return;
          }
        }

        const result = await updateRoute(
          editingRoute.route.id,
          userId,
          {
            startStation: startStationInfo,
            endStation: endStationInfo,
            departureTime,
            daysOfWeek: selectedDays,
          }
        );

        console.log('[AddRoute] Update successful:', result);

        Alert.alert(
          '성공',
          `동선이 수정되었습니다.\n${startStationName} → ${endStationName}`,
          [
            {
              text: '확인',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        // Create new route
        console.log('[AddRoute] Creating new route');

        const result = await createRoute(
          userId,
          startStationInfo,
          endStationInfo,
          departureTime,
          selectedDays
        );

        console.log('[AddRoute] Save successful:', result);

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
      }
    } catch (error) {
      console.error('[AddRoute] Save failed:', error);
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

  // Filter stations by search query
  const filteredStartStations = stations.filter(station =>
    station.stationName.toLowerCase().includes(startSearchQuery.toLowerCase())
  );

  const filteredEndStations = stations.filter(station =>
    station.stationName.toLowerCase().includes(endSearchQuery.toLowerCase())
  );

  // Station select modal
  const StationSelectModal = ({
    visible,
    onClose,
    onSelect,
    title,
    searchQuery,
    setSearchQuery,
    filteredStations,
  }: {
    visible: boolean;
    onClose: () => void;
    onSelect: (station: Station) => void;
    title: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredStations: Station[];
  }) => {
    if (!visible) return null;

    return (
      <>
        {/* Overlay - 전체 화면 덮기 */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 999998,
          }}
          onClick={onClose}
        />
        {/* Modal Content */}
        <View
          style={{
            position: 'absolute',
            top: '15%',
            left: '5%',
            right: '5%',
            backgroundColor: Colors.white,
            borderRadius: BorderRadius.md,
            maxHeight: '70%',
            zIndex: 999999,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 999999,
          }}
        >
          {/* Modal Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: Spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: Colors.gray200,
            }}
          >
            <Text style={{
              fontSize: Typography.fontSize.lg,
              fontWeight: Typography.fontWeight.semibold,
              color: Colors.textPrimary,
            }}>
              {title}
            </Text>
            <Text
              style={{
                fontSize: 24,
                color: Colors.gray600,
                padding: Spacing.sm,
                width: 32,
                height: 32,
                textAlign: 'center',
                lineHeight: 24,
              }}
              onClick={onClose}
            >
              ✕
            </Text>
          </View>

          {/* Search Input */}
          <View style={{ padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray200 }}>
            <TextInput
              style={{
                backgroundColor: Colors.gray50,
                borderRadius: BorderRadius.sm,
                padding: Spacing.md,
                fontSize: Typography.fontSize.base,
                color: Colors.textPrimary,
                borderWidth: 1,
                borderColor: Colors.gray200,
              }}
              placeholder="역 이름 검색..."
              placeholderTextColor={Colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {/* Station List */}
          <ScrollView style={{ flex: 1, maxHeight: 400 }}>
            {filteredStations.length === 0 ? (
              <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                <Text style={{ fontSize: Typography.fontSize.sm, color: Colors.gray500 }}>
                  '{searchQuery}'에 대한 검색 결과가 없습니다.
                </Text>
              </View>
            ) : (
              filteredStations.map((station) => (
                <View
                  key={station.stationId}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: Spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.gray100,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onSelect(station);
                    setSearchQuery('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: Typography.fontSize.base,
                      fontWeight: Typography.fontWeight.medium,
                      color: Colors.textPrimary,
                      marginBottom: 4,
                    }}>
                      {station.stationName}
                    </Text>
                    <Text style={{
                      fontSize: Typography.fontSize.sm,
                      color: Colors.gray500,
                    }}>
                      {station.lines.map(l => l.lineName).join(', ')}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 24,
                    color: Colors.gray400,
                    fontWeight: '300',
                    marginLeft: Spacing.sm,
                  }}>
                    ›
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          {/* Result Count */}
          {filteredStations.length > 0 && (
            <View
              style={{
                backgroundColor: Colors.gray50,
                padding: Spacing.sm,
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: Colors.gray200,
              }}
            >
              <Text style={{ fontSize: Typography.fontSize.xs, color: Colors.gray500 }}>
                {filteredStations.length}개의 역
              </Text>
            </View>
          )}
        </View>
      </>
    );
  };

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
        <Text style={styles.headerTitle}>{isEditing ? '동선 수정' : '동선 등록'}</Text>
        <Text style={styles.headerSubtitle}>{isEditing ? '출퇴근 경로를 수정하세요' : '출퇴근 경로를 등록하세요'}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Start Station */}
        <View style={styles.field}>
          <Text style={styles.label}>출발역</Text>
          <Text
            style={styles.input}
            onClick={() => setShowStartStationList(true)}
          >
            {startStationName || '출발역 선택'}
          </Text>
        </View>

        {/* End Station */}
        <View style={styles.field}>
          <Text style={styles.label}>도착역</Text>
          <Text
            style={styles.input}
            onClick={() => setShowEndStationList(true)}
          >
            {endStationName || '도착역 선택'}
          </Text>
        </View>

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
                  onClick={() => toggleDay(day)}
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
          onClick={() => {
            console.log('[AddRoute] Save button clicked');
            if (!saving) {
              handleSave();
            }
          }}
        >
          <Text style={styles.saveButtonText}>
            {saving ? '저장 중...' : (isEditing ? '동선 수정' : '동선 등록')}
          </Text>
        </View>
      </ScrollView>

      {/* Modals */}
      <StationSelectModal
        visible={showStartStationList}
        onClose={() => {
          setShowStartStationList(false);
          setStartSearchQuery('');
        }}
        onSelect={(station) => {
          setStartStationName(station.stationName);
          setShowStartStationList(false);
        }}
        title="출발역 선택"
        searchQuery={startSearchQuery}
        setSearchQuery={setStartSearchQuery}
        filteredStations={filteredStartStations}
      />

      <StationSelectModal
        visible={showEndStationList}
        onClose={() => {
          setShowEndStationList(false);
          setEndSearchQuery('');
        }}
        onSelect={(station) => {
          setEndStationName(station.stationName);
          setShowEndStationList(false);
        }}
        title="도착역 선택"
        searchQuery={endSearchQuery}
        setSearchQuery={setEndSearchQuery}
        filteredStations={filteredEndStations}
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
});
