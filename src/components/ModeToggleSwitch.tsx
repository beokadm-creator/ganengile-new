/**
 * Mode Toggle Switch Component
 * 모드 전환 토글 (P0-4)
 *
 * 기능:
 * - 정기 동선 / 일회성 모드 전환
 * - 슬라이더 애니메이션
 * - 현재 모드 표시
 * - 모드별 설명 표시
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

export type GillerMode = 'regular' | 'onetime';

interface Props {
  mode: GillerMode;
  onModeChange: (mode: GillerMode) => void;
  style?: any;
}

export default function ModeToggleSwitch({ mode, onModeChange, style }: Props) {
  const [sliderAnim] = useState(new Animated.Value(0));
  const _insets = useSafeAreaInsets();

  useEffect(() => {
    // 모드 변경 시 애니메이션
    Animated.timing(sliderAnim, {
      toValue: mode === 'onetime' ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [mode]);

  const _handleModeToggle = () => {
    const newMode: GillerMode = mode === 'regular' ? 'onetime' : 'regular';
    onModeChange(newMode);
  };

  const getSliderWidth = () => {
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = screenWidth - Spacing.md * 2;
    return (cardWidth - Spacing.md) / 2 - 4;
  };

  const sliderWidth = getSliderWidth();

  return (
    <View style={[styles.container, style]}>
      {/* 헤더 텍스트 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>길러 모드</Text>
        <Text style={styles.headerSubtitle}>
          {mode === 'onetime'
            ? '현재 위치에서 일회성 배송을 수락합니다'
            : '등록된 동선으로 배송합니다'}
        </Text>
      </View>

      {/* 모드 토글 컨테이너 */}
      <View style={styles.toggleContainer}>
        {/* 배경 */}
        <View style={styles.toggleBackground}>
          {/* 일회성 모드 */}
          <TouchableOpacity
            style={[styles.modeButton, styles.modeButtonLeft]}
            onPress={() => onModeChange('onetime')}
            activeOpacity={0.7}
          >
            <View style={styles.modeContent}>
              <Text style={[styles.modeIcon, mode === 'onetime' && styles.modeIconActive]}>
                📍
              </Text>
              <Text style={[styles.modeTitle, mode === 'onetime' && styles.modeTitleActive]}>
                일회성
              </Text>
              <Text
                style={[styles.modeDescription, mode === 'onetime' && styles.modeDescriptionActive]}
              >
                현재 위치에서 수락
              </Text>
            </View>
          </TouchableOpacity>

          {/* 정기 동선 모드 */}
          <TouchableOpacity
            style={[styles.modeButton, styles.modeButtonRight]}
            onPress={() => onModeChange('regular')}
            activeOpacity={0.7}
          >
            <View style={styles.modeContent}>
              <Text style={[styles.modeIcon, mode === 'regular' && styles.modeIconActive]}>
                🗓️
              </Text>
              <Text style={[styles.modeTitle, mode === 'regular' && styles.modeTitleActive]}>
                정기 동선
              </Text>
              <Text
                style={[styles.modeDescription, mode === 'regular' && styles.modeDescriptionActive]}
              >
                등록된 동선으로 배송
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 슬라이더 애니메이션 */}
        <Animated.View
          style={[
            styles.slider,
            {
              transform: [
                {
                  translateX: sliderAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, sliderWidth + 8],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* 모드별 추가 정보 */}
      <View style={styles.modeInfo}>
        {mode === 'regular' ? (
          <>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>✅</Text>
              <Text style={styles.infoText}>등록된 동선 자동 매칭</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📅</Text>
              <Text style={styles.infoText}>반복적인 출퇴근길 활용</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>💰</Text>
              <Text style={styles.infoText}>안정적인 수익</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>⏰</Text>
              <Text style={styles.infoText}>원할 때만 참여</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>🔄</Text>
              <Text style={styles.infoText}>환승 허용 시 보너스</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>현재 위치 기반 매칭</Text>
            </View>
          </>
        )}
      </View>

      {/* 일회성 모드 설정 버튼 */}
      {mode === 'onetime' && (
        <TouchableOpacity style={styles.settingsButton} activeOpacity={0.7}>
          <Text style={styles.settingsButtonText}>일회성 모드 설정</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.sm,
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  toggleContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  toggleBackground: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeButton: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  modeButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  modeButtonRight: {},
  modeContent: {
    alignItems: 'center',
  },
  modeIcon: {
    fontSize: 32,
    marginBottom: Spacing.xs,
    opacity: 0.5,
  },
  modeIconActive: {
    opacity: 1,
  },
  modeTitle: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  modeTitleActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  modeDescription: {
    ...Typography.bodySmall,
    color: Colors.textDisabled,
    textAlign: 'center',
    paddingHorizontal: Spacing.xs,
  },
  modeDescriptionActive: {
    color: Colors.textSecondary,
  },
  slider: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '48%',
    height: 'calc(100% - 8px)',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    opacity: 0.1,
  },
  modeInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.xs,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  infoText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    flex: 1,
  },
  settingsButton: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  settingsButtonText: {
    ...Typography.body1,
    color: Colors.primary,
    fontWeight: '600',
  },
});
