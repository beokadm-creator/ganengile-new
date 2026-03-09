/**
 * Badge Collection Screen
 * 배지 컬렉션 화면 - 사용자가 획득한 배지 확인
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { INITIAL_BADGES, getBadgesByCategory } from '../../data/badges';
import { BadgeCategory } from '../../types/user';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type CategoryTab = 'all' | BadgeCategory;

export default function BadgeCollectionScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userBadges, setUserBadges] = useState<{
    activity?: string[];
    quality?: string[];
    expertise?: string[];
    community?: string[];
  }>({});
  const [selectedCategory, setSelectedCategory] = useState<CategoryTab>('all');
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    // 실시간 사용자 배지 동기화
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserBadges(data.badges || {});
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const filteredBadges = selectedCategory === 'all'
    ? INITIAL_BADGES
    : getBadgesByCategory(selectedCategory);

  const isBadgeEarned = (badgeId: string) => {
    return Object.values(userBadges).flat().includes(badgeId);
  };

  const earnedCount = Object.values(userBadges).flat().length;
  const totalCount = INITIAL_BADGES.length;
  const progress = (earnedCount / totalCount) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>내 배지</Text>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {earnedCount}/{totalCount} ({Math.round(progress)}%)
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {(['all', BadgeCategory.ACTIVITY, BadgeCategory.QUALITY, BadgeCategory.EXPERTISE, BadgeCategory.COMMUNITY] as CategoryTab[]).map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryTab,
              selectedCategory === category && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === category && styles.categoryTabTextActive,
              ]}
            >
              {getCategoryLabel(category)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Badges Grid */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.badgesGrid}
          showsVerticalScrollIndicator={false}
        >
          {filteredBadges.map((badge) => {
            const earned = isBadgeEarned(badge.id);
            return (
              <TouchableOpacity
                key={badge.id}
                style={[
                  styles.badgeCard,
                  earned ? styles.badgeCardEarned : styles.badgeCardLocked,
                ]}
                onPress={() => {
                  setSelectedBadge({ ...badge, earned });
                  setShowModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>
                  {earned ? badge.icon : '🔒'}
                </Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                  {earned ? badge.name : '???'}
                </Text>
                <Text style={styles.badgeTier}>{getTierLabel(badge.tier)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Badge Detail Modal */}
      {showModal && selectedBadge && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>
              {selectedBadge.earned ? selectedBadge.icon : '🔒'}
            </Text>
            <Text style={styles.modalName}>
              {selectedBadge.earned ? selectedBadge.name : '???'}
            </Text>
            <Text style={styles.modalDescription}>
              {selectedBadge.earned
                ? selectedBadge.description
                : '배지를 획득하세요.'}
            </Text>
            <Text style={styles.modalRequirement}>
              조건: {getRequirementLabel(selectedBadge.requirement)}
            </Text>
            <View style={styles.modalTier}>
              <Text style={styles.modalTierText}>{getTierLabel(selectedBadge.tier)}</Text>
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function getCategoryLabel(category: CategoryTab): string {
  const labels: Record<CategoryTab, string> = {
    all: '전체',
    [BadgeCategory.ACTIVITY]: '활동',
    [BadgeCategory.QUALITY]: '품질',
    [BadgeCategory.EXPERTISE]: '전문성',
    [BadgeCategory.COMMUNITY]: '커뮤니티',
  };
  return labels[category];
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

function getRequirementLabel(requirement: any): string {
  const typeLabels: Record<string, string> = {
    completedDeliveries: `${requirement.value}건 배송 완료`,
    weeklyDeliveries: `일주일간 ${requirement.value}건 배송`,
    consecutiveWeeks: `${requirement.value}주 연속 주 ${requirement.minWeekly}건 이상`,
    consecutiveDeliveriesWithoutDelay: `${requirement.value}건 연속 지연 없음`,
    minRating: `평점 ${requirement.value} 이상 (${requirement.minDeliveries}건 이상)`,
    noShowCount: `노쇼 0회, ${requirement.completedDeliveries}건 완료`,
    uniqueLinesUsed: `${requirement.value}개 노선 이용`,
    transferDeliveries: `${requirement.value}건 환승 배송`,
    delayRate: `지연율 ${requirement.value * 100}% 미만 (${requirement.minDeliveries}건 이상)`,
    mentorCount: `${requirement.value}명 멘토링`,
    communityPosts: `커뮤니티 게시글 ${requirement.value}개`,
    monthlyTopRating: `월간 평점 ${requirement.value}위`,
    earlySignup: `출시 후 ${requirement.value}일 내 가입`,
  };
  return typeLabels[requirement.type] || '조건 없음';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  progressContainer: {
    marginTop: Spacing.sm,
  },
  progressText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  categoryTabs: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryTabsContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  categoryTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryTabText: {
    ...Typography.bodySmall,
    color: Colors.text,
  },
  categoryTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  badgeCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeCardEarned: {
    borderColor: Colors.primary,
  },
  badgeCardLocked: {
    borderColor: Colors.border,
    opacity: 0.6,
  },
  badgeIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  badgeIconLocked: {
    opacity: 0.3,
  },
  badgeName: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  badgeNameLocked: {
    color: Colors.textSecondary,
  },
  badgeTier: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  modalName: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modalDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  modalRequirement: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalTier: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  modalTierText: {
    ...Typography.bodySmall,
    color: '#fff',
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    width: '100%',
  },
  modalButtonText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});
