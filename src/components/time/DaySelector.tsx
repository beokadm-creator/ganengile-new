/**
 * DaySelector Component
 * 요일 선택기 (월~일)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface DaySelectorProps {
  value?: number[]; // 1-7 (Mon-Sun)
  selectedDays?: number[]; // Alias for value (for backward compatibility)
  onChange: (days: number[]) => void;
  label?: string;
  multiSelect?: boolean; // 다중 선택 가능 여부
  hint?: string; // Hint text (not displayed in current implementation)
}

const DAYS = [
  { id: 1, label: '월', shortLabel: 'M' },
  { id: 2, label: '화', shortLabel: 'T' },
  { id: 3, label: '수', shortLabel: 'W' },
  { id: 4, label: '목', shortLabel: 'T' },
  { id: 5, label: '금', shortLabel: 'F' },
  { id: 6, label: '토', shortLabel: 'S' },
  { id: 7, label: '일', shortLabel: 'S' },
];

// Export DAY_LABELS for use in other components
export const DAY_LABELS: Record<number, string> = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
  7: '일',
};

export default function DaySelector({
  value,
  selectedDays: selectedDaysProp,
  onChange,
  label,
  multiSelect = true,
  hint,
}: DaySelectorProps) {
  // Use selectedDays prop if provided, otherwise use value
  const initialValue = selectedDaysProp !== undefined ? selectedDaysProp : (value || []);
  const [selectedDays, setSelectedDays] = useState<number[]>(initialValue);

  const toggleDay = (dayId: number) => {
    let newSelectedDays: number[];

    if (multiSelect) {
      // 다중 선택 모드
      if (selectedDays.includes(dayId)) {
        newSelectedDays = selectedDays.filter((d) => d !== dayId);
      } else {
        newSelectedDays = [...selectedDays, dayId].sort();
      }
    } else {
      // 단일 선택 모드
      newSelectedDays = [dayId];
    }

    setSelectedDays(newSelectedDays);
    onChange(newSelectedDays);
  };

  const selectWeekdays = () => {
    const weekdays = [1, 2, 3, 4, 5];
    setSelectedDays(weekdays);
    onChange(weekdays);
  };

  const selectWeekend = () => {
    const weekend = [6, 7];
    setSelectedDays(weekend);
    onChange(weekend);
  };

  const selectAll = () => {
    const allDays = [1, 2, 3, 4, 5, 6, 7];
    setSelectedDays(allDays);
    onChange(allDays);
  };

  const clearAll = () => {
    setSelectedDays([]);
    onChange([]);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Day Buttons */}
      <View style={styles.daysContainer}>
        {DAYS.map((day) => {
          const isSelected = selectedDays.includes(day.id);
          return (
            <TouchableOpacity
              key={day.id}
              style={[
                styles.dayButton,
                isSelected && styles.dayButtonActive,
                day.id >= 6 && styles.weekendDay,
              ]}
              onPress={() => toggleDay(day.id)}
            >
              <Text
                style={[
                  styles.dayText,
                  isSelected && styles.dayTextActive,
                ]}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Quick Select Buttons */}
      <View style={styles.quickSelectContainer}>
        <TouchableOpacity
          style={styles.quickSelectButton}
          onPress={selectWeekdays}
        >
          <Text style={styles.quickSelectText}>평일</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickSelectButton}
          onPress={selectWeekend}
        >
          <Text style={styles.quickSelectText}>주말</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickSelectButton}
          onPress={selectAll}
        >
          <Text style={styles.quickSelectText}>매일</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickSelectButton, styles.clearButton]}
          onPress={clearAll}
        >
          <Text style={[styles.quickSelectText, styles.clearText]}>초기화</Text>
        </TouchableOpacity>
      </View>

      {/* Selected Summary */}
      {selectedDays.length > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {selectedDays.length === 7
              ? '매일'
              : selectedDays.length === 5 &&
                selectedDays.every((d) => d <= 5)
              ? '평일'
              : selectedDays.length === 2 &&
                selectedDays.every((d) => d >= 6)
              ? '주말'
              : `매주 ${selectedDays
                  .map((d) => DAYS.find((day) => day.id === d)?.label)
                  .join(', ')}요일`}
          </Text>
        </View>
      )}
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
    marginBottom: Spacing.md,
  },
  dayButton: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  dayButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  weekendDay: {
    // 주말 스타일 (선택적)
  },
  dayText: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
    fontSize: 16,
  },
  dayTextActive: {
    color: Colors.white,
  },
  quickSelectContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  quickSelectButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    marginHorizontal: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
  },
  quickSelectText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  clearButton: {
    backgroundColor: Colors.background.secondary,
  },
  clearText: {
    color: Colors.text.tertiary,
  },
  summaryContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  summaryText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
