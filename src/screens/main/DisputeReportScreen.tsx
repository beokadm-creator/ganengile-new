/**
 * Dispute Report Screen
 * 분쟁 신고 화면 (P1-5)
 *
 * 기능:
 * - 분쟁 유형 선택 (파손, 분실, 지연, 기타)
 * - 사진 증거 업로드
 * - 상세 설명 입력
 * - 긴급도 선택
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { uploadPhoto } from '../../services/photo-service';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  // deliveryId나 matchId를 받을 수 있음
  deliveryId?: string;
  matchId?: string;
}

type DisputeType = 'damage' | 'loss' | 'delay' | 'other';
type UrgencyLevel = 'normal' | 'urgent' | 'critical';

interface DisputeData {
  type: DisputeType;
  description: string;
  photos: string[];
  urgency: UrgencyLevel;
  deliveryId?: string;
  matchId?: string;
}

export default function DisputeReportScreen({ navigation, deliveryId, matchId }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // 폼 데이터
  const [disputeType, setDisputeType] = useState<DisputeType | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');

  // 분쟁 유형
  const DISPUTE_TYPES: { type: DisputeType; label: string; description: string }[] = [
    {
      type: 'damage',
      label: '파손',
      description: '배송 물건이 파손되었을 때',
    },
    {
      type: 'loss',
      label: '분실',
      description: '배송 물건이 분실되었을 때',
    },
    {
      type: 'delay',
      label: '지연',
      description: '배송이 지연되었을 때',
    },
    {
      type: 'other',
      label: '기타',
      description: '그 외 문제가 발생했을 때',
    },
  ];

  // 긴급도
  const URGENCY_LEVELS: { level: UrgencyLevel; label: string; color: string }[] = [
    {
      level: 'normal',
      label: '일반',
      color: '#4CAF50', // Green
    },
    {
      level: 'urgent',
      label: '긴급',
      color: '#FF9800', // Orange
    },
    {
      level: 'critical',
      label: '매우 긴급',
      color: '#FF5252', // Red
    },
  ];

  const handlePhotoSelect = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const uploadedPhotos: string[] = [];

        for (const asset of result.assets) {
          if (asset.uri) {
            setLoading(true);
            const photoUrl = await uploadPhoto(asset.uri, 'disputes');
            uploadedPhotos.push(photoUrl);
            setLoading(false);
          }
        }

        setPhotos([...photos, ...uploadedPhotos]);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('오류', '사진을 선택할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // 유효성 검사
    if (!disputeType) {
      Alert.alert('필수 입력', '분쟁 유형을 선택해주세요.');
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert('필수 입력', '상세 설명을 10자 이상 입력해주세요.');
      return;
    }

    if (photos.length === 0) {
      Alert.alert('필수 입력', '증거 사진을 1장 이상 업로드해주세요.');
      return;
    }

    try {
      setSubmitting(true);

      const db = getFirestore();
      const userId = requireUserId();

      // 분쟁 데이터 생성
      const disputeData: DisputeData = {
        type: disputeType,
        description: description.trim(),
        photos,
        urgency,
        deliveryId,
        matchId,
      };

      // Firestore에 저장 (disputes 컬렉션)
      await addDoc(collection(db, 'disputes'), {
        ...disputeData,
        reporterId: userId,
        status: 'pending', // pending, investigating, resolved
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        '신고 완료',
        '분쟁 신고가 접수되었습니다.\n\n빠른 시간 내 조사 후 답변드리겠습니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting dispute:', error);
      Alert.alert('오류', '분쟁 신고를 제출할 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDisputeTypeIcon = (type: DisputeType): string => {
    switch (type) {
      case 'damage':
        return '💥';
      case 'loss':
        return '📦';
      case 'delay':
        return '⏰';
      case 'other':
        return '❓';
      default:
        return '';
    }
  };

  const renderDisputeTypeCard = (item: { type: DisputeType; label: string; description: string }) => {
    const isSelected = disputeType === item.type;
    const urgencyColor = URGENCY_LEVELS.find((u) => u.level === urgency)?.color || '#4CAF50';

    return (
      <TouchableOpacity
        key={item.type}
        style={[styles.disputeTypeCard, isSelected && styles.disputeTypeCardSelected]}
        onPress={() => setDisputeType(item.type)}
        activeOpacity={0.7}
      >
        <View style={styles.disputeTypeHeader}>
          <Text style={styles.disputeTypeIcon}>{getDisputeTypeIcon(item.type)}</Text>
          <View style={styles.disputeTypeHeaderRight}>
            <Text style={styles.disputeTypeLabel}>{item.label}</Text>
            {isSelected && (
              <View style={[styles.selectedBadge, { backgroundColor: urgencyColor }]}>
                <Text style={styles.selectedBadgeText}>선택</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.disputeTypeDescription}>{item.description}</Text>
      </TouchableOpacity>
    );
  };

  const renderPhotoItem = (photoUri: string, index: number) => {
    return (
      <View key={index} style={styles.photoItem}>
        <Image source={{ uri: photoUri }} style={styles.photoImage} />
        <TouchableOpacity
          style={styles.photoRemoveButton}
          onPress={() => {
            const updatedPhotos = [...photos];
            updatedPhotos.splice(index, 1);
            setPhotos(updatedPhotos);
          }}
        >
          <Text style={styles.photoRemoveButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderUrgencyLevel = (item: { level: UrgencyLevel; label: string; color: string }) => {
    const isSelected = urgency === item.level;

    return (
      <TouchableOpacity
        key={item.level}
        style={[styles.urgencyLevelCard, isSelected && styles.urgencyLevelCardSelected]}
        onPress={() => setUrgency(item.level)}
        activeOpacity={0.7}
      >
        <View style={[styles.urgencyDot, { backgroundColor: item.color }]} />
        <Text style={styles.urgencyLabel}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>분쟁 신고</Text>
        <Text style={styles.headerSubtitle}>
          배송 중 문제가 발생했을 때 신고해주세요
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 분쟁 유형 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>분쟁 유형</Text>
          <Text style={styles.sectionDescription}>
            문제 유형을 선택해주세요
          </Text>

          <View style={styles.disputeTypesGrid}>
            {DISPUTE_TYPES.map((item) => renderDisputeTypeCard(item))}
          </View>
        </View>

        {/* 긴급도 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>긴급도</Text>
          <Text style={styles.sectionDescription}>
            얼마나 긴급한 상황인지 선택해주세요
          </Text>

          <View style={styles.urgencyLevelsRow}>
            {URGENCY_LEVELS.map((item) => renderUrgencyLevel(item))}
          </View>
        </View>

        {/* 상세 설명 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>상세 설명</Text>
          <Text style={styles.sectionDescription}>
            최소 10자 이상 입력해주세요
          </Text>

          <TextInput
            style={styles.descriptionInput}
            placeholder="문제가 발생한 경위, 시간, 구체적인 내용을 설명해주세요..."
            multiline
            numberOfLines={6}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length} / 500</Text>
        </View>

        {/* 사진 증거 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>사진 증거</Text>
          <Text style={styles.sectionDescription}>
            최소 1장 이상 업로드해주세요 (최대 3장)
          </Text>

          <View style={styles.photosGrid}>
            {photos.map((photo, index) => renderPhotoItem(photo, index))}

            {photos.length < 3 && (
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={handlePhotoSelect}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Text style={styles.addPhotoButtonText}>+</Text>
                    <Text style={styles.addPhotoLabel}>사진 추가</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 제출 버튼 */}
        <View style={styles.submitSection}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !disputeType || description.length < 10 || photos.length === 0}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? '제출 중...' : '분쟁 신고'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  disputeTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  disputeTypeCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disputeTypeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  disputeTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  disputeTypeIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  disputeTypeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disputeTypeLabel: {
    ...Typography.body1,
    color: Colors.text,
    fontWeight: '600',
  },
  selectedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  selectedBadgeText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
  },
  disputeTypeDescription: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  urgencyLevelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  urgencyLevelCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urgencyLevelCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  urgencyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  urgencyLabel: {
    ...Typography.body1,
    color: Colors.text,
  },
  descriptionInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body1,
    color: Colors.text,
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
  },
  photoItem: {
    width: 100,
    height: 100,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.md,
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButtonText: {
    fontSize: 32,
    color: Colors.textSecondary,
    fontWeight: '300',
  },
  addPhotoLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  submitSection: {
    padding: Spacing.md,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.border,
  },
  submitButtonText: {
    ...Typography.h3,
    color: Colors.white,
    fontWeight: '700',
  },
});
