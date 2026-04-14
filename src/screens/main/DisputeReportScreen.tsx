import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import { createPhotoService, takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

type DisputeRoute = RouteProp<MainStackParamList, 'DisputeReport'>;
type DisputeType = 'damage' | 'loss' | 'delay' | 'other';
type UrgencyLevel = 'normal' | 'urgent' | 'critical';

const disputeTypes: Array<{ value: DisputeType; label: string; helper: string }> = [
  { value: 'damage', label: '파손', helper: '물품이 훼손되었거나 상태가 달라졌을 때 선택해 주세요.' },
  { value: 'loss', label: '분실', helper: '물품이 확인되지 않거나 인계가 누락된 경우에 해당합니다.' },
  { value: 'delay', label: '지연', helper: '예정된 시간보다 크게 늦어져 운영 확인이 필요한 경우입니다.' },
  { value: 'other', label: '기타', helper: '위 유형에 딱 맞지 않는 운영 이슈를 남겨 주세요.' },
];

const urgencyLevels: Array<{ value: UrgencyLevel; label: string }> = [
  { value: 'normal', label: '일반' },
  { value: 'urgent', label: '긴급' },
  { value: 'critical', label: '매우 긴급' },
];

export default function DisputeReportScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<DisputeRoute>();
  const { deliveryId, matchId } = route.params;

  const [disputeType, setDisputeType] = useState<DisputeType>('damage');
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const helperText = useMemo(
    () => disputeTypes.find((item) => item.value === disputeType)?.helper ?? '',
    [disputeType]
  );

  const handleAddEvidence = async (): Promise<void> => {
    try {
      setUploadingPhoto(true);
      const photoUri = await takePhoto();
      if (!photoUri) {
        return;
      }

      const userId = requireUserId();
      const uploaded = await uploadPhotoWithThumbnail(photoUri, userId, 'dispute-evidence');
      setEvidenceUrls((current) => [...current, uploaded.url]);
    } catch (error) {
      console.error('Failed to upload dispute evidence:', error);
      Alert.alert('증빙 업로드 실패', '사진 업로드 중 문제가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (description.trim().length < 10) {
      Alert.alert('설명을 더 적어 주세요', '운영 검토가 가능하도록 10자 이상 작성해 주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const userId = requireUserId();
      const requestId = deliveryId ?? matchId ?? `manual-${Date.now()}`;
      const reporterType = 'requester';

      const dispute = await createPhotoService().reportDispute(
        userId,
        reporterType,
        requestId,
        disputeType,
        description.trim(),
        evidenceUrls,
        {
          deliveryId,
          matchId,
          urgency,
          evidenceUrls,
        }
      );

      Alert.alert('분쟁 신고 접수 완료', '운영팀이 증빙과 배송 이력을 함께 확인한 뒤 다음 조치를 안내합니다.', [
        {
          text: '처리 화면 보기',
          onPress: () => navigation.replace('DisputeResolution', { disputeId: dispute.disputeId }),
        },
      ]);
    } catch (error) {
      console.error('Failed to submit dispute:', error);
      Alert.alert('분쟁 신고 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>분쟁 신고</Text>
        <Text style={styles.subtitle}>
          파손, 분실, 지연 같은 이슈를 운영팀에 바로 전달합니다. 설명과 사진 증빙을 함께 남기면 처리 속도가 빨라집니다.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>분쟁 유형</Text>
        <View style={styles.chipGrid}>
          {disputeTypes.map((item) => {
            const active = disputeType === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.chip, active ? styles.chipActive : undefined]}
                onPress={() => setDisputeType(item.value)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.helperText}>{helperText}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>긴급도</Text>
        <View style={styles.chipGrid}>
          {urgencyLevels.map((item) => {
            const active = urgency === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.chip, active ? styles.chipActive : undefined]}
                onPress={() => setUrgency(item.value)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>상세 설명</Text>
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          placeholder="무슨 일이 있었는지, 어떤 확인이 필요한지 적어 주세요."
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>사진 증빙</Text>
        <Text style={styles.helperText}>
          현재는 카메라 촬영 후 업로드한 사진 URL을 운영 검토 증빙으로 저장합니다.
        </Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleAddEvidence()} disabled={uploadingPhoto}>
          {uploadingPhoto ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>증빙 사진 추가</Text>
          )}
        </TouchableOpacity>
        {evidenceUrls.map((url, index) => (
          <Text key={url} style={styles.evidenceItem}>
            {index + 1}. {url}
          </Text>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSubmit()} disabled={submitting}>
        {submitting ? <ActivityIndicator size="small" color={Colors.surface} /> : <Text style={styles.primaryButtonText}>분쟁 접수하기</Text>}
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
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSize['3xl'],
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
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryMint,
  },
  chipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.primary,
  },
  helperText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    backgroundColor: Colors.gray100,
    color: Colors.textPrimary,
  },
  descriptionInput: {
    minHeight: 120,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryMint,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  evidenceItem: {
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },
});
