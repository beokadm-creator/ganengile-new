/**
 * Onetime Mode Screen
 * 일회성 모드 활성화 화면 (P0-3)
 *
 * 기능:
 * - 현재 위치 기반 활성화
 * - 이용 가능 시간대 선택
 * - 환승 허용 설정 (토글)
 * - 최대 우회 시간 설정 (5~15분)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import GeoLocation from 'react-native-geolocation-service';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { requireUserId } from '../../services/firebase';
import { getAllStations } from '../../services/config-service';
import { LocationService } from '../../services/location-service';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface OnetimeModeSettings {
  enabled: boolean;
  availableFrom: string; // HH:mm
  availableUntil: string; // HH:mm
  allowTransfer: boolean;
  maxDetourTime: number; // 5, 10, 15 (분)
  preferredLines: string[]; // ['2호선', '신분당선', ...]
}

export default function OnetimeModeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    stationName?: string;
  } | null>(null);

  // 시간 선택 Modal 상태 추가
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'from' | 'until'>('from');

  const [settings, setSettings] = useState<OnetimeModeSettings>({
    enabled: false,
    availableFrom: '08:00',
    availableUntil: '20:00',
    allowTransfer: true,
    maxDetourTime: 10,
    preferredLines: [],
  });

  // LocationService 인스턴스 생성
  const locationService = new LocationService();

  // 현재 위치 가져오기
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);

      // 위치 권한 확인 및 요청
      const hasPermission = await GeoLocation.checkAuthorization();

      if (hasPermission === 'denied') {
        const granted = await GeoLocation.requestAuthorization('whenInUse');
        if (!granted) {
          Alert.alert(
            '위치 권한 필요',
            '일회성 모드를 사용하려면 위치 권한이 필요합니다.',
            [
              { text: '취소', onPress: () => navigation.goBack() },
              { text: '설정', onPress: () => GeoLocation.openSettings() },
            ]
          );
          return;
        }
      }

      // 현재 위치 가져오기
      const position = await GeoLocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      });

      // 역 이름 가져오기 (ConfigService 활용)
      const allStations = await getAllStations();
      const nearestStation = await locationService.findNearestStation(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          altitude: position.coords.altitude || null,
          speed: position.coords.speed || null,
          heading: position.coords.heading || null,
        },
        allStations.map((station) => ({
          name: station.stationName,
          line: station.lines[0]?.lineId || '',
          latitude: station.location.latitude,
          longitude: station.location.longitude,
        }))
      );

      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        stationName: nearestStation?.name || '알 수 없는 역',
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('오류', '위치를 가져올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const userId = requireUserId();
      const db = getFirestore();
      const userRef = doc(db, 'users', userId);

      // 일회성 모드 설정 저장
      await updateDoc(userRef, {
        'onetimeMode.enabled': settings.enabled,
        'onetimeMode.availableFrom': settings.availableFrom,
        'onetimeMode.availableUntil': settings.availableUntil,
        'onetimeMode.allowTransfer': settings.allowTransfer,
        'onetimeMode.maxDetourTime': settings.maxDetourTime,
        'onetimeMode.preferredLines': settings.preferredLines,
        'onetimeMode.location': currentLocation,
        'onetimeMode.updatedAt': new Date(),
      });

      Alert.alert(
        '저장 완료',
        '일회성 모드 설정이 저장되었습니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving onetime mode settings:', error);
      Alert.alert('오류', '설정을 저장할 수 없습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = (field: 'availableFrom' | 'availableUntil', time: string) => {
    setSettings({ ...settings, [field]: time });
  };

  // 시간 선택 Modal 핸들러
  const handleTimePickerPress = (type: 'from' | 'until') => {
    setTimePickerType(type);
    setShowTimePicker(true);
  };

  const handleTimeSelect = (time: string) => {
    if (timePickerType === 'from') {
      handleTimeChange('availableFrom', time);
    } else {
      handleTimeChange('availableUntil', time);
    }
    setShowTimePicker(false);
  };

  const handleLineToggle = (lineName: string) => {
    const newLines = settings.preferredLines.includes(lineName)
      ? settings.preferredLines.filter((l) => l !== lineName)
      : [...settings.preferredLines, lineName];

    setSettings({ ...settings, preferredLines: newLines });
  };

  const metroLines = [
    '1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선',
    '신분당선', '경의중앙선', '수인분당선', '공항철도', '경춘선',
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>현재 위치를 가져오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>일회성 모드</Text>
        <Text style={styles.headerSubtitle}>
          원할 때만 배송을 수락하세요
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 현재 위치 정보 */}
        {currentLocation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>현재 위치</Text>
            <View style={styles.locationCard}>
              <Text style={styles.locationText}>
                {currentLocation.stationName || '위치 확인 중...'}
              </Text>
              <Text style={styles.locationSubtext}>
                {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
              </Text>
            </View>
          </View>
        )}

        {/* 활성화 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>활성화</Text>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>일회성 모드 사용</Text>
            <Switch
              value={settings.enabled}
              onValueChange={(value) => setSettings({ ...settings, enabled: value })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
          <Text style={styles.sectionDescription}>
            활성화하면 설정한 시간대에 일회성 배송 요청을 받을 수 있습니다.
          </Text>
        </View>

        {/* 이용 가능 시간대 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이용 가능 시간대</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>시작 시간</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => handleTimePickerPress('from')}
              >
                <Text style={styles.timeButtonText}>{settings.availableFrom}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.timeSeparator}>~</Text>

            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>종료 시간</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => handleTimePickerPress('until')}
              >
                <Text style={styles.timeButtonText}>{settings.availableUntil}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 환승 허용 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>환승 허용</Text>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>환승 경로 허용</Text>
            <Switch
              value={settings.allowTransfer}
              onValueChange={(value) => setSettings({ ...settings, allowTransfer: value })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
          <Text style={styles.sectionDescription}>
            환승 시 배송 보너스(1회당 1,000원)가 추가됩니다.
          </Text>
        </View>

        {/* 최대 우회 시간 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최대 우회 시간</Text>
          <View style={styles.detourOptions}>
            {[5, 10, 15].map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.detourOption,
                  settings.maxDetourTime === time && styles.detourOptionActive,
                ]}
                onPress={() => setSettings({ ...settings, maxDetourTime: time })}
              >
                <Text
                  style={[
                    styles.detourOptionText,
                    settings.maxDetourTime === time && styles.detourOptionTextActive,
                  ]}
                >
                  {time}분
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionDescription}>
            환승 시 추가로 이동할 수 있는 최대 시간입니다.
          </Text>
        </View>

        {/* 선호 노선 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>선호 노선 (선택사항)</Text>
          <Text style={styles.sectionDescription}>
            배송하고 싶은 노선을 선택하세요. 미선택 시 전체 노선 대상입니다.
          </Text>
          <View style={styles.linesGrid}>
            {metroLines.map((line) => (
              <TouchableOpacity
                key={line}
                style={[
                  styles.lineChip,
                  settings.preferredLines.includes(line) && styles.lineChipActive,
                ]}
                onPress={() => handleLineToggle(line)}
              >
                <Text
                  style={[
                    styles.lineChipText,
                    settings.preferredLines.includes(line) && styles.lineChipTextActive,
                  ]}
                >
                  {line}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 저장 버튼 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, !settings.enabled && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!settings.enabled || saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? '저장 중...' : '저장'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 시간 선택 Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {timePickerType === 'from' ? '시작 시간 선택' : '종료 시간 선택'}
              </Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
                '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
                '20:00', '21:00', '22:00', '23:00'].map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    (timePickerType === 'from' && settings.availableFrom === time) ||
                    (timePickerType === 'until' && settings.availableUntil === time)
                      ? styles.timeOptionActive
                      : null,
                  ]}
                  onPress={() => handleTimeSelect(time)}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      (timePickerType === 'from' && settings.availableFrom === time) ||
                      (timePickerType === 'until' && settings.availableUntil === time)
                        ? styles.timeOptionTextActive
                        : null,
                    ]}
                  >
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  sectionDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  locationCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  locationText: {
    ...Typography.body1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  locationSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  switchLabel: {
    ...Typography.body1,
    color: Colors.text,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  timeButton: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeButtonText: {
    ...Typography.body1,
    color: Colors.text,
    textAlign: 'center',
  },
  timeSeparator: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.md,
  },
  detourOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
  },
  detourOption: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  detourOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  detourOptionText: {
    ...Typography.body1,
    color: Colors.text,
  },
  detourOptionTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  linesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
  },
  lineChip: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lineChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  lineChipText: {
    ...Typography.body2,
    color: Colors.text,
  },
  lineChipTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  buttonContainer: {
    padding: Spacing.md,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.border,
  },
  saveButtonText: {
    ...Typography.body1,
    color: Colors.white,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  // 시간 선택 Modal 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '600',
  },
  modalCloseButton: {
    fontSize: 24,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  modalContent: {
    padding: Spacing.md,
  },
  timeOption: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeOptionText: {
    ...Typography.body1,
    color: Colors.text,
    textAlign: 'center',
  },
  timeOptionTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
});
