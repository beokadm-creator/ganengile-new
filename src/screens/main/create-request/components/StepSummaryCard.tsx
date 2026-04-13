import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Keyboard } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../../../theme';

interface StepSummaryCardProps {
  step: number;
  title: string;
  summary: string[];
  onEdit: () => void;
}

export function StepSummaryCard({ step, title, summary, onEdit }: StepSummaryCardProps) {
  const handleEdit = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onEdit();
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handleEdit} activeOpacity={0.7}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{step}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <MaterialCommunityIcons name="pencil-outline" size={20} color={Colors.textSecondary} />
      </View>
      <View style={styles.content}>
        {summary.map((text, index) => (
          <Text key={index} style={styles.summaryText}>
            {text}
          </Text>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  title: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    paddingLeft: 32, // Indent to align with title text
    gap: 4,
  },
  summaryText: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
});