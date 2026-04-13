import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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
  const primaryOption = group.options[0];

  const handlePrimaryPress = () => {
    if (primaryOption) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPress(primaryOption);
    }
  };

  return (
    <View style={[styles.card, isAcceptedGroup ? styles.cardAcceptedShell : styles.cardAvailableShell]}>
      {/* Header: Badges & Details */}
      <View style={styles.cardHeader}>
        <View style={styles.badgeContainer}>
          <MissionStatusBadge label={group.status} />
          {primaryOption?.exposureLabel && (
            <Text style={styles.exposureText}>{primaryOption.exposureLabel}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.detailButton} onPress={() => onOpenDetails(group)} activeOpacity={0.7}>
          <Text style={styles.detailButtonText}>상세보기</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content: Toss-style emphasis on amount and route */}
      <View style={styles.mainContent}>
        <Text style={styles.routeLabel}>{group.routeLabel}</Text>
        <Text style={styles.windowLabel}>{group.windowLabel}</Text>
        
        {group.selectionState === 'available' && primaryOption ? (
          <View style={styles.rewardContainer}>
            <Text style={styles.rewardAmount}>{primaryOption.rewardLabel}</Text>
            {primaryOption.rewardBoostLabel && (
              <View style={styles.rewardBoostBadge}>
                <Text style={styles.rewardBoostText}>{primaryOption.rewardBoostLabel}</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* Strategy & Facts */}
      <View style={styles.strategyContainer}>
        <Text style={styles.strategyTitle}>{group.strategyTitle}</Text>
        <Text style={styles.strategyBody}>{group.strategyBody}</Text>
      </View>

      {/* Signal Pills */}
      <View style={styles.signalRow}>
        {group.candidateCount > 0 && (
          <MissionSignalPill icon="group" label={`추천 대상 ${group.candidateCount}명`} tone="neutral" />
        )}
        {group.requiresExternalPartner ? (
          <MissionSignalPill icon="local-shipping" label="일부 파트너 연계" tone="warning" />
        ) : (
          <MissionSignalPill icon="directions-subway" label="길러 수행 중심" tone="positive" />
        )}
      </View>

      {/* Next Action Label (Accepted) */}
      {isAcceptedGroup && nextActionLabel && (
        <View style={styles.nextActionBox}>
          <Text style={styles.nextActionText}>다음 할 일 · {nextActionLabel}</Text>
        </View>
      )}

      {/* Map (Accepted) */}
      {isAcceptedGroup && centerPoint && mapPoints.length >= 2 && (
        <View style={styles.mapWrap}>
          <NaverMapCard
            title={group.routeLabel}
            subtitle="출발과 도착을 지도에서 확인하세요."
            center={centerPoint}
            markers={mapPoints}
            path={mapPoints}
            height={160}
          />
        </View>
      )}

      {/* Accepted Options List */}
      {isAcceptedGroup && (
        <View style={styles.optionList}>
          {group.options.map((card, index) => {
            const disabled = card.selectionState === 'accepted' || !card.bundleId || submittingBundleId === card.bundleId;
            const actionLabel = submittingBundleId === card.bundleId
                ? '처리 중...'
                : card.actionLabel ?? (card.selectionState === 'accepted' ? '수락 완료' : '이 구간 수행하기');
            const isFullSpan = isFullSpanOption(card, group);
            const comparisonHint = buildComparisonHint(card, group);

            return (
              <View key={card.id} style={[styles.optionCard, card.selectionState === 'accepted' && styles.optionCardAccepted]}>
                <View style={styles.optionTop}>
                  <Text style={styles.optionTitle}>{buildOptionLabel(card)}</Text>
                  <Text style={styles.optionReward}>{card.rewardLabel}</Text>
                </View>
                <View style={styles.optionSignalRow}>
                  {isFullSpan ? (
                    <MissionSignalPill icon="star" label="전체 수행" tone="positive" />
                  ) : (
                    <MissionSignalPill icon="call-split" label="부분 수행" tone="neutral" />
                  )}
                  {comparisonHint && <MissionSignalPill icon="payments" label={comparisonHint} tone="neutral" />}
                </View>
                <Text style={styles.optionSummary}>{card.legSummary ?? card.strategyBody}</Text>
                
                <TouchableOpacity
                  style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
                  activeOpacity={0.85}
                  disabled={disabled}
                  onPress={() => onPress(card)}
                >
                  <Text style={[styles.actionButtonText, disabled && styles.actionButtonTextDisabled]}>
                    {actionLabel}
                  </Text>
                </TouchableOpacity>
                {card.selectionState === 'accepted' && (
                  <TouchableOpacity
                    style={styles.inlineSecondaryButton}
                    activeOpacity={0.85}
                    disabled={submittingBundleId === card.bundleId}
                    onPress={() => onRelease(card)}
                  >
                    <Text style={styles.inlineSecondaryButtonText}>수락 취소</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Primary Action Button for Available Missions */}
      {group.selectionState === 'available' && primaryOption && (
        <TouchableOpacity
          style={styles.primaryAcceptButton}
          activeOpacity={0.85}
          disabled={submittingBundleId === primaryOption.bundleId}
          onPress={handlePrimaryPress}
        >
          <Text style={styles.primaryAcceptButtonText}>
            {submittingBundleId === primaryOption.bundleId ? '처리 중...' : '바로 수행하기'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Next Action Button for Accepted Missions */}
      {isAcceptedGroup && nextActionLabel && (
        <TouchableOpacity style={styles.primaryAcceptButton} activeOpacity={0.85} onPress={() => onNextAction(group)}>
          <Text style={styles.primaryAcceptButtonText}>{nextActionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24, // 모던한 큰 라운딩
    padding: 24,
    marginBottom: Spacing.md,
    // 토스 스타일 부드러운 그림자
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  cardAvailableShell: {
    borderWidth: 1,
    borderColor: '#F2F4F6', // 아주 연한 보더
  },
  cardAcceptedShell: {
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    backgroundColor: '#F9FCFF', // 수락된 미션은 연한 블루/민트 배경
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  exposureText: {
    color: Colors.error,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  detailButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F2F4F6',
  },
  detailButtonText: {
    color: '#4E5968', // Secondary
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  mainContent: {
    marginBottom: Spacing.md,
  },
  routeLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#191F28', // Primary
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  windowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B95A1', // Tertiary
    marginBottom: Spacing.lg,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rewardAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#191F28', // 강렬한 텍스트
    letterSpacing: -0.5,
  },
  rewardBoostBadge: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rewardBoostText: {
    color: '#E53E3E',
    fontSize: 12,
    fontWeight: '800',
  },
  strategyContainer: {
    backgroundColor: '#F9FAFB',
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.md,
  },
  strategyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4E5968',
    marginBottom: 2,
  },
  strategyBody: {
    fontSize: 13,
    color: '#8B95A1',
    lineHeight: 20,
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  nextActionBox: {
    backgroundColor: Colors.primaryLight,
    padding: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  nextActionText: {
    color: Colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  mapWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  optionList: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  optionCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E5E8EB',
    borderRadius: 16,
    padding: Spacing.md,
  },
  optionCardAccepted: {
    borderColor: Colors.primary,
    backgroundColor: '#F9FCFF',
  },
  optionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#191F28',
  },
  optionReward: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  optionSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  optionSummary: {
    fontSize: 13,
    color: '#4E5968',
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#F2F4F6',
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonTextDisabled: {
    color: '#B0B8C1',
  },
  inlineSecondaryButton: {
    marginTop: Spacing.sm,
    alignItems: 'center',
    paddingVertical: 8,
  },
  inlineSecondaryButtonText: {
    color: '#8B95A1',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  primaryAcceptButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  primaryAcceptButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
