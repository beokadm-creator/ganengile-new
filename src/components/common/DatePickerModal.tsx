import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';

interface DatePickerModalProps {
  visible: boolean;
  value: string;
  title?: string;
  onClose: () => void;
  onSelect: (date: string) => void;
}

type CalendarCell = {
  key: string;
  value: string;
  label: string;
  inMonth: boolean;
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createMonthCalendar(baseDate: Date): CalendarCell[] {
  const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const firstWeekday = firstDay.getDay();
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + index);
    return {
      key: `${baseDate.getFullYear()}-${baseDate.getMonth()}-${index}`,
      value: toDateKey(current),
      label: String(current.getDate()),
      inMonth: current.getMonth() === baseDate.getMonth(),
    };
  });
}

function buildMonthOptions() {
  const today = new Date();
  return Array.from({ length: 3 }, (_, index) => new Date(today.getFullYear(), today.getMonth() + index, 1));
}

export default function DatePickerModal({
  visible,
  value,
  title = '날짜 선택',
  onClose,
  onSelect,
}: DatePickerModalProps) {
  const months = useMemo(() => buildMonthOptions(), []);
  const [selectedDate, setSelectedDate] = useState(value);

  const selectedLabel = selectedDate || '선택 안 됨';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{selectedLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {months.map((month) => {
              const cells = createMonthCalendar(month);
              const monthTitle = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
              return (
                <View key={monthTitle} style={styles.monthBlock}>
                  <Text style={styles.monthTitle}>{monthTitle}</Text>
                  <View style={styles.weekdayRow}>
                    {WEEKDAY_LABELS.map((weekday) => (
                      <Text key={weekday} style={styles.weekdayText}>
                        {weekday}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.grid}>
                    {cells.map((cell) => {
                      const isSelected = selectedDate === cell.value;
                      return (
                        <TouchableOpacity
                          key={cell.key}
                          style={[
                            styles.dayCell,
                            !cell.inMonth && styles.dayCellMuted,
                            isSelected && styles.dayCellSelected,
                          ]}
                          onPress={() => setSelectedDate(cell.value)}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              !cell.inMonth && styles.dayTextMuted,
                              isSelected && styles.dayTextSelected,
                            ]}
                          >
                            {cell.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmButton, !selectedDate && styles.confirmButtonDisabled]}
            disabled={!selectedDate}
            onPress={() => {
              onSelect(selectedDate);
              onClose();
            }}
          >
            <Text style={styles.confirmButtonText}>선택 완료</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  sheet: {
    maxHeight: '86%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  subtitle: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  scrollContent: {
    gap: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  monthBlock: {
    gap: Spacing.sm,
  },
  monthTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  dayCellMuted: {
    opacity: 0.32,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  dayTextMuted: {
    color: Colors.textSecondary,
  },
  dayTextSelected: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
  },
  confirmButton: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
});
