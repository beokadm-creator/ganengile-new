import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { BorderRadius, Colors, Spacing } from '../../../../theme';
import { Typography } from '../../../../theme/typography';
import type { SavedAddress } from '../../../../types/profile';

type Props = {
  title: string;
  addresses: SavedAddress[];
  onSelect: (address: SavedAddress) => void;
};

export function AddressQuickPick({ title, addresses, onSelect }: Props) {
  if (addresses.length === 0) return null;

  return (
    <View style={styles.quickPickWrap}>
      <Text style={styles.quickPickTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPickRow}>
        {addresses.slice(0, 5).map((address) => (
          <TouchableOpacity key={`${title}-${address.addressId}`} style={styles.quickPickChip} onPress={() => onSelect(address)}>
            <Text style={styles.quickPickLabel}>{address.label}</Text>
            <Text numberOfLines={1} style={styles.quickPickText}>{address.fullAddress}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  quickPickWrap: { gap: Spacing.sm },
  quickPickTitle: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold },
  quickPickRow: { gap: Spacing.sm },
  quickPickChip: {
    width: 180,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  quickPickLabel: { color: Colors.textPrimary, fontWeight: Typography.fontWeight.extrabold, fontSize: Typography.fontSize.sm },
  quickPickText: { color: Colors.textSecondary, ...Typography.caption },
});
