/**
 * Rating Screen
 * 배송 완료 후 평가 (별점, 태그, 코멘트)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { requireUserId } from '../../services/firebase';
import { submitRating, getUserRating } from '../../services/rating-service';
import { getDeliveryById } from '../../services/delivery-service';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route: {
    params: {
      deliveryId: string;
      gillerId: string;
      gllerId: string;
    };
  };
}

interface RatingTag {
  id: string;
  label: string;
  emoji: string;
}

const RATING_TAGS: RatingTag[] = [
  { id: 'friendly', label: '친절함', emoji: '😊' },
  { id: 'fast', label: '빠름', emoji: '⚡' },
  { id: 'careful', label: '조심스러움', emoji: '👍' },
  { id: 'communicative', label: '소통 잘됨', emoji: '💬' },
  { id: 'onTime', label: '시간 지킴', emoji: '⏰' },
  { id: 'professional', label: '전문적', emoji: '👔' },
];

export default function RatingScreen({ navigation, route }: Props) {
  const { deliveryId, gillerId, gllerId } = route.params;
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [opponentRating, setOpponentRating] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);

  React.useEffect(() => {
    loadData();
  }, [deliveryId, gillerId, gllerId]);

  const loadData = async () => {
    try {
      const userId = requireUserId();
      const isGiller = userId === gillerId;

      const targetUserId = isGiller ? gllerId : gillerId;
      const [ratingData, deliveryData] = await Promise.all([
        getUserRating(targetUserId),
        getDeliveryById(deliveryId),
      ]);

      setOpponentRating(ratingData);
      setDelivery(deliveryData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert('평점 필요', '별점을 선택해주세요.');
      return;
    }

    setLoading(true);

    try {
      const userId = requireUserId();
      const isGiller = userId === gillerId;
      const targetUserId = isGiller ? gllerId : gillerId;

      const tagLabels = selectedTags.map((id) =>
        RATING_TAGS.find((tag) => tag.id === id)?.label
      ).join(', ');

      const fullComment = tagLabels
        ? `${comment}\n\n특징: ${tagLabels}`
        : comment;

      await submitRating(
        deliveryId,
        userId,
        targetUserId,
        rating,
        fullComment.trim()
      );

      Alert.alert(
        '감사합니다',
        '소중한 평가를 남겨주셔서 감사합니다!',
        [
          {
            text: '확인',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Tabs' }],
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('오류', '평가 제출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderStar = (index: number) => {
    const filled = index <= rating;
    return (
      <TouchableOpacity
        key={index}
        style={styles.starButton}
        onPress={() => setRating(index)}
        activeOpacity={0.7}
      >
        <Text style={[styles.star, filled && styles.starFilled]}>
          {filled ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>배송 평가</Text>
          <Text style={styles.subtitle}>배송은 어떠셨나요?</Text>
        </View>

        {/* Opponent Info */}
        {opponentRating && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>상대방 정보</Text>
            <View style={styles.ratingSummary}>
              <Text style={styles.averageRating}>
                ⭐ {opponentRating.averageRating.toFixed(1)}
              </Text>
              <Text style={styles.totalRatings}>
                총 {opponentRating.totalRatings}건의 평가
              </Text>
            </View>
          </View>
        )}

        {/* Star Rating */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>별점</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(renderStar)}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingText}>{rating}점 선택</Text>
          )}
        </View>

        {/* Tags */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>특징 선택 (선택)</Text>
          <View style={styles.tagsContainer}>
            {RATING_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagButton,
                    isSelected && styles.tagButtonSelected,
                  ]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                  <Text
                    style={[
                      styles.tagLabel,
                      isSelected && styles.tagLabelSelected,
                    ]}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Comment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>코멘트 (선택)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="추가 코멘트를 입력하세요"
            placeholderTextColor="#999"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{comment.length}/500</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmitRating}
          disabled={rating === 0 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>평가 완료</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  averageRating: {
    color: '#FFA726',
    fontSize: 24,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    margin: 16,
    marginBottom: 12,
    marginTop: 0,
    padding: 16,
  },
  cardTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  charCount: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  commentInput: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#333',
    fontSize: 14,
    minHeight: 120,
    padding: 12,
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FF9800',
    padding: 20,
    paddingBottom: 24,
    paddingTop: 60,
  },
  ratingSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  ratingText: {
    color: '#FFA726',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  star: {
    color: '#e0e0e0',
    fontSize: 48,
  },
  starButton: {
    padding: 4,
  },
  starFilled: {
    color: '#FFA726',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 12,
    margin: 16,
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  tagButton: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagButtonSelected: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  tagEmoji: {
    fontSize: 16,
  },
  tagLabel: {
    color: '#666',
    fontSize: 14,
  },
  tagLabelSelected: {
    color: '#FF9800',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  totalRatings: {
    color: '#666',
    fontSize: 14,
  },
});
