import { Colors } from '../../theme';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import { getCurrentLocation } from '../../utils/permission-handler';
import * as Location from 'expo-location';

type CompletionRoute = RouteProp<MainStackParamList, 'DeliveryCompletion'>;

export default function DeliveryCompletionScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<CompletionRoute>();
  const { deliveryId } = route.params;

  const [delivery, setDelivery] = useState<Record<string, unknown> | null>(null);
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
        <Text style={styles.subtitle}>
          수령 코드와 완료 사진을 확인해 배송을 마감합니다. 필요하면 먼저 도착 처리부터 진행할 수 있어요.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>현재 상태</Text>
        <Text style={styles.statusText}>{deliveryStatus}</Text>
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
          <Text style={styles.helperText}>물품 인계가 끝난 상태와 수령 위치가 함께 보이도록 촬영해 주세요.</Text>
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
            placeholder="선택 입력입니다. 지연 사유나 전달 특이사항이 있으면 남겨 주세요."
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>배송 완료 기록</Text>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
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
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statusText: {
    fontSize: 15,
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
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  block: {
    gap: 12,
  },
  helperText: {
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});
