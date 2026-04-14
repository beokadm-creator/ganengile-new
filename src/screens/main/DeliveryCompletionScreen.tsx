import { Colors , Typography } from '../../theme';
import React, { useCallback, useEffect, useState } from 'react';
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
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { requireUserId } from '../../services/firebase';
import {
  completeDelivery,
  getDeliveryById,
  markAsArrived,
  type DeliveryCompletionData,
} from '../../services/delivery-service';
import { buildMissionExecutionGuideFromRequest } from '../../services/giller-mission-execution-service';
import { getRequestById } from '../../services/request-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import { getCurrentLocation } from '../../utils/permission-handler';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { SwipeButton } from '../../components/common/SwipeButton';

type CompletionRoute = RouteProp<MainStackParamList, 'DeliveryCompletion'>;

export default function DeliveryCompletionScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<CompletionRoute>();
  const { deliveryId } = route.params;

  const [delivery, setDelivery] = useState<Record<string, unknown> | null>(null);
  const [guide, setGuide] = useState(() => buildMissionExecutionGuideFromRequest(null));
  const [verificationCode, setVerificationCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDelivery, setLoadingDelivery] = useState(true);
  const [markingArrived, setMarkingArrived] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const loadDelivery = useCallback(async (): Promise<void> => {
    try {
      setLoadingDelivery(true);
      const result = await getDeliveryById(deliveryId);
      setDelivery((result as Record<string, unknown> | null) ?? null);
      const requestId =
        result && typeof (result as { requestId?: unknown }).requestId === 'string'
          ? ((result as { requestId?: string }).requestId ?? '')
          : '';
      if (requestId) {
        const request = await getRequestById(requestId).catch(() => null);
        setGuide(buildMissionExecutionGuideFromRequest(request));
      } else {
        setGuide(buildMissionExecutionGuideFromRequest(null));
      }
    } catch (error) {
      console.error('Failed to load delivery:', error);
      Alert.alert('배송 정보를 불러오지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoadingDelivery(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    void loadDelivery();
  }, [loadDelivery]);

  const deliveryStatus =
    typeof delivery?.status === 'string' && delivery.status.trim().length > 0
      ? delivery.status
      : 'status_unavailable';
  const requesterOrOwnerId =
    typeof delivery?.gllerId === 'string'
      ? delivery.gllerId
      : typeof delivery?.requesterId === 'string'
        ? delivery.requesterId
        : '';
  const arrivalReady = deliveryStatus.toLowerCase().includes('arrival_pending');
  const completionReady = verificationCode.trim().length === 6;

  const handleMarkArrived = async (): Promise<void> => {
    try {
      setMarkingArrived(true);
      const result = await markAsArrived(deliveryId);
      Alert.alert(result.success ? '도착 처리 완료' : '도착 처리 실패', result.message, [
        {
          text: '확인',
          onPress: () => {
            void loadDelivery();
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to mark arrived:', error);
      Alert.alert('도착 처리 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setMarkingArrived(false);
    }
  };

  const handleCapturePhoto = async (): Promise<void> => {
    try {
      setPhotoLoading(true);
      const userId = requireUserId();
      const capturedUri = await takePhoto();
      if (!capturedUri) {
        return;
      }

      const uploaded = await uploadPhotoWithThumbnail(capturedUri, userId, 'delivery_completion');
      setPhotoUri(uploaded.url);
    } catch (error) {
      console.error('Failed to capture delivery photo:', error);
      Alert.alert('사진 업로드 실패', '완료 증빙 사진을 다시 촬영해 주세요.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleComplete = async (): Promise<void> => {
    if (verificationCode.trim().length !== 6) {
      Alert.alert('수령 코드를 확인해 주세요', '6자리 수령 코드를 입력해야 배송 완료를 처리할 수 있어요.');
      return;
    }

    try {
      setLoading(true);
      const gillerId = requireUserId();
      const currentLocation = await getCurrentLocation({
        showSettingsAlert: true,
        accuracy: Location.Accuracy.Balanced,
      });

      if (!currentLocation) {
        Alert.alert('위치 확인이 필요해요', '현재 위치를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      const payload: DeliveryCompletionData = {
        deliveryId,
        gillerId,
        verificationCode: verificationCode.trim(),
        photoUri: photoUri ?? undefined,
        notes: notes || undefined,
        location: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
      };

      const result = await completeDelivery(payload);

      if (!result.success) {
        Alert.alert('배송 완료 실패', result.message);
        return;
      }

      Alert.alert('배송 완료', '수령 확인이 반영됐어요. 이제 평가 단계로 이동합니다.', [
        {
          text: '평가하기',
          onPress: () =>
            navigation.replace('Rating', {
              deliveryId,
              gillerId,
              requesterId: requesterOrOwnerId,
              gllerId: requesterOrOwnerId,
            }),
        },
      ]);
    } catch (error) {
      console.error('Failed to complete delivery:', error);
      Alert.alert('배송 완료 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingDelivery) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>배송 상태를 확인하고 있어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>배송 완료 처리</Text>
        <Text style={styles.subtitle}>도착 처리 후 수령 코드만 맞추면 완료됩니다.</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryChip label={arrivalReady ? '도착 확인 필요' : '도착 처리 확인'} active={arrivalReady} />
          <SummaryChip label={completionReady ? '코드 준비' : '코드 입력'} active={completionReady} />
          <SummaryChip label={photoUri ? '사진 준비' : '사진 선택'} active={Boolean(photoUri)} />
        </View>
        <Text style={styles.summaryText}>지금 필요한 것만 채우고 바로 마감하면 됩니다.</Text>
      </View>

      {guide.pickupGuide || guide.lockerGuide || guide.specialInstructions || guide.recipientSummary ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>전달 안내</Text>
          {guide.pickupGuide ? <Text style={styles.helperText}>인계 위치: {guide.pickupGuide}</Text> : null}
          {guide.lockerGuide ? <Text style={styles.helperText}>사물함: {guide.lockerGuide}</Text> : null}
          {guide.recipientSummary ? <Text style={styles.helperText}>수령인: {guide.recipientSummary}</Text> : null}
          {guide.specialInstructions ? <Text style={styles.helperText}>요청: {guide.specialInstructions}</Text> : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>현재 상태</Text>
        <Text style={styles.statusText}>{formatDeliveryStatus(deliveryStatus)}</Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => void handleMarkArrived()}
          disabled={markingArrived}
        >
          {markingArrived ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>도착 처리하기</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>완료 정보</Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>6자리 수령 코드</Text>
          <TextInput
            style={styles.input}
            placeholder="6자리 수령 코드 입력"
            value={verificationCode}
            onChangeText={(text) => setVerificationCode(text.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
          <View style={styles.codeRow}>
            {Array.from({ length: 6 }).map((_, index) => (
              <View key={`delivery-code-${index}`} style={styles.codeChip}>
                <Text style={styles.codeChipText}>{verificationCode[index] ?? '-'}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.codeLabel}>완료 사진</Text>
          <Text style={styles.helperText}>전달이 끝난 상태가 보이게 한 장만 남기면 됩니다.</Text>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.previewImage} /> : null}
          <TouchableOpacity style={styles.photoButton} onPress={() => void handleCapturePhoto()} disabled={photoLoading}>
            {photoLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.photoButtonText}>{photoUri ? '사진 다시 촬영하기' : '완료 사진 촬영하기'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.notesCard}>
          <Text style={styles.codeLabel}>운영 참고 메모</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="필요할 때만 간단히 남겨 주세요."
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>
      </View>

      <SwipeButton 
        onComplete={handleComplete} 
        title="밀어서 배송 완료" 
        disabled={loading || verificationCode.trim().length !== 6 || photoLoading}
      />
    </ScrollView>
  );
}

function formatDeliveryStatus(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes('arrival_pending')) {
    return '도착 확인 전';
  }
  if (normalized.includes('handover_pending')) {
    return '인계 대기 중';
  }
  if (normalized.includes('in_progress')) {
    return '이동 중';
  }
  if (normalized.includes('accepted')) {
    return '출발 준비';
  }
  if (normalized.includes('completed')) {
    return '완료됨';
  }

  return status;
}

function SummaryChip({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.summaryChip, active ? styles.summaryChipActive : undefined]}>
      <Text style={[styles.summaryChipText, active ? styles.summaryChipTextActive : undefined]}>{label}</Text>
    </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
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
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  summaryChipActive: {
    backgroundColor: Colors.primaryMint,
  },
  summaryChipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  summaryChipTextActive: {
    color: Colors.primary,
  },
  summaryText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
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
  statusText: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  codeBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    backgroundColor: Colors.surface,
  },
  codeLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeChip: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.primaryMint,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeChipText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  secondaryAction: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.border,
  },
  secondaryActionText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  block: {
    gap: 12,
  },
  helperText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: Colors.border,
  },
  photoButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryMint,
  },
  photoButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  notesCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    backgroundColor: Colors.surface,
  },
  notesText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  notesInput: {
    minHeight: 110,
    textAlignVertical: 'top',
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
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.primaryMint,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
});
