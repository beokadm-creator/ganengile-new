import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { MissionSignalPill, MissionStatusBadge } from './MissionBoardBadges';
import type { MissionCard, MissionGroup } from './mission-board-types';
import { NaverMapCard } from '../maps/NaverMapCard';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

type MissionGroupCardProps = {
  group: MissionGroup;
  submittingBundleId: string | null;
  onPress: (card: MissionCard) => void;
  onRelease: (card: MissionCard) => void;
  onNextAction: (group: MissionGroup) => void;
  onOpenDetails: (group: MissionGroup) => void;
  buildOptionLabel: (card: MissionCard) => string;
  buildQuickFacts: (group: MissionGroup) => string;
  getNextActionLabel: (group: MissionGroup) => string | null;
  isFullSpanOption: (card: MissionCard, group: MissionGroup) => boolean;
  buildComparisonHint: (card: MissionCard, group: MissionGroup) => string | null;
};

function buildCenterPoint(group: MissionGroup) {
  const points = [group.originPoint, group.destinationPoint].filter(
    (point): point is NonNullable<MissionGroup['originPoint']> => point != null
  );

  if (!points.length) {
    return null;
  }

  return {
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
    label: group.routeLabel,
  };
}

export function MissionGroupCard({
  group,
  submittingBundleId,
  onPress,
  onRelease,
  onNextAction,
  onOpenDetails,
  buildOptionLabel,
  buildQuickFacts,
  getNextActionLabel,
  isFullSpanOption,
  buildComparisonHint,
}: MissionGroupCardProps) {
  const centerPoint = buildCenterPoint(group);
  const mapPoints = [group.originPoint, group.destinationPoint].filter(
    (point): point is NonNullable<MissionGroup['originPoint']> => point != null
  );
  const isAcceptedGroup = group.selectionState === 'accepted';
  const nextActionLabel = getNextActionLabel(group);

  return (
    <View
      style={[
        styles.card,
        isAcceptedGroup ? styles.cardAcceptedShell : styles.cardAvailableShell,
      ]}
    >
      {group.selectionState === 'available' && group.options[0] ? (
        <TouchableOpacity
          style={styles.quickActionBanner}
          activeOpacity={0.9}
          disabled={submittingBundleId === group.options[0].bundleId}
          onPress={() => onPress(group.options[0])}
        >
          <View style={styles.quickActionCopy}>
            <Text style={styles.quickActionTitle}>바로 잡기</Text>
            <Text style={styles.quickActionBody}>
              {buildOptionLabel(group.options[0])} · {group.options[0].rewardLabel}
            </Text>
          </View>
          <MaterialIcons name="bolt" size={18} color={Colors.white} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{group.routeLabel}</Text>
        <View style={styles.cardTopActions}>
          <MissionStatusBadge label={group.status} />
          <TouchableOpacity style={styles.detailLink} activeOpacity={0.88} onPress={() => onOpenDetails(group)}>
            <Text style={styles.detailLinkText}>상세</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.quickFacts}>{buildQuickFacts(group)}</Text>
      <Text style={styles.windowLabel}>{group.windowLabel}</Text>
      {group.options[0]?.exposureLabel ? <Text style={styles.exposureLabel}>{group.options[0].exposureLabel}</Text> : null}
      {nextActionLabel ? <Text style={styles.nextActionLabel}>다음 행동 · {nextActionLabel}</Text> : null}
      <Text style={styles.cardBody}>{group.strategyTitle}</Text>
      <Text style={styles.cardSummary}>{group.strategyBody}</Text>

      {isAcceptedGroup && nextActionLabel ? (
        <TouchableOpacity style={styles.nextActionButton} activeOpacity={0.88} onPress={() => onNextAction(group)}>
          <Text style={styles.nextActionButtonText}>{nextActionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.signalRow}>
        {group.candidateCount > 0 ? (
          <MissionSignalPill
            icon="group"
            label={`추천 대상 ${group.candidateCount}명`}
            tone="neutral"
          />
        ) : null}
        {group.requiresExternalPartner ? (
          <MissionSignalPill
            icon="local-shipping"
            label="일부 파트너 연계"
            tone="warning"
          />
        ) : (
          <MissionSignalPill icon="directions-subway" label="길러 수행 중심" tone="positive" />
        )}
      </View>

      {isAcceptedGroup && centerPoint && mapPoints.length >= 2 ? (
        <View style={styles.mapWrap}>
          <NaverMapCard
            title={group.routeLabel}
            subtitle="출발과 도착을 지도에서 확인하세요."
            center={centerPoint}
            markers={mapPoints}
            path={mapPoints}
            height={180}
          />
        </View>
      ) : null}

      {isAcceptedGroup ? (
        <>
          <View style={styles.optionHeader}>
            <Text style={styles.optionHeaderTitle}>진행 중 구간</Text>
            <Text style={styles.optionHeaderHint}>진행 전이라면 수락을 취소할 수 있습니다.</Text>
          </View>

          <View style={styles.optionList}>
            {group.options.map((card, index) => {
              const disabled =
                card.selectionState === 'accepted' ||
                !card.bundleId ||
                submittingBundleId === card.bundleId;
              const actionLabel =
                submittingBundleId === card.bundleId
                  ? '처리 중...'
                  : card.actionLabel ??
                    (card.selectionState === 'accepted' ? '수락 완료' : '이 구간 수행하기');
              const isPrimaryOption = index === 0;
              const isFullSpan = isFullSpanOption(card, group);
              const comparisonHint = buildComparisonHint(card, group);

              return (
                <View
                  key={card.id}
                  style={[
                    styles.optionCard,
                    isPrimaryOption && styles.optionCardPrimary,
                    card.selectionState === 'accepted' && styles.optionCardAccepted,
                  ]}
                >
                  <View style={styles.optionTop}>
                    <Text style={styles.optionTitle}>{buildOptionLabel(card)}</Text>
                    <Text style={styles.optionReward}>{card.rewardLabel}</Text>
                  </View>
                  {card.rewardBoostLabel ? <Text style={styles.rewardBoostLabel}>{card.rewardBoostLabel}</Text> : null}
                  <View style={styles.optionSignalRow}>
                    {isFullSpan ? (
                      <MissionSignalPill icon="star" label="전체 수행" tone="positive" />
                    ) : (
                      <MissionSignalPill icon="call-split" label="부분 수행" tone="neutral" />
                    )}
                    {comparisonHint ? (
                      <MissionSignalPill icon="payments" label={comparisonHint} tone="neutral" />
                    ) : null}
                  </View>
                  <Text style={styles.optionSummary}>{card.legSummary ?? card.strategyBody}</Text>
                  {card.fallbackLabel ? <Text style={styles.fallbackLabel}>{card.fallbackLabel}</Text> : null}
                  <TouchableOpacity
                    style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
                    activeOpacity={0.88}
                    disabled={disabled}
                    onPress={() => onPress(card)}
                  >
                    <Text style={[styles.actionButtonText, disabled && styles.actionButtonTextDisabled]}>
                      {actionLabel}
                    </Text>
                  </TouchableOpacity>
                  {card.selectionState === 'accepted' ? (
                    <TouchableOpacity
                      style={styles.inlineSecondaryButton}
                      activeOpacity={0.88}
                      disabled={submittingBundleId === card.bundleId}
                      onPress={() => onRelease(card)}
                    >
                      <Text style={styles.inlineSecondaryButtonText}>수락 취소</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.availableFooter}>
          <Text style={styles.availableFooterText}>먼저 잡고, 자세한 구간은 상세에서 확인할 수 있습니다.</Text>
          <TouchableOpacity style={styles.availableDetailButton} activeOpacity={0.88} onPress={() => onOpenDetails(group)}>
            <Text style={styles.availableDetailButtonText}>상세 보기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardAvailableShell: {
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  cardAcceptedShell: {
    borderWidth: 1,
    borderColor: Colors.success,
    backgroundColor: '#F5FCF7',
  },
  quickActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  quickActionCopy: {
    flex: 1,
    gap: 2,
  },
  quickActionTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  quickActionBody: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  cardTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailLink: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray100,
  },
  detailLinkText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  cardTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  quickFacts: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  windowLabel: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  exposureLabel: {
    color: Colors.warningDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  nextActionLabel: {
    color: Colors.primaryDark,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  cardBody: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  cardSummary: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  nextActionButton: {
    marginTop: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryDark,
  },
  nextActionButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  mapWrap: {
    marginTop: Spacing.xs,
  },
  optionHeader: {
    marginTop: Spacing.sm,
    gap: 2,
  },
  optionHeaderTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  optionHeaderHint: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
  },
  optionList: {
    gap: Spacing.sm,
  },
  optionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  optionCardPrimary: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionCardAccepted: {
    borderColor: Colors.success,
    backgroundColor: '#ECFDF3',
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  optionSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  optionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  optionReward: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  optionSummary: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  rewardBoostLabel: {
    color: Colors.warningDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  fallbackLabel: {
    color: Colors.warning,
    fontSize: Typography.fontSize.sm,
  },
  actionButton: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.border,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  actionButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  inlineSecondaryButton: {
    marginTop: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  inlineSecondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  availableFooter: {
    marginTop: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  availableFooterText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
  },
  availableDetailButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray100,
  },
  availableDetailButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
});
