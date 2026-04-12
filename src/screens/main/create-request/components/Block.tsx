import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../../theme';

type Props = {
  title: string;
  children: React.ReactNode;
};

export function Block({ title, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 10,
    ...Shadows.sm,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
});
