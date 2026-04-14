import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../core/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../theme';

export type GillerMode = 'regular' | 'onetime';

interface Props {
  mode: GillerMode;
  onModeChange: (mode: GillerMode) => void;
  style?: StyleProp<ViewStyle>;
}

export default function ModeToggleSwitch({ mode, onModeChange, style }: Props) {
  const { user } = useAuth();
  const [containerWidth, setContainerWidth] = useState(0);
  const [animValue] = useState(() => new Animated.Value(mode === 'onetime' ? 0 : 1));

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: mode === 'onetime' ? 0 : 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [animValue, mode]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      const enabled = Boolean(snapshot.data().onetimeModeEnabled);
      onModeChange(enabled ? 'onetime' : 'regular');
    });

    return () => unsubscribe();
  }, [onModeChange, user?.uid]);

  const handleToggle = async (nextMode: GillerMode) => {
    if (!user?.uid || nextMode === mode) {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        onetimeModeEnabled: nextMode === 'onetime',
      });
      onModeChange(nextMode);
    } catch (error) {
      console.error('Failed to toggle giller mode', error);
    }
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const sliderWidth = useMemo(() => {
    if (containerWidth <= 12) {
      return 0;
    }
    return Math.max((containerWidth - 12) / 2, 0);
  }, [containerWidth]);

  const sliderTranslateX = useMemo(
    () =>
      animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [4, sliderWidth + 8],
      }),
    [animValue, sliderWidth],
  );

  const sliderHeight: DimensionValue = 92;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>길러 모드</Text>
        <Text style={styles.headerSubtitle}>
          {mode === 'onetime'
            ? '현재 위치 주변 미션을 빠르게 확인합니다.'
            : '등록한 이동 경로를 기준으로 미션을 추천받습니다.'}
        </Text>
      </View>

      <View style={styles.toggleContainer} onLayout={handleLayout}>
        <View style={styles.toggleBackground}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void handleToggle('onetime')}
            style={[styles.modeButton, styles.modeButtonLeft]}
          >
            <View style={styles.modeContent}>
              <Text style={[styles.modeIcon, mode === 'onetime' && styles.modeIconActive]}>번개</Text>
              <Text style={[styles.modeTitle, mode === 'onetime' && styles.modeTitleActive]}>바로 보기</Text>
              <Text style={[styles.modeDescription, mode === 'onetime' && styles.modeDescriptionActive]}>
                현재 위치 기준으로 바로 수락
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void handleToggle('regular')}
            style={styles.modeButton}
          >
            <View style={styles.modeContent}>
              <Text style={[styles.modeIcon, mode === 'regular' && styles.modeIconActive]}>경로</Text>
              <Text style={[styles.modeTitle, mode === 'regular' && styles.modeTitleActive]}>정기 경로</Text>
              <Text style={[styles.modeDescription, mode === 'regular' && styles.modeDescriptionActive]}>
                등록한 동선에 맞춰 추천
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {sliderWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.slider,
              {
                width: sliderWidth,
                height: sliderHeight,
                transform: [{ translateX: sliderTranslateX }],
              },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.modeInfo}>
        {(mode === 'regular'
          ? [
              '등록한 경로 기반으로 미션을 추천합니다.',
              '반복 동선이 많은 길러에게 적합합니다.',
              '예측 가능한 수익 흐름을 만들기 쉽습니다.',
            ]
          : [
              '현재 위치 근처 요청만 빠르게 확인합니다.',
              '긴급 재매칭이나 단기 참여에 유리합니다.',
              '짧은 시간 활용이 필요할 때 적합합니다.',
            ]).map((text) => (
          <InfoItem key={text} text={text} />
        ))}
      </View>
    </View>
  );
}

function InfoItem({ text }: { text: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoBullet}>•</Text>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body2,
    color: Colors.text.secondary,
  },
  toggleContainer: {
    marginBottom: Spacing.md,
    position: 'relative',
  },
  toggleBackground: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  modeButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 100,
    padding: Spacing.md,
  },
  modeButtonLeft: {
    borderRightColor: Colors.border,
    borderRightWidth: 1,
  },
  modeContent: {
    alignItems: 'center',
  },
  modeIcon: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
    opacity: 0.6,
  },
  modeIconActive: {
    color: Colors.text.primary,
    opacity: 1,
  },
  modeTitle: {
    ...Typography.h3,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  modeTitleActive: {
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  modeDescription: {
    ...Typography.bodySmall,
    color: Colors.text.disabled,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
  },
  modeDescriptionActive: {
    color: Colors.text.secondary,
  },
  slider: {
    ...Shadows.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    left: 0,
    opacity: 0.25,
    position: 'absolute',
    top: 4,
  },
  modeInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginBottom: Spacing.xs,
    width: '100%',
  },
  infoBullet: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
    marginRight: Spacing.xs,
  },
  infoText: {
    ...Typography.body2,
    color: Colors.text.secondary,
    flex: 1,
  },
});
