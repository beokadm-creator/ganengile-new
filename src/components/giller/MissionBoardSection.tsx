import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing } from '../../theme';
import { Typography } from '../../theme/typography';

type MissionBoardSectionProps<Item> = {
  title: string;
  subtitle: string;
  items: Item[];
  emptyTitle: string;
  emptySubtitle: string;
  renderItem: (item: Item) => React.ReactNode;
  getKey: (item: Item) => string;
};

export function MissionBoardSection<Item>({
  title,
  subtitle,
  items,
  emptyTitle,
  emptySubtitle,
  renderItem,
  getKey,
}: MissionBoardSectionProps<Item>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      {items.length ? (
        items.map((item) => <React.Fragment key={getKey(item)}>{renderItem(item)}</React.Fragment>)
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
});
