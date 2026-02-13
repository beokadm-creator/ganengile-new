/**
 * My Rating Screen
 * 내 평가 화면
 * 받은 평점, 리뷰 목록
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getUserRating, getUserRatingStats, getUserReviews } from '../../services/rating-service';
import { useUser } from '../../contexts/UserContext';
import { RATING_TAGS, RatingTag } from '../../types/rating';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

export default function MyRatingScreen({ navigation }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<{
    averageRating: number;
    totalRatings: number;
    distribution: { [key: number]: number };
  }>({
    averageRating: 0,
    totalRatings: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [tagStats, setTagStats] = useState<{ [key in RatingTag]: number }>({
    [RatingTag.FRIENDLY]: 0,
    [RatingTag.FAST]: 0,
    [RatingTag.TRUSTWORTHY]: 0,
    [RatingTag.COMMUNICATIVE]: 0,
    [RatingTag.PUNCTUAL]: 0,
  });
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const [userRating, userStats, userReviews] = await Promise.all([
        getUserRating(user.uid),
        getUserRatingStats(user.uid),
        getUserReviews(user.uid, 10),
      ]);

      setRating(userRating);
      setTagStats(userStats.tagStats);
      setReviews(userReviews);
    } catch (error) {
      console.error('Error loading rating data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(Math.floor(rating));
  };

  const getTagName = (tag: RatingTag): string => {
    return RATING_TAGS.find((t) => t.id === tag)?.label || tag;
  };

  const distribution = rating.distribution;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFA726" />
        <Text style={styles.loadingText}>평가 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 평가</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.averageRating}>{rating.averageRating.toFixed(1)}</Text>
            <Text style={styles.stars}>{renderStars(rating.averageRating)}</Text>
            <Text style={styles.totalRatings}>총 {rating.totalRatings}개 평가</Text>
          </View>

          <View style={styles.summaryRight}>
            {[5, 4, 3, 2, 1].map((star) => (
              <View key={star} style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>{star}점</Text>
                <View style={styles.ratingBarBg}>
                  <View
                    style={[
                      styles.ratingBarFill,
                      {
                        width: rating.totalRatings > 0
                          ? `${(distribution[star] / rating.totalRatings) * 100}%`
                          : '0%',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.ratingCount}>
                  {distribution[star]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>태그 통계</Text>
          <View style={styles.tagStatsContainer}>
            {RATING_TAGS.map((tag) => {
              const count = tagStats[tag.id];
              const percentage =
                rating.totalRatings > 0
                  ? Math.round((count / rating.totalRatings) * 100)
                  : 0;

              return (
                <View key={tag.id} style={styles.tagStatItem}>
                  <Text style={styles.statTagEmoji}>{tag.emoji}</Text>
                  <View style={styles.tagStatInfo}>
                    <Text style={styles.statTagLabel}>{tag.label}</Text>
                    <Text style={styles.tagCount}>
                      {count}회 ({percentage}%)
                    </Text>
                  </View>
                  <View style={styles.tagStatBarBg}>
                    <View
                      style={[
                        styles.tagStatBarFill,
                        { width: `${percentage}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 리뷰</Text>

          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>아직 받은 평가가 없습니다.</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.ratingId} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAuthor}>
                    <Text style={styles.authorName}>
                      {review.isAnonymous ? '익명' : review.fromUser.name}
                    </Text>
                    <Text style={styles.reviewDate}>
                      {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                    </Text>
                  </View>
                  <Text style={styles.reviewStars}>{renderStars(review.rating)}</Text>
                </View>

                {review.tags && review.tags.length > 0 && (
                  <View style={styles.reviewTags}>
                    {review.tags.map((tag: RatingTag) => (
                      <View key={tag} style={styles.reviewTag}>
                        <Text style={styles.reviewTagText}>
                          {getTagName(tag)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FFA726',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryLeft: {
    flex: 1,
    alignItems: 'center',
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  summaryRight: {
    flex: 2,
    paddingLeft: 20,
    justifyContent: 'center',
  },
  averageRating: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFA726',
  },
  stars: {
    fontSize: 24,
    marginTop: 4,
  },
  totalRatings: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#666',
    width: 30,
  },
  ratingBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#FFA726',
    borderRadius: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#666',
    width: 20,
    textAlign: 'right',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewAuthor: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  reviewStars: {
    fontSize: 16,
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  tagStatsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tagStatItem: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statTagEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  statTagLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  tagStatInfo: {
    flex: 1,
  },
  tagCount: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  tagStatBarBg: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  tagStatBarFill: {
    height: '100%',
    backgroundColor: '#FFA726',
    borderRadius: 3,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  reviewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  reviewTag: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reviewTagText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: '500',
  },
});
