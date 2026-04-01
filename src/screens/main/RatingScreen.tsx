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
  const { deliveryId, gillerId, gllerId } = route.params;

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<RatingTag[]>([]);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const targetUserId = useMemo(() => {
    const currentUserId = requireUserId();
    return currentUserId === gillerId ? gllerId : gillerId;
  }, [gillerId, gllerId]);

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
          <ActivityIndicator size="small" color="#FFFFFF" />
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
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  starButton: {
    padding: 8,
  },
  starText: {
    fontSize: 38,
    color: '#CBD5E1',
  },
  starTextActive: {
    color: '#F59E0B',
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
    backgroundColor: '#E2E8F0',
  },
  tagButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  tagButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tagButtonTextActive: {
    color: '#1D4ED8',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
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
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
