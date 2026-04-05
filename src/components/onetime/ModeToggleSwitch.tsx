/**
 * Mode Toggle Switch
 * 정기 동선/일회성 모드 전환 토글
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface ModeToggleSwitchProps {
  onModeChange?: (onetime: boolean) => void;
}

export default function ModeToggleSwitch({ onModeChange }: ModeToggleSwitchProps) {
  const { user } = useAuth();
  const [onetimeMode, setOnetimeMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [animValue] = useState(new Animated.Value(0));
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const enabled = doc.data().onetimeModeEnabled || false;
        setOnetimeMode(enabled);

        // 애니메이션: 일회성(true) -> 0, 정기동선(false) -> 1
        Animated.spring(animValue, {
          toValue: enabled ? 0 : 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();

        if (onModeChange) {
          onModeChange(enabled);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleToggle = async () => {
    if (!user?.uid) return;
    
    const newValue = !onetimeMode;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        onetimeModeEnabled: newValue,
      });
    } catch (error) {
      console.error('Error toggling onetime mode:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loading]}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toggleWrapper} onLayout={onLayout}>
        {/* 애니메이션 배경 영역 */}
        <Animated.View
          style={[
            styles.indicator,
            {
              width: containerWidth ? (containerWidth - 8) / 2 : '50%',
              transform: [
                {
                  translateX: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, containerWidth / 2],
                  }),
                },
              ],
              backgroundColor: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [Colors.primary, Colors.secondary],
              }),
            },
          ]}
        />

        {/* 버튼 영역 */}
        <TouchableOpacity
          style={styles.option}
          onPress={() => !onetimeMode && handleToggle()}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.optionText,
            onetimeMode && styles.activeText
          ]}>
            일회성
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
          onPress={() => onetimeMode && handleToggle()}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.optionText,
            !onetimeMode && styles.activeText
          ]}>
            정기 동선
          </Text>
        </TouchableOpacity>
      </View>

      {/* 상태 텍스트 */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusIcon}>
          {onetimeMode ? '🔥' : '🔄'}
        </Text>
        <Text style={styles.statusText}>
          {onetimeMode ? '일회성 모드' : '정기 동선 모드'}
        </Text>
      </View>

      {/* 설명 */}
      <Text style={styles.description}>
        {onetimeMode
          ? '동선 없이 자유롭게 배송 요청'
          : '정기 동선으로 빠른 매칭'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    marginBottom: Spacing.md,
  },
  loading: {
    opacity: 0.6,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.full,
    height: 48,
    padding: 4,
    position: 'relative',
    ...Shadows.sm,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: BorderRadius.full,
    zIndex: 0,
    ...Shadows.md,
  },
  option: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  optionText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.gray600,
  },
  activeText: {
    color: Colors.white,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  statusText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
