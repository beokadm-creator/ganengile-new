/**
 * RequestMatchScoreBadge Component
 * 매칭 점수 배지 표시 컴포넌트
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RouteMatchScore } from '../../types/matching-extended';

interface Props {
  score: RouteMatchScore;
  size?: 'small' | 'medium' | 'large';
}

export default function RequestMatchScoreBadge({ score, size = 'medium' }: Props) {
  const getScoreColor = (): string => {
    if (score.score >= 80) return '#4CAF50'; // 녹색
    if (score.score >= 60) return '#FFC107'; // 노란색
    if (score.score >= 40) return '#FF9800'; // 주황색
    return '#F44336'; // 빨간색
  };

  const getScoreLabel = (): string => {
    if (score.score >= 80) return '완벽';
    if (score.score >= 60) return '좋음';
    if (score.score >= 40) return '보통';
    return '낮음';
  };

  const sizeStyles = {
    small: {
      container: { paddingHorizontal: 8, paddingVertical: 4 },
      score: { fontSize: 14 },
      label: { fontSize: 9 },
    },
    medium: {
      container: { paddingHorizontal: 12, paddingVertical: 6 },
      score: { fontSize: 18 },
      label: { fontSize: 10 },
    },
    large: {
      container: { paddingHorizontal: 16, paddingVertical: 8 },
      score: { fontSize: 22 },
      label: { fontSize: 12 },
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={[styles.badge, { backgroundColor: getScoreColor() }, currentSize.container]}>
      <Text style={[styles.scoreText, currentSize.score]}>{score.score}%</Text>
      <Text style={[styles.labelText, currentSize.label]}>{getScoreLabel()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  labelText: {
    color: '#fff',
    marginTop: 2,
  },
});
