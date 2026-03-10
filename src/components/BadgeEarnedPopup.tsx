/**
 * Badge Earned Popup Component
 * 배지 획득 팝업 (P0-2)
 *
 * 기능:
 * - 배지 획득 시 애니메이션 팝업
 * - 배지 아이콘, 이름, 설명 표시
 * - "확인" 버튼으로 닫기
 * - 배지 획득 로그 기록
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { findBadgeById } from '../../data/badges';
import { Badge } from '../../types/user';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface Props {
  visible: boolean;
  badgeId: string;
  onClose: () => void;
  onShare?: () => void;
}

export default function BadgeEarnedPopup({ visible, badgeId, onClose, onShare }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.5));
  const [badge, setBadge] = useState<Omit<Badge, 'createdAt'> | null>(null);

  useEffect(() => {
    if (visible && badgeId) {
      const badgeData = findBadgeById(badgeId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBadge(badgeData || null);

      // 애니메이션 시작
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // 애니메이션 초기화
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
    }
  }, [visible, badgeId]);

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'bronze':
        return '#CD7F32';
      case 'silver':
        return '#C0C0C0';
      case 'gold':
        return '#FFD700';
      case 'platinum':
        return '#E5E4E2';
      default:
        return '#CD7F32';
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
    }
    onClose();
  };

  if (!badge) return null;

  const tierColor = getTierColor(badge.tier);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* 배경 오버레이 */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* 빛나는 효과 */}
          <View style={[styles.glowEffect, { backgroundColor: tierColor }]} />

          {/* 배지 컨테이너 */}
          <View style={styles.badgeContainer}>
            {/* 배지 아이콘 */}
            <View style={[styles.badgeIconContainer, { borderColor: tierColor }]}>
              <Animated.View
                style={[
                  styles.badgeIconGlow,
                  {
                    backgroundColor: tierColor,
                  },
                ]}
              />
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
            </View>

            {/* "배지 획득!" 텍스트 */}
            <Text style={styles.congratulationsText}>🎉 배지 획득! 🎉</Text>

            {/* 배지 이름 */}
            <Text style={styles.badgeName}>{badge.name}</Text>

            {/* 배지 설명 */}
            <Text style={styles.badgeDescription}>{badge.description}</Text>

            {/* 티어 뱃지 */}
            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
              <Text style={styles.tierBadgeText}>{badge.tier.toUpperCase()}</Text>
            </View>

            {/* 버튼 컨테이너 */}
            <View style={styles.buttonContainer}>
              {/* 공유 버튼 (선택사항) */}
              {onShare && (
                <TouchableOpacity
                  style={[styles.button, styles.shareButton]}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Text style={styles.shareButtonText}>공유하기</Text>
                </TouchableOpacity>
              )}

              {/* 확인 버튼 */}
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 350,
  },
  glowEffect: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    borderRadius: 20,
    opacity: 0.3,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  badgeContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  badgeIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  badgeIconGlow: {
    position: 'absolute',
    width: '150%',
    height: '150%',
    borderRadius: 75,
    opacity: 0.2,
  },
  badgeIcon: {
    fontSize: 48,
    zIndex: 1,
  },
  congratulationsText: {
    ...Typography.h2,
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  badgeName: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  badgeDescription: {
    ...Typography.body1,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  tierBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    alignSelf: 'center',
  },
  tierBadgeText: {
    ...Typography.body1,
    color: Colors.white,
    fontWeight: '700',
    letterSpacing: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  shareButtonText: {
    ...Typography.body1,
    color: Colors.primary,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmButtonText: {
    ...Typography.body1,
    color: Colors.white,
    fontWeight: '600',
  },
});
