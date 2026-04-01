import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

interface DaySelectorProps {
  value?: number[];
  selectedDays?: number[];
  onChange: (days: number[]) => void;
  label?: string;
  multiSelect?: boolean;
}

const DAYS = [
  { id: 1, label: '월' },
  { id: 2, label: '화' },
  { id: 3, label: '수' },
  { id: 4, label: '목' },
  { id: 5, label: '금' },
  { id: 6, label: '토' },
  { id: 7, label: '일' },
];

export const DAY_LABELS: Record<number, string> = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
  7: '일',
};

function sortDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

export default function DaySelector({
  value,
  selectedDays: selectedDaysProp,
  onChange,
  label,
  multiSelect = true,
}: DaySelectorProps) {
  const selectedDays = useMemo(() => sortDays(selectedDaysProp ?? value ?? []), [selectedDaysProp, value]);

  const summaryLabel = useMemo(() => {
    if (selectedDays.length === 0) return '선택한 요일 없음';
    if (selectedDays.length === 7) return '매일';
    if (selectedDays.length === 5 && selectedDays.every((day) => day <= 5)) return '평일';
    if (selectedDays.length === 2 && selectedDays.every((day) => day >= 6)) return '주말';
    return selectedDays.map((day) => DAY_LABELS[day]).join(', ');
  }, [selectedDays]);

  const updateDays = (days: number[]) => {
    const nextDays = sortDays(days);
    onChange(nextDays);
  };

  const toggleDay = (dayId: number) => {
    if (!multiSelect) {
      updateDays([dayId]);
      return;
    }

    if (selectedDays.includes(dayId)) {
      updateDays(selectedDays.filter((day) => day !== dayId));
      return;
    }

    updateDays([...selectedDays, dayId]);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.daysContainer}>
        {DAYS.map((day) => {
          const isSelected = selectedDays.includes(day.id);
          const isWeekend = day.id >= 6;

          return (
            <TouchableOpacity
              key={day.id}
              activeOpacity={0.85}
              style={[
                styles.dayButton,
                isWeekend && styles.weekendDayButton,
                isSelected && styles.dayButtonActive,
              ]}
              onPress={() => toggleDay(day.id)}
            >
              <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {multiSelect ? (
        <View style={styles.quickSelectContainer}>
          <TouchableOpacity style={styles.quickSelectButton} onPress={() => updateDays([1, 2, 3, 4, 5])}>
            <Text style={styles.quickSelectText}>평일</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickSelectButton} onPress={() => updateDays([6, 7])}>
            <Text style={styles.quickSelectText}>주말</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickSelectButton} onPress={() => updateDays([1, 2, 3, 4, 5, 6, 7])}>
            <Text style={styles.quickSelectText}>매일</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickSelectButton, styles.clearButton]} onPress={() => updateDays([])}>
            <Text style={[styles.quickSelectText, styles.clearText]}>초기화</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>{summaryLabel}</Text>
      </View>
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
    marginBottom: Spacing.sm,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  dayButton: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  weekendDayButton: {
    backgroundColor: Colors.gray50,
  },
  dayButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayText: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
  },
  dayTextActive: {
    color: Colors.white,
  },
  quickSelectContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  quickSelectButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
  },
  quickSelectText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  clearButton: {
    backgroundColor: Colors.gray200,
  },
  clearText: {
    color: Colors.text.tertiary,
  },
  summaryContainer: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  summaryText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
