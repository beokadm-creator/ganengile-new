/**
 * Icon Adapter Component
 * 웹에서는 Emoji, 네이티브에서는 Vector Icons 사용
 */

import React from 'react';
import { Platform } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

// 아이콘 이름 → Emoji 매핑
const iconEmojiMap: Record<string, string> = {
  // Material Icons
  'waving-hand': '👋',
  'inventory': '📦',
  'check-circle': '✅',
  'inventory-2': '📦',
  'chevron-right': '▶',
  'subway': '🚇',
  'location-on': '📍',
  'local-shipping': '🚚',
  'payments': '💰',
  'star': '⭐',
  'star-rate': '⭐',
  'pedal-bike': '🚲',

  // Ionicons
  'card-outline': '💳',
  'car-outline': '🚗',
  'airplane-outline': '✈️',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export function Icon({ name, size = 24, color = '#000', style }: IconProps) {
  // 웹에서는 Emoji, 네이티브에서는 Vector Icon
  if (Platform.OS === 'web') {
    const emoji = iconEmojiMap[name] || '•';
    return (
      <span
        style={{
          fontSize: size,
          color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {emoji}
      </span>
    );
  }

  // 네이티브에서는 MaterialIcons 기본 (Ionicons 필요 시 별도 처리)
  return <MaterialIcons name={name as any} size={size} color={color} style={style} />;
}

/**
 * 웹에서만 아이콘 대신 Emoji를 보여주는 헬퍼 함수
 */
export function useIconFallback() {
  return Platform.OS === 'web';
}
