import { Colors } from '../../theme';
import { Typography } from '../../theme/typography';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { submitRating } from '../../services/rating-service';
import { RatingTag, RATING_TAGS } from '../../types/rating';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

type RatingRoute = RouteProp<MainStackParamList, 'Rating'>;

export default function RatingScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<RatingRoute>();
  const { deliveryId, gillerId, requesterId, gllerId } = route.params;
  const resolvedRequesterId = requesterId ?? gllerId ?? '';

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<RatingTag[]>([]);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const targetUserId = useMemo(() => {
    const currentUserId = requireUserId();
    return currentUserId === gillerId ? resolvedRequesterId : gillerId;
  }, [gillerId, resolvedRequesterId]);

  const toggleTag = (tag: RatingTag): void => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const handleSubmit = async (): Promise<void> => {
    if (rating < 1 || rating > 5) {
      Alert.alert('평점을 선택해 주세요', '별점을 먼저 고른 뒤 제출할 수 있어요.');
      return;
    }

    try {
      setLoading(true);
      const currentUserId = requireUserId();
      await submitRating(
        deliveryId,
        currentUserId,
        targetUserId,
        rating,
        selectedTags,
        comment.trim(),
        isAnonymous
      );

      Alert.alert('평가가 저장됐어요', '남겨주신 평가는 신뢰도와 운영 품질 개선에 반영됩니다.', [
        {
          text: '홈으로 이동',
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Tabs', params: { screen: 'Home' } }],
            }),
        },
      ]);
    } catch (error) {
      console.error('Failed to submit rating:', error);
      Alert.alert('평가 저장 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>배송 평가</Text>
        <Text style={styles.subtitle}>
          이번 배송 경험을 남겨 주세요. 평점과 태그는 길러 신뢰도와 운영 품질 점검에 함께 반영됩니다.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>별점</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              style={styles.starButton}
              onPress={() => setRating(value)}
            >
              <Text style={[styles.starText, value <= rating ? styles.starTextActive : undefined]}>
                ★
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>인상 태그</Text>
        <View style={styles.tagGrid}>
          {RATING_TAGS.map((tag) => {
            const active = selectedTags.includes(tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                style={[styles.tagButton, active ? styles.tagButtonActive : undefined]}
                onPress={() => toggleTag(tag.id)}
              >
                <Text style={[styles.tagButtonText, active ? styles.tagButtonTextActive : undefined]}>
                  {tag.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={[styles.input, styles.commentInput]}
          placeholder="운영팀과 상대방에게 도움이 될 내용을 적어 주세요"
          value={comment}
          onChangeText={setComment}
          multiline
        />
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.sectionTitle}>익명 리뷰</Text>
            <Text style={styles.helperText}>이름을 숨기고 리뷰 내용만 전달합니다.</Text>
          </View>
          <Switch value={isAnonymous} onValueChange={setIsAnonymous} />
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSubmit()} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>평가 제출</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: Colors.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  starButton: {
    padding: 8,
  },
  starText: {
    fontSize: 38, // star rating display — intentionally large
    color: Colors.border,
  },
  starTextActive: {
    color: Colors.warning,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  tagButtonActive: {
    backgroundColor: Colors.primaryMint,
  },
  tagButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  tagButtonTextActive: {
    color: Colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: Typography.fontSize.base,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  commentInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchTextWrap: {
    flex: 1,
    gap: 4,
  },
  helperText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },
});
