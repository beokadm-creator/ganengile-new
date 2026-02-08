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
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
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

const DAY_LABELS: Record<number, string> = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
  7: '일',
};

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
  const [searchQuery, setSearchQuery] = useState('');

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
    setStartStationModalVisible(false);
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
    setEndStationModalVisible(false);
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = () => {
    if (!startStation || !endStation) {
      Alert.alert('오류', '출발역과 도착역을 모두 선택해주세요.');
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('오류', '최소 하나 이상의 요일을 선택해주세요.');
      return;
    }

    const validation = validateRoute(startStation, endStation, departureTime, selectedDays);
    if (!validation.isValid) {
      Alert.alert('유효성 오류', validation.errors.join('\n'));
      return;
    }

    if (validation.warnings.length > 0) {
      Alert.alert(
        '경고',
        validation.warnings.join('\n'),
        [
          { text: '취소', style: 'cancel' },
          { text: '계속', onPress: saveRoute },
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
        '성공',
        '동선이 등록되었습니다.',
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
      Alert.alert('오류', '동선 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const filteredStations = stations.filter(station =>
    station.stationName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <View style={styles.section}>
          <Text style={styles.label}>출발역</Text>
          <TouchableOpacity
            style={styles.stationButton}
            onPress={() => setStartStationModalVisible(true)}
          >
            <Text style={styles.stationButtonText}>
              {startStation ? startStation.stationName : '출발역 선택'}
            </Text>
            <Text style={styles.stationButtonArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>도착역</Text>
          <TouchableOpacity
            style={styles.stationButton}
            onPress={() => setEndStationModalVisible(true)}
          >
            <Text style={styles.stationButtonText}>
              {endStation ? endStation.stationName : '도착역 선택'}
            </Text>
            <Text style={styles.stationButtonArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TimePicker
            label="출발 시간"
            value={departureTime}
            onChange={setDepartureTime}
            placeholder="시간을 선택해주세요"
            minuteInterval={10}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>운영 요일</Text>
          <View style={styles.daysContainer}>
            {[1, 2, 3, 4, 5, 6, 7].map(day => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  selectedDays.includes(day) && styles.dayButtonSelected,
                ]}
                onPress={() => toggleDay(day)}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    selectedDays.includes(day) && styles.dayButtonTextSelected,
                  ]}
                >
                  {DAY_LABELS[day]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            선택된 요일: {selectedDays.map(d => DAY_LABELS[d]).join(', ')}
          </Text>
        </View>

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

      <Modal
        visible={startStationModalVisible}
        animationType="slide"
        onRequestClose={() => setStartStationModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>출발역 선택</Text>
            <TouchableOpacity onPress={() => setStartStationModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="역 이름 검색..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.modalContent}>
            {filteredStations.map(station => (
              <TouchableOpacity
                key={station.stationId}
                style={styles.stationItem}
                onPress={() => handleSelectStartStation(station)}
              >
                <View style={styles.stationItemLeft}>
                  <Text style={styles.stationItemName}>{station.stationName}</Text>
                  <Text style={styles.stationItemLine}>
                    {station.lines.map(l => l.lineName).join(', ')}
                  </Text>
                </View>
                <Text style={styles.stationItemArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={endStationModalVisible}
        animationType="slide"
        onRequestClose={() => setEndStationModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>도착역 선택</Text>
            <TouchableOpacity onPress={() => setEndStationModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="역 이름 검색..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.modalContent}>
            {filteredStations.map(station => (
              <TouchableOpacity
                key={station.stationId}
                style={styles.stationItem}
                onPress={() => handleSelectEndStation(station)}
              >
                <View style={styles.stationItemLeft}>
                  <Text style={styles.stationItemName}>{station.stationName}</Text>
                  <Text style={styles.stationItemLine}>
                    {station.lines.map(l => l.lineName).join(', ')}
                  </Text>
                </View>
                <Text style={styles.stationItemArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const TextInput = (props: any) => null;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  dayButton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  dayButtonSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  dayButtonText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  dayButtonTextSelected: {
    color: Colors.white,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  header: {
    backgroundColor: Colors.secondary,
    padding: Spacing.lg,
    paddingTop: 60,
  },
  hint: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.sm,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
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
  modalClose: {
    color: Colors.gray600,
    fontSize: 24,
  },
  modalContainer: {
    backgroundColor: Colors.white,
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingTop: 60,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  searchContainer: {
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    padding: Spacing.md,
  },
  searchInput: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.sm,
    fontSize: Typography.fontSize.base,
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
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
  stationButtonArrow: {
    color: Colors.gray400,
    fontSize: 24,
    fontWeight: '300',
  },
  stationButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
  },
  stationItem: {
    alignItems: 'center',
    borderBottomColor: Colors.gray100,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  stationItemArrow: {
    color: Colors.gray400,
    fontSize: 24,
    fontWeight: '300',
  },
  stationItemLeft: {
    flex: 1,
  },
  stationItemLine: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.sm,
  },
  stationItemName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    marginTop: Spacing.xs,
    opacity: 0.9,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
  },
});
