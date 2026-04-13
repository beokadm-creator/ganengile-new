import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { NaverMapCard } from '../maps/NaverMapCard';
import type { MissionCard, MissionGroup } from './mission-board-types';
import { buildMissionExecutionGuideFromCard } from '../../services/giller-mission-execution-service';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';

type MissionDetailSheetProps = {
  group: MissionGroup | null;
  submittingBundleId: string | null;
  onClose: () => void;
  onAccept: (card: MissionCard) => void;
  onRelease: (card: MissionCard) => void;
  onNextAction: (group: MissionGroup) => void;
  buildOptionLabel: (card: MissionCard) => string;
  getNextActionLabel: (group: MissionGroup) => string | null;
  isPreviewMode?: boolean;
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

function SignalPill({
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

export const MissionDetailSheet = React.memo(function MissionDetailSheet({
  group,
  submittingBundleId,
  onClose,
  onAccept,
  onRelease,
  onNextAction,
  buildOptionLabel,
  getNextActionLabel,
  isPreviewMode,
}: MissionDetailSheetProps) {
  if (!group) {
    return null;
  }

  const centerPoint = useMemo(() => buildCenterPoint(group), [group.originPoint, group.destinationPoint, group.routeLabel]);
  const mapPoints = useMemo(() => [group.originPoint, group.destinationPoint].filter(
    (point): point is NonNullable<MissionGroup['originPoint']> => point != null
  ), [group.originPoint, group.destinationPoint]);
  const nextActionLabel = getNextActionLabel(group);
  const guide = buildMissionExecutionGuideFromCard(
    group.options.find((option) => option.selectionState === 'accepted') ?? group.options[0] ?? null
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>{group.routeLabel}</Text>
              <Text style={styles.modalSubtitle}>{group.windowLabel}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseButton} activeOpacity={0.88} onPress={onClose}>
              <MaterialIcons name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
            <Text style={styles.bodyTitle}>{group.strategyTitle}</Text>
            <Text style={styles.bodySummary}>{group.strategyBody}</Text>
            {group.options[0]?.exposureLabel ? <Text style={styles.exposureLabel}>{group.options[0].exposureLabel}</Text> : null}
            {nextActionLabel ? (
              <TouchableOpacity style={styles.nextActionButton} activeOpacity={0.88} onPress={() => onNextAction(group)}>
                <Text style={styles.nextActionButtonText}>{nextActionLabel}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.signalRow}>
              {group.candidateCount > 0 ? (
                <SignalPill icon="group" label={`추천 대상 ${group.candidateCount}명`} tone="neutral" />
              ) : null}
              {group.requiresExternalPartner ? (
                <SignalPill icon="local-shipping" label="일부 파트너 연계" tone="warning" />
              ) : (
                <SignalPill icon="directions-subway" label="길러 수행 중심" tone="positive" />
              )}
            </View>

            {guide.pickupGuide || guide.lockerGuide || guide.specialInstructions || guide.recipientSummary ? (
              <View style={styles.executionCard}>
                <Text style={styles.executionTitle}>실행 정보</Text>
                {guide.pickupGuide ? <Text style={styles.executionRow}>픽업: {guide.pickupGuide}</Text> : null}
                {guide.lockerGuide ? <Text style={styles.executionRow}>사물함: {guide.lockerGuide}</Text> : null}
                {guide.recipientSummary ? <Text style={styles.executionRow}>수령인: {guide.recipientSummary}</Text> : null}
                {guide.specialInstructions ? <Text style={styles.executionRow}>요청: {guide.specialInstructions}</Text> : null}
              </View>
            ) : null}

            {centerPoint && mapPoints.length >= 2 ? (
              <NaverMapCard
                title={group.routeLabel}
                subtitle="출발과 도착을 먼저 확인하세요."
                center={centerPoint}
                markers={mapPoints}
                path={mapPoints}
                height={190}
              />
            ) : null}

            <View style={styles.optionHeader}>
              <Text style={styles.optionHeaderTitle}>구간 선택</Text>
              <Text style={styles.optionHeaderHint}>지금 바로 맡을 범위를 고르면 됩니다.</Text>
            </View>

            <View style={styles.optionList}>
              {group.options.map((card) => {
                const disabled =
                  card.selectionState === 'accepted' ||
                  !card.bundleId ||
                  submittingBundleId === card.bundleId;
                const actionLabel =
                  submittingBundleId === card.bundleId
                    ? '처리 중...'
                    : card.actionLabel ?? (card.selectionState === 'accepted' ? '수락 완료' : '이 구간 수행하기');

                return (
                  <View key={card.id} style={styles.optionCard}>
                    <View style={styles.optionTop}>
                      <Text style={styles.optionTitle}>{buildOptionLabel(card)}</Text>
                      <Text style={styles.optionReward}>{card.rewardLabel}</Text>
                    </View>
                    {card.rewardBoostLabel ? <Text style={styles.rewardBoostLabel}>{card.rewardBoostLabel}</Text> : null}
                    <Text style={styles.optionSummary}>{card.legSummary ?? card.strategyBody}</Text>
                    <TouchableOpacity
                      style={[
                        styles.actionButton, 
                        disabled && styles.actionButtonDisabled,
                        isPreviewMode && !disabled && styles.previewButton
                      ]}
                      activeOpacity={0.88}
                      disabled={disabled}
                      onPress={() => onAccept(card)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isPreviewMode && <MaterialIcons name="lock" size={14} color={disabled ? Colors.textSecondary : '#4E5968'} />}
                        <Text style={[
                          styles.actionButtonText, 
                          disabled && styles.actionButtonTextDisabled,
                          isPreviewMode && !disabled && styles.previewButtonText
                        ]}>
                          {actionLabel}
                        </Text>
                      </View>
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray100,
  },
  modalContent: {
    gap: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  bodyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  bodySummary: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  exposureLabel: {
    color: Colors.warningDark,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
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
  executionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  executionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  executionRow: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
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
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
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
  previewButton: {
    backgroundColor: '#F2F4F6',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewButtonText: {
    color: '#4E5968',
  },
});
