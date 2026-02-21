/**
 * Transfer Info Card Component
 * 환승 정보 카드 (P0-5)
 *
 * 기능:
 * - 환승역 표시
 * - 환승 횟수 표시
 * - 환승 보너스 요금 표시
 * - 지하철 요금 표시
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

export interface TransferInfo {
  hasTransfer: boolean;
  transferStation?: string;
  transferCount?: number;
  transferBonus?: number; // 원
  subwayFare?: number; // 원
  additionalTime?: number; // 분
}

interface Props {
  transferInfo: TransferInfo;
  style?: any;
}

export default function TransferInfoCard({ transferInfo, style }: Props) {
  if (!transferInfo.hasTransfer) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🔄</Text>
        <Text style={styles.headerTitle}>환승 정보</Text>
      </View>

      {/* 환승 정보 */}
      <View style={styles.infoContainer}>
        {/* 환승역 */}
        {transferInfo.transferStation && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>환승역</Text>
            <Text style={styles.infoValue}>{transferInfo.transferStation}</Text>
          </View>
        )}

        {/* 환승 횟수 */}
        {transferInfo.transferCount !== undefined && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>환승 횟수</Text>
            <Text style={styles.infoValue}>{transferInfo.transferCount}회</Text>
          </View>
        )}

        {/* 추가 소요 시간 */}
        {transferInfo.additionalTime !== undefined && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>추가 시간</Text>
            <Text style={styles.infoValue}>+{transferInfo.additionalTime}분</Text>
          </View>
        )}
      </View>

      {/* 요금 정보 */}
      <View style={styles.feeContainer}>
        {/* 환승 보너스 */}
        {transferInfo.transferBonus && (
          <View style={styles.feeItem}>
            <Text style={styles.feeLabel}>환승 보너스</Text>
            <Text style={[styles.feeValue, styles.feeValuePositive]}>
              +{transferInfo.transferBonus.toLocaleString()}원
            </Text>
          </View>
        )}

        {/* 지하철 요금 */}
        {transferInfo.subwayFare && (
          <View style={styles.feeItem}>
            <Text style={styles.feeLabel}>지하철 요금</Text>
            <Text style={[styles.feeValue, styles.feeValueNegative]}>
              -{transferInfo.subwayFare.toLocaleString()}원
            </Text>
          </View>
        )}
      </View>

      {/* 안내 문구 */}
      <Text style={styles.notice}>
        환승 경로로 배송합니다. 추가 시간 내에 도착합니다.
      </Text>
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
        shadowOpacity: 0.1,
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
  },
  headerIcon: {
    fontSize: 20,
    marginRight: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  infoContainer: {
    backgroundColor: Colors.background,
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
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  infoValue: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: '600',
  },
  feeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  feeItem: {
    alignItems: 'center',
  },
  feeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  feeValue: {
    ...Typography.body1,
    fontWeight: '700',
  },
  feeValuePositive: {
    color: '#4CAF50', // Green
  },
  feeValueNegative: {
    color: '#FF5252', // Red
  },
  notice: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
