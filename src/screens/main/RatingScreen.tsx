/**
 * Rating Screen
 * 배송 완료 후 평가 (별점, 태그, 코멘트)
 * 개선사항: 드래프트 저장, 네트워크 에러 처리, 더 나은 UX
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { requireUserId } from '../../services/firebase';
import { submitRating, getUserRating } from '../../services/rating-service';
import { getDeliveryById } from '../../services/delivery-service';
import { RatingTag, RATING_TAGS } from '../../types/rating';

// Utils
import { retryWithBackoff, retryFirebaseQuery } from '../../utils/retry-with-backoff';
import { showErrorAlert, isNetworkError } from '../../utils/error-handler';
import { isNetworkAvailable } from '../../utils/network-detector';
import {
  saveRatingDraft,
  loadRatingDraft,
  deleteRatingDraft,
  type RatingDraft,
} from '../../utils/draft-storage';
import { SuccessOverlay } from '../../utils/success-animation';

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

export default function RatingScreen({ navigation, route }: Props) {
  const { deliveryId, gillerId, gllerId } = route.params;
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<RatingTag[]>([]);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [opponentRating, setOpponentRating] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);

  useEffect(() => {
    loadData();
    loadDraft();
  }, [deliveryId, gillerId, gllerId]);

  // Auto-save draft when rating data changes
  useEffect(() => {
    if (rating > 0 || selectedTags.length > 0 || comment) {
      const draft: RatingDraft = {
        rating,
        selectedTags,
        comment,
        isAnonymous,
      };
      saveRatingDraft(deliveryId, draft);
    }
  }, [rating, selectedTags, comment, isAnonymous, deliveryId]);

  const loadData = async () => {
    setLoadingData(true);

    try {
      const userId = requireUserId();
      const isGiller = userId === gillerId;

      const targetUserId = isGiller ? gllerId : gillerId;

      const [ratingData, deliveryData] = await Promise.all([
        retryFirebaseQuery(() => getUserRating(targetUserId)),
        retryFirebaseQuery(() => getDeliveryById(deliveryId)),
      ]);

      setOpponentRating(ratingData);
      setDelivery(deliveryData);
    } catch (error) {
      console.error('Error loading data:', error);
      showErrorAlert(error, loadData);
    } finally {
      setLoadingData(false);
    }
  };

  const loadDraft = async () => {
    try {
      const draft = await loadRatingDraft(deliveryId);
      if (draft && (draft.rating > 0 || draft.selectedTags.length > 0 || draft.comment)) {
        setShowDraftRestore(true);
        // Store draft data for restore
        (window as any).__ratingDraft = draft;
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  const restoreDraft = () => {
    const draft = (window as any).__ratingDraft as RatingDraft;
    if (draft) {
      setRating(draft.rating);
      setSelectedTags(draft.selectedTags);
      setComment(draft.comment);
      setIsAnonymous(draft.isAnonymous);
      setShowDraftRestore(false);
    }
  };

  const discardDraft = async () => {
    await deleteRatingDraft(deliveryId);
    setShowDraftRestore(false);
    delete (window as any).__ratingDraft;
  };

  const toggleTag = useCallback((tag: RatingTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert('평점 필요', '별점을 선택해주세요.');
      return;
    }

    // Check network
    const isOnline = await isNetworkAvailable();
    if (!isOnline) {
      Alert.alert(
        '네트워크 오류',
        '인터넷 연결을 확인해주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '다시 시도', onPress: handleSubmitRating },
        ]
      );
      return;
    }

    setLoading(true);
    setIsRetrying(false);

    try {
      const userId = requireUserId();
      const isGiller = userId === gillerId;
      const targetUserId = isGiller ? gllerId : gillerId;

      await retryWithBackoff(
        () => submitRating(
          deliveryId,
          userId,
          targetUserId,
          rating,
          selectedTags,
          comment.trim(),
          isAnonymous
        ),
        {
          maxAttempts: 3,
          timeoutMs: 20000,
          onRetry: (attempt) => {
            setIsRetrying(true);
            console.log(`Retry attempt ${attempt}...`);
          },
        }
      );

      // Clear draft after successful submission
      await deleteRatingDraft(deliveryId);

      // Show success animation
      setShowSuccess(true);

      // Navigate after animation
      setTimeout(() => {
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
      }, 1500);
    } catch (error) {
      console.error('Error submitting rating:', error);
      showErrorAlert(error, handleSubmitRating);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  const renderStar = useCallback((index: number) => {
    const filled = index <= rating;
    return (
      <TouchableOpacity
        key={index}
        style={styles.starButton}
        onPress={() => setRating(index)}
        activeOpacity={0.7}
        accessibilityLabel={`별 ${index}점`}
        accessibilityState={{ selected: filled }}
        accessibilityHint={`${index}점 평가하기`}
      >
        <Text style={[styles.star, filled && styles.starFilled]}>
          {filled ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    );
  }, [rating]);

  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>배송 평가</Text>
          <Text style={styles.subtitle}>배송은 어떠셨나요?</Text>
        </View>

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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>별점</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(renderStar)}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingText}>{rating}점 선택</Text>
          )}
        </View>

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
                  accessibilityLabel={`태그 ${tag.label}`}
                  accessibilityState={{ selected: isSelected }}
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
            maxLength={500}
            accessibilityLabel="코멘트 입력"
          />
          <Text style={styles.charCount}>{comment.length}/500</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>익명으로 평가하기</Text>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: '#e0e0e0', true: '#FF9800' }}
              thumbColor={isAnonymous ? '#fff' : '#f5f5f5'}
              accessibilityLabel="익명 평가"
              accessibilityState={{ checked: isAnonymous }}
            />
          </View>
          <Text style={styles.switchDescription}>
            익명으로 평가하면 상대방에게 평가자 정보가 공개되지 않습니다.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmitRating}
          disabled={rating === 0 || loading}
          accessibilityLabel="평가 완료"
        >
          {loading ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.submitButtonText}>
                {isRetrying ? '제출 중...' : '제출 중...'}
              </Text>
            </>
          ) : (
            <Text style={styles.submitButtonText}>평가 완료</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Draft restore modal */}
      {showDraftRestore && (
        <View style={styles.draftModalOverlay}>
          <View style={styles.draftModal}>
            <Text style={styles.draftModalTitle}>이전 평가 내역이 있습니다</Text>
            <Text style={styles.draftModalText}>
              이전에 작성 중이던 평가 내역이 있습니다. 이어서 작성하시겠습니까?
            </Text>
            <View style={styles.draftModalButtons}>
              <TouchableOpacity
                style={styles.draftModalButtonSecondary}
                onPress={discardDraft}
              >
                <Text style={styles.draftModalButtonTextSecondary}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.draftModalButton}
                onPress={restoreDraft}
              >
                <Text style={styles.draftModalButtonText}>이어서 작성</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Success Overlay */}
      <SuccessOverlay
        visible={showSuccess}
        message="평가 완료!"
        submessage="소중한 의견 감사합니다"
        duration={2000}
        onComplete={() => setShowSuccess(false)}
      />
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
  draftModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
  },
  draftModalButton: {
    alignItems: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  draftModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  draftModalButtonSecondary: {
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  draftModalButtonTextSecondary: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  draftModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  draftModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    zIndex: 1000,
  },
  draftModalText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  draftModalTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  header: {
    backgroundColor: '#FF9800',
    padding: 20,
    paddingBottom: 24,
    paddingTop: 60,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
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
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  switchLabel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  switchDescription: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
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
