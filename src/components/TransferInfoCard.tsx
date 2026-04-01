import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { BorderRadius, Colors, Spacing, Typography } from '../theme';

export interface TransferInfo {
  hasTransfer: boolean;
  transferStation?: string;
  transferCount?: number;
  transferBonus?: number;
  subwayFare?: number;
  additionalTime?: number;
}

interface Props {
  transferInfo: TransferInfo;
  style?: StyleProp<ViewStyle>;
}

export default function TransferInfoCard({ transferInfo, style }: Props) {
  if (!transferInfo.hasTransfer) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>환승</Text>
        <Text style={styles.headerTitle}>환승 정보</Text>
      </View>

      <View style={styles.infoContainer}>
        {transferInfo.transferStation ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>환승역</Text>
            <Text style={styles.infoValue}>{transferInfo.transferStation}</Text>
          </View>
        ) : null}

        {typeof transferInfo.transferCount === 'number' ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>환승 횟수</Text>
            <Text style={styles.infoValue}>{transferInfo.transferCount}회</Text>
          </View>
        ) : null}

        {typeof transferInfo.additionalTime === 'number' ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>추가 시간</Text>
            <Text style={styles.infoValue}>+{transferInfo.additionalTime}분</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.feeContainer}>
        {typeof transferInfo.transferBonus === 'number' ? (
          <View style={styles.feeItem}>
            <Text style={styles.feeLabel}>환승 보너스</Text>
            <Text style={[styles.feeValue, styles.feeValuePositive]}>
              +{transferInfo.transferBonus.toLocaleString()}원
            </Text>
          </View>
        ) : null}

        {typeof transferInfo.subwayFare === 'number' ? (
          <View style={styles.feeItem}>
            <Text style={styles.feeLabel}>지하철 요금</Text>
            <Text style={[styles.feeValue, styles.feeValueNegative]}>
              -{transferInfo.subwayFare.toLocaleString()}원
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.notice}>환승 구간이 포함되어 있어 이동 시간이 조금 더 걸릴 수 있습니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  headerIcon: {
    ...Typography.bodyBold,
    color: Colors.primary,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  infoContainer: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  infoValue: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  feeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  feeItem: {
    alignItems: 'center',
  },
  feeLabel: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  feeValue: {
    ...Typography.body,
    fontWeight: '700',
  },
  feeValuePositive: {
    color: Colors.success,
  },
  feeValueNegative: {
    color: Colors.error,
  },
  notice: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
