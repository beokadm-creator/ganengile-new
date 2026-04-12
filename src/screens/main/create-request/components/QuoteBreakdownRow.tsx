import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../../../theme';

type Props = {
  label: string;
  value: number;
  strong?: boolean;
};

export function QuoteBreakdownRow({ label, value, strong }: Props) {
  if (value === 0 && !strong) return null;

  return (
    <View style={styles.quoteBreakdownRow}>
      <Text style={[styles.quoteBreakdownLabel, strong && styles.quoteBreakdownLabelStrong]}>{label}</Text>
      <Text style={[styles.quoteBreakdownValue, strong && styles.quoteBreakdownValueStrong]}>
        {value.toLocaleString()}원
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  quoteBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quoteBreakdownLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  quoteBreakdownLabelStrong: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  quoteBreakdownValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  quoteBreakdownValueStrong: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
  },
});
