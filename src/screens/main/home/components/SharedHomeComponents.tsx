import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../../../theme';
import { UserRole } from '../../../../types/user';

// ─── Compact Role Toggle ─────────────────────────────────────────────────────
export function CompactRoleToggle({
  isGiller,
  onToggle,
}: {
  isGiller: boolean;
  onToggle: (role: UserRole) => void;
}) {
  const [slideAnim] = React.useState(new Animated.Value(isGiller ? 1 : 0));

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isGiller ? 1 : 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  }, [isGiller, slideAnim]);

  const toggleWidth = 120;
  const padding = 2; // tighter than xs(4) — compact pill proportion
  const sliderWidth = toggleWidth / 2 - padding;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [padding, toggleWidth / 2],
  });

  return (
    <View style={[sharedStyles.compactToggleContainer, { width: toggleWidth }]}>
      <Animated.View
        style={[
          sharedStyles.compactToggleSlider,
          {
            width: sliderWidth,
            transform: [{ translateX }],
          },
        ]}
      />
      <TouchableOpacity
        style={sharedStyles.compactToggleOption}
        activeOpacity={1}
        onPress={() => {
          if (isGiller) onToggle(UserRole.GLER);
        }}
      >
        <Text style={[sharedStyles.compactToggleText, !isGiller && sharedStyles.compactToggleTextActive]}>
          요청
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={sharedStyles.compactToggleOption}
        activeOpacity={1}
        onPress={() => {
          if (!isGiller) onToggle(UserRole.GILLER);
        }}
      >
        <Text style={[sharedStyles.compactToggleText, isGiller && sharedStyles.compactToggleTextActive]}>
          배송
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Primary Action Button ───────────────────────────────────────────────────
export function PrimaryActionButton({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={sharedStyles.primaryActionButton}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={sharedStyles.primaryActionContent}>
        <Text style={sharedStyles.primaryActionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={sharedStyles.primaryActionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      <MaterialIcons name="arrow-forward" size={22} color={Colors.textWhite} />
    </TouchableOpacity>
  );
}

// ─── Quick Link ──────────────────────────────────────────────────────────────
export function QuickLinkRow({
  icon,
  title,
  onPress,
  disabled,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={sharedStyles.quickLinkRow}
      onPress={onPress}
      activeOpacity={0.88}
      hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
    >
      <MaterialIcons
        name={icon}
        size={20}
        color={disabled ? Colors.textDisabled : Colors.primary}
      />
      <Text
        style={[
          sharedStyles.quickLinkText,
          disabled && sharedStyles.quickLinkDisabled,
        ]}
      >
        {title}
      </Text>
      <MaterialIcons
        name="chevron-right"
        size={20}
        color={disabled ? Colors.textDisabled : Colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

export function QuickLinkPanel({ children }: { children: React.ReactNode }) {
  return <View style={sharedStyles.quickLinkPanel}>{children}</View>;
}

export function QuickLinkDivider() {
  return <View style={sharedStyles.quickLinkDivider} />;
}

// ─── Badges ──────────────────────────────────────────────────────────────────
export function ModeBadge({ label }: { label: string }) {
  return (
    <View style={sharedStyles.modeBadge}>
      <Text style={sharedStyles.modeBadgeText}>{label}</Text>
    </View>
  );
}

export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'request' | 'mission';
}) {
  return (
    <View
      style={[
        sharedStyles.statusPill,
        tone === 'request' ? sharedStyles.requestPill : sharedStyles.missionPill,
      ]}
    >
      <Text
        style={[
          sharedStyles.statusPillText,
          tone === 'request'
            ? sharedStyles.requestPillText
            : sharedStyles.missionPillText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Empty Card ──────────────────────────────────────────────────────────────
export function EmptyCard({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={sharedStyles.emptyCard}>
      <Text style={sharedStyles.emptyCardTitle}>{title}</Text>
      <Text style={sharedStyles.emptyCardSubtitle}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={sharedStyles.emptyCardAction}
          onPress={onAction}
          activeOpacity={0.88}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={sharedStyles.emptyCardActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Wallet Compact ──────────────────────────────────────────────────────────
export function WalletCompact({
  balance,
  onPress,
}: {
  balance: number;
  onPress: () => void;
}) {
  return (
    <View style={sharedStyles.walletCompact}>
      <Text style={sharedStyles.walletCompactLabel}>출금 가능</Text>
      <TouchableOpacity
        style={sharedStyles.walletCompactRight}
        onPress={onPress}
        activeOpacity={0.88}
        hitSlop={{ top: 8, bottom: 8, left: 16, right: 8 }}
      >
        <Text style={sharedStyles.walletCompactValue}>
          {balance.toLocaleString()}원
        </Text>
        <Text style={sharedStyles.walletCompactMore}>자세히</Text>
        <MaterialIcons name="chevron-right" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
export const sharedStyles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    gap: Spacing.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing['5xl'],
  },

  // Hero
  hero: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  heroTop: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
  },
  heroKicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
  },

  // Section
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  resumeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  resumeInlineText: {
    flex: 1,
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  resumeInlineAction: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.extrabold,
  },

  // Primary Action Button
  primaryActionButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    minHeight: 56,
    ...Shadows.md,
  },
  primaryActionContent: {
    flex: 1,
    gap: 2, // tighter than xs(4) — kicker/subtitle stack
  },
  primaryActionTitle: {
    color: Colors.textWhite,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  primaryActionSubtitle: {
    color: 'rgba(255,255,255,0.72)', // translucent white on primary bg — intentional
    fontSize: Typography.fontSize.sm,
  },

  // Quick Link
  quickLinkPanel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
  },
  quickLinkText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  quickLinkDisabled: {
    color: Colors.textDisabled,
  },
  quickLinkDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },

  // Recommendation panel
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

  // Board card
  boardCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    padding: Spacing.lg,
    ...Shadows.sm,
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
    gap: Spacing.sm,
  },
  boardTitle: {
    color: Colors.textPrimary,
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
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
  rewardText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },

  // Strategy note — flat, no nested card
  strategyNote: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    gap: 2, // tighter than xs(4) — compact label/body stack
    marginTop: Spacing.xs,
  },
  strategyNoteTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  strategyNoteBody: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },

  // Badges
  modeBadge: {
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10, // between sm(8) and md(12) — badge pill proportion
    paddingVertical: 6,    // between xs(4) and sm(8) — badge pill proportion
  },
  modeBadgeText: {
    color: Colors.infoDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.extrabold,
  },
  statusPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10, // between sm(8) and md(12) — pill proportion
    paddingVertical: 6,    // between xs(4) and sm(8) — pill proportion
  },
  requestPill: {
    backgroundColor: Colors.successLight,
  },
  missionPill: {
    backgroundColor: Colors.infoLight,
  },
  statusPillText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.extrabold,
  },
  requestPillText: {
    color: Colors.successDark,
  },
  missionPillText: {
    color: Colors.info,
  },

  // Empty card
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: 6, // between xs(4) and sm(8) — intentional compact card rhythm
    ...Shadows.sm,
  },
  emptyCardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyCardSubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  emptyCardAction: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  emptyCardActionText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },

  // More link
  moreLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minHeight: 44, // WCAG minimum touch target
    justifyContent: 'center',
  },
  moreLinkText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },

  // Wallet compact
  walletCompact: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    ...Shadows.sm,
  },
  walletCompactLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  walletCompactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // between xs(4) and sm(8) — tight value/label cluster
  },
  walletCompactValue: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  walletCompactMore: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Role toggle
  compactToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.08)', // subtle scrim on mint bg — intentional

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
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  compactToggleTextActive: {
    color: Colors.textPrimary,
  },
});
