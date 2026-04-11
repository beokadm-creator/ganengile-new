import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { BorderRadius, Colors, Spacing, Typography } from '../../theme';

export function MissionStatusBadge({ label }: { label: string }) {
  return (
    <View style={styles.statusBadge}>
      <MaterialIcons name="bolt" size={14} color={Colors.primaryDark} />
      <Text style={styles.statusBadgeText}>{label}</Text>
    </View>
  );
}

export function MissionSignalPill({
  icon,
  label,
  tone,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  tone: 'positive' | 'warning' | 'neutral';
}) {
  const toneStyle =
    tone === 'positive'
      ? styles.signalPillPositive
      : tone === 'warning'
        ? styles.signalPillWarning
        : styles.signalPillNeutral;

  const toneTextStyle =
    tone === 'positive'
      ? styles.signalPillTextPositive
      : tone === 'warning'
        ? styles.signalPillTextWarning
        : styles.signalPillTextNeutral;

  return (
    <View style={[styles.signalPill, toneStyle]}>
      <MaterialIcons
        name={icon}
        size={14}
        color={
          tone === 'positive'
            ? Colors.successDark
            : tone === 'warning'
              ? Colors.warningDark
              : Colors.textSecondary
        }
      />
      <Text style={[styles.signalPillText, toneTextStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: Colors.primaryDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  signalPillPositive: {
    backgroundColor: Colors.successLight,
  },
  signalPillWarning: {
    backgroundColor: Colors.warningLight,
  },
  signalPillNeutral: {
    backgroundColor: Colors.gray100,
  },
  signalPillText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  signalPillTextPositive: {
    color: Colors.successDark,
  },
  signalPillTextWarning: {
    color: Colors.warningDark,
  },
  signalPillTextNeutral: {
    color: Colors.textSecondary,
  },
});
