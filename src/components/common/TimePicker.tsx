/**
 * TimePicker Component
 * 시간 선택기 컴포넌트 (슬라이더 방식 개선)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

interface TimePickerProps {
  value: string; // HH:mm format
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
}

// 시간 슬라이더 스텝 생성 (30분 단위)
const generateTimeSteps = (): Array<{ hour: number; minute: number; label: string }> => {
  const steps: Array<{ hour: number; minute: number; label: string }> = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      steps.push({ hour: h, minute: m, label });
    }
  }
  return steps;
};

const TIME_STEPS = generateTimeSteps();

// 빠른 선택 프리셋
const QUICK_PRESETS = {
  commute: { hour: 8, minute: 0, label: '출근' },    // 08:00
  leave: { hour: 18, minute: 0, label: '퇴근' },    // 18:00
};

export default function TimePicker({
  value,
  onChange,
  label = '시간 선택',
  placeholder = '시간을 선택해주세요',
  minuteInterval = 10,
}: TimePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // 현재 시간에서 인덱스 찾기
  const getCurrentIndex = (): number => {
    const [h, m] = value.split(':').map(Number);
    const stepMinute = m >= 30 ? 30 : 0;
    return TIME_STEPS.findIndex(s => s.hour === h && s.minute === stepMinute);
  };

  const [selectedIndex, setSelectedIndex] = useState(getCurrentIndex());

  const handleTimeSelect = (index: number) => {
    setSelectedIndex(index);
  };

  const handleQuickSelect = (preset: keyof typeof QUICK_PRESETS) => {
    const p = QUICK_PRESETS[preset];
    const timeString = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
    const newIndex = TIME_STEPS.findIndex(s => s.hour === p.hour && s.minute === p.minute);
    setSelectedIndex(newIndex);
    onChange(timeString);
  };

  const handleConfirm = () => {
    const selectedTime = TIME_STEPS[selectedIndex];
    const timeString = `${String(selectedTime.hour).padStart(2, '0')}:${String(selectedTime.minute).padStart(2, '0')}`;
    onChange(timeString);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setSelectedIndex(getCurrentIndex()); // 원래 값으로 복원
    setModalVisible(false);
  };

  const formatTime = (hour: number, minute: number): string => {
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${h}:${m}`;
  };

  const getAmPm = (hour: number): string => {
    return hour < 12 ? '오전' : '오후';
  };

  const getCurrentTime = () => {
    const selected = TIME_STEPS[selectedIndex];
    return {
      hour: selected.hour,
      minute: selected.minute,
      formatted: formatTime(selected.hour, selected.minute),
      ampm: getAmPm(selected.hour),
    };
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={styles.timeButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.timeText}>
          {value || placeholder}
        </Text>
        <Ionicons name="time-outline" size={20} color={Colors.primary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCancel}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={handleCancel}>
                <Ionicons name="close" size={28} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 현재 선택된 시간 표시 (큰 숫자) */}
            <View style={styles.selectedTimeDisplay}>
              <Text style={styles.ampmText}>{getCurrentTime().ampm}</Text>
              <Text style={styles.timeLarge}>{getCurrentTime().formatted}</Text>
            </View>

            {/* 빠른 선택 버튼 */}
            <View style={styles.quickSelectContainer}>
              <TouchableOpacity
                style={[styles.quickButton, styles.commuteButton]}
                onPress={() => handleQuickSelect('commute')}
              >
                <Ionicons name="sunny-outline" size={20} color={Colors.white} />
                <Text style={styles.quickButtonText}>{QUICK_PRESETS.commute.label}</Text>
                <Text style={styles.quickButtonTime}>{QUICK_PRESETS.commute.hour}:00</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickButton, styles.leaveButton]}
                onPress={() => handleQuickSelect('leave')}
              >
                <Ionicons name="moon-outline" size={20} color={Colors.white} />
                <Text style={styles.quickButtonText}>{QUICK_PRESETS.leave.label}</Text>
                <Text style={styles.quickButtonTime}>{QUICK_PRESETS.leave.hour}:00</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickButton, styles.customButton]}
                onPress={() => {}}
              >
                <Ionicons name="options-outline" size={20} color={Colors.primary} />
                <Text style={[styles.quickButtonText, styles.customButtonText]}>커스텀</Text>
              </TouchableOpacity>
            </View>

            {/* 시간 슬라이더 (가로 스크롤) */}
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>시간 선택</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sliderScrollContent}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const itemWidth = 70; // 각 아이템 너비
                  const index = Math.round(offsetX / itemWidth);
                  if (index >= 0 && index < TIME_STEPS.length) {
                    handleTimeSelect(index);
                  }
                }}
                scrollEventThrottle={16}
              >
                {TIME_STEPS.map((step, index) => {
                  const isSelected = index === selectedIndex;
                  const isHour = step.minute === 0;

                  return (
                    <TouchableOpacity
                      key={`${step.hour}-${step.minute}`}
                      style={[
                        styles.timeStep,
                        isSelected && styles.timeStepSelected,
                        isHour && styles.timeStepHour,
                      ]}
                      onPress={() => handleTimeSelect(index)}
                    >
                      <Text
                        style={[
                          styles.timeStepText,
                          isSelected && styles.timeStepTextSelected,
                          isHour && styles.timeStepTextHour,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 확인 버튼 */}
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  timeButton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  timeText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
  },
  // Modal styles
  modalContainer: {
    backgroundColor: Colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  // 큰 시간 표시
  selectedTimeDisplay: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  ampmText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.xs,
  },
  timeLarge: {
    color: Colors.primary,
    fontSize: 48,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 2,
  },
  // 빠른 선택 버튼
  quickSelectContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  quickButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    flex: 1,
    paddingVertical: Spacing.md,
  },
  commuteButton: {
    backgroundColor: Colors.primary,
  },
  leaveButton: {
    backgroundColor: Colors.secondary,
  },
  customButton: {
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray300,
    borderWidth: 1,
  },
  quickButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.xs,
  },
  customButtonText: {
    color: Colors.primary,
  },
  quickButtonTime: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
    opacity: 0.9,
  },
  // 슬라이더
  sliderContainer: {
    marginBottom: Spacing.lg,
  },
  sliderLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  sliderScrollContent: {
    paddingHorizontal: Spacing.md,
  },
  timeStep: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.sm,
    height: 50,
    justifyContent: 'center',
    marginRight: Spacing.sm,
    width: 70,
  },
  timeStepSelected: {
    backgroundColor: Colors.primary,
  },
  timeStepHour: {
    backgroundColor: Colors.gray200,
  },
  timeStepText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  timeStepTextSelected: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
  timeStepTextHour: {
    fontWeight: Typography.fontWeight.medium,
  },
  // 확인 버튼
  confirmButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
});
