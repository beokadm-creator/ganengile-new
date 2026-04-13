import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../../../theme';

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={sharedStyles.metricCard}>
      <Text style={sharedStyles.metricLabel}>{label}</Text>
      <Text style={sharedStyles.metricValue}>{value}</Text>
    </View>
  );
}

export function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={sharedStyles.actionCard} onPress={onPress} activeOpacity={0.88}>
      <View style={sharedStyles.actionIconWrap}>
        <MaterialIcons name={icon} size={22} color={Colors.primaryDark} />
      </View>
      <Text style={sharedStyles.actionTitle}>{title}</Text>
      <Text style={sharedStyles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

export function ModeBadge({ label }: { label: string }) {
  return (
    <View style={sharedStyles.modeBadge}>
      <Text style={sharedStyles.modeBadgeText}>{label}</Text>
    </View>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: 'request' | 'mission' }) {
  return (
    <View style={[sharedStyles.statusPill, tone === 'request' ? sharedStyles.requestPill : sharedStyles.missionPill]}>
      <Text
        style={[
          sharedStyles.statusPillText,
          tone === 'request' ? sharedStyles.requestPillText : sharedStyles.missionPillText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={sharedStyles.emptyCard}>
      <Text style={sharedStyles.emptyCardTitle}>{title}</Text>
      <Text style={sharedStyles.emptyCardSubtitle}>{subtitle}</Text>
    </View>
  );
}

export function WalletRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={sharedStyles.walletRow}>
      <Text style={[sharedStyles.walletLabel, strong && sharedStyles.walletLabelStrong]}>{label}</Text>
      <Text style={[sharedStyles.walletValue, strong && sharedStyles.walletValueStrong]}>
        {value.toLocaleString()}원
      </Text>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    gap: Spacing.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing['5xl'],
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  hero: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  heroTop: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  heroCopy: {
    flex: 1,
  },
  heroKicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  roleChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleChipText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    flex: 1,
    padding: Spacing.md,
  },
  metricLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginBottom: 6,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  section: {
    gap: Spacing.md,
  },
  resumeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: 4,
  },
  resumeInlineText: {
    flex: 1,
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  resumeInlineAction: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  actionGrid: {
    gap: Spacing.md,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  actionIconWrap: {
    alignItems: 'center',
    backgroundColor: Colors.secondaryLight,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    marginBottom: Spacing.md,
    width: 42,
  },
  actionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  recommendationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  recommendationText: {
    color: Colors.gray700,
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  boardCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: 8,
    padding: Spacing.lg,
  },
  boardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  boardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardTitle: {
    color: Colors.textPrimary,
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  modeBadge: {
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeBadgeText: {
    color: Colors.infoDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
  },
  statusPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestPill: {
    backgroundColor: Colors.successLight,
  },
  missionPill: {
    backgroundColor: Colors.infoLight,
  },
  statusPillText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
  },
  requestPillText: {
    color: Colors.successDark,
  },
  missionPillText: {
    color: Colors.info,
  },
  boardBody: {
    color: Colors.gray700,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  boardMeta: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  boardHint: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  rewardText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  strategyCard: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  strategyCardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  strategyCardBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: 6,
  },
  emptyCardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  emptyCardSubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  moreLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  moreLinkText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  walletCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  walletLabelStrong: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  walletValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
  walletValueStrong: {
    color: Colors.primary,
  },
  walletDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  compactToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: BorderRadius.full,
    padding: 2,
    alignSelf: 'flex-start',
    height: 32,
    position: 'relative',
  },
  compactToggleSlider: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  compactToggleOption: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  compactToggleText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  compactToggleTextActive: {
    color: Colors.textPrimary,
  },
});
