import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

type FeaturedMissionSummary = {
  routeLabel: string;
  featuredReason: string;
  quickFacts: string;
  rewardLabel?: string;
  disabled?: boolean;
  onPress: () => void;
};

type MissionBoardHeaderProps = {
  scopeTitle: string;
  scopeSubtitle: string;
  onPressScopeSettings: () => void;
  featuredMission?: FeaturedMissionSummary | null;
};

export function MissionBoardHeader({
  scopeTitle,
  scopeSubtitle,
  onPressScopeSettings,
  featuredMission,
}: MissionBoardHeaderProps) {
  return (
    <>
      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <View style={styles.filterCopy}>
            <Text style={styles.filterTitle}>{scopeTitle}</Text>
            <Text style={styles.filterSubtitle}>{scopeSubtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.88}
            onPress={onPressScopeSettings}
          >
            <Text style={styles.filterButtonText}>권역/동선 설정</Text>
          </TouchableOpacity>
        </View>
      </View>

      {featuredMission ? (
        <View style={styles.featuredCard}>
          <View style={styles.featuredTop}>
            <Text style={styles.featuredKicker}>가장 먼저 보기</Text>
            <Text style={styles.featuredReward}>{featuredMission.rewardLabel}</Text>
          </View>
          <Text style={styles.featuredTitle}>{featuredMission.routeLabel}</Text>
          <Text style={styles.featuredReason}>{featuredMission.featuredReason}</Text>
          <Text style={styles.featuredBody}>{featuredMission.quickFacts}</Text>
          <TouchableOpacity
            style={[styles.featuredButton, featuredMission.disabled ? styles.featuredButtonDisabled : undefined]}
            activeOpacity={0.9}
            disabled={featuredMission.disabled}
            onPress={featuredMission.onPress}
          >
            <Text style={styles.featuredButtonText}>바로 잡기</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  filterCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  filterHeader: {
    gap: Spacing.sm,
  },
  filterCopy: {
    gap: 4,
  },
  filterTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  filterSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  filterButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  featuredCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    backgroundColor: Colors.primaryDark,
    ...Shadows.md,
  },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  featuredKicker: {
    color: Colors.primaryMint,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  featuredReward: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  featuredTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  featuredReason: {
    color: Colors.primaryMint,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  featuredBody: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
  },
  featuredButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
  },
  featuredButtonDisabled: {
    opacity: 0.6,
  },
  featuredButtonText: {
    color: Colors.primaryDark,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
});
