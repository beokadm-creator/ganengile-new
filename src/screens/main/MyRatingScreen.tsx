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
import { getUserRating } from '../../services/rating-service';
import { useUser } from '../../contexts/UserContext';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  from: string;
  date: string;
}

// 더미데이터
const dummyReviews: Review[] = [
  {
    id: '1',
    rating: 5,
    comment: '친절하게 잘 전달해주셨어요! 다시 이용하고 싶어요 👍',
    from: '김*현',
    date: '2026-02-10',
  },
  {
    id: '2',
    rating: 5,
    comment: '빠르고 정확했어요',
    from: '이*민',
    date: '2026-02-09',
  },
  {
    id: '3',
    rating: 4,
    comment: '좋았습니다. 조금 늦었지만 양해했습니다.',
    from: '박*진',
    date: '2026-02-08',
  },
  {
    id: '4',
    rating: 5,
    comment: '완벽해요! 최고의 길러입니다',
    from: '최*수',
    date: '2026-02-07',
  },
  {
    id: '5',
    rating: 5,
    comment: '매번 친절하게 해주세요!',
    from: '정*우',
    date: '2026-02-06',
  },
];

export default function MyRatingScreen({ navigation }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<{ averageRating: number; totalRatings: number }>({
    averageRating: 0,
    totalRatings: 0,
  });
  const [reviews, setReviews] = useState<Review[]>(dummyReviews);

  useEffect(() => {
    loadRating();
  }, []);

  const loadRating = async () => {
    if (!user) return;

    try {
      const userRating = await getUserRating(user.uid);
      setRating(userRating);
    } catch (error) {
      console.error('Error loading rating:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(Math.floor(rating));
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review) => {
      distribution[review.rating as keyof typeof distribution]++;
    });
    return distribution;
  };

  const distribution = getRatingDistribution();

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 평가</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Rating Summary */}
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
                        width: `${(distribution[star as keyof typeof distribution] / reviews.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.ratingCount}>
                  {distribution[star as keyof typeof distribution]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Reviews List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 리뷰</Text>

          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAuthor}>
                  <Text style={styles.authorName}>{review.from}</Text>
                  <Text style={styles.reviewDate}>{review.date}</Text>
                </View>
                <Text style={styles.reviewStars}>{renderStars(review.rating)}</Text>
              </View>

              {review.comment && (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              )}
            </View>
          ))}
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
});
