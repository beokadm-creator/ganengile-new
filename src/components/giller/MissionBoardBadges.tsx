import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { BorderRadius, Colors, Spacing, Typography } from '../../theme';

export function MissionStatusBadge({ label }: { label: string }) {
  return (
    <View style={styles.statusBadge}>
      <MaterialIcons name="bolt" size={14} color="#3182F6" />
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

  const iconColor =
    tone === 'positive'
      ? '#00B26F'
      : tone === 'warning'
        ? '#F04452'
        : '#8B95A1';

  return (
    <View style={[styles.signalPill, toneStyle]}>
      <MaterialIcons name={icon} size={14} color={iconColor} />
      <Text style={[styles.signalPillText, toneTextStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: '#E8F3FF', // 연한 블루
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#3182F6', // 쨍한 블루
    fontSize: 13,
    fontWeight: '700',
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  signalPillPositive: {
    backgroundColor: '#E5F7ED',
  },
  signalPillWarning: {
    backgroundColor: '#FDECEE',
  },
  signalPillNeutral: {
    backgroundColor: '#F2F4F6',
  },
  signalPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signalPillTextPositive: {
    color: '#00B26F',
  },
  signalPillTextWarning: {
    color: '#F04452',
  },
  signalPillTextNeutral: {
    color: '#4E5968',
  },
});
