/**
 * LocationInfoCard Component
 * 위치 정보 카드 컴포넌트
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  distance: number; // meters
  nearestStation: string;
  estimatedTime: number; // minutes
  rank?: number;
}

export default function LocationInfoCard({
  distance,
  nearestStation,
  estimatedTime,
  rank,
}: Props) {
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getDistanceColor = (): string => {
    if (distance < 1000) return '#4CAF50'; // 1km 미만: 녹색
    if (distance < 3000) return '#FFC107'; // 3km 미만: 노란색
    return '#FF9800'; // 3km 이상: 주황색
  };

  return (
    <View style={styles.container}>
      {/* 거리 정보 */}
      <View style={styles.infoRow}>
        <Ionicons name="location" size={18} color={getDistanceColor()} />
        <Text style={styles.label}>현재 거리</Text>
        <Text style={[styles.value, { color: getDistanceColor() }]}>
          {formatDistance(distance)}
        </Text>
      </View>

      {/* 가까운 역 */}
      <View style={styles.infoRow}>
        <Ionicons name="subway" size={18} color="#00BCD4" />
        <Text style={styles.label}>가까운 역</Text>
        <Text style={styles.value}>{nearestStation}</Text>
      </View>

      {/* 예상 시간 */}
      <View style={styles.infoRow}>
        <Ionicons name="time" size={18} color="#2196F3" />
        <Text style={styles.label}>예상 시간</Text>
        <Text style={styles.value}>{estimatedTime}분</Text>
      </View>

      {/* 순위 배지 (있는 경우) */}
      {rank && rank <= 3 && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>🏆 {rank}위</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    position: 'relative',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#666',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  value: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  rankBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
  },
  rankText: {
    fontSize: 14,
  },
});
