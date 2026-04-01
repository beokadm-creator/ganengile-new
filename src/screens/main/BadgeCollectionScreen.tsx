import { Colors } from '../../theme';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useUser } from '../../contexts/UserContext';
import {
  getBadgeCategoryLabel,
  getBadgeTierLabel,
  INITIAL_BADGES,
} from '../../data/badges';
import { BadgeCategory, BadgeTier, type User } from '../../types/user';

type CategoryFilter = 'all' | BadgeCategory;
type TierFilter = 'all' | BadgeTier;

type BadgeCard = {
  id: string;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  earned: boolean;
};

export default function BadgeCollectionScreen() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [earnedByCategory, setEarnedByCategory] = useState<User['badges'] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [selectedBadge, setSelectedBadge] = useState<BadgeCard | null>(null);

  useEffect(() => {
    const loadBadges = async (): Promise<void> => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const snapshot = await getDoc(doc(db, 'users', user.uid));
        const data = snapshot.exists() ? (snapshot.data() as User) : null;
        setEarnedByCategory(data?.badges ?? null);
      } catch (error) {
        console.error('Failed to load badge collection:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadBadges();
  }, [user?.uid]);

  const badges = useMemo<BadgeCard[]>(
    () =>
      INITIAL_BADGES.map((badge) => ({
        ...badge,
        earned: earnedByCategory?.[badge.category]?.includes(badge.id) ?? false,
      })),
    [earnedByCategory]
  );

  const earnedCount = useMemo(
    () => badges.filter((badge) => badge.earned).length,
    [badges]
  );

  const filtered = useMemo(
    () =>
      badges.filter((badge) => {
        if (categoryFilter !== 'all' && badge.category !== categoryFilter) {
          return false;
        }
        if (tierFilter !== 'all' && badge.tier !== tierFilter) {
          return false;
        }
        return true;
      }),
    [badges, categoryFilter, tierFilter]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>배지 컬렉션을 불러오고 있어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>배지 컬렉션</Text>
        <Text style={styles.subtitle}>
          활동, 품질, 전문성, 커뮤니티 배지를 모으면서 길러의 신뢰와 숙련도를 한눈에
          확인할 수 있어요.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>획득 현황</Text>
        <Text style={styles.summaryValue}>
          {earnedCount} / {INITIAL_BADGES.length}
        </Text>
        <Text style={styles.summaryBody}>
          지금까지 획득한 배지 수와 전체 카탈로그 수를 함께 보여줍니다.
        </Text>
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.sectionTitle}>카테고리</Text>
        <View style={styles.chipRow}>
          {(['all', BadgeCategory.ACTIVITY, BadgeCategory.QUALITY, BadgeCategory.EXPERTISE, BadgeCategory.COMMUNITY] as const).map(
            (value) => {
              const active = categoryFilter === value;
              const label = value === 'all' ? '전체' : getBadgeCategoryLabel(value);
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, active ? styles.chipActive : undefined]}
                  onPress={() => setCategoryFilter(value)}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        <Text style={styles.sectionTitle}>티어</Text>
        <View style={styles.chipRow}>
          {(['all', BadgeTier.BRONZE, BadgeTier.SILVER, BadgeTier.GOLD, BadgeTier.PLATINUM] as const).map(
            (value) => {
              const active = tierFilter === value;
              const label = value === 'all' ? '전체' : getBadgeTierLabel(value);
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, active ? styles.chipActive : undefined]}
                  onPress={() => setTierFilter(value)}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>
      </View>

      {filtered.map((badge) => (
        <TouchableOpacity
          key={badge.id}
          style={[styles.card, !badge.earned ? styles.cardMuted : undefined]}
          onPress={() => setSelectedBadge(badge)}
        >
          <Text style={styles.badgeIcon}>{badge.earned ? badge.icon : '🔒'}</Text>
          <View style={styles.badgeCopy}>
            <Text style={styles.badgeTitle}>{badge.earned ? badge.name : '잠금 배지'}</Text>
            <Text style={styles.badgeBody}>
              {badge.earned ? badge.description : '아직 획득하지 않은 배지입니다.'}
            </Text>
            <Text style={styles.badgeMeta}>
              {getBadgeCategoryLabel(badge.category)} · {getBadgeTierLabel(badge.tier)} ·{' '}
              {badge.earned ? '획득 완료' : '미획득'}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <Modal
        visible={Boolean(selectedBadge)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>{selectedBadge?.earned ? selectedBadge.icon : '🔒'}</Text>
            <Text style={styles.modalTitle}>{selectedBadge?.earned ? selectedBadge?.name : '잠금 배지'}</Text>
            <Text style={styles.modalBody}>
              {selectedBadge?.earned
                ? selectedBadge.description
                : '해당 배지는 아직 획득 전입니다. 활동을 이어가면 조건을 채울 수 있어요.'}
            </Text>
            <Text style={styles.modalMeta}>
              {selectedBadge ? getBadgeCategoryLabel(selectedBadge.category) : ''} ·{' '}
              {selectedBadge ? getBadgeTierLabel(selectedBadge.tier) : ''}
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setSelectedBadge(null)}>
              <Text style={styles.primaryButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 16 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary },
  summaryCard: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary },
  summaryValue: { fontSize: 30, fontWeight: '800', color: Colors.surface },
  summaryBody: { fontSize: 14, lineHeight: 20, color: Colors.border },
  filterCard: { backgroundColor: Colors.surface, borderRadius: 24, padding: 20, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryMint },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    gap: 14,
  },
  cardMuted: { opacity: 0.62 },
  badgeIcon: { fontSize: 30 },
  badgeCopy: { flex: 1, gap: 4 },
  badgeTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  badgeBody: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  badgeMeta: { fontSize: 12, color: Colors.textSecondary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  modalIcon: { fontSize: 42 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalBody: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center' },
  modalMeta: { fontSize: 13, color: Colors.textSecondary },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: { fontSize: 14, fontWeight: '700', color: Colors.surface },
});
