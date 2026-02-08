/**
 * TimePicker Component
 * 시간 선택기 컴포넌트
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
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

interface TimePickerProps {
  value: string; // HH:mm format
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
}

export default function TimePicker({
  value,
  onChange,
  label = '시간 선택',
  placeholder = '시간을 선택해주세요',
  minuteInterval = 10,
}: TimePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from(
    { length: 60 / minuteInterval },
    (_, i) => i * minuteInterval
  );

  const [selectedHour, setSelectedHour] = useState(
    parseInt(value.split(':')[0]) || 0
  );
  const [selectedMinute, setSelectedMinute] = useState(
    parseInt(value.split(':')[1]) || 0
  );

  const handleTimeSelect = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
  };

  const handleConfirm = () => {
    const timeString = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    onChange(timeString);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
        <Text style={styles.timeIcon}>🕐</Text>
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
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timePickerContainer}>
              {/* 시간 선택 */}
              <View style={styles.columnContainer}>
                <Text style={styles.columnLabel}>시</Text>
                <ScrollView style={styles.columnScroll}>
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.timeItem,
                        selectedHour === hour && styles.timeItemSelected,
                      ]}
                      onPress={() => handleTimeSelect(hour, selectedMinute)}
                    >
                      <Text
                        style={[
                          styles.timeItemText,
                          selectedHour === hour && styles.timeItemTextSelected,
                        ]}
                      >
                        {String(hour).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* 구분자 */}
              <Text style={styles.separator}>:</Text>

              {/* 분 선택 */}
              <View style={styles.columnContainer}>
                <Text style={styles.columnLabel}>분</Text>
                <ScrollView style={styles.columnScroll}>
                  {minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.timeItem,
                        selectedMinute === minute && styles.timeItemSelected,
                      ]}
                      onPress={() => handleTimeSelect(selectedHour, minute)}
                    >
                      <Text
                        style={[
                          styles.timeItemText,
                          selectedMinute === minute && styles.timeItemTextSelected,
                        ]}
                      >
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* 현재 선택된 시간 표시 */}
            <View style={styles.selectedTimeContainer}>
              <Text style={styles.selectedTimeLabel}>선택된 시간:</Text>
              <Text style={styles.selectedTimeValue}>
                {formatTime(selectedHour, selectedMinute)}
              </Text>
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
  columnContainer: {
    alignItems: 'center',
    flex: 1,
  },
  columnLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  columnScroll: {
    height: 200,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  modalClose: {
    color: Colors.textSecondary,
    fontSize: 24,
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
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: Colors.gray200,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  selectedTimeContainer: {
    alignItems: 'center',
    borderTopColor: Colors.gray200,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  selectedTimeLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    marginRight: Spacing.sm,
  },
  selectedTimeValue: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  separator: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    marginTop: 20,
  },
  timeButton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  timeIcon: {
    fontSize: 20,
  },
  timeItem: {
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    height: 40,
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    width: 60,
  },
  timeItemSelected: {
    backgroundColor: Colors.primary,
  },
  timeItemText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
  },
  timeItemTextSelected: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
  timePickerContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.lg,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  timeText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
  },
});
