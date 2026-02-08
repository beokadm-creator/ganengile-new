/**
 * ProgressBar Component
 * 진행 상태를 표시하는 프로그레스 바
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../theme';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  backgroundColor?: string;
  height?: number;
  style?: ViewStyle;
  showLabel?: boolean;
}

export default function ProgressBar({
  progress,
  color = Colors.primary,
  backgroundColor = Colors.gray200,
  height = 8,
  style,
  showLabel = false,
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const widthValue = clampedProgress * 100;

  return (
    <View style={[styles.container, style, { height, backgroundColor }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${widthValue}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray200,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
});
