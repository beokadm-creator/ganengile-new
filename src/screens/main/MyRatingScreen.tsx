import { Colors } from '../../theme';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  type DimensionValue,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useUser } from '../../contexts/UserContext';
import { getUserRating, getUserRatingStats, getUserReviews } from '../../services/rating-service';
import { RATING_TAGS, RatingTag, type ReviewItem } from '../../types/rating';

type RatingSummary = {
  averageRating: number;
  totalRatings: number;
  distribution: { [key: number]: number };
};

function getBarWidth(summary: RatingSummary, star: number): DimensionValue {
  if (summary.totalRatings <= 0) {
    return '0%';
  }

  const count = summary.distribution[star] ?? 0;
  return `${(count / summary.totalRatings) * 100}%`;
}

export default function MyRatingScreen() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RatingSummary>({
    averageRating: 0,
    totalRatings: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [tagStats, setTagStats] = useState<Record<RatingTag, number>>({
    [RatingTag.FRIENDLY]: 0,
    [RatingTag.FAST]: 0,
    [RatingTag.TRUSTWORTHY]: 0,
    [RatingTag.COMMUNICATIVE]: 0,
    [RatingTag.PUNCTUAL]: 0,
  });
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    const loadRatings = async (): Promise<void> => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [nextSummary, nextStats, nextReviews] = await Promise.all([
          getUserRating(user.uid),
          getUserRatingStats(user.uid),
          getUserReviews(user.uid, 10),
        ]);
        setSummary(nextSummary);
        setTagStats(nextStats.tagStats);
        setReviews(nextReviews);
      } catch (error) {
        console.error('Failed to load rating summary:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadRatings();
  }, [user?.uid]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>평점 요약을 불러오고 있어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>내 평점</Text>
        <Text style={styles.subtitle}>
          배송 이후 받은 평균 점수와 최근 리뷰를 함께 확인할 수 있어요.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.score}>{summary.averageRating.toFixed(1)}</Text>
        <Text style={styles.scoreMeta}>총 {summary.totalRatings}건의 평가</Text>
        {[5, 4, 3, 2, 1].map((star) => (
          <View key={star} style={styles.distributionRow}>
            <Text style={styles.distributionLabel}>{star}점</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: getBarWidth(summary, star) }]} />
            </View>
            <Text style={styles.distributionCount}>{summary.distribution[star] ?? 0}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>태그 통계</Text>
        {RATING_TAGS.map((tag) => (
          <View key={tag.id} style={styles.tagRow}>
            <Text style={styles.tagLabel}>
              {tag.emoji} {tag.label}
            </Text>
            <Text style={styles.tagValue}>{tagStats[tag.id]}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>최근 리뷰</Text>
        {reviews.length === 0 ? (
          <Text style={styles.emptyText}>아직 받은 리뷰가 없어요.</Text>
        ) : (
          reviews.map((review) => (
            <View key={review.ratingId} style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>
                {review.isAnonymous ? '익명' : review.fromUser.name}
              </Text>
              <Text style={styles.reviewMeta}>
                {new Date(review.createdAt).toLocaleDateString('ko-KR')} · {review.rating.toFixed(1)}점
              </Text>
              {review.comment ? <Text style={styles.reviewBody}>{review.comment}</Text> : null}
            </View>
          ))
        )}
      </View>
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
  card: { backgroundColor: Colors.surface, borderRadius: 24, padding: 20, gap: 12 },
  score: { fontSize: 42, fontWeight: '800', color: Colors.textPrimary },
  scoreMeta: { fontSize: 14, color: Colors.textSecondary },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  distributionLabel: { width: 32, fontSize: 13, color: Colors.textSecondary },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: Colors.primary },
  distributionCount: { width: 24, fontSize: 12, textAlign: 'right', color: Colors.textSecondary },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  tagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagLabel: { fontSize: 14, color: Colors.textPrimary },
  tagValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  reviewCard: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, gap: 4 },
  reviewTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  reviewMeta: { fontSize: 12, color: Colors.textSecondary },
  reviewBody: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
