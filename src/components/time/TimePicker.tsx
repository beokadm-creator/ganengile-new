/**
 * TimePicker Component
 * 시간 선택기 (출발/도착 시간)
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
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface TimePickerProps {
  value: string; // HH:MM 형식
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  minuteInterval?: number; // 분 단위 (기본값: 10분)
}

export default function TimePicker({
  value,
  onChange,
  label,
  placeholder = '시간 선택',
  minuteInterval = 10,
}: TimePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedHour, setSelectedHour] = useState(value ? parseInt(value.split(':')[0]) : 9);
  const [selectedMinute, setSelectedMinute] = useState(value ? parseInt(value.split(':')[1]) : 0);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 / minuteInterval }, (_, i) => i * minuteInterval);

  const handleConfirm = () => {
    const timeString = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    onChange(timeString);
    setModalVisible(false);
  };

  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? '오후' : '오전';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={styles.button}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>
          {value ? formatTime(selectedHour, selectedMinute) : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButton}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>시간 선택</Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={styles.confirmButton}>확인</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickersContainer}>
              {/* Hour Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>시</Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.pickerScroll}
                >
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.pickerItem,
                        selectedHour === hour && styles.pickerItemActive,
                      ]}
                      onPress={() => setSelectedHour(hour)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          selectedHour === hour && styles.pickerItemTextActive,
                        ]}
                      >
                        {String(hour).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Minute Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>분</Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.pickerScroll}
                >
                  {minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.pickerItem,
                        selectedMinute === minute && styles.pickerItemActive,
                      ]}
                      onPress={() => setSelectedMinute(minute)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          selectedMinute === minute && styles.pickerItemTextActive,
                        ]}
                      >
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Quick Select */}
            <View style={styles.quickSelect}>
              <TouchableOpacity
                style={styles.quickSelectButton}
                onPress={() => {
                  setSelectedHour(8);
                  setSelectedMinute(0);
                }}
              >
                <Text style={styles.quickSelectText}>출근 (8:00)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickSelectButton}
                onPress={() => {
                  setSelectedHour(18);
                  setSelectedMinute(0);
                }}
              >
                <Text style={styles.quickSelectText}>퇴근 (18:00)</Text>
              </TouchableOpacity>
            </View>
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
    ...Typography.bodyBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  button: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Shadows.sm,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  cancelButton: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  confirmButton: {
    ...Typography.bodyBold,
    color: Colors.primary,
  },
  pickersContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    ...Typography.bodyBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  pickerScroll: {
    paddingHorizontal: Spacing.sm,
  },
  pickerItem: {
    width: 60,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  pickerItemActive: {
    backgroundColor: Colors.primary,
  },
  pickerItemText: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  pickerItemTextActive: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  quickSelect: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  quickSelectButton: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  quickSelectText: {
    ...Typography.body,
    color: Colors.primary,
  },
});
