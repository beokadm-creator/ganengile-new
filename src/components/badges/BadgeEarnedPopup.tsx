/**
 * Badge Earned Popup
 * 배지 획득 팝업 - 새 배지를 획득했을 때 표시
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
} from 'react-native';
import { findBadgeById } from '../../data/badges';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BadgeEarnedPopupProps {
  visible: boolean;
  badgeId: string | null;
  onClose: () => void;
}

export default function BadgeEarnedPopup({
  visible,
  badgeId,
  onClose,
}: BadgeEarnedPopupProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.5));
  const badge = badgeId ? findBadgeById(badgeId) : null;

  useEffect(() => {
    if (visible) {
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

      // 5초 후 자동 닫기
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      // 애니메이션 리셋
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.5,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!badge) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* 배지 아이콘 */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{badge.icon}</Text>
          </View>

          {/* 축하 메시지 */}
          <Text style={styles.congratsText}>🎉 새 배지 획득! 🎉</Text>

          {/* 배지 이름 */}
          <Text style={styles.badgeName}>{badge.name}</Text>

          {/* 배지 설명 */}
          <Text style={styles.badgeDescription}>{badge.description}</Text>

          {/* 등급 라벨 */}
          <View style={[styles.tierBadge, { backgroundColor: getTierColor(badge.tier) }]}>
            <Text style={styles.tierText}>{getTierLabel(badge.tier)}</Text>
          </View>

          {/* 카테고리 라벨 */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{getCategoryLabel(badge.category)}</Text>
          </View>

          {/* 닫기 버튼 */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>확인</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    BRONZE: '#CD7F32',
    SILVER: '#C0C0C0',
    GOLD: '#FFD700',
    PLATINUM: '#E5E4E2',
  };
  return colors[tier] || '#999';
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    BRONZE: 'Bronze',
    SILVER: 'Silver',
    GOLD: 'Gold',
    PLATINUM: 'Platinum',
  };
  return labels[tier] || tier;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    activity: '활동',
    quality: '품질',
    expertise: '전문성',
    community: '커뮤니티',
  };
  return labels[category] || category;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  icon: {
    fontSize: 64,
  },
  congratsText: {
    ...Typography.h3,
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  badgeName: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  badgeDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  tierBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  tierText: {
    ...Typography.bodySmall,
    color: '#fff',
    fontWeight: '600',
  },
  categoryBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  categoryText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  closeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    width: '100%',
  },
  closeButtonText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});
