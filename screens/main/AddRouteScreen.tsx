/**
 * Add Route Screen
 * Register user's regular commuting route
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Colors } from '../../src/theme';
import { TimePicker } from '../../src/components';
import type { AddRouteScreenProps } from '../../src/types/navigation';
import { db, auth } from '../../src/services/firebase';

export default function AddRouteScreen({ navigation }: AddRouteScreenProps) {
  const [startStation, setStartStation] = useState('');
  const [endStation, setEndStation] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const daysOfWeek = [
    { id: 1, label: '월' },
    { id: 2, label: '화' },
    { id: 3, label: '수' },
    { id: 4, label: '목' },
    { id: 5, label: '금' },
    { id: 6, label: '토' },
    { id: 7, label: '일' },
  ];

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const validateForm = (): boolean => {
    if (!startStation.trim()) {
      Alert.alert('오류', '출발역을 입력해주세요.');
      return false;
    }

    if (!endStation.trim()) {
      Alert.alert('오류', '도착역을 입력해주세요.');
      return false;
    }

    if (startStation.trim() === endStation.trim()) {
      Alert.alert('오류', '출발역과 도착역이 같습니다.');
      return false;
    }

    if (!departureTime.trim()) {
      Alert.alert('오류', '출발 시간을 선택해주세요.');
      return false;
    }

    // 시간대 제한 (06:00 ~ 23:00)
    const [hours, minutes] = departureTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const minTime = 6 * 60; // 06:00
    const maxTime = 23 * 60; // 23:00

    if (totalMinutes < minTime || totalMinutes > maxTime) {
      Alert.alert('오류', '출발 시간은 06:00 ~ 23:00 사이여야 합니다.');
      return false;
    }

    if (selectedDays.length === 0) {
      Alert.alert('오류', '최소 하나 이상의 요일을 선택해주세요.');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('사용자 인증 정보가 없습니다.');
      }

      await addDoc(collection(db, 'routes'), {
        userId: user.uid,
        startStation: {
          name: startStation.trim(),
          line: '',
          code: '',
        },
        endStation: {
          name: endStation.trim(),
          line: '',
          code: '',
        },
        departureTime: departureTime.trim(),
        daysOfWeek: selectedDays.sort((a, b) => a - b),
        isActive: true,
        createdAt: serverTimestamp(),
      });

      Alert.alert('성공', '동선이 등록되었습니다.', [
        {
          text: '확인',
          onPress: () => navigation.navigate('Tabs', { screen: 'Home' }),
        },
      ]);
    } catch (error: any) {
      console.error('Route registration error:', error);
      Alert.alert('오류', '동선 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📍 내 동선 등록</Text>
        <Text style={styles.subtitle}>
          출퇴근 경로를 등록하고 배송 기회를 받으세요
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>출발역</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 서울역"
            value={startStation}
            onChangeText={setStartStation}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>도착역</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 강남역"
            value={endStation}
            onChangeText={setEndStation}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>출발 시간</Text>
          <TimePicker
            value={departureTime}
            onChange={setDepartureTime}
            label="출발 시간 선택"
            placeholder="시간을 선택해주세요"
            minuteInterval={10}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>반복 요일</Text>
          <View style={styles.daysContainer}>
            {daysOfWeek.map((day) => (
              <TouchableOpacity
                key={day.id}
                style={[
                  styles.dayButton,
                  selectedDays.includes(day.id) && styles.dayButtonSelected,
                ]}
                onPress={() => toggleDay(day.id)}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    selectedDays.includes(day.id) && styles.dayButtonTextSelected,
                  ]}
                >
                  {day.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>등록하기</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    marginTop: 10,
    padding: 16,
  },
  buttonDisabled: {
    backgroundColor: Colors.gray400,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  dayButton: {
    alignItems: 'center',
    backgroundColor: Colors.gray200,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginBottom: 8,
    marginRight: 8,
    width: 44,
  },
  dayButtonSelected: {
    backgroundColor: Colors.secondary,
  },
  dayButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  dayButtonTextSelected: {
    color: Colors.white,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  form: {
    padding: 20,
  },
  header: {
    backgroundColor: Colors.secondary,
    padding: 30,
    paddingTop: 60,
  },
  input: {
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray300,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
  },
  inputGroup: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 15,
    padding: 15,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});
