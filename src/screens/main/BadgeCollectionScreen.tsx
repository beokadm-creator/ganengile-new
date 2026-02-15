/**
 * Badge Collection Screen
 * 배지 컬렉션 화면 (P0-1)
 *
 * 기능:
 * - 카테고리별/티어별 필터링
 * - 보유한 배지 컬러 표시
 * - 미획득 배지 흑백 표시
 * - 배지 상세 모달
 * - 획득 일자 표시
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { INITIAL_BADGES, getBadgesByCategory, getBadgesByTier, findBadgeById } from '../../data/badges';
import { BadgeCategory, BadgeTier, User } from '../../types/user';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

type FilterType = 'all' | 'category' | 'tier';
type CategoryFilter = 'all' | BadgeCategory;
type TierFilter = 'all' | BadgeTier;

interface BadgeWithStatus {
  id: string;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  earned: boolean;
  earnedAt?: Date;
}

export default function BadgeCollectionScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [userBadges, setUserBadges] = useState<User['badges'] | null>(null);
  const [badgeEarnedAt, setBadgeEarnedAt] = useState<Record<string, Date>>({});
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [selectedBadge, setSelectedBadge] = useState<BadgeWithStatus | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // 사용자 배지 데이터 로드
  useEffect(() => {
    loadUserBadges();
  }, []);

  const loadUserBadges = async () => {
    try {
      const db = getFirestore();
      const userId = 'current_user_id'; // 실제로는 Auth에서 가져옴
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const user = userDoc.data() as User;
        setUserBadges(user.badges || {});

        // 배지 획득일 로드
        const earnedAt: Record<string, Date> = {};

        // 사용자 문서에서 badgeEarnedAt 필드 가져오기 (있는 경우)
        if (user.badgeEarnedAt) {
          Object.entries(user.badgeEarnedAt).forEach(([badgeId, timestamp]) => {
            if (timestamp instanceof Date) {
              earnedAt[badgeId] = timestamp;
            } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
              // Firebase Timestamp
              earnedAt[badgeId] = timestamp.toDate();
            } else if (typeof timestamp === 'number') {
              // Unix timestamp (milliseconds)
              earnedAt[badgeId] = new Date(timestamp);
            }
          });
        } else {
          // badgeEarnedAt 필드가 없는 경우, 모든 배지를 현재 시간으로 설정 (임시)
          // 추후 배지 획득 시 실제 시간을 저장하도록 수정 필요
          Object.values(user.badges || {}).flat().forEach((badgeId) => {
            earnedAt[badgeId] = new Date(); // 임시: 현재 시간
          });
        }

        setBadgeEarnedAt(earnedAt);
      }
    } catch (error) {
      console.error('Error loading user badges:', error);
    } finally {
      setLoading(false);
    }
  };

  // 배지 상태 계산
  const badgesWithStatus: BadgeWithStatus[] = useMemo(() => {
    return INITIAL_BADGES.map((badge) => {
      const category = badge.category;
      const earned = userBadges?.[category]?.includes(badge.id) || false;

      return {
        ...badge,
        earned,
        earnedAt: badgeEarnedAt[badge.id],
      };
    });
  }, [userBadges, badgeEarnedAt]);

  // 필터링된 배지
  const filteredBadges = useMemo(() => {
    let filtered = badgesWithStatus;

    if (filterType === 'category' && categoryFilter !== 'all') {
      filtered = filtered.filter((badge) => badge.category === categoryFilter);
    }

    if (filterType === 'tier' && tierFilter !== 'all') {
      filtered = filtered.filter((badge) => badge.tier === tierFilter);
    }

    return filtered;
  }, [badgesWithStatus, filterType, categoryFilter, tierFilter]);

  // 배지 카테고리 라벨
  const getCategoryLabel = (category: BadgeCategory): string => {
    switch (category) {
      case BadgeCategory.ACTIVITY:
        return '활동';
      case BadgeCategory.QUALITY:
        return '품질';
      case BadgeCategory.EXPERTISE:
        return '전문성';
      case BadgeCategory.COMMUNITY:
        return '커뮤니티';
    }
  };

  // 배지 티어 라벨
  const getTierLabel = (tier: BadgeTier): string => {
    switch (tier) {
      case BadgeTier.BRONZE:
        return '브론즈';
      case BadgeTier.SILVER:
        return '실버';
      case BadgeTier.GOLD:
        return '골드';
      case BadgeTier.PLATINUM:
        return '플래티넘';
    }
  };

  // 배지 티어 색상
  const getTierColor = (tier: BadgeTier): string => {
    switch (tier) {
      case BadgeTier.BRONZE:
        return '#CD7F32'; // Bronze
      case BadgeTier.SILVER:
        return '#C0C0C0'; // Silver
      case BadgeTier.GOLD:
        return '#FFD700'; // Gold
      case BadgeTier.PLATINUM:
        return '#E5E4E2'; // Platinum
    }
  };

  // 배지 카드 렌더
  const renderBadgeCard = (badge: BadgeWithStatus) => {
    const tierColor = getTierColor(badge.tier);

    return (
      <TouchableOpacity
        key={badge.id}
        style={[
          styles.badgeCard,
          badge.earned ? styles.badgeCardEarned : styles.badgeCardNotEarned,
        ]}
        onPress={() => {
          setSelectedBadge(badge);
          setModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        {/* 배지 아이콘 */}
        <View
          style={[
            styles.badgeIconContainer,
            badge.earned ? { borderColor: tierColor } : null,
          ]}
        >
          <Text style={[styles.badgeIcon, !badge.earned && styles.badgeIconNotEarned]}>
            {badge.icon}
          </Text>
        </View>

        {/* 배지 정보 */}
        <View style={styles.badgeInfo}>
          <Text style={[styles.badgeName, !badge.earned && styles.textNotEarned]}>
            {badge.name}
          </Text>
          <Text
            style={[styles.badgeDescription, !badge.earned && styles.textNotEarned]}
            numberOfLines={2}
          >
            {badge.description}
          </Text>

          {/* 티어 뱃지 */}
          <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
            <Text style={styles.tierBadgeText}>{getTierLabel(badge.tier)}</Text>
          </View>

          {/* 획득일 */}
          {badge.earned && badge.earnedAt && (
            <Text style={styles.earnedDate}>
              획득: {badge.earnedAt.toLocaleDateString('ko-KR')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // 필터 버튼 렌더
  const renderFilterButtons = () => {
    return (
      <View style={styles.filterContainer}>
        {/* 필터 타입 선택 */}
        <View style={styles.filterTypeContainer}>
          <TouchableOpacity
            style={[
              styles.filterTypeButton,
              filterType === 'all' && styles.filterTypeButtonActive,
            ]}
            onPress={() => setFilterType('all')}
          >
            <Text
              style={[
                styles.filterTypeText,
                filterType === 'all' && styles.filterTypeTextActive,
              ]}
            >
              전체
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTypeButton,
              filterType === 'category' && styles.filterTypeButtonActive,
            ]}
            onPress={() => setFilterType('category')}
          >
            <Text
              style={[
                styles.filterTypeText,
                filterType === 'category' && styles.filterTypeTextActive,
              ]}
            >
              카테고리
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTypeButton,
              filterType === 'tier' && styles.filterTypeButtonActive,
            ]}
            onPress={() => setFilterType('tier')}
          >
            <Text
              style={[
                styles.filterTypeText,
                filterType === 'tier' && styles.filterTypeTextActive,
              ]}
            >
              등급
            </Text>
          </TouchableOpacity>
        </View>

        {/* 카테고리 필터 */}
        {filterType === 'category' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryFilterScroll}
          >
            <TouchableOpacity
              style={[
                styles.categoryFilterButton,
                categoryFilter === 'all' && styles.categoryFilterButtonActive,
              ]}
              onPress={() => setCategoryFilter('all')}
            >
              <Text
                style={[
                  styles.categoryFilterText,
                  categoryFilter === 'all' && styles.categoryFilterTextActive,
                ]}
              >
                전체
              </Text>
            </TouchableOpacity>

            {Object.values(BadgeCategory).map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryFilterButton,
                  categoryFilter === category && styles.categoryFilterButtonActive,
                ]}
                onPress={() => setCategoryFilter(category)}
              >
                <Text
                  style={[
                    styles.categoryFilterText,
                    categoryFilter === category && styles.categoryFilterTextActive,
                  ]}
                >
                  {getCategoryLabel(category)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 티어 필터 */}
        {filterType === 'tier' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tierFilterScroll}
          >
            <TouchableOpacity
              style={[
                styles.tierFilterButton,
                tierFilter === 'all' && styles.tierFilterButtonActive,
              ]}
              onPress={() => setTierFilter('all')}
            >
              <Text
                style={[
                  styles.tierFilterText,
                  tierFilter === 'all' && styles.tierFilterTextActive,
                ]}
              >
                전체
              </Text>
            </TouchableOpacity>

            {Object.values(BadgeTier).map((tier) => (
              <TouchableOpacity
                key={tier}
                style={[
                  styles.tierFilterButton,
                  { borderColor: getTierColor(tier) },
                  tierFilter === tier && styles.tierFilterButtonActive,
                ]}
                onPress={() => setTierFilter(tier)}
              >
                <Text
                  style={[
                    styles.tierFilterText,
                    tierFilter === tier && styles.tierFilterTextActive,
                  ]}
                >
                  {getTierLabel(tier)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  // 배지 상세 모달
  const renderBadgeModal = () => {
    if (!selectedBadge) return null;

    const tierColor = getTierColor(selectedBadge.tier);

    return (
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {/* 배지 아이콘 */}
            <View
              style={[
                styles.modalBadgeIconContainer,
                { borderColor: tierColor },
                !selectedBadge.earned && styles.modalBadgeIconContainerNotEarned,
              ]}
            >
              <Text
                style={[
                  styles.modalBadgeIcon,
                  !selectedBadge.earned && styles.badgeIconNotEarned,
                ]}
              >
                {selectedBadge.icon}
              </Text>
            </View>

            {/* 배지 정보 */}
            <Text style={[styles.modalBadgeName, !selectedBadge.earned && styles.textNotEarned]}>
              {selectedBadge.name}
            </Text>

            <Text
              style={[styles.modalBadgeDescription, !selectedBadge.earned && styles.textNotEarned]}
            >
              {selectedBadge.description}
            </Text>

            {/* 티어와 카테고리 */}
            <View style={styles.modalBadges}>
              <View style={[styles.modalBadge, { backgroundColor: tierColor }]}>
                <Text style={styles.modalBadgeText}>{getTierLabel(selectedBadge.tier)}</Text>
              </View>

              <View style={styles.modalBadge}>
                <Text style={styles.modalBadgeText}>{getCategoryLabel(selectedBadge.category)}</Text>
              </View>
            </View>

            {/* 획득일 */}
            {selectedBadge.earned && selectedBadge.earnedAt && (
              <Text style={styles.modalEarnedDate}>
                획득: {selectedBadge.earnedAt.toLocaleDateString('ko-KR')}
              </Text>
            )}

            {/* 닫기 버튼 */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>배지를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>배지 컬렉션</Text>
        <Text style={styles.headerSubtitle}>
          획득한 배지: {badgesWithStatus.filter((b) => b.earned).length} / {badgesWithStatus.length}
        </Text>
      </View>

      {/* 필터 */}
      {renderFilterButtons()}

      {/* 배지 목록 */}
      <ScrollView
        style={styles.badgeList}
        contentContainerStyle={styles.badgeListContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredBadges.map((badge) => renderBadgeCard(badge))}

        {filteredBadges.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>표시할 배지가 없습니다</Text>
          </View>
        )}
      </ScrollView>

      {/* 배지 상세 모달 */}
      {renderBadgeModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
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
  filterContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  filterTypeContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  filterTypeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
  },
  filterTypeButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterTypeText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  filterTypeTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  categoryFilterScroll: {
    flexDirection: 'row',
  },
  categoryFilterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
  },
  categoryFilterButtonActive: {
    backgroundColor: Colors.primary,
  },
  categoryFilterText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  categoryFilterTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  tierFilterScroll: {
    flexDirection: 'row',
  },
  tierFilterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  tierFilterButtonActive: {
    backgroundColor: Colors.primary,
  },
  tierFilterText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  tierFilterTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  badgeList: {
    flex: 1,
  },
  badgeListContent: {
    padding: Spacing.md,
  },
  badgeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  badgeCardEarned: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  badgeCardNotEarned: {
    opacity: 0.5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    marginRight: Spacing.md,
  },
  badgeIcon: {
    fontSize: 32,
  },
  badgeIconNotEarned: {
    filter: 'grayscale(100%)',
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  badgeDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  tierBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },
  earnedDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  textNotEarned: {
    color: Colors.textDisabled,
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body1,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  modalBadgeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    marginBottom: Spacing.md,
  },
  modalBadgeIconContainerNotEarned: {
    borderWidth: 2,
    borderColor: Colors.border,
  },
  modalBadgeIcon: {
    fontSize: 40,
  },
  modalBadgeName: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modalBadgeDescription: {
    ...Typography.body1,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalBadges: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  modalBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    marginRight: Spacing.sm,
  },
  modalBadgeText: {
    ...Typography.body2,
    color: Colors.white,
    fontWeight: '600',
  },
  modalEarnedDate: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  closeButtonText: {
    ...Typography.body1,
    color: Colors.white,
    fontWeight: '600',
  },
});
