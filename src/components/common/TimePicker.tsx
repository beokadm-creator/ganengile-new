import React, { useMemo, useState } from 'react';
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
  value: string;
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
}

const QUICK_PRESETS = ['08:00', '09:00', '12:00', '18:00', '21:00'];

function generateTimeSteps(interval: number): string[] {
  const steps: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += interval) {
      steps.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return steps;
}

function getAmPmLabel(time: string): string {
  const [hourText] = time.split(':');
  const hour = Number(hourText);
  return hour < 12 ? '오전' : '오후';
}

export default function TimePicker({
  value,
  onChange,
  label = '출발 시간',
  placeholder = '시간을 선택해 주세요',
  minuteInterval = 10,
}: TimePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const timeSteps = useMemo(() => generateTimeSteps(minuteInterval), [minuteInterval]);
  const initialIndex = Math.max(timeSteps.indexOf(value), 0);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const selectedTime = timeSteps[selectedIndex] ?? timeSteps[0] ?? '08:00';

  const handleOpen = () => {
    setSelectedIndex(Math.max(timeSteps.indexOf(value), 0));
    setModalVisible(true);
  };

  const handleConfirm = () => {
    onChange(selectedTime);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity style={styles.timeButton} onPress={handleOpen}>
        <Text style={styles.timeText}>{value || placeholder}</Text>
        <Ionicons name="time-outline" size={20} color={Colors.primary} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.selectedTimeDisplay}>
              <Text style={styles.ampmText}>{getAmPmLabel(selectedTime)}</Text>
              <Text style={styles.timeLarge}>{selectedTime}</Text>
            </View>

            <View style={styles.quickSelectContainer}>
              {QUICK_PRESETS.map((preset) => {
                const isSelected = preset === selectedTime;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.quickButton, isSelected && styles.quickButtonSelected]}
                    onPress={() => setSelectedIndex(Math.max(timeSteps.indexOf(preset), 0))}
                  >
                    <Text style={[styles.quickButtonText, isSelected && styles.quickButtonTextSelected]}>
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>시간 선택</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sliderScrollContent}>
                {timeSteps.map((step, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <TouchableOpacity
                      key={step}
                      style={[styles.timeStep, isSelected && styles.timeStepSelected]}
                      onPress={() => setSelectedIndex(index)}
                    >
                      <Text style={[styles.timeStepText, isSelected && styles.timeStepTextSelected]}>
                        {step}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>선택 완료</Text>
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
  modalContainer: {
    backgroundColor: Colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '80%',
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
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
  quickSelectContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickButton: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.md,
    flex: 1,
    paddingVertical: Spacing.md,
  },
  quickButtonSelected: {
    backgroundColor: Colors.primary,
  },
  quickButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  quickButtonTextSelected: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
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
    width: 76,
  },
  timeStepSelected: {
    backgroundColor: Colors.primary,
  },
  timeStepText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  timeStepTextSelected: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
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
