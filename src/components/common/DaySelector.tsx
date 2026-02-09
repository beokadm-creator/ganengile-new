/**
 * Day Selector Component
 * 요일 선택 컴포넌트
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

export const DAY_LABELS: Record<number, string> = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
  7: '일',
};

interface DaySelectorProps {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  label?: string;
  hint?: string;
}

export default function DaySelector({
  selectedDays,
  onChange,
  label = '운영 요일',
  hint,
}: DaySelectorProps) {
  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter((d) => d !== day));
    } else {
      onChange([...selectedDays, day]);
    }
  };

  const toggleWeekdays = () => {
    const weekdays = [1, 2, 3, 4, 5];
    const allSelected = weekdays.every((d) => selectedDays.includes(d));
    if (allSelected) {
      onChange(selectedDays.filter((d) => !weekdays.includes(d)));
    } else {
      const newDays = selectedDays.filter((d) => !weekdays.includes(d));
      onChange([...newDays, ...weekdays]);
    }
  };

  const toggleWeekend = () => {
    const weekend = [6, 7];
    const allSelected = weekend.every((d) => selectedDays.includes(d));
    if (allSelected) {
      onChange(selectedDays.filter((d) => !weekend.includes(d)));
    } else {
      const newDays = selectedDays.filter((d) => !weekend.includes(d));
      onChange([...newDays, ...weekend]);
    }
  };

  const allWeekdaysSelected = [1, 2, 3, 4, 5].every((d) => selectedDays.includes(d));
  const allWeekendSelected = [6, 7].every((d) => selectedDays.includes(d));

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* 빠른 선택 버튼 */}
      <View style={styles.quickSelectContainer}>
        <TouchableOpacity
          style={[styles.quickSelectButton, allWeekdaysSelected && styles.quickSelectButtonActive]}
          onPress={toggleWeekdays}
        >
          <Text
            style={[
              styles.quickSelectButtonText,
              allWeekdaysSelected && styles.quickSelectButtonTextActive,
            ]}
          >
            평일
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickSelectButton, allWeekendSelected && styles.quickSelectButtonActive]}
          onPress={toggleWeekend}
        >
          <Text
            style={[
              styles.quickSelectButtonText,
              allWeekendSelected && styles.quickSelectButtonTextActive,
            ]}
          >
            주말
          </Text>
        </TouchableOpacity>
      </View>

      {/* 요일 버튼 */}
      <View style={styles.daysContainer}>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayButton,
              selectedDays.includes(day) && styles.dayButtonSelected,
            ]}
            onPress={() => toggleDay(day)}
            activeOpacity={0.7}
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

      {hint && (
        <Text style={styles.hint}>
          {hint}: {selectedDays.map((d) => DAY_LABELS[d]).join(', ')}
        </Text>
      )}
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
  quickSelectContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  quickSelectButton: {
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  quickSelectButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickSelectButtonText: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  quickSelectButtonTextActive: {
    color: Colors.white,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
  hint: {
    color: Colors.gray500,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.sm,
  },
});
