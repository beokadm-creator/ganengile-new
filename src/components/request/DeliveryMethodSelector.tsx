/**
 * Create Request Screen Enhancements
 * 배송 방식 선택 및 사물함 연동 확장
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import type { DeliveryMethod, DeliveryMethodOption } from '../../types/delivery-method';
import { DELIVERY_METHODS } from '../../types/delivery-method';

// 배송 방식 선택 UI 컴포넌트
export function DeliveryMethodSelector({
  selectedMethod,
  onSelect,
}: {
  selectedMethod: DeliveryMethod | null;
  onSelect: (method: DeliveryMethod) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {DELIVERY_METHODS.map((method) => {
        const isSelected = selectedMethod === method.id;
        return (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.methodCard,
              isSelected && styles.methodCardSelected,
            ]}
            onPress={() => onSelect(method.id)}
            activeOpacity={0.7}
          >
            <View style={styles.methodEmojiContainer}>
              <Text style={styles.methodEmoji}>{method.emoji}</Text>
            </View>
            <View style={styles.methodInfo}>
              <Text style={[
                styles.methodLabel,
                isSelected && styles.methodLabelSelected,
              ]}>
                {method.label}
              </Text>
              <Text style={styles.methodDescription}>
                {method.description}
              </Text>
            </View>
            {isSelected && (
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// 배송 방식 안내 UI
export function DeliveryMethodInfo({ method }: { method: DeliveryMethod | null }) {
  if (!method) return null;

  const methodInfo = DELIVERY_METHODS.find((m) => m.id === method);
  if (!methodInfo) return null;

  return (
    <View style={styles.infoContainer}>
      <View style={styles.infoHeader}>
        <Ionicons name="information-circle" size={20} color={Colors.primary} />
        <Text style={styles.infoTitle}>배송 방식 안내</Text>
      </View>
      <Text style={styles.infoText}>
        {methodInfo.emoji} {methodInfo.label}
      </Text>
      <Text style={styles.infoDescription}>
        {methodInfo.description}
      </Text>
      {methodInfo.requiresLocker && (
        <Text style={styles.infoNote}>
          ⚠️ 사물함을 선택해야 합니다
        </Text>
      )}
    </View>
  );
}

// 스타일
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: -Spacing.md,
  },
  methodCard: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    minWidth: 280,
    padding: Spacing.md,
  },
  methodCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  methodEmojiContainer: {
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 20,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  methodEmoji: {
    fontSize: 24,
  },
  methodInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  methodLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  methodLabelSelected: {
    color: Colors.primary,
  },
  methodDescription: {
    color: Colors.gray600,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.xs,
  },
  checkIcon: {
    marginLeft: Spacing.sm,
  },
  infoContainer: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  infoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  infoTitle: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  infoText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.xs,
  },
  infoDescription: {
    color: Colors.gray700,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
  },
  infoNote: {
    color: Colors.accent,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.sm,
  },
});
