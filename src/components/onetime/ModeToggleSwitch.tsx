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
} from 'react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface ModeToggleSwitchProps {
  onModeChange?: (onetime: boolean) => void;
}

export default function ModeToggleSwitch({ onModeChange }: ModeToggleSwitchProps) {
  const { user } = useAuth();
  const [onetimeMode, setOnetimeMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [animValue] = useState(new Animated.Value(1));

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const enabled = doc.data().onetimeModeEnabled || false;
        setOnetimeMode(enabled);

        // 애니메이션
        Animated.timing(animValue, {
          toValue: enabled ? 0 : 1,
          duration: 200,
          useNativeDriver: true,
        }).start();

        if (onModeChange) {
          onModeChange(enabled);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.toggleBackground,
            {
              backgroundColor: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: ['#4CAF50', '#FF9800'],
              }),
            },
          ]}
        >
          <View style={styles.toggleContent}>
            <Animated.View
              style={[
                styles.toggleIndicator,
                {
                  transform: [
                    {
                      translateX: animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 120],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={styles.toggleLabels}>
              <Text
                style={[
                  styles.toggleLabel,
                  onetimeMode && styles.toggleLabelActive,
                ]}
              >
                일회성
              </Text>
              <Text
                style={[
                  styles.toggleLabel,
                  !onetimeMode && styles.toggleLabelActive,
                ]}
              >
                정기 동선
              </Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>

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
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
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
  toggleButton: {
    width: '100%',
  },
  toggleBackground: {
    borderRadius: 24,
    height: 48,
    overflow: 'hidden',
  },
  toggleContent: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  toggleIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 120,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
  },
  toggleLabels: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
  },
  toggleLabel: {
    ...Typography.body,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    zIndex: 1,
  },
  toggleLabelActive: {
    color: '#fff',
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
    color: Colors.text,
    fontWeight: '600',
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
